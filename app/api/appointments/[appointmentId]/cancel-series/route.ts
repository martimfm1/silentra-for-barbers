import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { hasPlanFeature } from '@/lib/billing/plan-features';
import { resolveAccessPlanForUser } from '@/services/billing/plan-access.guard';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';
import { dispatchAppointmentAutomations } from '@/lib/automations/dispatch-appointment';
import { sendAppointmentCancellationEmail } from '@/lib/brevo/appointment-cancellation';

const ROLES = ['owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'] as const;
type Scope = 'future' | 'all';

async function POST__unobserved(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const { appointmentId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const scope = body?.scope as Scope;
    if (scope !== 'future' && scope !== 'all') {
      return NextResponse.json({ success: false, error: 'Âmbito de cancelamento inválido.' }, { status: 400 });
    }

    const tenant = await requireTenantAuthorization(request, ROLES);
    if (!tenant.ok) return NextResponse.json({ success: false, error: 'Sem autorização para cancelar a série.' }, { status: tenant.status });

    if (tenant.role !== 'owner') {
      const { data: grant, error } = await tenant.admin
        .from('barbershop_member_permissions').select('permissions')
        .eq('barbershop_id', tenant.barbershopId).eq('user_id', tenant.userId).maybeSingle();
      if (error) return NextResponse.json({ success: false, error: 'Não foi possível validar as permissões.' }, { status: 503 });
      const permissions = grant?.permissions && typeof grant.permissions === 'object' ? grant.permissions as Record<string, unknown> : {};
      let allowed = permissions.agenda === true || permissions.appointments === true;
      if (!grant) {
        const legacy = await tenant.admin.from('staff_permissions').select('allowed')
          .eq('barbershop_id', tenant.barbershopId).eq('user_id', tenant.userId)
          .in('permission', ['agenda', 'appointments']).eq('allowed', true).limit(1).maybeSingle();
        if (legacy.error) return NextResponse.json({ success: false, error: 'Não foi possível validar as permissões.' }, { status: 503 });
        allowed = legacy.data?.allowed === true;
      }
      if (!allowed) return NextResponse.json({ success: false, error: 'Sem permissão para cancelar marcações.' }, { status: 403 });
    }

    const plan = await resolveAccessPlanForUser(tenant.userId);
    if (!hasPlanFeature(plan, 'appointments')) return NextResponse.json({ success: false, error: 'A agenda não está incluída no plano.' }, { status: 403 });

    const { data: selected, error: selectedError } = await tenant.admin
      .from('appointments')
      .select('id,recurrence_series_id,date_hour,client_id,manual_email,manual_name,service_id,professional_id')
      .eq('id', appointmentId).eq('barbershop_id', tenant.barbershopId)
      .in('status', ['pending', 'scheduled']).maybeSingle();
    if (selectedError) return NextResponse.json({ success: false, error: 'Não foi possível consultar a série.' }, { status: 503 });
    if (!selected?.recurrence_series_id) return NextResponse.json({ success: false, error: 'Esta marcação não está associada a uma série recorrente. Só é possível cancelar esta ocorrência.' }, { status: 409 });

    let query = tenant.admin.from('appointments')
      .select('id,date_hour,client_id,manual_email,manual_name,service_id,professional_id,payment_status')
      .eq('barbershop_id', tenant.barbershopId)
      .eq('recurrence_series_id', selected.recurrence_series_id)
      .in('status', ['pending', 'scheduled']);
    if (scope === 'future') query = query.gte('date_hour', selected.date_hour);
    const { data: targets, error: targetsError } = await query.order('date_hour', { ascending: true });
    if (targetsError) return NextResponse.json({ success: false, error: 'Não foi possível carregar as marcações da série.' }, { status: 503 });
    if (!targets?.length) return NextResponse.json({ success: false, error: 'Não existem marcações ativas para cancelar.' }, { status: 409 });

    const cancelledAt = new Date().toISOString();
    const { data: cancellingUser } = await tenant.admin.from('users').select('name_complete')
      .eq('id', tenant.userId).eq('barbershop_id', tenant.barbershopId).maybeSingle();
    const ids = targets.map(item => item.id);
    const { data: cancelled, error: updateError } = await tenant.admin.from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: cancelledAt,
        cancellation_actor: 'staff',
        cancellation_actor_name: cancellingUser?.name_complete?.trim() || tenant.role,
      })
      .eq('barbershop_id', tenant.barbershopId).in('id', ids)
      .in('status', ['pending', 'scheduled'])
      .select('id');
    if (updateError) return NextResponse.json({ success: false, error: 'Não foi possível cancelar a série.' }, { status: 503 });

    const awaitingReviewIds = targets
      .filter(item => item.payment_status === 'awaiting_review')
      .map(item => item.id);
    if (awaitingReviewIds.length > 0) {
      const { error: paymentError } = await tenant.admin
        .from('appointments')
        .update({
          payment_status: 'rejected',
          payment_reviewed_at: cancelledAt,
          cancellation_reason: 'Pré-pagamento MB WAY rejeitado pelo barbeiro.',
        })
        .eq('barbershop_id', tenant.barbershopId)
        .in('id', awaitingReviewIds)
        .eq('status', 'cancelled');
      if (paymentError) {
        console.error('[CANCEL_SERIES_PAYMENT_REJECTION_FAILED]');
      }
    }

    const [shop, service, professional, client] = await Promise.all([
      tenant.admin.from('barbershops').select('name,default_language').eq('id', tenant.barbershopId).maybeSingle(),
      selected.service_id ? tenant.admin.from('services').select('name').eq('id', selected.service_id).eq('barbershop_id', tenant.barbershopId).maybeSingle() : Promise.resolve({ data: null }),
      selected.professional_id ? tenant.admin.from('professionals').select('name').eq('id', selected.professional_id).eq('barbershop_id', tenant.barbershopId).maybeSingle() : Promise.resolve({ data: null }),
      selected.client_id ? tenant.admin.from('users').select('email,name_complete').eq('id', selected.client_id).eq('barbershop_id', tenant.barbershopId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const language = shop.data?.default_language === 'en' ? 'en' : 'pt';
    const email = targets[0]?.manual_email?.trim() || client.data?.email?.trim() || '';
    const clientName = targets[0]?.manual_name?.trim() || client.data?.name_complete?.trim() || 'Cliente';
    const emailResults = await Promise.all((cancelled ?? []).map(async item => {
      const target = targets.find(entry => entry.id === item.id);
      if (!email || !target) return false;
      const result = await sendAppointmentCancellationEmail({
        to: email, clientName,
        serviceName: service.data?.name?.trim() || 'Serviço',
        professionalName: professional.data?.name?.trim() || null,
        dateHour: target.date_hour, appointmentId: target.id,
        barbershopName: shop.data?.name?.trim() || 'A tua barbearia', language,
      });
      void dispatchAppointmentAutomations('booking_cancelled', {
        appointmentId: target.id, barbershopId: tenant.barbershopId,
        clientId: target.client_id, manualEmail: target.manual_email,
        manualName: target.manual_name, serviceName: service.data?.name ?? null,
      });
      return result.success;
    }));

    return NextResponse.json({
      success: true,
      cancelledCount: cancelled?.length ?? 0,
      emailSent: emailResults.length > 0 && emailResults.every(Boolean),
      emailFailedCount: emailResults.filter(value => !value).length,
    });
  } catch (error) {
    console.error('[CANCEL_APPOINTMENT_SERIES_ERROR]', error instanceof Error ? error.name : 'UNKNOWN');
    return NextResponse.json({ success: false, error: 'Erro interno ao cancelar a série.' }, { status: 500 });
  }
}

export const POST = withApiObservability('/api/appointments/[appointmentId]/cancel-series', POST__unobserved);
