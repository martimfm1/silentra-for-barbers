import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail } from '@/lib/email/brevo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 8;
const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;

function authorized(request: Request) {
  const secret = (
    process.env.BOOKING_OUTBOX_CRON_SECRET ?? process.env.CRON_SECRET
  )?.trim();
  if (!secret) return false;
  if (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.headers.get('x-cron-secret') === secret
  ) return true;

  const timestamp = request.headers.get('x-reminder-timestamp') ?? '';
  const signature = request.headers.get('x-reminder-signature') ?? '';
  if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false;
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}:appointment-reminders`)
    .digest();
  const supplied = Buffer.from(signature, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character,
  );
}

function formatAppointmentDate(value: string, language: 'pt' | 'en') {
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'pt-PT', {
      dateStyle: 'full',
      timeZone: 'Europe/Lisbon',
    }).format(date),
    time: new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Europe/Lisbon',
    }).format(date),
  };
}

async function GET__unobserved(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const { error: recoveryError } = await admin.rpc('recover_stale_appointment_reminders');
    if (recoveryError) throw recoveryError;
    const { data: events, error } = await admin.rpc('claim_appointment_reminder_events', {
      p_batch_size: BATCH_SIZE,
    });
    if (error) throw error;

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const event of events ?? []) {
      try {
        const { data: appointment, error: appointmentError } = await admin
          .from('appointments')
          .select('id,barbershop_id,client_id,status,date_hour,manual_name,manual_email,services(name,duration),professionals(name)')
          .eq('id', event.appointment_id)
          .eq('barbershop_id', event.barbershop_id)
          .maybeSingle();
        if (appointmentError) throw appointmentError;

        const complete = async (lastError: string | null = null) => {
          const { error: updateError } = await admin
            .from('appointment_reminder_outbox')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              locked_at: null,
              last_error: lastError,
            })
            .eq('id', event.id)
            .eq('status', 'processing');
          if (updateError) throw updateError;
        };

        if (!appointment || appointment.status !== 'scheduled' ||
            Math.abs(new Date(appointment.date_hour).getTime() -
              new Date(event.scheduled_for).getTime() - REMINDER_LEAD_MS) > 1000) {
          await complete();
          skipped += 1;
          continue;
        }

        const [{ data: shop, error: shopError }, { data: plan, error: planError }] =
          await Promise.all([
            admin.from('barbershops').select('name,address,phone,default_language,auto_reminders').eq('id', event.barbershop_id).maybeSingle(),
            admin.rpc('get_effective_billing_plan_for_barbershop', { p_barbershop_id: event.barbershop_id }),
          ]);
        if (shopError || planError) throw shopError ?? planError;
        const { data: client, error: clientError } = appointment.client_id
          ? await admin.from('users').select('email,name_complete').eq('id', appointment.client_id).eq('barbershop_id', event.barbershop_id).maybeSingle()
          : { data: null, error: null };
        if (clientError) throw clientError;
        if (shop?.auto_reminders !== true ||
            !['pro', 'enterprise'].includes(String(plan ?? '').toLowerCase())) {
          await complete();
          skipped += 1;
          continue;
        }

        const recipient = appointment.manual_email?.trim().toLowerCase() || client?.email?.trim().toLowerCase() || '';
        if (!recipient) {
          await complete('No customer email address');
          skipped += 1;
          continue;
        }

        const language = shop.default_language === 'en' ? 'en' : 'pt';
        const date = formatAppointmentDate(appointment.date_hour, language);
        const service = Array.isArray(appointment.services) ? appointment.services[0] : appointment.services;
        const professional = Array.isArray(appointment.professionals) ? appointment.professionals[0] : appointment.professionals;
        const name = appointment.manual_name?.trim() || client?.name_complete?.trim() || (language === 'en' ? 'there' : 'Cliente');
        const shopName = shop.name?.trim() || 'Silentra';
        const isEnglish = language === 'en';
        const subject = isEnglish
          ? `Reminder: your appointment at ${shopName}`
          : `Lembrete da tua marcação — ${shopName}`;
        const rows = isEnglish
          ? [
              ['Service', service?.name ?? 'Appointment'],
              ['Professional', professional?.name ?? 'Any professional'],
              ['Date', date.date],
              ['Time', date.time],
              ['Address', shop.address ?? 'Contact the barbershop'],
            ]
          : [
              ['Serviço', service?.name ?? 'Marcação'],
              ['Barbeiro', professional?.name ?? 'A definir'],
              ['Data', date.date],
              ['Hora', date.time],
              ['Morada', shop.address ?? 'Contacta a barbearia'],
            ];
        const details = rows.map(([label, value]) =>
          `<p style="margin:10px 0"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}</p>`,
        ).join('');
        const greeting = isEnglish ? 'Hello' : 'Olá';
        const intro = isEnglish
          ? 'This is a friendly reminder that your appointment is coming up in 24 hours.'
          : 'Este é um lembrete de que a tua marcação é daqui a 24 horas.';
        const footer = isEnglish
          ? 'If you need to change your booking, please contact the barbershop.'
          : 'Se precisares de alterar a marcação, contacta diretamente a barbearia.';
        const result = await sendBrevoEmail({
          to: recipient,
          toName: name,
          senderName: shopName,
          subject,
          htmlContent: `<!doctype html><html lang="${isEnglish ? 'en' : 'pt-PT'}"><body style="font-family:Arial,sans-serif;line-height:1.6;color:#18181b"><h1>${isEnglish ? 'Appointment reminder' : 'Lembrete de marcação'}</h1><p>${greeting} ${escapeHtml(name)},</p><p>${intro}</p>${details}<p>${footer}</p><p>${escapeHtml(shopName)}</p></body></html>`,
        });
        if (!result.success) throw new Error(result.error || 'Email delivery failed');

        await complete();
        sent += 1;
      } catch (error) {
        failed += 1;
        const attempts = Number(event.attempts ?? 1);
        const exhausted = attempts >= MAX_ATTEMPTS;
        const delayMinutes = Math.min(360, 2 ** Math.min(attempts, 8));
        const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown reminder worker error';
        const { error: updateError } = await admin
          .from('appointment_reminder_outbox')
          .update({
            status: exhausted ? 'failed' : 'pending',
            available_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
            last_error: message,
            locked_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', event.id)
          .eq('status', 'processing');
        if (updateError) console.error('[APPOINTMENT_REMINDER_RETRY_UPDATE_FAILED]', { requestId, eventId: event.id, code: updateError.code });
      }
    }

    const result = { ok: failed === 0, requestId, claimed: events?.length ?? 0, sent, skipped, failed, durationMs: Date.now() - startedAt };
    console.info('[APPOINTMENT_REMINDERS_CRON]', result);
    return NextResponse.json(result, { status: failed === 0 ? 200 : 207, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[APPOINTMENT_REMINDERS_CRON_FAILED]', { requestId, error: error instanceof Error ? error.message : 'UNKNOWN' });
    return NextResponse.json({ ok: false, requestId, error: 'Appointment reminder worker failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export const GET = withApiObservability('/api/cron/appointment-reminders', GET__unobserved);
export const POST = withApiObservability('/api/cron/appointment-reminders', GET__unobserved);
