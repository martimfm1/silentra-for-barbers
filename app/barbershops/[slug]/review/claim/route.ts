import { NextRequest, NextResponse } from 'next/server';
import { getPublicProfileBySlug } from '@/lib/barbershops/public-profile';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';
import {
  REVIEW_TOKEN_COOKIE_MAX_AGE,
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
  const response = NextResponse.redirect(
    cleanRedirect(request, profile.slug),
    303,
  );
  const cookieName = reviewTokenCookieName(profile.id);

  if (REVIEW_TOKEN_PATTERN.test(token)) {
    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: REVIEW_TOKEN_COOKIE_MAX_AGE,
    });
  } else {
    response.cookies.set(cookieName, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }

  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}
