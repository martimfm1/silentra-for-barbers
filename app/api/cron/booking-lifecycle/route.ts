import { withApiObservability } from '@/lib/observability/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.headers.get('x-cron-secret') === secret
  );
}

async function GET__unobserved(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const admin = createAdminClient();
    // Use the canonical SQL worker so per-shop auto-completion preferences are
    // respected. The appointment status trigger writes durable outbox events.
    const { data, error } = await admin.rpc('process_automatic_booking_completion');
    if (error) throw error;

    const result = {
      ok: true,
      requestId,
      completed: Number(data ?? 0),
      durationMs: Date.now() - startedAt,
    };
    console.info('[BOOKING_LIFECYCLE_CRON] completed', result);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[BOOKING_LIFECYCLE_CRON] failed', {
      requestId,
      error: error instanceof Error ? error.message : 'UNKNOWN',
    });
    return NextResponse.json(
      { ok: false, requestId, error: 'Booking lifecycle worker failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = withApiObservability('/api/cron/booking-lifecycle', GET__unobserved);
