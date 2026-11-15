import { createAdminClient } from '@/lib/supabase/admin';

type OutboxEvent = {
  id: string;
  event_key: string;
  payload: Record<string, unknown>;
  attempts: number;
};

type OutboxSummary = {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  disconnected: boolean;
};

function getMoneyFlowBaseUrl() {
  const value = (
    process.env.MONEYFLOW_API_URL ?? 'https://moneyflow.silentra.me'
  ).trim();
  const url = new URL(value);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('MoneyFlow endpoint must use HTTPS.');
  }
  return url.toString().replace(/\/$/, '');
}

function backoffMs(attempts: number) {
  const exponent = Math.max(0, Math.min(attempts - 1, 7));
  return Math.min(30 * 60 * 1000, 15_000 * 2 ** exponent);
}

async function updateEvent(
  admin: ReturnType<typeof createAdminClient>,
  event: OutboxEvent,
  status: 'sent' | 'pending' | 'failed',
  lastError: string | null,
  delayMs = 0,
) {
  const now = new Date();
  const { error } = await admin
    .from('moneyflow_sync_outbox')
    .update({
      status,
      sent_at: status === 'sent' ? now.toISOString() : null,
      locked_at: null,
      available_at: new Date(now.getTime() + delayMs).toISOString(),
      last_error: lastError,
      updated_at: now.toISOString(),
    })
    .eq('id', event.id);

  if (error) {
    console.error('[MONEYFLOW_OUTBOX_UPDATE_FAILED]', {
      eventId: event.event_key,
      code: error.code ?? 'UNKNOWN',
    });
  }
}

export async function dispatchMoneyFlowOutboxBatch(
  batchSize = 50,
): Promise<OutboxSummary> {
  const summary: OutboxSummary = {
    claimed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    disconnected: false,
  };

  const admin = createAdminClient();
  const { data: credentials, error: credentialError } = await admin
    .from('moneyflow_sync_credentials')
    .select('sync_token, status')
    .eq('integration_key', 'silentra-platform')
    .maybeSingle();

  if (credentialError) {
    throw new Error('MONEYFLOW_CREDENTIAL_READ_FAILED');
  }

  const syncToken =
    credentials?.status === 'connected' ? credentials.sync_token : null;
  if (!syncToken) {
    summary.disconnected = true;
    return summary;
  }

  const { data, error } = await admin.rpc('claim_moneyflow_sync_events', {
    p_batch_size: Math.max(1, Math.min(batchSize, 50)),
  });

  if (error) {
    throw new Error('MONEYFLOW_OUTBOX_CLAIM_FAILED');
  }

  const events = (data ?? []) as OutboxEvent[];
  summary.claimed = events.length;
  if (!events.length) return summary;

  const endpoint = `${getMoneyFlowBaseUrl()}/api/integrations/silentra-for-barbers/events`;

  for (const event of events) {
    const payload = event.payload ?? {};
    const amount = Number(payload.amount);
    const currency =
      typeof payload.currency === 'string' ? payload.currency.toUpperCase() : '';
    const occurredAt =
      typeof payload.occurredAt === 'string'
        ? payload.occurredAt
        : new Date().toISOString();
    const description =
      typeof payload.description === 'string'
        ? payload.description.slice(0, 160)
        : 'Subscrição Silentra for Barbers';

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      currency !== 'EUR' ||
      !Number.isFinite(Date.parse(occurredAt))
    ) {
      await updateEvent(
        admin,
        event,
        'failed',
        'INVALID_OUTBOX_PAYLOAD',
      );
      summary.failed += 1;
      continue;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventSecret: syncToken,
          eventId:
            typeof payload.eventId === 'string'
              ? payload.eventId
              : event.event_key,
          amount,
          currency,
          occurredAt,
          description,
          externalReference:
            typeof payload.externalReference === 'string'
              ? payload.externalReference.slice(0, 200)
              : null,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });

      const responsePayload = await response.json().catch(() => null);
      if (response.ok && responsePayload?.ok === true) {
        await updateEvent(admin, event, 'sent', null);
        await admin
          .from('moneyflow_sync_credentials')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('integration_key', 'silentra-platform');
        summary.sent += 1;
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        await admin
          .from('moneyflow_sync_credentials')
          .update({
            status: 'disconnected',
            sync_token: '',
            updated_at: new Date().toISOString(),
          })
          .eq('integration_key', 'silentra-platform');

        for (const pending of events.slice(events.indexOf(event))) {
          await updateEvent(
            admin,
            pending,
            'pending',
            'INTEGRATION_DISCONNECTED',
            60 * 60 * 1000,
          );
          summary.retried += 1;
        }

        summary.disconnected = true;
        break;
      }

      const permanentFailure =
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 408 &&
        response.status !== 429;
      if (permanentFailure || event.attempts >= 10) {
        await updateEvent(
          admin,
          event,
          'failed',
          `MONEYFLOW_HTTP_${response.status}`,
        );
        summary.failed += 1;
      } else {
        await updateEvent(
          admin,
          event,
          'pending',
          `MONEYFLOW_HTTP_${response.status}`,
          backoffMs(event.attempts),
        );
        summary.retried += 1;
      }
    } catch {
      if (event.attempts >= 10) {
        await updateEvent(admin, event, 'failed', 'MONEYFLOW_NETWORK_ERROR');
        summary.failed += 1;
      } else {
        await updateEvent(
          admin,
          event,
          'pending',
          'MONEYFLOW_NETWORK_ERROR',
          backoffMs(event.attempts),
        );
        summary.retried += 1;
      }
    }
  }

  return summary;
}
