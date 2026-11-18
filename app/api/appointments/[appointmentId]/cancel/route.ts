import { withApiObservability } from '@/lib/observability/api';
import { recordAppointmentActivity } from '@/lib/appointments/activity';
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
            {
              success: false,
              error: 'Não foi possível validar as permissões.',
            },
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
        .select('status,date_hour,payment_status')
        .eq('id', appointmentId)
        .eq('barbershop_id', tenant.barbershopId)
        .in('status', ['pending', 'scheduled'])
        .maybeSingle();

    if (currentAppointmentError)
      return NextResponse.json(
        {
          success: false,
          error: 'Não foi possível consultar o estado do pagamento.',
        },
        { status: 503 },
      );

    const { data: cancellingUser } = await tenant.admin
      .from('users')
      .select('name_complete')
      .eq('id', tenant.userId)
      .eq('barbershop_id', tenant.barbershopId)
      .maybeSingle();

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
        cancellation_actor: 'staff',
        cancellation_actor_name:
          cancellingUser?.name_complete?.trim() || tenant.role,
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

    await recordAppointmentActivity(tenant.admin, {
      barbershopId: tenant.barbershopId,
      appointmentId: appointment.id,
      event: 'cancelled',
      actorType: 'staff',
      actorId: tenant.userId,
      actorName: cancellingUser?.name_complete?.trim() || null,
      metadata: {
        previousStatus: currentAppointment?.status ?? null,
        newStatus: 'cancelled',
        from: currentAppointment?.date_hour ?? null,
      },
    });

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
              .select('name_complete')
              .eq('id', appointment.client_id)
              .eq('barbershop_id', tenant.barbershopId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

    const customerEmail = appointment.manual_email?.trim().toLowerCase() || '';
    const customerName =
      appointment.manual_name?.trim() ||
      clientResult.data?.name_complete?.trim() ||
      'Cliente';
    const barbershopName = shopResult.data?.name?.trim() || 'A tua barbearia';
    const language = shopResult.data?.default_language === 'en' ? 'en' : 'pt';

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
      : null;

    const { data: cancellationActivity, error: cancellationActivityError } =
      await tenant.admin
        .from('audit_logs')
        .select('id,metadata')
        .eq('barbershop_id', tenant.barbershopId)
        .eq('entity_type', 'appointment')
        .eq('entity_id', appointment.id)
        .eq('action', 'appointment.cancelled')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (cancellationActivityError) {
      console.error('[APPOINTMENT_CANCELLATION_ACTIVITY_LOOKUP_FAILED]', {
        code: cancellationActivityError.code ?? 'UNKNOWN',
      });
    } else if (cancellationActivity) {
      const { error: activityUpdateError } = await tenant.admin
        .from('audit_logs')
        .update({
          metadata: {
            ...((cancellationActivity.metadata ?? {}) as Record<string, unknown>),
            notificationSent: emailResult?.success ?? false,
            notificationSkipped: !customerEmail,
            notificationRetryCount: 0,
          },
        })
        .eq('id', cancellationActivity.id)
        .eq('barbershop_id', tenant.barbershopId);
      if (activityUpdateError) {
        console.error('[APPOINTMENT_CANCELLATION_ACTIVITY_UPDATE_FAILED]', {
          code: activityUpdateError.code ?? 'UNKNOWN',
        });
      }
    }

    if (emailResult && !emailResult.success) {
      console.error('[APPOINTMENT_CANCELLATION_EMAIL_FAILED]', {
        appointmentId: appointment.id,
        reasonCode:
          'errorCode' in emailResult
            ? emailResult.errorCode
            : 'EMAIL_SEND_FAILED',
        hasRecipient: true,
        // Never log the recipient or a provider response that could contain PII.
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
      emailSent: emailResult?.success ?? false,
      emailSkipped: !customerEmail,
      emailError: emailResult && !emailResult.success ? emailResult.error : null,
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
