import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { hasPlanFeature } from '@/lib/billing/plan-features';
import { resolveAccessPlanForUser } from '@/services/billing/plan-access.guard';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';
import { dispatchAppointmentAutomations } from '@/lib/automations/dispatch-appointment';
import { sendAppointmentCancellationEmail } from '@/lib/brevo/appointment-cancellation';

const ROLES = [
  'owner',
  'admin',
  'manager',
  'barber',
  'receptionist',
  'staff',
] as const;

async function DELETE__unobserved(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const { appointmentId } = await context.params;
    const tenant = await requireTenantAuthorization(request, ROLES);
    if (!tenant.ok)
      return NextResponse.json(
        { success: false, error: 'Sem autorização para cancelar a marcação.' },
        { status: tenant.status },
      );

    if (tenant.role !== 'owner') {
      const { data: grant, error } = await tenant.admin
        .from('barbershop_member_permissions')
        .select('permissions')
        .eq('barbershop_id', tenant.barbershopId)
        .eq('user_id', tenant.userId)
        .maybeSingle();
      if (error)
        return NextResponse.json(
          { success: false, error: 'Não foi possível validar as permissões.' },
          { status: 503 },
        );

      const permissions =
        grant?.permissions && typeof grant.permissions === 'object'
          ? (grant.permissions as Record<string, unknown>)
          : {};
      let allowed =
        permissions.agenda === true || permissions.appointments === true;

      if (!grant) {
        const legacy = await tenant.admin
          .from('staff_permissions')
          .select('allowed')
          .eq('barbershop_id', tenant.barbershopId)
          .eq('user_id', tenant.userId)
          .in('permission', ['agenda', 'appointments'])
          .eq('allowed', true)
          .limit(1)
          .maybeSingle();
        if (legacy.error)
          return NextResponse.json(
            { success: false, error: 'Não foi possível validar as permissões.' },
            { status: 503 },
          );
        allowed = legacy.data?.allowed === true;
      }

      if (!allowed)
        return NextResponse.json(
          { success: false, error: 'Sem permissão para cancelar marcações.' },
          { status: 403 },
        );
    }

    const plan = await resolveAccessPlanForUser(tenant.userId);
    if (!hasPlanFeature(plan, 'appointments'))
      return NextResponse.json(
        { success: false, error: 'A agenda não está incluída no plano.' },
        { status: 403 },
      );

    const { data: currentAppointment, error: currentAppointmentError } =
      await tenant.admin
        .from('appointments')
        .select('payment_status')
        .eq('id', appointmentId)
        .eq('barbershop_id', tenant.barbershopId)
        .in('status', ['pending', 'scheduled'])
        .maybeSingle();

    if (currentAppointmentError)
      return NextResponse.json(
        { success: false, error: 'Não foi possível consultar o estado do pagamento.' },
        { status: 503 },
      );

    const cancelledAt = new Date().toISOString();
    const isPrepaymentReview =
      currentAppointment?.payment_status === 'awaiting_review';
    const paymentReviewUpdate = isPrepaymentReview
      ? {
          payment_status: 'rejected',
          payment_reviewed_at: cancelledAt,
          cancellation_reason: 'Pré-pagamento MB WAY rejeitado pelo barbeiro.',
        }
      : {};

    const { data: appointment, error } = await tenant.admin
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: cancelledAt,
        ...paymentReviewUpdate,
      })
      .eq('id', appointmentId)
      .eq('barbershop_id', tenant.barbershopId)
      .in('status', ['pending', 'scheduled'])
      .select(
        'id,date_hour,client_id,manual_email,manual_name,service_id,professional_id,payment_status',
      )
      .maybeSingle();

    if (error)
      return NextResponse.json(
        { success: false, error: 'Não foi possível cancelar a marcação.' },
        { status: 503 },
      );
    if (!appointment)
      return NextResponse.json(
        { success: false, error: 'Marcação não encontrada ou já processada.' },
        { status: 409 },
      );

    const [shopResult, serviceResult, professionalResult, clientResult] =
      await Promise.all([
        tenant.admin
          .from('barbershops')
          .select('name,default_language')
          .eq('id', tenant.barbershopId)
          .maybeSingle(),
        appointment.service_id
          ? tenant.admin
              .from('services')
              .select('name')
              .eq('id', appointment.service_id)
              .eq('barbershop_id', tenant.barbershopId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        appointment.professional_id
          ? tenant.admin
              .from('professionals')
              .select('name')
              .eq('id', appointment.professional_id)
              .eq('barbershop_id', tenant.barbershopId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        appointment.client_id
          ? tenant.admin
              .from('users')
              .select('email,name_complete')
              .eq('id', appointment.client_id)
              .eq('barbershop_id', tenant.barbershopId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

    const customerEmail =
      appointment.manual_email?.trim() ||
      clientResult.data?.email?.trim() ||
      '';
    const customerName =
      appointment.manual_name?.trim() ||
      clientResult.data?.name_complete?.trim() ||
      'Cliente';
    const barbershopName = shopResult.data?.name?.trim() || 'A tua barbearia';
    const language =
      shopResult.data?.default_language === 'en' ? 'en' : 'pt';

    const emailResult = customerEmail
      ? await sendAppointmentCancellationEmail({
          to: customerEmail,
          clientName: customerName,
          serviceName: serviceResult.data?.name?.trim() || 'Serviço',
          professionalName: professionalResult.data?.name?.trim() || null,
          dateHour: appointment.date_hour,
          appointmentId: appointment.id,
          barbershopName,
          language,
        })
      : {
          success: false as const,
          error:
            language === 'en'
              ? 'There is no email address registered for this customer.'
              : 'Não existe um endereço de email registado para este cliente.',
        };

    if (!emailResult.success) {
      console.error('[APPOINTMENT_CANCELLATION_EMAIL_FAILED]', {
        appointmentId: appointment.id,
        barbershopId: tenant.barbershopId,
        reason: emailResult.error,
      });
    }

    // Keep optional marketing automations separate from the mandatory
    // transactional cancellation notice sent above.
    void dispatchAppointmentAutomations('booking_cancelled', {
      appointmentId: appointment.id,
      barbershopId: tenant.barbershopId,
      clientId: appointment.client_id,
      manualEmail: appointment.manual_email,
      manualName: appointment.manual_name,
      serviceName: serviceResult.data?.name ?? null,
    });

    return NextResponse.json({
      success: true,
      emailSent: emailResult.success,
      emailError: emailResult.success ? null : emailResult.error,
      appointment: {
        id: appointment.id,
        status: 'cancelled',
        prepaymentRejected: isPrepaymentReview,
      },
    });
  } catch (error) {
    console.error(
      '[MOBILE_APPOINTMENT_CANCEL_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { success: false, error: 'Erro interno ao cancelar a marcação.' },
      { status: 500 },
    );
  }
}

export const DELETE = withApiObservability(
  '/api/appointments/[appointmentId]/cancel',
  DELETE__unobserved,
);
