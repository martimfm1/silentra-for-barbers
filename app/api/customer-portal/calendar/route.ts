import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashPortalToken } from '@/lib/customer-booking-portal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type NamedRelation = { name?: string | null; address?: string | null };
type Relation = NamedRelation | NamedRelation[] | null;
type FeedAppointment = {
  id: string;
  date_hour: string;
  duration_minutes: number | null;
  status: string;
  services: Relation;
  barbershops: Relation;
};

function relation(value: Relation): NamedRelation | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function formatUtc(value: Date): string {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function foldLine(line: string): string {
  const chunks: string[] = [];
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character, 'utf8');
    if (bytes + size > 75 && current) {
      chunks.push(current);
      current = ' ' + character;
      bytes = 1 + size;
    } else {
      current += character;
      bytes += size;
    }
  }
  chunks.push(current);
  return chunks.join('\r\n');
}

function notFound() {
  return new NextResponse('Calendar not found.', {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

async function GET__unobserved(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token') ?? '';
    if (token.length < 32 || token.length > 256) return notFound();

    const admin = createAdminClient();
    const { data: feedRecord, error: feedError } = await admin
      .from('customer_calendar_feeds')
      .select('email,enabled')
      .eq('token_hash', hashPortalToken(token))
      .maybeSingle();

    if (feedError || !feedRecord || feedRecord.enabled !== true) return notFound();

    const email = String(feedRecord.email).trim().toLowerCase();
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const until = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const [manualResult, userResult] = await Promise.all([
      admin
        .from('appointments')
        .select('id,date_hour,duration_minutes,status,client_id,services(name),barbershops(name,address)')
        .eq('manual_email', email)
        .in('status', ['pending', 'scheduled', 'cancelled'])
        .gte('date_hour', from.toISOString())
        .lte('date_hour', until.toISOString())
        .order('date_hour', { ascending: true }),
      admin.from('users').select('id').eq('email', email),
    ]);

    if (manualResult.error || userResult.error) {
      console.error('[CUSTOMER_CALENDAR_APPOINTMENTS_LOOKUP_ERROR]', manualResult.error?.code ?? userResult.error?.code ?? 'UNKNOWN');
      return new NextResponse('Calendar temporarily unavailable.', {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
      });
    }

    const clientIds = (userResult.data ?? []).map((row) => row.id).filter(Boolean);
    let linkedAppointments: FeedAppointment[] = [];
    if (clientIds.length > 0) {
      const linkedResult = await admin
        .from('appointments')
        .select('id,date_hour,duration_minutes,status,client_id,services(name),barbershops(name,address)')
        .in('client_id', clientIds)
        .in('status', ['pending', 'scheduled', 'cancelled'])
        .gte('date_hour', from.toISOString())
        .lte('date_hour', until.toISOString())
        .order('date_hour', { ascending: true });

      if (linkedResult.error) {
        console.error('[CUSTOMER_CALENDAR_LINKED_LOOKUP_ERROR]', linkedResult.error.code ?? 'UNKNOWN');
        return new NextResponse('Calendar temporarily unavailable.', {
          status: 503,
          headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
        });
      }
      linkedAppointments = (linkedResult.data ?? []) as unknown as FeedAppointment[];
    }

    const unique = new Map<string, FeedAppointment>();
    for (const item of [...((manualResult.data ?? []) as unknown as FeedAppointment[]), ...linkedAppointments]) {
      if (item?.id) unique.set(item.id, item);
    }

    const events: string[] = [];
    for (const appointment of unique.values()) {
      const start = new Date(appointment.date_hour);
      if (!Number.isFinite(start.getTime())) continue;
      const duration = Math.max(1, Math.min(Number(appointment.duration_minutes ?? 30), 1440));
      const end = new Date(start.getTime() + duration * 60_000);
      const service = relation(appointment.services);
      const shop = relation(appointment.barbershops);
      const cancelled = appointment.status === 'cancelled';
      const pending = appointment.status === 'pending';
      const summary = [
        cancelled ? 'Cancelada' : pending ? 'Por confirmar' : 'Marcação',
        service?.name?.trim() || 'Serviço',
        shop?.name?.trim() || 'Barbearia',
      ].join(' · ');
      const description = cancelled
        ? 'Esta marcação foi cancelada.'
        : pending
          ? 'Este pedido de marcação ainda aguarda confirmação da barbearia.'
          : 'Marcação confirmada através da Silentra.';
      const eventLines = [
        'BEGIN:VEVENT',
        'UID:' + appointment.id + '@barbers.silentra.me',
        'DTSTAMP:' + formatUtc(now),
        'DTSTART:' + formatUtc(start),
        'DTEND:' + formatUtc(end),
        'SUMMARY:' + escapeIcs(summary),
        'DESCRIPTION:' + escapeIcs(description),
        ...(shop?.address ? ['LOCATION:' + escapeIcs(shop.address)] : []),
        'STATUS:' + (cancelled ? 'CANCELLED' : pending ? 'TENTATIVE' : 'CONFIRMED'),
        'URL:https://barbers.silentra.me/my-bookings',
        'END:VEVENT',
      ];
      events.push(eventLines.join('\r\n'));
    }

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Silentra//Customer Calendar//PT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:As minhas marcações · Silentra',
      'X-WR-CALDESC:Calendário pessoal das tuas marcações.',
      ...events,
      'END:VCALENDAR',
    ];
    const calendar = lines.map(foldLine).join('\r\n') + '\r\n';

    return new NextResponse(calendar, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="silentra-marcacoes.ics"',
        'Cache-Control': 'no-store, max-age=0',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (error) {
    console.error('[CUSTOMER_CALENDAR_FEED_ERROR]', error instanceof Error ? error.name : 'UNKNOWN');
    return new NextResponse('Calendar temporarily unavailable.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    });
  }
}

export const GET = withApiObservability('/api/customer-portal/calendar', GET__unobserved);
