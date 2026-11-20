import { randomUUID } from 'node:crypto';
import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { UUID_PATTERN } from '@/lib/validation';
import { readJsonObject } from '@/lib/security/request-validation';
import { hasPlanFeature } from '@/lib/billing/plan-features';
import { resolveAccessPlanForUser } from '@/services/billing/plan-access.guard';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';
import { sendCustomerAppointmentRescheduledEmail } from '@/lib/brevo/appointment-change-notifications';
import { sendAppointmentCancellationEmail } from '@/lib/brevo/appointment-cancellation';
import { notifyBarberOfAppointmentChange } from '@/lib/brevo/appointment-change-notifications';

const ROLES = ['owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'] as const;

function hasAgendaGrant(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const permissions = value as Record<string, unknown>;
  return permissions.agenda === true || permissions.appointments === true;
}

function isAmbiguousEmailFailure(result: { success: boolean; errorCode?: string }): boolean {
  if (result.success) return false;
  const errorCode = result.errorCode ?? '';
  const httpStatus = Number(/^BREVO_HTTP_([0-9]{3})$/.exec(errorCode)?.[1] ?? 0);
  return (
    errorCode === 'BREVO_NETWORK_ERROR' ||
    !errorCode ||
    httpStatus === 408 ||
    httpStatus >= 500
  );
}

