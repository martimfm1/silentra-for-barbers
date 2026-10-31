import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { verifyBarbershopCalendarFeedToken } from '@/lib/calendar/feed-token';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type NamedRelation = {
  name?: string | null;
  name_complete?: string | null;
  style_notes?: string | null;
};
type Relation = NamedRelation | NamedRelation[] | null;
type CalendarAppointmentRow = {
  id: string;
  date_hour: string;
  duration_minutes: number | null;
  status: string;
  manual_name: string | null;
  users: Relation;
  services: Relation;
};
type CalendarBlockRow = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  professionals: Relation;
};

function relation(value: Relation): NamedRelation | null {
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

function getLisbonOffsetMinutes(instant: Date): number {
  const value = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon',
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(instant)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(value ?? 'GMT');
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0));
}

function lisbonLocalDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
    return null;
  }

  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = 0] = time.split(':').map(Number);
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstGuess = new Date(
    wallClockUtc - getLisbonOffsetMinutes(new Date(wallClockUtc)) * 60_000,
  );
  return new Date(
    wallClockUtc - getLisbonOffsetMinutes(firstGuess) * 60_000,
  );
}

function lisbonDate(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
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
      headers: {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
      },
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
      headers: {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const until = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const appointmentPageSize = 1000;
  const appointments: CalendarAppointmentRow[] = [];
  let appointmentsError: { code?: string } | null = null;

  for (let offset = 0; offset < 5000; offset += appointmentPageSize) {
    const { data, error } = await admin
      .from('appointments')
      .select(
        'id,date_hour,duration_minutes,status,manual_name,users(name_complete,style_notes),services(name)',
      )
      .eq('barbershop_id', payload.barbershopId)
      .in('status', ['pending', 'scheduled'])
      .gte('date_hour', from.toISOString())
      .lte('date_hour', until.toISOString())
      .order('date_hour', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + appointmentPageSize - 1);

    if (error) {
      appointmentsError = error;
      break;
    }

    appointments.push(...(data ?? []));
    if ((data?.length ?? 0) < appointmentPageSize) break;
  }

  if (appointmentsError) {
    console.error(
      '[CALENDAR_FEED_APPOINTMENTS_READ_ERROR]',
      appointmentsError.code ?? 'UNKNOWN',
    );
    return new NextResponse('Calendar temporarily unavailable.', {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  const fromDate = lisbonDate(from);
  const untilDate = lisbonDate(until);
  const blockPageSize = 1000;
  const blocks: CalendarBlockRow[] = [];
  let blocksError: { code?: string } | null = null;

  for (let offset = 0; offset < 2000; offset += blockPageSize) {
    const { data, error } = await admin
      .from('schedule_blocks')
      .select('id,date,start_time,end_time,reason,professionals(name)')
      .eq('barbershop_id', payload.barbershopId)
      .gte('date', fromDate)
      .lte('date', untilDate)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + blockPageSize - 1);

    if (error) {
      blocksError = error;
      break;
    }

    blocks.push(...(data ?? []));
    if ((data?.length ?? 0) < blockPageSize) break;
  }

  if (blocksError) {
    console.error(
      '[CALENDAR_FEED_BLOCKS_READ_ERROR]',
      blocksError.code ?? 'UNKNOWN',
    );
    return new NextResponse('Calendar temporarily unavailable.', {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
      },
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
    const client = relation(appointment.users as Relation);
    const service = relation(appointment.services as Relation);
    const start = new Date(appointment.date_hour);
    if (Number.isNaN(start.getTime())) continue;

    const duration = Math.max(
      1,
      Math.min(1440, Number(appointment.duration_minutes ?? 45)),
    );
    const end = new Date(start.getTime() + duration * 60_000);
    const clientName =
      appointment.manual_name?.trim() ||
      client?.name_complete?.trim() ||
      'Cliente';
    const serviceName = service?.name?.trim() || 'Marcação';
    const clientNotes = client?.style_notes?.trim();
    const summary = `${clientName} - ${serviceName}`;
    const status = appointment.status === 'pending' ? 'TENTATIVE' : 'CONFIRMED';
    const location = [shop.name, shop.address].filter(Boolean).join(', ');

    const eventLines = [
      'BEGIN:VEVENT',
      `UID:${appointment.id}@calendar.silentra.me`,
      `DTSTAMP:${formatUtc(now)}`,
      `DTSTART:${formatUtc(start)}`,
      `DTEND:${formatUtc(end)}`,
      `SUMMARY:${escapeIcs(summary)}`,
    ];
    if (clientNotes) {
      eventLines.push(`DESCRIPTION:${escapeIcs(`notes:${clientNotes}`)}`);
    }
    eventLines.push(
      `LOCATION:${escapeIcs(location)}`,
      `STATUS:${status}`,
      'TRANSP:OPAQUE',
      'END:VEVENT',
    );
    lines.push(...eventLines);
  }

  for (const block of blocks ?? []) {
    const start = lisbonLocalDateTime(block.date, block.start_time);
    const end = lisbonLocalDateTime(block.date, block.end_time);
    if (!start || !end || end.getTime() <= start.getTime()) continue;

    const professional = relation(block.professionals as Relation);
    const professionalName = professional?.name?.trim();
    const title = professionalName
      ? `Bloqueio de agenda — ${professionalName}`
      : 'Bloqueio de agenda';
    const description = block.reason?.trim()
      ? `Indisponível: ${block.reason.trim()}`
      : 'Horário indisponível na Silentra.';
    const location = [shop.name, shop.address].filter(Boolean).join(', ');

    lines.push(
      'BEGIN:VEVENT',
      `UID:bloqueio-${block.id}@calendar.silentra.me`,
      `DTSTAMP:${formatUtc(now)}`,
      `DTSTART:${formatUtc(start)}`,
      `DTEND:${formatUtc(end)}`,
      `SUMMARY:${escapeIcs(title)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      `LOCATION:${escapeIcs(location)}`,
      'STATUS:CONFIRMED',
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
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export const GET = withApiObservability(
  '/api/calendar/feed',
  GET__unobserved,
);
