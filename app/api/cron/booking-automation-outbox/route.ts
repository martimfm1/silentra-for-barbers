import { withApiObservability } from '@/lib/observability/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { dispatchAppointmentAutomations } from '@/lib/automations/dispatch-appointment';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 10;

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

  const startedAt = Date.now();
  const admin = createAdminClient();
  const requestId = crypto.randomUUID();

  try {
    const recovery = await admin.rpc('recover_stale_booking_automation_events');
    if (recovery.error) throw recovery.error;

    const { data: events, error } = await admin.rpc(
      'claim_booking_automation_events',
      { p_batch_size: BATCH_SIZE },
    );
    if (error) throw error;

    let completed = 0;
    let failed = 0;
    for (const event of events ?? []) {
      try {
        const { data: appointment, error: appointmentError } = await admin
          .from('appointments')
          .select('id,barbershop_id,client_id,status')
          .eq('id', event.appointment_id)
          .eq('barbershop_id', event.barbershop_id)
          .maybeSingle();

        if (appointmentError) throw appointmentError;
        // A booking could have been changed after the event was queued. Only
        // dispatch a completion event while its current state is still completed.
        if (!appointment || appointment.status !== 'completed') {
          const { error: skipError } = await admin
            .from('booking_automation_outbox')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              last_error: null,
              locked_at: null,
            })
            .eq('id', event.id)
            .eq('status', 'processing');
          if (skipError) throw skipError;
          completed += 1;
          continue;
        }

        const dispatched = await dispatchAppointmentAutomations('booking_completed', {
          appointmentId: appointment.id,
          barbershopId: appointment.barbershop_id,
          clientId: appointment.client_id,
        });
        if (!dispatched) throw new Error('One or more booking automations failed');

        const { error: completeError } = await admin
          .from('booking_automation_outbox')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_error: null,
            locked_at: null,
          })
          .eq('id', event.id)
          .eq('status', 'processing');
        if (completeError) throw completeError;
        completed += 1;
      } catch (error) {
        failed += 1;
        const attempts = Number(event.attempts ?? 1);
        const exhausted = attempts >= MAX_ATTEMPTS;
        const delayMinutes = Math.min(6 * 60, 2 ** Math.min(attempts, 8));
        const message =
          error instanceof Error ? error.message.slice(0, 500) : 'Unknown worker error';
        const { error: updateError } = await admin
          .from('booking_automation_outbox')
          .update({
            status: exhausted ? 'failed' : 'pending',
            available_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
            last_error: message,
            locked_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', event.id)
          .eq('status', 'processing');
        if (updateError) {
          console.error('[BOOKING_AUTOMATION_OUTBOX_UPDATE_FAILED]', {
            requestId,
            eventId: event.id,
            code: updateError.code,
          });
        }
      }
    }

    const result = {
      ok: failed === 0,
      requestId,
      claimed: events?.length ?? 0,
      completed,
      failed,
      recoveredLeases: Number(recovery.data ?? 0),
      durationMs: Date.now() - startedAt,
    };
    console.info('[BOOKING_AUTOMATION_OUTBOX]', result);
    return NextResponse.json(result, {
      status: failed === 0 ? 200 : 207,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[BOOKING_AUTOMATION_OUTBOX_FAILED]', {
      requestId,
      error: error instanceof Error ? error.message : 'UNKNOWN',
    });
    return NextResponse.json(
      { ok: false, requestId, error: 'Booking automation worker failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = withApiObservability(
  '/api/cron/booking-automation-outbox',
  GET__unobserved,
);
