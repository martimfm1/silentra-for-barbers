import { withApiObservability } from '@/lib/observability/api';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sendBookingConfirmationEmail } from '@/lib/brevo/brevo';
import {
  requireTenantAuthorization,
  tenantAuthorizationResponse,
} from '@/lib/security/tenant-guard';
import { UUID_PATTERN } from '@/lib/validation';

export const runtime = 'nodejs';

async function POST__unobserved(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      appointmentId?: unknown;
    };
    const appointmentId =
      typeof body.appointmentId === 'string' ? body.appointmentId : '';
    if (!UUID_PATTERN.test(appointmentId)) {
      return NextResponse.json(
        { error: 'Marcação inválida.' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const admin = createAdminClient();
    const { data: userProfile } = await admin
      .from('users')
      .select('barbershop_id')
      .eq('id', user.id)
      .maybeSingle();
    if (!userProfile?.barbershop_id)
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });

    const tenant = await requireTenantAuthorization({
      barbershopId: userProfile.barbershop_id,
    });

    const { data: appointment, error: appointmentError } = await admin
      .from('appointments')
      .select(
        'id,date_hour,duration,manual_name,manual_email,barbershop_id,service:services(name),barbershop:barbershops(name,address)',
      )
      .eq('id', appointmentId)
      .eq('barbershop_id', tenant.barbershopId)
      .maybeSingle();

    if (appointmentError || !appointment) {
      return NextResponse.json(
        { error: 'Marcação não encontrada.' },
        { status: 404 },
      );
    }

    const email =
      typeof appointment.manual_email === 'string'
        ? appointment.manual_email.trim().toLowerCase()
        : '';
    const clientName =
      typeof appointment.manual_name === 'string'
        ? appointment.manual_name.trim()
        : '';
    const dateHour =
      typeof appointment.date_hour === 'string'
        ? new Date(appointment.date_hour)
        : null;
    const barbershop = Array.isArray(appointment.barbershop)
      ? appointment.barbershop[0]
      : appointment.barbershop;
    const service = Array.isArray(appointment.service)
      ? appointment.service[0]
      : appointment.service;
    if (
      !email ||
      !clientName ||
      !dateHour ||
      Number.isNaN(dateHour.getTime()) ||
      !barbershop?.name ||
      !barbershop.address ||
      !service?.name
    ) {
      return NextResponse.json(
        { error: 'A marcação não tem dados suficientes para envio.' },
        { status: 409 },
      );
    }

    const result = await sendBookingConfirmationEmail({
      appointmentId: appointment.id,
      to: email,
      clientName,
      serviceName: service.name,
      date: dateHour.toISOString().slice(0, 10),
      time: dateHour.toISOString().slice(11, 16),
      durationMinutes: Number(appointment.duration ?? 30),
      barbershopId: tenant.barbershopId,
      barbershopName: barbershop.name,
      barbershopAddress: barbershop.address,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Não foi possível enviar o email.' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { success: true },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const response = tenantAuthorizationResponse(error);
    if (response) return response;
    console.error('[EMAIL_ROUTE_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
}

export const POST = withApiObservability('/api/notifications/email', POST__unobserved);
