import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublicProfileBySlug } from '@/lib/barbershops/public-profile';
import { requireTenantAuthorization } from '@/lib/security/tenant-guard';
import { normalizeBarbershopAmenities } from '@/lib/barbershops/amenities';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function notFound() {
  return NextResponse.json(
    { error: 'Barbearia não encontrada.' },
    {
      status: 404,
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    },
  );
}

async function GET__unobserved(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const profile = await getPublicProfileBySlug(slug);
    if (!profile) return notFound();
    const barbershopId = profile.barbershop_id ?? null;
    if (!barbershopId) return notFound();
    await requireTenantAuthorization({ barbershopId, allowPublicTenant: true });
    const database = createAdminClient();
    const [
      { data: services, error: servicesError },
      { data: reviews, error: reviewsError },
      { data: shop, error: shopError },
    ] = await Promise.all([
      database
        .from('services')
        .select('id, name, price, duration, popular')
        .eq('barbershop_id', barbershopId)
        .order('popular', { ascending: false })
        .order('name', { ascending: true }),
      database
        .from('reviews')
        .select('id, client_name, rating, comment, created_at')
        .eq('barbershop_id', profile.id)
        .order('created_at', { ascending: false }),
      database
        .from('shops')
        .select('amenities')
        .eq('barbershop_id', barbershopId)
        .maybeSingle(),
    ]);

    if (servicesError || reviewsError || shopError) {
      console.error('[PUBLIC_BARBERSHOP_API_ERROR]', {
        services: servicesError?.code ?? null,
        reviews: reviewsError?.code ?? null,
        shop: shopError?.code ?? null,
      });
      return NextResponse.json(
        { error: 'Não foi possível carregar os dados da barbearia.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const { data: landingPage, error: landingPageError } =
      profile.plan === 'enterprise'
        ? await database
            .from('barbershop_landing_pages')
            .select('status')
            .eq('barbershop_id', barbershopId)
            .maybeSingle()
        : { data: null, error: null };
    if (landingPageError) {
      console.error('[PUBLIC_BARBERSHOP_API_LANDING_PAGE]', {
        code: landingPageError.code ?? 'UNKNOWN',
      });
    }
    const { owner_user_id: ownerUserId, ...publicProfile } = profile;
    void ownerUserId;

    const reviewItems = reviews ?? [];
    const ratingAverage = reviewItems.length
      ? Number(
          (
            reviewItems.reduce(
              (total, review) => total + Number(review.rating || 0),
              0,
            ) / reviewItems.length
          ).toFixed(1),
        )
      : 0;

    return NextResponse.json(
      {
        data: {
          ...publicProfile,
          landing_page_url:
            profile.plan === 'enterprise' && landingPage?.status === 'active'
              ? '/site/' + encodeURIComponent(profile.slug)
              : null,
          amenities: normalizeBarbershopAmenities(shop?.amenities),
          services: (services ?? []).map((service) => ({
            ...service,
            popular: profile.plan !== 'free' && service.popular === true,
          })),
          reviews: reviewItems,
          rating: ratingAverage,
          reviewsCount: reviewItems.length,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível carregar a barbearia.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = withApiObservability(
  '/api/public/barbershops/[slug]',
  GET__unobserved,
);
