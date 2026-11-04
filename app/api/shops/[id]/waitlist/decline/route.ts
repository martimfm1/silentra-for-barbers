import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { readJsonObject } from '@/lib/security/request-validation';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_PATTERN } from '@/lib/validation';

type DeclineBody = {
  vacancyId?: unknown;
  waitlistId?: unknown;
  expires?: unknown;
  signature?: unknown;
};

function getSigningSecret() {
  return (
    process.env.BOOKING_OUTBOX_CRON_SECRET ?? process.env.CRON_SECRET
  )?.trim();
}

function validSignature(
  secret: string,
  shopId: string,
  vacancyId: string,
  waitlistId: string,
  expires: number,
  signature: string,
) {
  const expected = createHmac('sha256', secret)
    .update(
      `booking-waitlist-decline:${shopId}:${vacancyId}:${waitlistId}:${expires}`,
    )
    .digest();
  const supplied = Buffer.from(signature, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function POST__unobserved(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: shopId } = await context.params;
    if (!UUID_PATTERN.test(shopId))
      return NextResponse.json({ success: false, error: 'Pedido inválido.' }, { status: 400 });

    const payload = await readJsonObject(request, {
      maxBytes: 4 * 1024,
      allowedKeys: ['vacancyId', 'waitlistId', 'expires', 'signature'],
    });
    if (!payload.ok) return payload.response;
    const body = payload.value as DeclineBody;

    const vacancyId = typeof body.vacancyId === 'string' ? body.vacancyId : '';
    const waitlistId = typeof body.waitlistId === 'string' ? body.waitlistId : '';
    const expiresRaw = typeof body.expires === 'string' ? body.expires : '';
    const signature = typeof body.signature === 'string' ? body.signature : '';
    const expires = /^\d{10}$/.test(expiresRaw) ? Number(expiresRaw) : 0;

    if (
      !UUID_PATTERN.test(vacancyId) ||
      !UUID_PATTERN.test(waitlistId) ||
      !expires ||
      !/^[a-f0-9]{64}$/i.test(signature)
    ) {
      return NextResponse.json(
        { success: false, error: 'O link não é válido.' },
        { status: 400 },
      );
    }

    const secret = getSigningSecret();
    if (!secret || secret.length < 32)
      return NextResponse.json(
        { success: false, error: 'O serviço está temporariamente indisponível.' },
        { status: 503 },
      );

    if (Date.now() >= expires * 1000)
      return NextResponse.json(
        { success: false, error: 'Esta proposta já expirou.' },
        { status: 410 },
      );

    if (!validSignature(secret, shopId, vacancyId, waitlistId, expires, signature))
      return NextResponse.json(
        { success: false, error: 'O link não é válido.' },
        { status: 403 },
      );

    const allowed = await consumePublicRateLimit(
      request,
      'waitlist-offer-decline',
      shopId,
      20,
      10 * 60,
    );
    if (!allowed)
      return NextResponse.json(
        { success: false, error: 'Demasiados pedidos. Tenta novamente mais tarde.' },
        { status: 429, headers: { 'Retry-After': '600' } },
      );

    const admin = createAdminClient();
    const expiresAt = new Date(expires * 1000).toISOString();
    const { data: vacancy, error: vacancyError } = await admin
      .from('booking_waitlist_vacancies')
      .select('id')
      .eq('id', vacancyId)
      .eq('shop_id', shopId)
      .eq('waitlist_id', waitlistId)
      .in('status', ['dispatching', 'offered'])
      .gt('offer_expires_at', new Date().toISOString())
      .maybeSingle();

    if (vacancyError)
      throw new Error('WAITLIST_OFFER_LOOKUP_FAILED');
    if (!vacancy)
      return NextResponse.json(
        { success: false, error: 'Esta proposta já não está disponível.' },
        { status: 410 },
      );

    const { data: entry, error: updateError } = await admin
      .from('booking_waitlist')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', waitlistId)
      .eq('shop_id', shopId)
      .eq('status', 'offered')
      .gt('offer_expires_at', expiresAt)
      .select('id,status')
      .maybeSingle();

    if (updateError)
      throw new Error('WAITLIST_DECLINE_UPDATE_FAILED');
    if (!entry)
      return NextResponse.json(
        { success: false, error: 'Esta proposta já foi atualizada ou utilizada.' },
        { status: 409 },
      );

    return NextResponse.json(
      { success: true, status: 'cancelled' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[PUBLIC_WAITLIST_DECLINE_ERROR]',
      error instanceof Error ? error.message : 'UNKNOWN',
    );
    return NextResponse.json(
      { success: false, error: 'Não foi possível atualizar o pedido.' },
      { status: 503 },
    );
  }
}

export const POST = withApiObservability(
  '/api/shops/[id]/waitlist/decline',
  POST__unobserved,
);
