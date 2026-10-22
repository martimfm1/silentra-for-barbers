import { withApiObservability } from '@/lib/observability/api';
import { dispatchAppointmentAutomations } from '@/lib/automations/dispatch-appointment';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A four-hour grace period avoids completing appointments merely because their
// start time has passed. Only rows still in "scheduled" can transition, making
// concurrent/retried cron invocations safe.
const COMPLETION_GRACE_HOURS = 4;
const BATCH_SIZE = 100;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
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
  const cutoff = new Date(Date.now() - COMPLETION_GRACE_HOURS * 60 * 60 * 1000).toISOString();
  const admin = createAdminClient();

  try {
    // The conditional update is the concurrency guard: retries only transition
    // appointments that are still scheduled and therefore cannot double-complete.
    const { data: completed, error } = await admin
      .from('appointments')
      .update({ status: 'completed' })
      .eq('status', 'scheduled')
      .lt('date_hour', cutoff)
      .order('date_hour', { ascending: true })
      .limit(BATCH_SIZE)
      .select('id,barbershop_id,client_id');

    if (error) throw error;

    let automationFailures = 0;
    for (const appointment of completed ?? []) {
      try {
        await dispatchAppointmentAutomations('booking_completed', {
          appointmentId: appointment.id,
          barbershopId: appointment.barbershop_id,
          clientId: appointment.client_id,
        });
      } catch {
        // The lifecycle transition is committed; report automation failure
        // separately instead of retrying the state transition.
        automationFailures += 1;
      }
    }

    const result = {
      ok: true,
      requestId,
      cutoff,
      processed: completed?.length ?? 0,
      automationFailures,
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
