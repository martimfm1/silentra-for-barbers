import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/security/request-validation';
import { getClientIp } from '@/lib/security/public-rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSafePublicBookingDate, isValidTime, normalizeText, UUID_PATTERN } from '@/lib/validation';

const EMAIL_PATTERN = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
const RATE_LIMIT = 8;
const RATE_WINDOW_SECONDS = 10 * 60;

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

function rateLimitKey(request: Request, shopId: string) {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('RATE_LIMIT_SECRET is not configured.');
  return createHmac('sha256', secret)
    .update(`public-waitlist:${shopId}:${getClientIp(request)}`)
    .digest('hex');
}

async function enforceRateLimit(request: Request, shopId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('consume_public_rate_limit', {
    p_key: rateLimitKey(request, shopId),
    p_limit: RATE_LIMIT,
    p_window_seconds: RATE_WINDOW_SECONDS,
  });
  if (error) throw new Error('WAITLIST_RATE_LIMIT_UNAVAILABLE');
  return data === true;
}

export async function POST(
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
      !name ||
      name.length < 2 ||
      !email ||
      !EMAIL_PATTERN.test(email) ||
      !phone ||
      phone.replace(/\\D/g, '').length < 7 ||
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

    const admin = createAdminClient();
    if (!(await enforceRateLimit(request, shopId)))
      return NextResponse.json(
        { success: false, error: 'Demasiados pedidos. Tenta novamente mais tarde.' },
        { status: 429, headers: { 'Retry-After': String(RATE_WINDOW_SECONDS) } },
      );

    const { data: shop, error: shopError } = await admin
      .from('shops')
      .select('id,barbershop_id,is_active')
      .eq('id', shopId)
      .maybeSingle();
    if (shopError || !shop || shop.is_active !== true || !shop.barbershop_id)
      return NextResponse.json({ success: false, error: 'Barbearia indisponível.' }, { status: 404 });

    const { data: service, error: serviceError } = await admin
      .from('services')
      .select('id')
      .eq('id', serviceId)
      .eq('barbershop_id', shop.barbershop_id)
      .eq('is_active', true)
      .maybeSingle();
    if (serviceError || !service)
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
