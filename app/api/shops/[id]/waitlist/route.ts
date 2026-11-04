import { NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/security/request-validation';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';
import { withApiObservability } from '@/lib/observability/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSafePublicBookingDate, isValidTime, normalizeText, UUID_PATTERN } from '@/lib/validation';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT = 8;
const RATE_WINDOW_SECONDS = 10 * 60;
const PUBLIC_BOOKING_WINDOW_DAYS = 14;

function isWithinPublicBookingWindow(date: string) {
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Europe/Lisbon',
  });
  const lastAllowed = new Date(`${today}T12:00:00Z`);
  lastAllowed.setUTCDate(lastAllowed.getUTCDate() + PUBLIC_BOOKING_WINDOW_DAYS - 1);
  return date >= today && date <= lastAllowed.toISOString().slice(0, 10);
}

type WaitlistBody = {
  serviceId?: unknown;
  professionalId?: unknown;
  date?: unknown;
  preferredTimeStart?: unknown;
  preferredTimeEnd?: unknown;
  customerName?: unknown;
  customerEmail?: unknown;
  customerPhone?: unknown;
  consent?: unknown;
};


async function POST__unobserved(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: shopId } = await context.params;
    if (!UUID_PATTERN.test(shopId))
      return NextResponse.json({ success: false, error: 'Barbearia inválida.' }, { status: 400 });

    const payload = await readJsonObject(request, {
      maxBytes: 8 * 1024,
      allowedKeys: [
        'serviceId',
        'professionalId',
        'date',
        'preferredTimeStart',
        'preferredTimeEnd',
        'customerName',
        'customerEmail',
        'customerPhone',
        'consent',
      ],
    });
    if (!payload.ok) return payload.response;
    const body = payload.value as WaitlistBody;

    const serviceId = typeof body.serviceId === 'string' ? body.serviceId : '';
    const professionalId =
      typeof body.professionalId === 'string' && body.professionalId
        ? body.professionalId
        : null;
    const date = typeof body.date === 'string' ? body.date : '';
    const timeStart =
      typeof body.preferredTimeStart === 'string' ? body.preferredTimeStart.slice(0, 5) : null;
    const timeEnd =
      typeof body.preferredTimeEnd === 'string' ? body.preferredTimeEnd.slice(0, 5) : null;
    const name = normalizeText(body.customerName, 120);
    const email = normalizeText(body.customerEmail, 254)?.toLowerCase();
    const phone = normalizeText(body.customerPhone, 30);

    if (
      !UUID_PATTERN.test(serviceId) ||
      (professionalId && !UUID_PATTERN.test(professionalId)) ||
      !isSafePublicBookingDate(date) ||
      !isWithinPublicBookingWindow(date) ||
      !name ||
      name.length < 2 ||
      !email ||
      !EMAIL_PATTERN.test(email) ||
      !phone ||
      phone.replace(/\D/g, '').length < 7 ||
      body.consent !== true ||
      (timeStart && !isValidTime(timeStart)) ||
      (timeEnd && !isValidTime(timeEnd)) ||
      Boolean(timeStart) !== Boolean(timeEnd) ||
      (timeStart && timeEnd && timeStart >= timeEnd)
    ) {
      return NextResponse.json(
        { success: false, error: 'Verifica os teus dados e aceita o aviso para entrar na lista de espera.' },
        { status: 400 },
      );
    }

    const allowed = await consumePublicRateLimit(
      request,
      'customer-waitlist',
      shopId,
      RATE_LIMIT,
      RATE_WINDOW_SECONDS,
    );
    if (!allowed)
      return NextResponse.json(
        { success: false, error: 'Demasiados pedidos. Tenta novamente mais tarde.' },
        { status: 429, headers: { 'Retry-After': String(RATE_WINDOW_SECONDS) } },
      );

    const admin = createAdminClient();

    const { data: shop, error: shopError } = await admin
      .from('shops')
      .select('id,barbershop_id,is_active')
      .eq('id', shopId)
      .maybeSingle();
    if (shopError || !shop || shop.is_active !== true || !shop.barbershop_id)
      return NextResponse.json({ success: false, error: 'Barbearia indisponível.' }, { status: 404 });

    const serviceQuery = await admin
      .from('services')
      .select('id')
      .eq('id', serviceId)
      .eq('barbershop_id', shop.barbershop_id)
      .eq('is_active', true)
      .maybeSingle();
    if (serviceQuery.error && serviceQuery.error.code !== '42703')
      throw new Error('WAITLIST_SERVICE_LOOKUP_FAILED');

    let serviceExists = Boolean(serviceQuery.data);
    if (!serviceExists) {
      const legacyServiceQuery = await admin
        .from('services')
        .select('id')
        .eq('id', serviceId)
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .maybeSingle();
      if (legacyServiceQuery.error && legacyServiceQuery.error.code !== '42703')
        throw new Error('WAITLIST_LEGACY_SERVICE_LOOKUP_FAILED');
      serviceExists = Boolean(legacyServiceQuery.data);
    }
    if (!serviceExists)
      return NextResponse.json({ success: false, error: 'Serviço indisponível.' }, { status: 400 });

    if (professionalId) {
      const { data: professional, error: professionalError } = await admin
        .from('professionals')
        .select('id')
        .eq('id', professionalId)
        .eq('barbershop_id', shop.barbershop_id)
        .eq('active', true)
        .maybeSingle();
      if (professionalError || !professional)
        return NextResponse.json({ success: false, error: 'Profissional indisponível.' }, { status: 400 });
    }

    let duplicateQuery = admin
      .from('booking_waitlist')
      .select('id')
      .eq('shop_id', shopId)
      .eq('service_id', serviceId)
      .eq('customer_email', email)
      .eq('preferred_date', date)
      .in('status', ['waiting', 'offered']);
    duplicateQuery = professionalId
      ? duplicateQuery.eq('professional_id', professionalId)
      : duplicateQuery.is('professional_id', null);
    const { data: existing, error: duplicateError } = await duplicateQuery.maybeSingle();
    if (duplicateError)
      throw new Error('WAITLIST_DUPLICATE_CHECK_FAILED');
    if (existing)
      return NextResponse.json(
        { success: false, error: 'Já estás na lista de espera para este serviço e dia.' },
        { status: 409 },
      );

    const { data: entry, error: insertError } = await admin
      .from('booking_waitlist')
      .insert({
        barbershop_id: shop.barbershop_id,
        shop_id: shopId,
        service_id: serviceId,
        professional_id: professionalId,
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        preferred_date: date,
        preferred_time_start: timeStart,
        preferred_time_end: timeEnd,
        status: 'waiting',
        consented_at: new Date().toISOString(),
      })
      .select('id,status')
      .single();
    if (insertError) {
      if (insertError.code === '23505')
        return NextResponse.json(
          { success: false, error: 'Já estás na lista de espera para este serviço e dia.' },
          { status: 409 },
        );
      throw new Error('WAITLIST_INSERT_FAILED');
    }

    return NextResponse.json(
      { success: true, entry: { id: entry.id, status: entry.status } },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[PUBLIC_WAITLIST_CREATE_ERROR]',
      error instanceof Error ? error.message : 'UNKNOWN',
    );
    return NextResponse.json(
      { success: false, error: 'Não foi possível entrar na lista de espera.' },
      { status: 503 },
    );
  }
}


export const POST = withApiObservability(
  '/api/shops/[id]/waitlist',
  POST__unobserved,
);
