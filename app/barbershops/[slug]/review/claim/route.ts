import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublicProfileBySlug } from '@/lib/barbershops/public-profile';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';
import {
  REVIEW_TOKEN_COOKIE_MAX_AGE,
  reviewAccessCookieName,
  reviewTokenCookieName,
} from '@/lib/reviews/review-token-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REVIEW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function cleanRedirect(request: NextRequest, slug: string) {
  return new URL(
    `/barbershops/${encodeURIComponent(slug)}/review`,
    request.url,
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const profile = await getPublicProfileBySlug(slug);

  if (!profile) {
    return NextResponse.json(
      { error: 'Barbearia não encontrada.' },
      {
        status: 404,
        headers: {
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      },
    );
  }

  const allowed = await consumePublicRateLimit(
    request,
    'public-review-claim',
    profile.id,
    30,
    60 * 60,
  );
  if (!allowed) {
    return NextResponse.json(
      { error: 'Este link foi aberto demasiadas vezes. Tenta novamente mais tarde.' },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
          'Retry-After': String(60 * 60),
          'X-Robots-Tag': 'noindex, nofollow',
        },
      },
    );
  }

  const token = request.nextUrl.searchParams.get('token') ?? '';
  const redirectUrl = cleanRedirect(request, profile.slug);
  const tokenCookieName = reviewTokenCookieName(profile.id);
  const accessCookieName = reviewAccessCookieName(profile.id);
  let claimStatus: 'already-used' | 'expired' | 'invalid' | 'unavailable' | null = null;

  if (!REVIEW_TOKEN_PATTERN.test(token)) {
    claimStatus = 'invalid';
  } else {
    const database = createAdminClient();
    const { data: tokenRecord, error } = await database
      .from('review_submission_tokens')
      .select('consumed_at, expires_at')
      .eq('shop_id', profile.id)
      .eq('token_hash', createHash('sha256').update(token).digest('hex'))
      .maybeSingle();

    if (error) {
      console.error('[PUBLIC_REVIEW_CLAIM_CHECK_FAILED]', error.code ?? 'UNKNOWN');
      claimStatus = 'unavailable';
    } else if (!tokenRecord) {
      claimStatus = 'invalid';
    } else if (tokenRecord.consumed_at) {
      claimStatus = 'already-used';
    } else if (new Date(tokenRecord.expires_at).getTime() <= Date.now()) {
      claimStatus = 'expired';
    }
  }

  if (claimStatus) redirectUrl.searchParams.set('review', claimStatus);
  const response = NextResponse.redirect(redirectUrl, 303);

  if (claimStatus) {
    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 0 };
    response.cookies.set(tokenCookieName, '', { ...cookieOptions, path: '/api/public/reviews' });
    response.cookies.set(accessCookieName, '', { ...cookieOptions, path: '/' });
  } else {
    response.cookies.set(tokenCookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/public/reviews',
      maxAge: REVIEW_TOKEN_COOKIE_MAX_AGE,
    });
    response.cookies.set(accessCookieName, '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: REVIEW_TOKEN_COOKIE_MAX_AGE,
    });
  }

  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}
