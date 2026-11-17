import type { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

export type AppointmentActivityActor = 'staff' | 'customer' | 'system';

export type AppointmentActivityEvent =
  | 'created'
  | 'confirmed'
  | 'rescheduled'
  | 'cancelled'
  | 'completed';

export async function recordAppointmentActivity(
  admin: AdminClient,
  input: {
    barbershopId: string;
    appointmentId: string;
    event: AppointmentActivityEvent;
    actorType: AppointmentActivityActor;
    actorId?: string | null;
    actorName?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
  },
): Promise<void> {
  const { error } = await admin.from('audit_logs').insert({
    action: `appointment.${input.event}`,
    entity_type: 'appointment',
    entity_id: input.appointmentId,
    barbershop_id: input.barbershopId,
    actor_id: input.actorId ?? null,
    actor_type: input.actorType,
    actor_name: input.actorName?.trim().slice(0, 120) || null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    // Appointment mutations must not be rolled back by a secondary audit write,
    // but failures are visible to server monitoring for investigation.
    console.error('[APPOINTMENT_ACTIVITY_WRITE_FAILED]', {
      event: input.event,
      code: error.code ?? 'UNKNOWN',
    });
  }
}
