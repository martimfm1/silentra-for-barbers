import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendBookingReviewRequestEmail } from '@/lib/brevo/review-email';
import { dispatchAppointmentAutomations } from '@/lib/automations/dispatch-appointment';
import { isRecord } from '@/lib/validation';

async function POSTHandler(
  request: Request,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const { appointmentId } = await params;
    const body: unknown = await request.json().catch(() => ({}));
    if (!appointmentId || !isRecord(body))
      return NextResponse.json(
        { success: false, error: 'Pedido inválido.' },
        { status: 400 },
      );
    const paymentMethod =
      typeof body.paymentMethod === 'string' ? body.paymentMethod : '';
    const descriptionProducts =
      typeof body.descriptionProducts === 'string'
        ? body.descriptionProducts.slice(0, 500)
        : '';
    const rawValue =
      typeof body.valueProducts === 'string' ||
      typeof body.valueProducts === 'number'
        ? Number(body.valueProducts)
        : 0;
    const valueProducts =
      Number.isFinite(rawValue) && rawValue >= 0 ? rawValue : 0;
    if (!paymentMethod)
      return NextResponse.json(
        { success: false, error: 'Seleciona o método de pagamento.' },
        { status: 400 },
      );

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json(
        { success: false, error: 'Não autorizado.' },
        { status: 401 },
      );

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('barbershop_id, role')
      .eq('id', user.id)
      .maybeSingle();
    if (
      profileError ||
      !profile?.barbershop_id ||
      !['owner', 'admin', 'manager', 'receptionist', 'staff'].includes(
        profile.role,
      )
    ) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para concluir esta marcação.' },
        { status: 403 },
      );
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(
        'id,status,barbershop_id,client_id,manual_name,manual_email,date_hour,services(name)',
      )
      .eq('id', appointmentId)
      .eq('barbershop_id', profile.barbershop_id)
      .maybeSingle();
    if (appointmentError || !appointment)
      return NextResponse.json(
        { success: false, error: 'Marcação não encontrada.' },
        { status: 404 },
      );
    if (appointment.status === 'completed')
      return NextResponse.json(
        { success: false, error: 'Este atendimento já foi concluído.' },
        { status: 409 },
      );
    if (appointment.status !== 'scheduled')
      return NextResponse.json(
        { success: false, error: 'Só podes concluir uma marcação confirmada.' },
        { status: 409 },
      );

    const { data: updated, error: updateError } = await supabase
      .from('appointments')
      .update({
        status: 'completed',
        payment_method: paymentMethod,
        value_products: valueProducts,
        description_products: descriptionProducts,
      })
      .eq('id', appointmentId)
      .eq('barbershop_id', profile.barbershop_id)
      .eq('status', 'scheduled')
      .select(
        'id,status,date_hour,barbershop_id,client_id,manual_name,manual_email,services(name)',
      )
      .maybeSingle();
    if (updateError || !updated) {
      console.error(
        '[APPOINTMENT_COMPLETE_UPDATE_ERROR]',
        updateError?.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        { success: false, error: 'Não foi possível concluir o atendimento.' },
        { status: 500 },
      );
    }

    const { data: shop } = await supabase
      .from('shops')
      .select('slug,name')
      .eq('barbershop_id', profile.barbershop_id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    let customerEmail = appointment.manual_email?.trim().toLowerCase() || '';
    let customerName = appointment.manual_name?.trim() || 'Cliente';
    if (!customerEmail && appointment.client_id) {
      const { data: client } = await supabase
        .from('users')
        .select('email,name_complete')
        .eq('id', appointment.client_id)
        .eq('barbershop_id', profile.barbershop_id)
        .maybeSingle();
      customerEmail = client?.email?.trim().toLowerCase() || '';
      customerName = client?.name_complete?.trim() || customerName;
    }

    const serviceRelation = Array.isArray(appointment.services)
      ? appointment.services[0]
      : appointment.services;
    let reviewEmailSent = false;
    if (customerEmail && shop?.slug) {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
        new URL(request.url).origin;
      const reviewUrl = `${siteUrl}/barbershops/${encodeURIComponent(shop.slug)}`;
      const serviceName = serviceRelation?.name || 'o teu atendimento';
      try {
        const emailResult = await sendBookingReviewRequestEmail({
          to: customerEmail,
          clientName: customerName,
          serviceName,
          barbershopName: shop.name || 'a barbearia',
          reviewUrl,
        });
        reviewEmailSent = emailResult.success;
        if (!emailResult.success)
          console.error(
            '[BOOKING_REVIEW_EMAIL_ERROR]',
            emailResult.error ?? 'UNKNOWN',
          );
      } catch (error) {
        console.error(
          '[BOOKING_REVIEW_EMAIL_UNEXPECTED_ERROR]',
          error instanceof Error ? error.name : 'UNKNOWN',
        );
      }
    }

    void dispatchAppointmentAutomations('booking_completed', {
      appointmentId: appointment.id,
      barbershopId: profile.barbershop_id,
      clientId: appointment.client_id,
      manualEmail: appointment.manual_email,
      manualName: appointment.manual_name,
      serviceName: serviceRelation?.name,
    });
    return NextResponse.json({
      success: true,
      booking: updated,
      reviewEmailSent,
    });
  } catch (error) {
    console.error(
      '[APPOINTMENT_COMPLETE_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { success: false, error: 'Erro interno no servidor.' },
      { status: 500 },
    );
  }
}


export const POST = withApiLogging('/api/appointments/[appointmentId]/complete', POSTHandler);
