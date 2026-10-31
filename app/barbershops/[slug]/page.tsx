import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { UUID_PATTERN } from '@/lib/validation';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getPublicProfileById,
  getPublicProfileByRedirect,
  getPublicProfileBySlug,
  isValidPublicProfileSlug,
} from '@/lib/barbershops/public-profile';
import { normalizeBarbershopAmenities } from '@/lib/barbershops/amenities';
import { DEFAULT_BARBERSHOP_BANNER } from '@/lib/barbershops/default-media';
import BarbershopPublicPage from './public-barbershop-page';
import ProBookingPage from './pro-booking-page';
import type { PublicProfileRecord } from '@/lib/barbershops/public-profile';
import type { BarbershopPublicDetails } from './services/public-barbershop.service';

interface BarbershopPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ booking?: string }>;
}

const AGENDA_DO_VICTOR_BARBERSHOP_ID = 'f9cf1bca-22ec-4782-87ca-c338d51fc30d';

const PUBLIC_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://barbers.silentra.me'
).replace(/\/$/, '');

function absoluteUrl(path: string): string {
  return `${PUBLIC_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

function logPublicProfile(
  level: 'info' | 'warn',
  event: string,
  slug: string,
  details?: Record<string, string | boolean>,
) {
  const payload = { event, route: '/barbershops/[slug]', slug, ...details };
  if (level === 'warn') console.warn('[PUBLIC_BARBERSHOP]', payload);
  else console.info('[PUBLIC_BARBERSHOP]', payload);
}

export async function generateMetadata({
  params,
}: BarbershopPageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfileBySlug(slug);
  if (!profile) return {};
  let canonicalPath =
    profile.barbershop_id === AGENDA_DO_VICTOR_BARBERSHOP_ID &&
    profile.plan === 'pro'
      ? '/agendadovictor'
      : `/barbershops/${encodeURIComponent(profile.slug)}`;
  if (profile.plan === 'enterprise' && profile.barbershop_id) {
    const database = createAdminClient();
    const { data: landingPage, error } = await database
      .from('barbershop_landing_pages')
      .select('status')
      .eq('barbershop_id', profile.barbershop_id)
      .maybeSingle();
    if (error) {
      console.error('[PUBLIC_BARBERSHOP]', {
        event: 'landing_page_metadata_lookup_failed',
        slug: profile.slug,
        code: error.code ?? 'UNKNOWN',
      });
    } else if (landingPage?.status === 'active') {
      canonicalPath = `/site/${encodeURIComponent(profile.slug)}`;
    }
  }
  const title =
    profile.seo_title?.trim() ||
    `${profile.name} — Barbearia${profile.city ? ` em ${profile.city}` : ''} | Agendamento Online`;
  const description =
    profile.seo_description?.trim() ||
    `Consulta serviços, preços, horário e localização da ${profile.name}. Marca o teu próximo serviço online em poucos segundos.`;
  const image =
    profile.og_image_url ||
    profile.cover_url ||
    profile.avatar_url ||
    absoluteUrl(DEFAULT_BARBERSHOP_BANNER);
  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      title,
      description,
      url: absoluteUrl(canonicalPath),
      siteName: 'Silentra for Barbers',
      ...(image ? { images: [{ url: image, alt: profile.name }] } : {}),
      locale: 'pt_PT',
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

function PublicBusinessJsonLd({
  name,
  url,
  address,
  city,
  phone,
  image,
}: {
  name: string;
  url: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  image: string | null;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Barbershop',
    name,
    url,
    ...(phone ? { telephone: phone } : {}),
    ...(image ? { image: [image] } : {}),
    ...(address || city
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(address ? { streetAddress: address } : {}),
            ...(city ? { addressLocality: city } : {}),
            addressCountry: 'PT',
          },
        }
      : {}),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

function getResolvedProfileUrl(profile: PublicProfileRecord): string {
  return `/barbershops/${encodeURIComponent(profile.slug)}`;
}

async function getInitialPublicDetails(
  profile: PublicProfileRecord,
): Promise<BarbershopPublicDetails> {
  const database = createAdminClient();
  const barbershopId = profile.barbershop_id ?? profile.id;
  const [
    { data: services },
    { data: reviews },
    { data: barbershop },
    { data: shop },
    { data: landingPage, error: landingPageError },
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
      .from('barbershops')
      .select('opening_time, closing_time, lunch_start, lunch_end, closed_days')
      .eq('id', barbershopId)
      .maybeSingle(),
    database
      .from('shops')
      .select('amenities')
      .eq('barbershop_id', barbershopId)
      .maybeSingle(),
    database
      .from('barbershop_landing_pages')
      .select('status')
      .eq('barbershop_id', barbershopId)
      .maybeSingle(),
  ]);

  if (landingPageError) {
    console.error('[PUBLIC_BARBERSHOP]', {
      event: 'landing_page_entitlement_lookup_failed',
      slug: profile.slug,
      code: landingPageError.code ?? 'UNKNOWN',
    });
  }

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
  const { owner_user_id: ownerUserId, ...publicProfile } = profile;
  void ownerUserId;
  return {
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
    opening_time: barbershop?.opening_time ?? null,
    closing_time: barbershop?.closing_time ?? null,
    lunch_start: barbershop?.lunch_start ?? null,
    lunch_end: barbershop?.lunch_end ?? null,
    closed_days: barbershop?.closed_days ?? null,
  } as BarbershopPublicDetails;
}

async function getPublicLoyaltyEnabled(
  profile: PublicProfileRecord,
): Promise<boolean> {
  if (!['pro', 'enterprise'].includes(profile.plan)) return false;
  const database = createAdminClient();
  const { data, error } = await database
    .from('loyalty_settings')
    .select('enabled')
    .eq('barbershop_id', profile.barbershop_id ?? profile.id)
    .maybeSingle();
  if (error) {
    console.error('[PUBLIC_BARBERSHOP]', {
      event: 'loyalty_settings_lookup_failed',
      slug: profile.slug,
      code: error.code ?? 'UNKNOWN',
    });
    return false;
  }
  return data?.enabled === true;
}

export default async function BarbershopPage({
  params,
  searchParams,
}: BarbershopPageProps) {
  const [{ slug }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({ booking: undefined }),
  ]);
  const bookingMode = query.booking === '1';
  logPublicProfile('info', 'request', slug, {
    isUuid: UUID_PATTERN.test(slug),
  });
  let profile: PublicProfileRecord | null = null;

  if (UUID_PATTERN.test(slug)) {
    profile = await getPublicProfileById(slug);
    if (!profile) {
      logPublicProfile('warn', 'id_resolution_failed', slug);
      notFound();
    }
    logPublicProfile('info', 'id_resolved', slug, {
      hasCustomSlug: Boolean(profile.custom_slug),
      publicProfileEnabled: profile.public_profile_enabled,
    });
    permanentRedirect(getResolvedProfileUrl(profile));
  }

  if (!isValidPublicProfileSlug(slug)) {
    logPublicProfile('warn', 'invalid_slug', slug);
    notFound();
  }
  profile = await getPublicProfileBySlug(slug);

  if (!profile) {
    const redirectProfile = await getPublicProfileByRedirect(slug);
    if (redirectProfile) {
      logPublicProfile('info', 'legacy_slug_redirect', slug, {
        publicProfileEnabled: redirectProfile.public_profile_enabled,
      });
      permanentRedirect(getResolvedProfileUrl(redirectProfile));
    }
    logPublicProfile('warn', 'slug_resolution_failed', slug);
    notFound();
  }

  if (slug !== profile.slug) {
    logPublicProfile('info', 'canonical_redirect', slug, {
      publicProfileEnabled: profile.public_profile_enabled,
    });
    permanentRedirect(getResolvedProfileUrl(profile));
  }

  if (
    profile.barbershop_id === AGENDA_DO_VICTOR_BARBERSHOP_ID &&
    profile.plan === 'pro'
  ) {
    permanentRedirect('/agendadovictor');
  }

  const initialData = await getInitialPublicDetails(profile);
  if (profile.plan === 'enterprise' && !initialData.landing_page_url && !bookingMode) {
    console.error('[PUBLIC_BARBERSHOP]', {
      event: 'enterprise_landing_page_not_active',
      slug: profile.slug,
    });
    notFound();
  }
  if (
    profile.plan === 'enterprise' &&
    initialData.landing_page_url &&
    !bookingMode
  ) {
    permanentRedirect(initialData.landing_page_url);
  }

  if (profile.plan === 'pro' || (profile.plan === 'enterprise' && bookingMode)) {
    const canonicalPath =
      profile.plan === 'enterprise'
        ? `/site/${encodeURIComponent(profile.slug)}`
        : getResolvedProfileUrl(profile);
    return (
      <>
        <PublicBusinessJsonLd
          name={profile.name}
          url={absoluteUrl(canonicalPath)}
          address={profile.address}
          city={profile.city}
          phone={profile.phone}
          image={
            profile.og_image_url ||
            profile.cover_url ||
            profile.avatar_url ||
            absoluteUrl(DEFAULT_BARBERSHOP_BANNER)
          }
        />
        <ProBookingPage
          profile={initialData}
          services={initialData.services}
          openingTime={initialData.opening_time ?? null}
          closingTime={initialData.closing_time ?? null}
          closedDays={initialData.closed_days ?? null}
        />
      </>
    );
  }

  const loyaltyEnabled = await getPublicLoyaltyEnabled(profile);
  logPublicProfile('info', 'render', slug, { loyaltyEnabled });
  const canonicalUrl = absoluteUrl(getResolvedProfileUrl(profile));
  const image =
    profile.og_image_url ||
    profile.cover_url ||
    profile.avatar_url ||
    absoluteUrl(DEFAULT_BARBERSHOP_BANNER);

  return (
    <>
      <PublicBusinessJsonLd
        name={profile.name}
        url={canonicalUrl}
        address={profile.address}
        city={profile.city}
        phone={profile.phone}
        image={image}
      />
      <BarbershopPublicPage
        slug={profile.slug}
        loyaltyEnabled={loyaltyEnabled}
        initialData={initialData}
      />
    </>
  );
}
