import { timingSafeEqual } from 'node:crypto';
import { withApiObservability } from '@/lib/observability/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 10;
const MONEYFLOW_BASE_URL = 'https://moneyflow.silentra.me';

function isAuthorized(request: Request) {
  const secret = (
    process.env.BOOKING_OUTBOX_CRON_SECRET ?? process.env.CRON_SECRET
  )?.trim();
  const header = request.headers.get('authorization') ?? '';
  if (!secret || !header.startsWith('Bearer ')) return false;

  const provided = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return (
    provided.length === expected.length &&
    timingSafeEqual(provided, expected)
  );
}

async function GET__unobserved(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
      );
  }

  const startedAt = Date.now();
  const admin = createAdminClient();

  try {
    const { data: connection, error: connectionError } = await admin
      .from('moneyflow_sync_credentials')
      .select('sync_token,status')
      .eq('integration_key', 'silentra-platform')
      .maybeSingle();

    if (connectionError) throw connectionError;
    if (!connection || connection.status !== 'connected' || !connection.sync_token) {
      return NextResponse.json(
        { ok: true, configured: false, claimed: 0, sent: 0, failed: 0 },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const claimed = await admin.rpc('claim_moneyflow_sync_events', {
      p_batch_size: BATCH_SIZE,
    });
    if (claimed.error) throw claimed.error;

    const queue = claimed.data ?? [];
    let sent = 0;
    let retried = 0;
    let failed = 0;
    const baseUrl = process.env.MONEYFLOW_APP_URL?.trim() || MONEYFLOW_BASE_URL;
    const endpoint = new URL('/api/integrations/silentra/events', baseUrl);
    if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'moneyflow.silentra.me') {
      throw new Error('INVALID_MONEYFLOW_ORIGIN');
    }

    for (const event of queue) {
      let response: Response | null = null;
      let errorCode = 'NETWORK_ERROR';

      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${connection.sync_token}`,
          },
          body: JSON.stringify(event.payload),
          cache: 'no-store',
          signal: AbortSignal.timeout(12_000),
        });
      } catch {
        response = null;
      }

      if (response?.ok) {
        const now = new Date().toISOString();
        const { error: outboxError } = await admin
          .from('moneyflow_sync_outbox')
          .update({
            status: 'sent',
            sent_at: now,
            locked_at: null,
            last_error: null,
            updated_at: now,
          })
          .eq('id', event.id)
          .eq('status', 'processing');

        if (outboxError) {
          console.error('[MONEYFLOW_SYNC_MARK_SENT_FAILED]', {
            eventId: event.id,
            code: outboxError.code ?? 'unknown',
          });
          failed += 1;
          continue;
        }

        await admin
          .from('moneyflow_sync_credentials')
          .update({ last_synced_at: now, updated_at: now })
          .eq('integration_key', 'silentra-platform');

        sent += 1;
        continue;
      }

      if (response) {
        errorCode = `HTTP_${response.status}`;
        // Invalid token, invalid data or unsupported currency are terminal.
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          const { error: updateError } = await admin
            .from('moneyflow_sync_outbox')
            .update({
              status: 'failed',
              locked_at: null,
              last_error: errorCode,
              updated_at: new Date().toISOString(),
            })
            .eq('id', event.id)
            .eq('status', 'processing');
          if (updateError) {
            console.error('[MONEYFLOW_SYNC_MARK_FAILED]', {
              eventId: event.id,
              code: updateError.code ?? 'unknown',
            });
          }
          failed += 1;
          continue;
        }
      }

      const attempts = Number(event.attempts ?? 1);
      const exhausted = attempts >= MAX_ATTEMPTS;
      const delayMinutes = Math.min(6 * 60, 2 ** Math.min(attempts, 8));
      const { error: updateError } = await admin
        .from('moneyflow_sync_outbox')
        .update({
          status: exhausted ? 'failed' : 'pending',
          available_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
          locked_at: null,
          last_error: errorCode,
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id)
        .eq('status', 'processing');

      if (updateError) {
        console.error('[MONEYFLOW_SYNC_RETRY_UPDATE_FAILED]', {
          eventId: event.id,
          code: updateError.code ?? 'unknown',
        });
      }

      if (exhausted) failed += 1;
      else retried += 1;
    }

    const result = {
      ok: failed === 0,
      configured: true,
      claimed: queue.length,
      sent,
      retried,
      failed,
      durationMs: Date.now() - startedAt,
    };
    console.info('[MONEYFLOW_SYNC_OUTBOX]', result);
    return NextResponse.json(result, {
      status: failed === 0 ? 200 : 207,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[MONEYFLOW_SYNC_OUTBOX_FAILED]', {
      error: error instanceof Error ? error.name : 'UNKNOWN',
    });
    return NextResponse.json(
      { ok: false, error: 'MoneyFlow sync worker failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = withApiObservability('/api/cron/moneyflow-sync', GET__unobserved);
export const POST = withApiObservability('/api/cron/moneyflow-sync', GET__unobserved);
