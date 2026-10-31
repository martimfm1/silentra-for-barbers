import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { verifyBarbershopCalendarFeedToken } from '@/lib/calendar/feed-token';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Relation = { name?: string | null } | Relation[] | null;

function relation(value: Relation): { name?: string | null } | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function formatUtc(value: Date): string {
  return value
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function foldLine(line: string): string {
  const lines: string[] = [];
  let current = '';
  let bytes = 0;

  for (const character of line) {
    const characterBytes = Buffer.byteLength(character, 'utf8');
    if (bytes + characterBytes > 75 && current) {
      lines.push(current);
      current = ` ${character}`;
      bytes = 1 + characterBytes;
    } else {
      current += character;
      bytes += characterBytes;
    }
  }

  lines.push(current);
  return lines.join('\r\n');
}

function textCalendar(lines: string[]): string {
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

async function GET__unobserved(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const payload = verifyBarbershopCalendarFeedToken(token);
  if (!payload) {
    return new NextResponse('Calendar not found.', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const admin = createAdminClient();
  const { data: shop, error: shopError } = await admin
    .from('barbershops')
    .select('id,name,address,calendar_feed_enabled,calendar_feed_version')
    .eq('id', payload.barbershopId)
    .maybeSingle();

  if (
    shopError ||
    !shop ||
    shop.calendar_feed_enabled !== true ||
    Number(shop.calendar_feed_version) !== payload.version
  ) {
    return new NextResponse('Calendar not found.', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const until = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const { data: appointments, error: appointmentsError } = await admin
    .from('appointments')
    .select(
      'id,date_hour,duration_minutes,status,services(name),professionals(name)',
    )
    .eq('barbershop_id', payload.barbershopId)
    .in('status', ['pending', 'scheduled'])
    .gte('date_hour', from.toISOString())
    .lte('date_hour', until.toISOString())
    .order('date_hour', { ascending: true })
    .limit(5000);

  if (appointmentsError) {
    console.error(
      '[CALENDAR_FEED_APPOINTMENTS_READ_ERROR]',
      appointmentsError.code ?? 'UNKNOWN',
    );
    return new NextResponse('Calendar temporarily unavailable.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Silentra for Barbers//Calendar Feed 1.0//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(`Silentra — ${shop.name || 'Agenda'}`)}`,
    'X-WR-TIMEZONE:Europe/Lisbon',
    'X-PUBLISHED-TTL:PT15M',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
  ];

  for (const appointment of appointments ?? []) {
    const service = relation(appointment.services as Relation);
    const professional = relation(appointment.professionals as Relation);
    const start = new Date(appointment.date_hour);
    if (Number.isNaN(start.getTime())) continue;

    const duration = Math.max(
      1,
      Math.min(1440, Number(appointment.duration_minutes ?? 45)),
    );
    const end = new Date(start.getTime() + duration * 60_000);
    const serviceName = service?.name?.trim() || 'Marcação';
    const professionalName = professional?.name?.trim();
    const summary = professionalName
      ? `${serviceName} — ${professionalName}`
      : serviceName;
    const status = appointment.status === 'pending' ? 'TENTATIVE' : 'CONFIRMED';
    const description =
      appointment.status === 'pending'
        ? 'Marcação por confirmar na Silentra.'
        : 'Marcação confirmada na Silentra.';
    const location = [shop.name, shop.address].filter(Boolean).join(', ');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${appointment.id}@calendar.silentra.me`,
      `DTSTAMP:${formatUtc(now)}`,
      `DTSTART:${formatUtc(start)}`,
      `DTEND:${formatUtc(end)}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      `LOCATION:${escapeIcs(location)}`,
      `STATUS:${status}`,
      'TRANSP:OPAQUE',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return new NextResponse(textCalendar(lines), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="silentra-agenda.ics"',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const GET = withApiObservability(
  '/api/calendar/feed',
  GET__unobserved,
);
