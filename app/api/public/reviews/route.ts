import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { withApiObservability } from '@/lib/observability/api';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';
import { NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/security/request-validation';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_PATTERN } from '@/lib/validation';
import { assertSameOrigin } from '@/services/billing/http';
import {
  reviewAccessCookieName,
  reviewTokenCookieName,
} from '@/lib/reviews/review-token-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_COMMENT_LENGTH = 1000;
const REVIEW_RATE_LIMIT = 5;
const REVIEW_RATE_WINDOW_SECONDS = 60 * 60;

function jsonError(message: string, status: number, clearShopId?: string) {
  const response = NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    },
  );

  if (clearShopId) {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 0,
    };
    response.cookies.set(reviewTokenCookieName(clearShopId), '', {
      ...cookieOptions,
      path: '/api/public/reviews',
    });
    response.cookies.set(reviewAccessCookieName(clearShopId), '', {
      ...cookieOptions,
      path: '/',
    });
  }
  return response;
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

async function POST__unobserved(request: Request) {
  try {
    try {
      assertSameOrigin(request);
    } catch {
      return jsonError('A origem do pedido não é válida.', 403);
    }

    const bodyResult = await readJsonObject(request, {
      maxBytes: 4 * 1024,
      allowedKeys: ['barbershopId', 'rating', 'comment', 'website'],
    });
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.value;

    // Honeypot: automated submissions are accepted silently but never stored.
    if (typeof body.website === 'string' && body.website.trim()) {
      return NextResponse.json(
        { accepted: true },
        {
          status: 202,
          headers: {
            'Cache-Control': 'no-store',
            'Referrer-Policy': 'no-referrer',
          },
        },
      );
    }

    const shopId = cleanString(body.barbershopId, 100);
    const comment = cleanString(body.comment, MAX_COMMENT_LENGTH);
    const rating =
      typeof body.rating === 'number' ? body.rating : Number.NaN;

    if (!shopId || !UUID_PATTERN.test(shopId)) {
      return jsonError('Barbearia inválida.', 400);
    }

    const cookieStore = await cookies();
    const reviewToken =
      cookieStore.get(reviewTokenCookieName(shopId))?.value ?? '';

    if (!/^[A-Za-z0-9_-]{43}$/.test(reviewToken)) {
      return jsonError(
        'Utiliza a ligação segura recebida por email após o atendimento.',
        403,
        shopId,
      );
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return jsonError('A classificação deve estar entre 1 e 5.', 400);
    }

    if (typeof body.comment !== 'undefined' && body.comment !== null && typeof body.comment !== 'string') {
      return jsonError('O comentário não é válido.', 400);
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
        {
          error:
            'Atingiste o limite de avaliações. Tenta novamente mais tarde.',
        },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(REVIEW_RATE_WINDOW_SECONDS),
            'Referrer-Policy': 'no-referrer',
          },
        },
      );
    }

    const database = createAdminClient();
    const { data: shop, error: shopError } = await database
      .from('shops')
      .select('id, public_profile_enabled, is_active')
      .eq('id', shopId)
      .maybeSingle();

    if (shopError || !shop) {
      return jsonError('Barbearia não encontrada.', 404, shopId);
    }
    if (shop.is_active === false || shop.public_profile_enabled === false) {
      return jsonError(
        'Esta barbearia não aceita avaliações públicas.',
        403,
        shopId,
      );
    }

    // The database RPC binds the review to a completed appointment, derives
    // the customer's display name from that appointment, and consumes the
    // capability atomically. Never insert directly with service_role.
    const { error } = await database.rpc(
      'submit_public_review_with_token',
      {
        p_shop_id: shop.id,
        p_token_hash: createHash('sha256').update(reviewToken).digest('hex'),
        p_client_name: '',
        p_rating: rating,
        p_comment: comment,
      },
    );

    if (error) {
      console.error('[PUBLIC_REVIEW_SUBMIT_FAILED]', error.code ?? 'UNKNOWN');
      if (error.code === '42501') {
        return jsonError(
          'O link de avaliação é inválido, expirou ou já foi utilizado.',
          403,
          shopId,
        );
      }
      if (error.code === '22023') {
        return jsonError('Os dados da avaliação são inválidos.', 400);
      }
      return jsonError('Não foi possível guardar a avaliação.', 500);
    }

    const response = NextResponse.json(
      { success: true },
      {
        status: 201,
        headers: {
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
        },
      },
    );
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 0,
    };
    response.cookies.set(reviewTokenCookieName(shopId), '', {
      ...cookieOptions,
      path: '/api/public/reviews',
    });
    response.cookies.set(reviewAccessCookieName(shopId), '', {
      ...cookieOptions,
      path: '/',
    });
    return response;
  } catch (error) {
    // Fail closed if the shared production rate limiter is unavailable.
    if (
      error instanceof Error &&
      error.message === 'Public rate limiter unavailable.'
    ) {
      return jsonError(
        'O serviço de avaliações está temporariamente indisponível.',
        503,
      );
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
