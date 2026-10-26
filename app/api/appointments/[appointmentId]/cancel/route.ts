import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { hasPlanFeature } from '@/lib/billing/plan-features';
import { resolveAccessPlanForUser } from '@/services/billing/plan-access.guard';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';
import { dispatchAppointmentAutomations } from '@/lib/automations/dispatch-appointment';

const ROLES = ['owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'] as const;

async function DELETE__unobserved(request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  try {
    const { appointmentId } = await context.params;
    const tenant = await requireTenantAuthorization(request, ROLES);
    if (!tenant.ok) return NextResponse.json({ success: false, error: 'Sem autorização para cancelar a marcação.' }, { status: tenant.status });
    if (tenant.role !== 'owner') {
      const { data: grant, error } = await tenant.admin.from('barbershop_member_permissions').select('permissions').eq('barbershop_id', tenant.barbershopId).eq('user_id', tenant.userId).maybeSingle();
      if (error) return NextResponse.json({ success: false, error: 'Não foi possível validar as permissões.' }, { status: 503 });
      const permissions = grant?.permissions && typeof grant.permissions === 'object' ? grant.permissions as Record<string, unknown> : {};
      let allowed = permissions.agenda === true || permissions.appointments === true;
      if (!grant) {
        const legacy = await tenant.admin.from('staff_permissions').select('allowed').eq('barbershop_id', tenant.barbershopId).eq('user_id', tenant.userId).in('permission', ['agenda', 'appointments']).eq('allowed', true).limit(1).maybeSingle();
        if (legacy.error) return NextResponse.json({ success: false, error: 'Não foi possível validar as permissões.' }, { status: 503 });
        allowed = legacy.data?.allowed === true;
      }
      if (!allowed) return NextResponse.json({ success: false, error: 'Sem permissão para cancelar marcações.' }, { status: 403 });
    }
    const plan = await resolveAccessPlanForUser(tenant.userId);
    if (!hasPlanFeature(plan, 'appointments')) return NextResponse.json({ success: false, error: 'A agenda não está incluída no plano.' }, { status: 403 });

    const { data: appointment, error } = await tenant.admin.from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId).eq('barbershop_id', tenant.barbershopId)
      .in('status', ['pending', 'scheduled'])
      .select('id,client_id,manual_email,manual_name,service_id').maybeSingle();
    if (error) return NextResponse.json({ success: false, error: 'Não foi possível cancelar a marcação.' }, { status: 503 });
    if (!appointment) return NextResponse.json({ success: false, error: 'Marcação não encontrada ou já processada.' }, { status: 409 });

    let serviceName: string | null = null;
    if (appointment.service_id) {
      const service = await tenant.admin.from('services').select('name').eq('id', appointment.service_id).eq('barbershop_id', tenant.barbershopId).maybeSingle();
      serviceName = service.data?.name ?? null;
    }
    void dispatchAppointmentAutomations('booking_cancelled', {
      appointmentId: appointment.id, barbershopId: tenant.barbershopId,
      clientId: appointment.client_id, manualEmail: appointment.manual_email,
      manualName: appointment.manual_name, serviceName,
    });
    return NextResponse.json({ success: true, appointment: { id: appointment.id, status: 'cancelled' } });
  } catch (error) {
    console.error('[MOBILE_APPOINTMENT_CANCEL_ERROR]', error instanceof Error ? error.name : 'UNKNOWN');
    return NextResponse.json({ success: false, error: 'Erro interno ao cancelar a marcação.' }, { status: 500 });
  }
}
export const DELETE = withApiObservability('/api/appointments/[appointmentId]/cancel', DELETE__unobserved);
