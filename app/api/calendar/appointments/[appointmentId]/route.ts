import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyCalendarToken } from '@/lib/email/calendar-link';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function formatUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

async function GETHandler(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  const { appointmentId } = await context.params;
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const verifiedAppointmentId = verifyCalendarToken(token);

  if (!verifiedAppointmentId || verifiedAppointmentId !== appointmentId) {
    return new NextResponse('Invalid calendar link.', { status: 404 });
  }

  const admin = createAdminClient();
  const { data: appointment } = await admin
    .from('appointments')
    .select(
      'id,date_hour,duration_minutes,manual_name,service_id,barbershop_id,services(name),barbershops(name,address)',
    )
    .eq('id', appointmentId)
    .maybeSingle();

  if (!appointment)
    return new NextResponse('Appointment not found.', { status: 404 });

  const service = Array.isArray(appointment.services)
    ? appointment.services[0]
    : appointment.services;
  const shop = Array.isArray(appointment.barbershops)
    ? appointment.barbershops[0]
    : appointment.barbershops;
  const title = `${service?.name || 'Agendamento'} — ${shop?.name || 'Silentra'}`;
  const description = `Agendamento em ${shop?.name || 'barbearia'}. Serviço: ${service?.name || 'Serviço'}.`;
  const location = [shop?.name, shop?.address].filter(Boolean).join(', ');
  const start = new Date(appointment.date_hour);
  const end = new Date(
    start.getTime() +
      Math.max(1, Number(appointment.duration_minutes ?? 45)) * 60_000,
  );

  const ics =
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Silentra for Barbers//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${appointment.id}@silentra.me`,
      `DTSTAMP:${formatUtc(new Date())}`,
      `DTSTART:${formatUtc(start)}`,
      `DTEND:${formatUtc(end)}`,
      `SUMMARY:${icsEscape(title)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      `LOCATION:${icsEscape(location)}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n') + '\r\n';

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="silentra-agendamento-${appointment.id}.ics"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}


export const GET = withApiLogging('/api/calendar/appointments/[appointmentId]', GETHandler);
