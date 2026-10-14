import { createHash } from 'node:crypto';
import { withApiObservability } from '@/lib/observability/api';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getPublicProfileBySlug,
  isValidPublicProfileSlug,
} from '@/lib/barbershops/public-profile';
import { normalizeBarbershopAmenities } from '@/lib/barbershops/amenities';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT = 120;
const RATE_WINDOW_SECONDS = 60;
const PUBLIC_CACHE = 'public, s-maxage=60, stale-while-revalidate=300';
const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://barbers.silentra.me'
).replace(/\/$/, '');
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, If-None-Match',
  'Access-Control-Max-Age': '86400',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'X-API-Version': '1',
  'X-Content-Type-Options': 'nosniff',
};

function jsonResponse(
  payload: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

async function GET__unobserved(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await context.params;
  const slug = rawSlug.trim().toLowerCase();

  if (!isValidPublicProfileSlug(slug)) {
    return jsonResponse({ error: 'O slug da barbearia não é válido.' }, 400);
  }

  let allowed: boolean;
  try {
    allowed = await consumePublicRateLimit(
      request,
      'barbershops-public-v1',
      slug,
      RATE_LIMIT,
      RATE_WINDOW_SECONDS,
    );
  } catch {
    console.error('[PUBLIC_BARBERSHOP_V1_RATE_LIMIT]', 'unavailable');
    return jsonResponse(
      { error: 'A API pública está temporariamente indisponível.' },
      503,
    );
  }

  if (!allowed) {
    return jsonResponse(
      { error: 'Limite de pedidos atingido. Tenta novamente dentro de um minuto.' },
      429,
      { 'Retry-After': String(RATE_WINDOW_SECONDS) },
    );
  }

  try {
    const profile = await getPublicProfileBySlug(slug);
    if (!profile) {
      return jsonResponse({ error: 'Barbearia não encontrada.' }, 404, {
        'Cache-Control': 'public, max-age=30, s-maxage=30',
      });
    }

    const barbershopId = profile.barbershop_id ?? profile.id;
    const database = createAdminClient();
    const [
      { data: services, error: servicesError },
      { data: reviews, error: reviewsError },
      { data: shop, error: shopError },
      { data: hours, error: hoursError },
    ] = await Promise.all([
      database
        .from('services')
        .select('id, name, price, duration, popular')
        .eq('barbershop_id', barbershopId)
        .order('popular', { ascending: false })
        .order('name', { ascending: true })
        .limit(100),
      database
        .from('reviews')
        .select('id, client_name, rating, comment, created_at')
        .eq('barbershop_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(100),
      database
        .from('shops')
        .select('amenities, rating, reviews_count')
        .eq('barbershop_id', barbershopId)
        .maybeSingle(),
      database
        .from('barbershops')
        .select('opening_time, closing_time, lunch_start, lunch_end, closed_days')
        .eq('id', barbershopId)
        .maybeSingle(),
    ]);

    if (servicesError || reviewsError || shopError || hoursError) {
      console.error('[PUBLIC_BARBERSHOP_V1_DATA_ERROR]', {
        services: servicesError?.code ?? null,
        reviews: reviewsError?.code ?? null,
        shop: shopError?.code ?? null,
        hours: hoursError?.code ?? null,
      });
      return jsonResponse(
        { error: 'Não foi possível carregar os dados públicos da barbearia.' },
        503,
      );
    }

    const { data: landingEntitlement, error: landingError } =
      profile.plan === 'enterprise'
        ? await database
            .from('barbershop_landing_pages')
            .select('status')
            .eq('barbershop_id', barbershopId)
            .maybeSingle()
        : { data: null, error: null };

    if (landingError) {
      console.error('[PUBLIC_BARBERSHOP_V1_LANDING_PAGE_ERROR]', {
        code: landingError.code ?? 'UNKNOWN',
      });
    }

    const reviewItems = (reviews ?? []).map((review) => ({
      id: review.id,
      name: review.client_name,
      rating: Number(review.rating ?? 0),
      comment: review.comment ?? null,
      createdAt: review.created_at,
    }));
    const calculatedRating = reviewItems.length
      ? Number(
          (
            reviewItems.reduce((total, review) => total + review.rating, 0) /
            reviewItems.length
          ).toFixed(1),
        )
      : 0;
    const rating =
      typeof shop?.rating === 'number' && Number.isFinite(shop.rating)
        ? Number(shop.rating.toFixed(1))
        : calculatedRating;
    const reviewsCount =
      typeof shop?.reviews_count === 'number' && shop.reviews_count >= 0
        ? shop.reviews_count
        : reviewItems.length;
    const landingPath =
      profile.plan === 'enterprise' && landingEntitlement?.status === 'active'
        ? '/site/' + encodeURIComponent(profile.slug)
        : null;

    const payload = {
      apiVersion: '1',
      data: {
        barbershop: {
          id: profile.id,
          slug: profile.slug,
          name: profile.name,
          city: profile.city,
          address: profile.address,
          phone: profile.phone,
          avatarUrl: profile.avatar_url,
          coverUrl: profile.cover_url,
          tags: profile.tags,
          publicProfileEnabled: profile.public_profile_enabled,
          seo: {
            title: profile.seo_title,
            description: profile.seo_description,
            imageUrl: profile.og_image_url,
          },
          amenities: normalizeBarbershopAmenities(shop?.amenities),
          openingHours: {
            opens: hours?.opening_time ?? null,
            closes: hours?.closing_time ?? null,
            lunchStarts: hours?.lunch_start ?? null,
            lunchEnds: hours?.lunch_end ?? null,
            closedDays: hours?.closed_days ?? null,
          },
        },
        services: (services ?? []).map((service) => ({
          id: service.id,
          name: service.name,
          price: Number(service.price),
          currency: 'EUR',
          durationMinutes: Number(service.duration),
          popular: profile.plan !== 'free' && service.popular === true,
        })),
        reviews: reviewItems,
        rating,
        reviewsCount,
        bookingUrl: SITE_ORIGIN + '/barbershops/' + encodeURIComponent(profile.slug),
        landingPage: {
          available: landingPath !== null,
          url: landingPath ? SITE_ORIGIN + landingPath : null,
        },
      },
    };

    const body = JSON.stringify(payload);
    const etag = '"' + createHash('sha256').update(body).digest('hex') + '"';
    const requestEtags = (request.headers.get('if-none-match') ?? '')
      .split(',')
      .map((value) => value.trim());
    const headers = {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': PUBLIC_CACHE,
      ETag: etag,
    };

    if (requestEtags.includes(etag) || requestEtags.includes('*')) {
      return new Response(null, { status: 304, headers });
    }

    return new Response(body, { status: 200, headers });
  } catch (error) {
    console.error('[PUBLIC_BARBERSHOP_V1_INTERNAL_ERROR]', {
      error: error instanceof Error ? error.name : 'UNKNOWN',
    });
    return jsonResponse(
      { error: 'Ocorreu um erro ao consultar a API pública.' },
      500,
    );
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, Allow: 'GET, OPTIONS' },
  });
}

export const GET = withApiObservability(
  '/api/v1/public/barbershops/[slug]',
  GET__unobserved,
);
