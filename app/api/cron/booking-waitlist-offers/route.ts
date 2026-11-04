import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { getPublicProfileById } from '@/lib/barbershops/public-profile';
import { sendBrevoEmail } from '@/lib/email/brevo';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 10;

type WaitlistOfferEvent = {
  vacancy_id: string;
  waitlist_id: string;
  shop_id: string;
  barbershop_id: string;
  service_id: string;
  professional_id: string | null;
  preferred_date: string;
  offered_time: string;
  offer_expires_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_name: string;
  professional_name: string | null;
  shop_name: string;
  default_language: string | null;
  attempts: number;
};

function authorized(request: Request) {
  const secret = (
    process.env.BOOKING_OUTBOX_CRON_SECRET ?? process.env.CRON_SECRET
  )?.trim();
  if (!secret) return false;

  if (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.headers.get('x-cron-secret') === secret
  ) {
    return true;
  }

  const timestamp = request.headers.get('x-waitlist-timestamp') ?? '';
  const signature = request.headers.get('x-waitlist-signature') ?? '';
  if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature))
    return false;

  const seconds = Number(timestamp);
  if (
    !Number.isSafeInteger(seconds) ||
    Math.abs(Date.now() / 1000 - seconds) > 300
  ) {
    return false;
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}:booking-waitlist-offers`)
    .digest();
  const supplied = Buffer.from(signature, 'hex');
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character] ?? character,
  );
}

function formatOfferDate(value: string, language: 'pt' | 'en') {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'pt-PT', {
    dateStyle: 'full',
    timeZone: 'Europe/Lisbon',
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatOfferTime(value: string) {
  return value.slice(0, 5);
}

function formatExpiry(value: string, language: 'pt' | 'en') {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Europe/Lisbon',
  }).format(new Date(value));
}

async function isCurrentOffer(
  admin: ReturnType<typeof createAdminClient>,
  event: WaitlistOfferEvent,
) {
  const now = new Date().toISOString();
  const [vacancy, entry] = await Promise.all([
    admin
      .from('booking_waitlist_vacancies')
      .select('id')
      .eq('id', event.vacancy_id)
      .eq('waitlist_id', event.waitlist_id)
      .eq('status', 'dispatching')
      .gt('offer_expires_at', now)
      .maybeSingle(),
    admin
      .from('booking_waitlist')
      .select('id')
      .eq('id', event.waitlist_id)
      .eq('shop_id', event.shop_id)
      .eq('status', 'offered')
      .gt('offer_expires_at', now)
      .maybeSingle(),
  ]);

  if (vacancy.error || entry.error)
    throw new Error('WAITLIST_OFFER_REVALIDATION_FAILED');

  return Boolean(vacancy.data && entry.data);
}

async function releaseFailedOffer(
  admin: ReturnType<typeof createAdminClient>,
  event: WaitlistOfferEvent,
  reason: string,
) {
  const { error } = await admin.rpc('release_booking_waitlist_offer', {
    p_vacancy_id: event.vacancy_id,
    p_waitlist_id: event.waitlist_id,
    p_error: reason.slice(0, 500),
  });
  if (error) {
    console.error('[BOOKING_WAITLIST_RELEASE_FAILED]', {
      vacancyId: event.vacancy_id,
      code: error.code ?? 'UNKNOWN',
    });
  }
}

async function GET__unobserved(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const admin = createAdminClient();
  const requestId = randomUUID();
  const startedAt = Date.now();

  try {
    const { data: events, error } = await admin.rpc(
      'claim_booking_waitlist_vacancies',
      { p_batch_size: BATCH_SIZE },
    );
    if (error) throw error;

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const event of (events ?? []) as WaitlistOfferEvent[]) {
      let deliveryAccepted = false;
      try {
        const email = event.customer_email?.trim().toLowerCase();
        if (!email) throw new Error('WAITLIST_CUSTOMER_EMAIL_MISSING');

        const profile = await getPublicProfileById(event.shop_id);
        if (!profile) throw new Error('WAITLIST_PUBLIC_PROFILE_UNAVAILABLE');

        const siteUrl = (
          process.env.NEXT_PUBLIC_APP_URL ??
          process.env.NEXT_PUBLIC_SITE_URL ??
          'https://barbers.silentra.me'
        ).replace(/\/$/, '');
        const bookingUrl = new URL(
          `/barbershops/${encodeURIComponent(profile.slug)}`,
          siteUrl,
        );
        if (profile.plan === 'enterprise')
          bookingUrl.searchParams.set('booking', '1');
        bookingUrl.searchParams.set('service', event.service_id);
        bookingUrl.searchParams.set('date', event.preferred_date);
        bookingUrl.searchParams.set('time', formatOfferTime(event.offered_time));
        if (event.professional_id)
          bookingUrl.searchParams.set('professional', event.professional_id);

        const declineSecret = (
          process.env.BOOKING_OUTBOX_CRON_SECRET ?? process.env.CRON_SECRET
        )?.trim();
        if (!declineSecret || declineSecret.length < 32)
          throw new Error('WAITLIST_DECLINE_SIGNING_SECRET_MISSING');
        const declineExpires = Math.floor(
          new Date(event.offer_expires_at).getTime() / 1000,
        );
        const declineSignature = createHmac('sha256', declineSecret)
          .update(
            `booking-waitlist-decline:${event.shop_id}:${event.vacancy_id}:${event.waitlist_id}:${declineExpires}`,
          )
          .digest('hex');
        const declineUrl = new URL('/waitlist/decline', siteUrl);
        declineUrl.searchParams.set('shop', event.shop_id);
        declineUrl.searchParams.set('vacancy', event.vacancy_id);
        declineUrl.searchParams.set('entry', event.waitlist_id);
        declineUrl.searchParams.set('expires', String(declineExpires));
        declineUrl.searchParams.set('signature', declineSignature);

        const language: 'pt' | 'en' = String(
          event.default_language ?? '',
        ).toLowerCase().startsWith('en')
          ? 'en'
          : 'pt';
        const english = language === 'en';
        const date = formatOfferDate(event.preferred_date, language);
        const time = formatOfferTime(event.offered_time);
        const expiry = formatExpiry(event.offer_expires_at, language);
        const shopName = event.shop_name?.trim() || profile.name;
        const serviceName = event.service_name?.trim() || (english ? 'Service' : 'Serviço');
        const professional = event.professional_name?.trim() || '';
        const subject = english
          ? `A time opened up at ${shopName}`
          : `Surgiu uma vaga na ${shopName}`;

        const intro = english
          ? 'A time matching your waitlist request has become available.'
          : 'Surgiu um horário compatível com o pedido que deixaste na lista de espera.';
        const availabilityNote = english
          ? 'This time is not held automatically. It is confirmed only after you complete the booking, and may become unavailable if someone else books first.'
          : 'Este horário não fica reservado automaticamente. Só fica confirmado depois de concluíres a marcação e poderá deixar de estar disponível se outra pessoa marcar primeiro.';
        const expiryNote = english
          ? `Your priority offer expires at ${expiry} (Lisbon time). After that, the opening may be offered to someone else. You can still check current availability on the booking page.`
          : `A prioridade deste convite termina às ${expiry} (hora de Portugal continental). Depois disso, a vaga poderá ser proposta a outra pessoa. Podes continuar a consultar os horários disponíveis na página de marcação.`;
        const button = english ? 'Open booking page' : 'Abrir página de marcação';
        const declineLabel = english ? 'I am not interested in this opening' : 'Não tenho interesse nesta vaga';
        const declineNote = english
          ? 'You can decline this offer and let the barbershop contact the next customer.'
          : 'Podes recusar esta proposta para que a barbearia contacte o próximo cliente.';

        const details = [
          [english ? 'Service' : 'Serviço', serviceName],
          ...(professional
            ? [[english ? 'Professional' : 'Profissional', professional]]
            : []),
          [english ? 'Date' : 'Data', date],
          [english ? 'Time' : 'Hora', time],
        ] as Array<[string, string]>;

        const htmlContent = `<!doctype html>
