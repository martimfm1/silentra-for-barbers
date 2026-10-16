import { createHash } from 'node:crypto';
import { withApiObservability } from '@/lib/observability/api';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';
import { NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/security/request-validation';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_PATTERN } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_NAME_LENGTH = 80;
const MAX_COMMENT_LENGTH = 1000;
const REVIEW_RATE_LIMIT = 5;
const REVIEW_RATE_WINDOW_SECONDS = 60 * 60;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

async function POST__unobserved(request: Request) {
  try {
    const bodyResult = await readJsonObject(request, {
      maxBytes: 8 * 1024,
      allowedKeys: ['barbershopId', 'clientName', 'rating', 'comment', 'reviewToken'],
    });
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.value;

    const shopId = cleanString(body.barbershopId, 100);
    const clientName = cleanString(body.clientName, MAX_NAME_LENGTH);
    const comment = cleanString(body.comment, MAX_COMMENT_LENGTH);
    const reviewToken = cleanString(body.reviewToken, 64);
    const rating =
      typeof body.rating === 'number' ? body.rating : Number(body.rating);

    if (
      !shopId ||
      !UUID_PATTERN.test(shopId) ||
      !clientName ||
      !reviewToken ||
      !/^[A-Za-z0-9_-]{43}$/.test(reviewToken)
    )
      return jsonError('Utiliza o link de avaliação recebido após o atendimento.', 400);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return jsonError('A classificação deve estar entre 1 e 5.', 400);
    }

    const allowed = await consumePublicRateLimit(
      request,
      'public-review-submit',
      shopId,
      REVIEW_RATE_LIMIT,
      REVIEW_RATE_WINDOW_SECONDS,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: 'Atingiste o limite de avaliações. Tenta novamente mais tarde.' },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(REVIEW_RATE_WINDOW_SECONDS),
          },
        },
      );
    }

    const database = createAdminClient();
    const { data: shop, error: shopError } = await database
      .from('shops')
      .select('id, public_profile_enabled')
      .eq('id', shopId)
      .maybeSingle();

    if (shopError || !shop) return jsonError('Barbearia não encontrada.', 404);
    if (shop.public_profile_enabled === false)
      return jsonError('Esta barbearia não aceita avaliações públicas.', 403);

    // Keep review validation and aggregate updates in the database RPC/trigger.
    // Do not write directly with service_role, which bypasses RLS policies.
    const { data, error } = await database.rpc(
      'submit_public_review_with_token',
      {
        p_shop_id: shop.id,
        p_token_hash: createHash('sha256').update(reviewToken).digest('hex'),
        p_client_name: clientName,
        p_rating: rating,
        p_comment: comment,
      },
    );

    if (error || !data) {
      console.error('[PUBLIC_REVIEW_SUBMIT_FAILED]', error?.code ?? 'UNKNOWN');
      if (error?.code === '42501')
        return jsonError('O link de avaliação é inválido, expirou ou já foi utilizado.', 403);
      if (error?.code === '22023')
        return jsonError('Os dados da avaliação são inválidos.', 400);
      return jsonError('Não foi possível guardar a avaliação.', 500);
    }

    return NextResponse.json(
      { data },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    // Fail closed if the shared production rate limiter is unavailable.
    if (
      error instanceof Error &&
      error.message === 'Public rate limiter unavailable.'
    ) {
      return jsonError('O serviço de avaliações está temporariamente indisponível.', 503);
    }
    console.error(
      '[PUBLIC_REVIEW_REQUEST_FAILED]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return jsonError('Não foi possível processar a avaliação.', 500);
  }
}

export const POST = withApiObservability(
  '/api/public/reviews',
  POST__unobserved,
);
