import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { getPortalSession } from '@/lib/customer-booking-portal';
import { createAdminClient } from '@/lib/supabase/admin';

async function GETHandler() {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json(
      {
        success: false,
        error: 'Sessão expirada. Confirma novamente o teu email.',
      },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  const [manualEmailResult, clientResult] = await Promise.all([
    admin
      .from('appointments')
      .select(
        `
        id,
        date_hour,
        duration_minutes,
        status,
        manual_email,
        cancellation_reason,
        cancelled_at,
        service_id,
        professional_id,
        barbershop_id,
        client_id,
        services ( name, duration, price ),
        professionals ( name ),
        barbershops ( name, address, time_limit_cancellation_hours )
      `,
      )
      .eq('manual_email', session.email)
      .order('date_hour', { ascending: true }),
    admin.from('users').select('id').eq('email', session.email),
  ]);

  if (manualEmailResult.error) {
    console.error(
      '[CUSTOMER_PORTAL_APPOINTMENTS_MANUAL_EMAIL_ERROR]',
      manualEmailResult.error,
    );
    return NextResponse.json(
      { success: false, error: 'Não foi possível carregar as marcações.' },
      { status: 503 },
    );
  }
  if (clientResult.error) {
    console.error(
      '[CUSTOMER_PORTAL_APPOINTMENTS_CLIENT_LOOKUP_ERROR]',
      clientResult.error,
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Não foi possível validar o histórico de marcações.',
      },
      { status: 503 },
    );
  }

  const clientIds = (clientResult.data ?? [])
    .map((row) => row.id)
    .filter(Boolean);
  let clientAppointments: any[] = [];

  if (clientIds.length > 0) {
    const result = await admin
      .from('appointments')
      .select(
        `
        id,
        date_hour,
        duration_minutes,
        status,
        manual_email,
        cancellation_reason,
        cancelled_at,
        service_id,
        professional_id,
        barbershop_id,
        client_id,
        services ( name, duration, price ),
        professionals ( name ),
        barbershops ( name, address, time_limit_cancellation_hours )
      `,
      )
      .in('client_id', clientIds)
      .order('date_hour', { ascending: true });

    if (result.error) {
      console.error(
        '[CUSTOMER_PORTAL_APPOINTMENTS_CLIENT_ERROR]',
        result.error,
      );
      return NextResponse.json(
        {
          success: false,
          error:
            'Não foi possível carregar as marcações associadas ao cliente.',
        },
        { status: 503 },
      );
    }
    clientAppointments = result.data ?? [];
  }

  const byId = new Map<string, any>();
  for (const appointment of [
    ...(manualEmailResult.data ?? []),
    ...clientAppointments,
  ]) {
    if (appointment?.id) byId.set(appointment.id, appointment);
  }

  const now = Date.now();
  const appointments = [...byId.values()]
    .sort(
      (a, b) =>
        new Date(a.date_hour).getTime() - new Date(b.date_hour).getTime(),
    )
    .map((appointment) => ({
      id: appointment.id,
      dateHour: appointment.date_hour,
      durationMinutes:
        appointment.duration_minutes ?? appointment.services?.duration ?? 30,
      status: appointment.status,
      serviceName: appointment.services?.name ?? 'Serviço',
      servicePrice: Number(appointment.services?.price ?? 0),
      professionalName: appointment.professionals?.name ?? null,
      professionalId: appointment.professional_id,
      barbershopId: appointment.barbershop_id,
      barbershopName: appointment.barbershops?.name ?? 'Barbearia',
      barbershopAddress: appointment.barbershops?.address ?? null,
      cancellationHours: Math.max(
        0,
        Number(appointment.barbershops?.time_limit_cancellation_hours ?? 24),
      ),
      cancellationReason: appointment.cancellation_reason ?? null,
      cancelledAt: appointment.cancelled_at ?? null,
    }));

  const upcoming = appointments.filter(
    (item) =>
      new Date(item.dateHour).getTime() >= now &&
      ['pending', 'scheduled'].includes(item.status),
  );
  const past = appointments.filter(
    (item) => !upcoming.some((upcomingItem) => upcomingItem.id === item.id),
  );

  return NextResponse.json(
    { success: true, email: session.email, upcoming, past },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}


export const GET = withApiLogging('/api/customer-portal/appointments', GETHandler);
