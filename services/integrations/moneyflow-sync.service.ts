import { createAdminClient } from '@/lib/supabase/admin';

const MONEYFLOW_API_URL = (
  process.env.MONEYFLOW_API_URL || 'https://moneyflow.silentra.me'
).replace(/\/$/, '');

type SyncEvent = {
  id: string;
  event_key: string;
  payload: {
    eventId?: string;
    amount?: number;
    currency?: string;
    occurredAt?: string;
    description?: string;
    externalReference?: string;
  };
  attempts: number;
};

export type MoneyFlowDispatchResult = {
  connected: boolean;
  claimed: number;
  sent: number;
  failed: number;
};

export async function dispatchMoneyFlowSyncBatch(
  batchSize = 25,
): Promise<MoneyFlowDispatchResult> {
  const admin = createAdminClient();
  const result: MoneyFlowDispatchResult = {
    connected: false,
    claimed: 0,
    sent: 0,
    failed: 0,
  };

  try {
    const { data: credential, error: credentialError } = await admin
      .from('moneyflow_sync_credentials')
      .select('sync_token,status')
      .eq('integration_key', 'silentra-platform')
      .maybeSingle();

    if (credentialError) throw credentialError;
    if (!credential || credential.status !== 'connected') return result;

    result.connected = true;
    const { data: events, error: claimError } = await admin.rpc(
      'claim_moneyflow_sync_events',
      { p_batch_size: Math.max(1, Math.min(batchSize, 100)) },
    );
    if (claimError) throw claimError;

    const claimed = (events ?? []) as SyncEvent[];
    result.claimed = claimed.length;

    for (const event of claimed) {
      try {
        const payload = event.payload;
        if (
          !payload ||
          typeof payload.eventId !== 'string' ||
          typeof payload.amount !== 'number' ||
          typeof payload.currency !== 'string' ||
          typeof payload.occurredAt !== 'string'
        ) {
          throw new Error('INVALID_OUTBOX_PAYLOAD');
        }

        const response = await fetch(
          `${MONEYFLOW_API_URL}/api/integrations/silentra-for-barbers/events`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
            },
            body: JSON.stringify({ ...payload, eventSecret: credential.sync_token }),
            cache: 'no-store',
            signal: AbortSignal.timeout(10_000),
          },
        );

        const responseBody = (await response.json().catch(() => null)) as
          | { ok?: boolean; error?: string }
          | null;

        if (!response.ok || responseBody?.ok !== true) {
          if (response.status === 401 || response.status === 403) {
            await admin
              .from('moneyflow_sync_credentials')
              .update({ status: 'disconnected', updated_at: new Date().toISOString() })
              .eq('integration_key', 'silentra-platform');
          }
          throw new Error(
            response.status === 401 || response.status === 403
              ? 'MONEYFLOW_UNAUTHORIZED'
              : `MONEYFLOW_HTTP_${response.status}`,
          );
        }

        const { data: completed, error: completeError } = await admin.rpc(
          'complete_moneyflow_sync_event',
          { p_event_id: event.id },
        );
        if (completeError || completed !== true) {
          throw new Error('OUTBOX_ACKNOWLEDGEMENT_FAILED');
        }
        result.sent += 1;
      } catch (error) {
        result.failed += 1;
        const code =
          error instanceof Error &&
          /^[A-Za-z0-9_.:-]{1,80}$/.test(error.message)
            ? error.message
            : 'DELIVERY_FAILED';

        await admin.rpc('fail_moneyflow_sync_event', {
          p_event_id: event.id,
          p_error: code,
        });

        if (code === 'MONEYFLOW_UNAUTHORIZED') break;
      }
    }

    return result;
  } catch (error) {
    console.error('[MONEYFLOW_SYNC_BATCH_FAILED]', {
      error: error instanceof Error ? error.name : 'UNKNOWN',
    });
    return result;
  }
}