<html lang="${english ? 'en' : 'pt-PT'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
  <main style="max-width:560px;margin:0 auto;padding:28px;background:#fff;border:1px solid #e4e4e7;border-radius:16px">
    <p style="margin:0 0 8px;color:#71717a;font-size:13px">${escapeHtml(shopName)}</p>
    <h1 style="margin:0 0 12px;font-size:24px">${english ? 'A waitlist opening is available' : 'Há uma vaga disponível'}</h1>
    <p style="margin:0 0 20px;line-height:1.6">${escapeHtml(intro)} ${english ? `Hello ${escapeHtml(event.customer_name)},` : `Olá ${escapeHtml(event.customer_name)},`}</p>
    <table role="presentation" style="width:100%;border-collapse:collapse">
      ${details.map(([label, value]) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e4e4e7;color:#71717a">${escapeHtml(label)}</td><td style="padding:10px 0;border-bottom:1px solid #e4e4e7;text-align:right;font-weight:600">${escapeHtml(value)}</td></tr>`).join('')}
    </table>
    <p style="margin:18px 0 8px;line-height:1.6">${escapeHtml(expiryNote)}</p>
    <p style="margin:0 0 22px;color:#71717a;font-size:13px;line-height:1.6">${escapeHtml(availabilityNote)}</p>
    <a href="${escapeHtml(bookingUrl.toString())}" style="display:inline-block;padding:13px 20px;border-radius:10px;background:#18181b;color:#fff;text-decoration:none;font-weight:700">${escapeHtml(button)}</a>
    <p style="margin:20px 0 6px;font-size:13px;line-height:1.5">${escapeHtml(declineNote)}</p>
    <a href="${escapeHtml(declineUrl.toString())}" style="display:inline-block;padding:10px 14px;border:1px solid #d4d4d8;border-radius:9px;color:#52525b;text-decoration:none;font-size:13px">${escapeHtml(declineLabel)}</a>
    <p style="margin:22px 0 0;color:#a1a1aa;font-size:12px">${escapeHtml(shopName)} · Silentra for Barbers</p>
  </main>
</body>
</html>`;

        if (!(await isCurrentOffer(admin, event))) {
          skipped += 1;
          continue;
        }

        const result = await sendBrevoEmail({
          to: email,
          toName: event.customer_name,
          senderName: shopName,
          subject,
          htmlContent,
        });
        if (!result.success)
          throw new Error(result.error || 'WAITLIST_EMAIL_DELIVERY_FAILED');
        deliveryAccepted = true;

        const { data: completed, error: completionError } = await admin.rpc(
          'complete_booking_waitlist_offer_delivery',
          {
            p_vacancy_id: event.vacancy_id,
            p_waitlist_id: event.waitlist_id,
          },
        );
        if (completionError) {
          // The provider accepted the email. Keep the dispatch lease intact so
          // recovery does not send a duplicate invitation.
          console.error('[BOOKING_WAITLIST_DELIVERY_STATE_FAILED]', {
            requestId,
            vacancyId: event.vacancy_id,
            code: completionError.code ?? 'UNKNOWN',
          });
          failed += 1;
          continue;
        }

        sent += 1;
        if (completed !== true) skipped += 1;
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : 'UNKNOWN_WAITLIST_OFFER_ERROR';
        if (!deliveryAccepted) {
          await releaseFailedOffer(admin, event, 'WAITLIST_OFFER_DELIVERY_FAILED');
        }
        failed += 1;
        console.error('[BOOKING_WAITLIST_OFFER_FAILED]', {
          requestId,
          vacancyId: event.vacancy_id,
          reason,
        });
      }
    }

    const result = {
      ok: failed === 0,
      requestId,
      claimed: events?.length ?? 0,
      sent,
      skipped,
      failed,
      durationMs: Date.now() - startedAt,
    };
    console.info('[BOOKING_WAITLIST_OFFERS_CRON]', result);
    return NextResponse.json(result, {
      status: failed === 0 ? 200 : 207,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[BOOKING_WAITLIST_OFFERS_CRON_FAILED]', {
      requestId,
      error: error instanceof Error ? error.message : 'UNKNOWN',
    });
    return NextResponse.json(
      { ok: false, requestId, error: 'Waitlist offer worker failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = withApiObservability(
  '/api/cron/booking-waitlist-offers',
  GET__unobserved,
);
export const POST = withApiObservability(
  '/api/cron/booking-waitlist-offers',
  GET__unobserved,
);