async function POST__unobserved(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const { appointmentId } = await context.params;
    if (!UUID_PATTERN.test(appointmentId)) {
      return NextResponse.json(
        { success: false, error: 'Identificador de marcação inválido.' },
        { status: 400 },
      );
    }

    const tenant = await requireTenantAuthorization(request, ROLES);
    if (!tenant.ok) {
      return NextResponse.json(
        { success: false, error: 'Sem autorização para reenviar notificações.' },
        { status: tenant.status },
      );
    }

    if (tenant.role !== 'owner') {
      const { data: grant, error: grantError } = await tenant.admin
        .from('barbershop_member_permissions')
        .select('permissions')
        .eq('barbershop_id', tenant.barbershopId)
        .eq('user_id', tenant.userId)
        .maybeSingle();
      if (grantError) {
        return NextResponse.json(
          { success: false, error: 'Não foi possível validar as permissões.' },
          { status: 503 },
        );
      }

      let allowed = grant ? hasAgendaGrant(grant.permissions) : false;
      if (!grant) {
        const { data: legacy, error } = await tenant.admin
          .from('staff_permissions')
          .select('allowed')
          .eq('barbershop_id', tenant.barbershopId)
          .eq('user_id', tenant.userId)
          .in('permission', ['agenda', 'appointments'])
          .eq('allowed', true)
          .limit(1)
          .maybeSingle();
        if (error) {
          return NextResponse.json(
            { success: false, error: 'Não foi possível validar as permissões.' },
            { status: 503 },
          );
        }
        allowed = legacy?.allowed === true;
      }
      if (!allowed) {
        return NextResponse.json(
          { success: false, error: 'Sem permissão para reenviar emails da agenda.' },
          { status: 403 },
        );
      }
    }

    const plan = await resolveAccessPlanForUser(tenant.userId);
    if (!hasPlanFeature(plan, 'appointments')) {
      return NextResponse.json(
        { success: false, error: 'A agenda não está incluída no plano.' },
        { status: 403 },
      );
    }

    const bodyResult = await readJsonObject(request, {
      maxBytes: 1024,
      allowedKeys: ['action', 'audience'],
    });
    if (!bodyResult.ok) return bodyResult.response;
    const action = bodyResult.value.action;
    const audience = bodyResult.value.audience === undefined
      ? 'customer'
      : bodyResult.value.audience;
    if (audience !== 'customer' && audience !== 'barbershop') {
      return NextResponse.json(
        { success: false, error: 'Destino da notificação inválido.' },
        { status: 400 },
      );
    }
    if (action !== 'rescheduled' && action !== 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Tipo de notificação inválido.' },
        { status: 400 },
      );
    }

    const { data: latestActivity, error: activityError } = await tenant.admin
      .from('audit_logs')
      .select('id,action,actor_type,actor_name,metadata')
      .eq('barbershop_id', tenant.barbershopId)
      .eq('entity_type', 'appointment')
      .eq('entity_id', appointmentId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activityError) {
      return NextResponse.json(
        { success: false, error: 'Não foi possível consultar o histórico da marcação.' },
        { status: 503 },
      );
    }
    if (!latestActivity || latestActivity.action !== `appointment.${action}` || latestActivity.actor_type !== 'staff') {
      return NextResponse.json(
        { success: false, error: 'Esta notificação já não corresponde à última alteração da marcação.' },
        { status: 409 },
      );
    }

    const metadata = (latestActivity.metadata ?? {}) as Record<string, unknown>;

    if (audience === 'barbershop') {
      if (latestActivity.actor_type !== 'customer') {
        return NextResponse.json(
          { success: false, error: 'Esta alteração não foi iniciada pelo cliente.' },
          { status: 409 },
        );
      }

      // Only a fully failed push channel is retried. Partial delivery is not
      // replayed because we do not persist per-subscription receipts.
      const retryPush = metadata.barberPushStatus === 'failed';
      if (!retryPush) {
        return NextResponse.json(
          { success: false, error: 'Não existe uma notificação push totalmente falhada que possa ser repetida em segurança.' },
          { status: 409 },
        );
      }

      const { data: barberAppointment, error: barberAppointmentError } = await tenant.admin
        .from('appointments')
        .select('id,status,date_hour,barbershop_id,manual_name,service_id,professional_id')
        .eq('id', appointmentId)
        .eq('barbershop_id', tenant.barbershopId)
        .maybeSingle();

      if (barberAppointmentError) {
        return NextResponse.json(
          { success: false, error: 'Não foi possível consultar a marcação.' },
          { status: 503 },
        );
      }
      if (!barberAppointment) {
        return NextResponse.json(
          { success: false, error: 'Marcação não encontrada.' },
          { status: 404 },
        );
      }

      if (action === 'cancelled' && barberAppointment.status !== 'cancelled') {
        return NextResponse.json(
          { success: false, error: 'A marcação já não está cancelada.' },
          { status: 409 },
        );
      }
      if (
        action === 'rescheduled' &&
        (!['pending', 'scheduled'].includes(barberAppointment.status) ||
          typeof metadata.to !== 'string' ||
          Date.parse(metadata.to) !== Date.parse(barberAppointment.date_hour) ||
          typeof metadata.from !== 'string' ||
          Date.parse(metadata.from) === Date.parse(metadata.to))
      ) {
        return NextResponse.json(
          { success: false, error: 'O horário da marcação já foi alterado novamente.' },
          { status: 409 },
        );
      }

      const { data: service, error: serviceError } = barberAppointment.service_id
        ? await tenant.admin
            .from('services')
            .select('name')
            .eq('id', barberAppointment.service_id)
            .eq('barbershop_id', tenant.barbershopId)
            .maybeSingle()
        : { data: null, error: null };

      if (serviceError) {
        return NextResponse.json(
          { success: false, error: 'Não foi possível preparar a notificação.' },
          { status: 503 },
        );
      }

      const claimToken = randomUUID();
      const { data: claimResult, error: claimError } = await tenant.admin.rpc(
        'claim_appointment_barber_notification_retry',
        {
          p_audit_log_id: latestActivity.id,
          p_barbershop_id: tenant.barbershopId,
          p_appointment_id: barberAppointment.id,
          p_action: action,
          p_claim_token: claimToken,
        },
      );

      if (claimError) {
        console.error('[BARBER_NOTIFICATION_RETRY_CLAIM_FAILED]', {
          code: claimError.code ?? 'UNKNOWN',
        });
        return NextResponse.json(
          { success: false, error: 'Não foi possível reservar o reenvio push.' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } },
        );
      }

      const retryCount = Number(claimResult);
      if (!Number.isSafeInteger(retryCount) || retryCount < 1) {
        return NextResponse.json(
          { success: false, error: 'Esta notificação já está a ser repetida ou deixou de ser a mais recente.' },
          { status: 409, headers: { 'Cache-Control': 'no-store' } },
        );
      }

      const notification = await notifyBarberOfAppointmentChange({
        event: action,
        appointmentId: barberAppointment.id,
        barbershopId: tenant.barbershopId,
        professionalId: barberAppointment.professional_id,
        customerName: latestActivity.actor_name?.trim() || barberAppointment.manual_name?.trim() || 'Cliente',
        serviceName: service?.name?.trim() || 'Serviço',
        ...(action === 'cancelled'
          ? { dateHour: barberAppointment.date_hour }
          : {
              previousDateHour: metadata.from as string,
              newDateHour: barberAppointment.date_hour,
            }),
        channels: { email: false, push: true },
      });

      const { data: completed, error: completionError } = await tenant.admin.rpc(
        'complete_appointment_barber_notification_retry',
        {
          p_audit_log_id: latestActivity.id,
          p_barbershop_id: tenant.barbershopId,
          p_claim_token: claimToken,
          p_retry_email: false,
          p_emails_attempted: 0,
          p_emails_sent: 0,
          p_emails_failed: 0,
          p_retry_push: true,
          p_push_sent: notification.pushSent,
          p_push_failed: notification.pushFailed,
        },
      );

      if (completionError || completed !== true) {
        console.error('[BARBER_NOTIFICATION_RETRY_COMPLETION_FAILED]', {
          code: completionError?.code ?? 'CLAIM_NOT_OWNED',
        });
        return NextResponse.json(
          { success: false, retryPending: true, retryCount, error: 'O push foi tentado, mas não foi possível guardar o resultado.' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } },
        );
      }

      if (notification.pushSent === 0) {
        return NextResponse.json(
          { success: false, retryCount, pushSent: 0, pushFailed: notification.pushFailed, error: 'Não foi possível entregar a notificação push.' },
          { status: 502, headers: { 'Cache-Control': 'no-store' } },
        );
      }

      return NextResponse.json(
        { success: true, retryCount, pushSent: notification.pushSent, pushFailed: notification.pushFailed },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (metadata.notificationSent === true) {
      return NextResponse.json(
        { success: false, error: 'O email desta alteração já foi enviado.' },
        { status: 409 },
      );
    }
    if (metadata.notificationSkipped === true) {
      return NextResponse.json(
        { success: false, error: 'Esta marcação não tinha um email de cliente associado.' },
        { status: 409 },
      );
    }
    if (metadata.notificationSent !== false) {
      return NextResponse.json(
        { success: false, error: 'Não existe um envio falhado registado para esta alteração.' },
        { status: 409 },
      );
    }

    const { data: appointment, error: appointmentError } = await tenant.admin
      .from('appointments')
      .select('id,status,date_hour,manual_email,manual_name,client_id,service_id,professional_id')
      .eq('id', appointmentId)
      .eq('barbershop_id', tenant.barbershopId)
      .maybeSingle();
    if (appointmentError) {
      return NextResponse.json(
        { success: false, error: 'Não foi possível consultar a marcação.' },
        { status: 503 },
      );
    }
    if (!appointment) {
      return NextResponse.json(
        { success: false, error: 'Marcação não encontrada.' },
        { status: 404 },
      );
    }

    if (action === 'cancelled' && appointment.status !== 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'A marcação já não está cancelada.' },
        { status: 409 },
      );
    }
    if (
      action === 'rescheduled' &&
      (!['pending', 'scheduled'].includes(appointment.status) ||
        typeof metadata.to !== 'string' ||
        Date.parse(metadata.to) !== Date.parse(appointment.date_hour) ||
        typeof metadata.from !== 'string' ||
        Date.parse(metadata.from) === Date.parse(metadata.to))
    ) {
      return NextResponse.json(
        { success: false, error: 'O horário da marcação já foi alterado novamente.' },
        { status: 409 },
      );
    }

    const customerEmail = appointment.manual_email?.trim().toLowerCase() || '';
    if (!customerEmail) {
      return NextResponse.json(
        { success: false, error: 'Esta marcação não tem um email de cliente guardado.' },
        { status: 409 },
      );
    }

    const [shopResult, serviceResult, professionalResult, clientResult] = await Promise.all([
      tenant.admin.from('barbershops')
        .select('name,default_language')
        .eq('id', tenant.barbershopId)
        .maybeSingle(),
      appointment.service_id
        ? tenant.admin.from('services')
            .select('name')
            .eq('id', appointment.service_id)
            .eq('barbershop_id', tenant.barbershopId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      appointment.professional_id
        ? tenant.admin.from('professionals')
            .select('name')
            .eq('id', appointment.professional_id)
            .eq('barbershop_id', tenant.barbershopId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      appointment.client_id
        ? tenant.admin.from('users')
            .select('name_complete')
            .eq('id', appointment.client_id)
            .eq('barbershop_id', tenant.barbershopId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (!shopResult.data || shopResult.error || serviceResult.error || professionalResult.error || clientResult.error) {
      return NextResponse.json(
        { success: false, error: 'Não foi possível preparar o email da marcação.' },
        { status: 503 },
      );
    }

    const customerName =
      appointment.manual_name?.trim() ||
      clientResult.data?.name_complete?.trim() ||
      'Cliente';
    const barbershopName = shopResult.data.name?.trim() || 'A tua barbearia';
    const serviceName = serviceResult.data?.name?.trim() || 'Serviço';
    const language = shopResult.data.default_language === 'en' ? 'en' : 'pt';
    const claimToken = randomUUID();
    const { data: claimResult, error: claimError } = await tenant.admin.rpc(
      'claim_appointment_notification_retry',
      {
        p_audit_log_id: latestActivity.id,
        p_barbershop_id: tenant.barbershopId,
        p_appointment_id: appointment.id,
        p_action: action,
        p_claim_token: claimToken,
      },
    );

    if (claimError) {
      console.error('[APPOINTMENT_NOTIFICATION_RETRY_CLAIM_FAILED]', {
        code: claimError.code ?? 'UNKNOWN',
      });
      return NextResponse.json(
        { success: false, error: 'Não foi possível reservar o reenvio. Tenta novamente.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const retryCount = Number(claimResult);
    if (!Number.isSafeInteger(retryCount) || retryCount < 1) {
      return NextResponse.json(
        { success: false, error: 'Este email já está a ser enviado ou a alteração deixou de ser a mais recente.' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    let emailSent = false;
    let deliveryOutcomeUnknown = false;

    try {
      if (action === 'rescheduled') {
        const result = await sendCustomerAppointmentRescheduledEmail({
          to: customerEmail,
          customerName,
          barbershopName,
          serviceName,
          previousDateHour: metadata.from as string,
          newDateHour: appointment.date_hour,
          appointmentId: appointment.id,
          status: appointment.status === 'scheduled' ? 'scheduled' : 'pending',
          language,
        });
        emailSent = result.success;
        deliveryOutcomeUnknown = isAmbiguousEmailFailure(result);
      } else {
        const result = await sendAppointmentCancellationEmail({
          to: customerEmail,
          clientName: customerName,
          serviceName,
          professionalName: professionalResult.data?.name?.trim() || null,
          dateHour: appointment.date_hour,
          appointmentId: appointment.id,
          barbershopName,
          language,
        });
        emailSent = result.success;
        deliveryOutcomeUnknown = isAmbiguousEmailFailure(result);
      }
    } catch (sendError) {
      deliveryOutcomeUnknown = true;
      console.error('[APPOINTMENT_NOTIFICATION_RETRY_SEND_FAILED]', {
        action,
        error: sendError instanceof Error ? sendError.name : 'UNKNOWN',
      });
    }

    if (deliveryOutcomeUnknown) {
      // Keep the lease active: the provider may have accepted the email even
      // though the response was lost or ambiguous. A retry can resume after
      // the lease expires, avoiding an immediate duplicate.
      return NextResponse.json(
        {
          success: false,
          emailSent: false,
          retryPending: true,
          retryCount,
          error: 'Não foi possível confirmar se o email foi aceite. O reenvio ficará temporariamente bloqueado para evitar duplicados.',
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const { data: completed, error: completionError } = await tenant.admin.rpc(
      'complete_appointment_notification_retry',
      {
        p_audit_log_id: latestActivity.id,
        p_barbershop_id: tenant.barbershopId,
        p_claim_token: claimToken,
        p_email_sent: emailSent,
      },
    );

    if (completionError || completed !== true) {
      console.error('[APPOINTMENT_NOTIFICATION_RETRY_COMPLETION_FAILED]', {
        code: completionError?.code ?? 'CLAIM_NOT_OWNED',
      });
      return NextResponse.json(
        { success: false, emailSent, retryCount, error: 'O envio foi iniciado, mas não foi possível guardar o resultado. O estado será reconciliado automaticamente.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (!emailSent) {
      return NextResponse.json(
        { success: false, emailSent: false, retryCount, error: 'O fornecedor de email não confirmou o envio. Podes tentar novamente.' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      { success: true, emailSent: true, retryCount },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[APPOINTMENT_NOTIFICATION_RETRY_ERROR]', error instanceof Error ? error.name : 'UNKNOWN');
    return NextResponse.json(
      { success: false, error: 'Erro interno ao reenviar a notificação.' },
      { status: 500 },
    );
  }
}

export const POST = withApiObservability(
  '/api/appointments/[appointmentId]/notifications/retry',
  POST__unobserved,
);
