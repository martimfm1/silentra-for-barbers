import type { Metadata } from 'next';
import Link from 'next/link';
import { cache, type CSSProperties } from 'react';
import SilentraDemoBarbershop from '@/app/silentra/silentra-demo-barbershop';
import { notFound, permanentRedirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeBarbershopAmenities, type BarbershopAmenities } from '@/lib/barbershops/amenities';
import { normalizeWeeklySchedule, WEEKDAY_KEYS, type WeeklySchedule, type WeekdayKey } from '@/lib/scheduling/weekly-schedule';
import { resolveEnterpriseLandingPalette, type EnterpriseLandingPageConfig } from '@/lib/barbershops/enterprise-landing-page-config';
import {
  getPublicProfileBySlug,
  isValidPublicProfileSlug,
  type PublicProfileRecord,
} from '@/lib/barbershops/public-profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LandingService {
  id: string;
  name: string;
  price: number | string;
  duration: number;
  popular: boolean | null;
}

interface LandingReview {
  id: string;
  client_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface LandingProfessional {
  id: string;
  name: string;
}

interface LandingPageData {
  profile: PublicProfileRecord;
  services: LandingService[];
  professionals: LandingProfessional[];
  reviews: LandingReview[];
  rating: number;
  reviewsCount: number;
  weeklySchedule: WeeklySchedule;
  amenities: BarbershopAmenities;
  latitude: number | null;
  longitude: number | null;
  language: 'pt' | 'en';
  coverUrl: string | null;
  avatarUrl: string | null;
}

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://barbers.silentra.me'
).replace(/\/$/, '');

const SILENTRA_DEMO_PUBLIC_SLUG = 'barbearia-silentra-ecf1da6c';

function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function withCacheVersion(
  value: string | null | undefined,
  version: string | null | undefined,
): string | null {
  const safeUrl = safeHttpsUrl(value);
  if (!safeUrl || !version) return safeUrl;
  try {
    const parsed = new URL(safeUrl);
    const timestamp = Date.parse(version);
    parsed.searchParams.set(
      'v',
      Number.isFinite(timestamp) ? String(timestamp) : version,
    );
    return parsed.toString();
  } catch {
    return safeUrl;
  }
}

const getLandingPageData = cache(
  async (requestedSlug: string): Promise<LandingPageData | null> => {
    const slug = requestedSlug.trim().toLowerCase();
    if (!isValidPublicProfileSlug(slug)) return null;

    const profile = await getPublicProfileBySlug(slug);
    if (!profile || profile.plan !== 'enterprise') return null;

    const barbershopId = profile.barbershop_id ?? profile.id;
    const database = createAdminClient();
    const [
      { data: entitlement, error: entitlementError },
      { data: services, error: servicesError },
      { data: hours, error: hoursError },
      { data: shop, error: shopError },
      { data: reviews, error: reviewsError },
      { data: professionals, error: professionalsError },
      { data: bannerFiles, error: bannerFilesError },
    ] = await Promise.all([
      database
        .from('barbershop_landing_pages')
        .select('status, template_version')
        .eq('barbershop_id', barbershopId)
        .maybeSingle(),
      database
        .from('services')
        .select('id, name, price, duration, popular')
        .eq('barbershop_id', barbershopId)
        .eq('is_active', true)
        .order('popular', { ascending: false })
        .order('name', { ascending: true })
        .limit(50),
      database
        .from('barbershops')
        .select(
          'opening_time, closing_time, lunch_start, lunch_end, closed_days, weekly_schedule, default_language, avatar_url, updated_at',
        )
        .eq('id', barbershopId)
        .maybeSingle(),
      database
        .from('shops')
        .select('amenities, lat, lng, rating, reviews_count')
        .eq('barbershop_id', barbershopId)
        .maybeSingle(),
      database
        .from('reviews')
        .select('id, client_name, rating, comment, created_at')
        .eq('barbershop_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(6),
      database
        .from('professionals')
        .select('id, name')
        .eq('barbershop_id', barbershopId)
        .eq('active', true)
        .order('name', { ascending: true })
        .limit(20),
      database.storage
        .from('banner')
        .list(barbershopId, { limit: 100, search: 'banner.webp' }),
    ]);

    if (entitlementError) {
      console.error('[ENTERPRISE_LANDING_PAGE_LOOKUP_FAILED]', {
        operation: 'entitlement',
        code: entitlementError.code ?? 'UNKNOWN',
      });
      return null;
    }
    if (!entitlement || entitlement.status !== 'active') return null;

    if (
      servicesError ||
      hoursError ||
      shopError ||
      reviewsError ||
      professionalsError
    ) {
      console.error('[ENTERPRISE_LANDING_PAGE_LOOKUP_FAILED]', {
        operation: 'public_content',
        services: servicesError?.code ?? null,
        hours: hoursError?.code ?? null,
        shop: shopError?.code ?? null,
        reviews: reviewsError?.code ?? null,
        professionals: professionalsError?.code ?? null,
      });
      return null;
    }

    const reviewItems = (reviews ?? []) as LandingReview[];
    const calculatedRating = reviewItems.length
      ? reviewItems.reduce((sum, review) => sum + Number(review.rating || 0), 0) /
        reviewItems.length
      : 0;
    const storedRating = Number(shop?.rating ?? 0);
    const rating =
      Number.isFinite(storedRating) && storedRating > 0
        ? Number(storedRating.toFixed(1))
        : Number(calculatedRating.toFixed(1));
    const storedReviewsCount = Number(shop?.reviews_count ?? 0);
    const settingsBannerFile = !bannerFilesError
      ? (bannerFiles ?? []).find((file) => file.name === 'banner.webp')
      : null;
    const supabaseStorageOrigin = (
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
    ).replace(/\/$/, '');
    const settingsBannerUrl =
      settingsBannerFile && supabaseStorageOrigin
        ? supabaseStorageOrigin +
          '/storage/v1/object/public/banner/' +
          encodeURIComponent(barbershopId) +
          '/banner.webp'
        : null;

    return {
      profile,
      services: (services ?? []) as LandingService[],
      professionals: (professionals ?? []) as LandingProfessional[],
      reviews: reviewItems,
      rating,
      reviewsCount:
        Number.isFinite(storedReviewsCount) && storedReviewsCount > 0
          ? storedReviewsCount
          : reviewItems.length,
      weeklySchedule: normalizeWeeklySchedule(
        hours?.weekly_schedule,
        hours ?? undefined,
      ),
      amenities: normalizeBarbershopAmenities(shop?.amenities),
      latitude:
        typeof shop?.lat === 'number' &&
        typeof shop?.lng === 'number' &&
        (shop.lat !== 0 || shop.lng !== 0)
          ? shop.lat
          : null,
      longitude:
        typeof shop?.lat === 'number' &&
        typeof shop?.lng === 'number' &&
        (shop.lat !== 0 || shop.lng !== 0)
          ? shop.lng
          : null,
      language: hours?.default_language === 'en' ? 'en' : 'pt',
      // Settings uploads use canonical tenant-owned Storage objects. Prefer
      // these assets over legacy shops metadata so public pages reflect the
      // branding configured in Dashboard > Settings > Appearance.
      coverUrl:
        withCacheVersion(
          settingsBannerUrl,
          settingsBannerFile?.updated_at ?? null,
        ) || safeHttpsUrl(profile.cover_url),
      avatarUrl:
        withCacheVersion(hours?.avatar_url, hours?.updated_at ?? null) ||
        safeHttpsUrl(profile.avatar_url),
    };
  },
);

type PurchasedCustomWebsite = {
  shop_name: string;
  booking_slug: string;
  public_slug: string;
  site_title: string | null;
  site_description: string | null;
  hero_image_url: string | null;
  primary_cta_label: string | null;
};

const getPurchasedCustomWebsite = cache(
  async (slug: string): Promise<PurchasedCustomWebsite | null> => {
    const normalizedSlug = slug.trim().toLowerCase();
    if (!isValidPublicProfileSlug(normalizedSlug)) return null;
    const database = createAdminClient();
    const { data, error } = await database
      .from('custom_website_requests')
      .select(
        'shop_name, booking_slug, public_slug, site_title, site_description, hero_image_url, primary_cta_label',
      )
      .eq('public_slug', normalizedSlug)
      .eq('status', 'published')
      .maybeSingle();
    if (error) {
      console.error('[CUSTOM_WEBSITE_PUBLIC_LOOKUP_FAILED]', {
        code: error.code ?? 'UNKNOWN',
      });
      return null;
    }
    return data as PurchasedCustomWebsite | null;
  },
);

function PurchasedCustomWebsitePage({
  website,
}: {
  website: PurchasedCustomWebsite;
}) {
  const title = website.site_title?.trim() || website.shop_name;
  const description =
    website.site_description?.trim() ||
    'Conhece os nossos serviços e marca o teu próximo horário online.';
  const bookingUrl =
    '/barbershops/' + encodeURIComponent(website.booking_slug) + '?booking=1';
  return (
    <main className="min-h-screen overflow-x-clip bg-[#090b0e] text-zinc-50">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link
          href={bookingUrl}
          className="truncate text-sm font-semibold tracking-wide"
        >
          {website.shop_name}
        </Link>
        <Link
          href={bookingUrl}
          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-300 px-4 text-xs font-bold text-zinc-950 hover:bg-emerald-200 sm:text-sm"
        >
          {website.primary_cta_label || 'Marcar horário'}
        </Link>
      </header>
      <section className="mx-auto grid min-h-[72dvh] w-full max-w-7xl items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
            Site oficial
          </p>
          <h1 className="mt-5 break-words text-4xl font-semibold leading-[1.03] tracking-[-0.055em] sm:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
            {description}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={bookingUrl}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-300 px-5 text-sm font-bold text-zinc-950 hover:bg-emerald-200"
            >
              {website.primary_cta_label || 'Marcar horário'}
            </Link>
            <Link
              href={bookingUrl}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-5 text-sm font-semibold text-white hover:bg-white/[0.06]"
            >
              Ver serviços
            </Link>
          </div>
        </div>
        <div className="relative aspect-[4/5] max-h-[620px] overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900/70">
          {website.hero_image_url ? (
            <img
              src={website.hero_image_url}
              alt={title}
              className="absolute inset-0 size-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_25%,rgba(16,185,129,0.22),transparent_35%),linear-gradient(145deg,#171a1f,#090b0e_65%)]" />
          )}
        </div>
      </section>
      <footer className="border-t border-white/10 px-5 py-7 text-center text-xs text-zinc-600">
        Site criado com Silentra for Barbers.
      </footer>
    </main>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (slug === SILENTRA_DEMO_PUBLIC_SLUG) {
    const canonicalPath =
      '/site/' + encodeURIComponent(SILENTRA_DEMO_PUBLIC_SLUG);
    const title = 'Silentra Barbershop — Barbearia de Demonstração';
    const description =
      'Conhece a experiência digital de uma barbearia criada com a Silentra: serviços, equipa, galeria e uma simulação de marcação online.';
    return {
      title,
      description,
      alternates: { canonical: SITE_ORIGIN + canonicalPath },
      robots: { index: true, follow: true },
      openGraph: {
        type: 'website',
        title: 'Silentra Barbershop — Uma experiência de barbearia',
        description:
          'Uma página de demonstração para mostrar como a tua barbearia pode estar online com a Silentra.',
        url: SITE_ORIGIN + canonicalPath,
        siteName: 'Silentra for Barbers',
        locale: 'pt_PT',
      },
      twitter: {
        card: 'summary',
        title,
        description:
          'Serviços, equipa, galeria e uma simulação de marcação online.',
      },
    };
  }
  const customWebsite = await getPurchasedCustomWebsite(slug);
  if (customWebsite) {
    const title = customWebsite.site_title?.trim() || customWebsite.shop_name;
    const description =
      customWebsite.site_description?.trim() ||
      'Conhece os serviços e marca o teu próximo horário online.';
    return {
      title,
      description,
      alternates: {
        canonical:
          SITE_ORIGIN +
          '/site/' +
          encodeURIComponent(customWebsite.public_slug),
      },
      robots: { index: true, follow: true },
      openGraph: {
        type: 'website',
        title,
        description,
        siteName: customWebsite.shop_name,
        ...(customWebsite.hero_image_url
          ? { images: [customWebsite.hero_image_url] }
          : {}),
      },
    };
  }
  const data = await getLandingPageData(slug);
  if (!data) return { robots: { index: false, follow: false } };

  const canonicalPath = '/site/' + encodeURIComponent(data.profile.slug);
  const title =
    data.profile.seo_title?.trim() || data.profile.name + ' | Website oficial';
  const description =
    data.profile.seo_description?.trim() ||
    data.profile.theme_config.description ||
    'Conhece os serviços, preços e horários da ' +
      data.profile.name +
      ' e agenda a tua próxima visita online.';
  const image =
    safeHttpsUrl(data.profile.og_image_url) ||
    data.coverUrl ||
    data.avatarUrl ||
    undefined;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      title,
      description,
      url: SITE_ORIGIN + canonicalPath,
      siteName: 'Silentra for Barbers',
      locale: 'pt_PT',
      ...(image ? { images: [{ url: image, alt: data.profile.name }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

const WEEKDAY_LABELS: Record<WeekdayKey, { pt: string; en: string }> = {
  monday: { pt: 'Segunda-feira', en: 'Monday' },
  tuesday: { pt: 'Terça-feira', en: 'Tuesday' },
  wednesday: { pt: 'Quarta-feira', en: 'Wednesday' },
  thursday: { pt: 'Quinta-feira', en: 'Thursday' },
  friday: { pt: 'Sexta-feira', en: 'Friday' },
  saturday: { pt: 'Sábado', en: 'Saturday' },
  sunday: { pt: 'Domingo', en: 'Sunday' },
};

const LANDING_COPY = {
  pt: {
    siteLabel: 'Website oficial',
    barbershop: 'Barbearia',
    in: 'em',
    book: 'Marcar horário',
    services: 'Serviços',
    seeServices: 'Ver serviços',
    about: 'Sobre a barbearia',
    team: 'A nossa equipa',
    reviews: 'O que dizem os clientes',
    averageRating: 'Avaliação média',
    schedule: 'Horário de funcionamento',
    closed: 'Encerrado',
    hoursToConfirm: 'Horário por confirmar',
    breakLabel: 'Pausa',
    location: 'Visita-nos',
    amenities: 'Comodidades',
    popular: 'Popular',
    minutes: 'min',
    bookService: 'Marcar este serviço',
    noServices: 'A barbearia está a atualizar o catálogo de serviços. Contacta-nos para mais informações.',
    noAddress: 'Contacta a barbearia para confirmar a morada.',
    directions: 'Obter direções',
    call: 'Ligar',
    follow: 'Segue-nos',
    reviewsCount: 'avaliações',
    footer: 'Site criado com Silentra for Barbers.',
    intro: 'Descobre os nossos serviços, conhece a equipa e reserva o teu próximo horário online.',
    tags: 'O que nos distingue',
    parkingFree: 'Estacionamento gratuito',
    parkingPaid: 'Estacionamento pago',
    wifi: 'Wi-Fi',
    wheelchairAccessible: 'Acessível a cadeira de rodas',
    accessibleEntrance: 'Entrada acessível',
    accessibleToilet: 'WC acessível',
    kidsFriendly: 'Adequado para crianças',
    waitingArea: 'Área de espera',
    restroom: 'Casa de banho',
    airConditioning: 'Ar condicionado',
    cardPayments: 'Pagamento por cartão',
    walkIns: 'Atendimento sem marcação',
    coffee: 'Café',
    water: 'Água',
    petFriendly: 'Pet friendly',
    appointmentRequired: 'Agendamento obrigatório',
  },
  en: {
    siteLabel: 'Official website',
    barbershop: 'Barbershop',
    in: 'in',
    book: 'Book an appointment',
    services: 'Services',
    seeServices: 'View services',
    about: 'About the barbershop',
    team: 'Meet the team',
    reviews: 'What customers say',
    averageRating: 'Average rating',
    schedule: 'Opening hours',
    closed: 'Closed',
    hoursToConfirm: 'Hours to be confirmed',
    breakLabel: 'Break',
    location: 'Visit us',
    amenities: 'Amenities',
    popular: 'Popular',
    minutes: 'min',
    bookService: 'Book this service',
    noServices: 'The barbershop is updating its service catalogue. Contact us for more information.',
    noAddress: 'Contact the barbershop to confirm the address.',
    directions: 'Get directions',
    call: 'Call',
    follow: 'Follow us',
    reviewsCount: 'reviews',
    footer: 'Website created with Silentra for Barbers.',
    intro: 'Discover our services, meet the team and book your next appointment online.',
    tags: 'What makes us different',
    parkingFree: 'Free parking',
    parkingPaid: 'Paid parking',
    wifi: 'Wi-Fi',
    wheelchairAccessible: 'Wheelchair accessible',
    accessibleEntrance: 'Accessible entrance',
    accessibleToilet: 'Accessible restroom',
    kidsFriendly: 'Family friendly',
    waitingArea: 'Waiting area',
    restroom: 'Restroom',
    airConditioning: 'Air conditioning',
    cardPayments: 'Card payments',
    walkIns: 'Walk-ins welcome',
    coffee: 'Coffee',
    water: 'Water',
    petFriendly: 'Pet friendly',
    appointmentRequired: 'Appointment required',
  },
} as const;

function EnterpriseLandingStructuredData({
  data,
  canonicalUrl,
}: {
  data: LandingPageData;
  canonicalUrl: string;
}) {
  const profile = data.profile;
  const config = profile.theme_config;
  const dayNames: Record<WeekdayKey, string> = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  };
  const openingHoursSpecification = WEEKDAY_KEYS.flatMap((day) =>
    data.weeklySchedule[day].work_intervals.map((interval) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'https://schema.org/' + dayNames[day],
      opens: interval.start,
      closes: interval.end,
    })),
  );
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Barbershop',
    '@id': canonicalUrl + '#business',
    name: profile.name,
    url: canonicalUrl,
    ...(config.description ? { description: config.description } : {}),
    ...(profile.phone ? { telephone: profile.phone } : {}),
    ...(data.coverUrl || data.avatarUrl
      ? { image: [data.coverUrl || data.avatarUrl] }
      : {}),
    ...(profile.address || profile.city
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(profile.address ? { streetAddress: profile.address } : {}),
            ...(profile.city ? { addressLocality: profile.city } : {}),
            addressCountry: 'PT',
          },
        }
      : {}),
    ...(data.latitude !== null && data.longitude !== null
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: data.latitude,
            longitude: data.longitude,
          },
        }
      : {}),
    ...(openingHoursSpecification.length
      ? { openingHoursSpecification }
      : {}),
    ...(data.reviewsCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: data.rating,
            reviewCount: data.reviewsCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(data.services.length
      ? {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: data.language === 'en' ? 'Services' : 'Serviços',
            itemListElement: data.services.map((service) => {
              const price = Number(service.price);
              return {
                '@type': 'Offer',
                ...(Number.isFinite(price) && price >= 0
                  ? { price: String(price), priceCurrency: 'EUR' }
                  : {}),
                itemOffered: {
                  '@type': 'Service',
                  name: service.name,
                  provider: { '@id': canonicalUrl + '#business' },
                },
              };
            }),
          },
        }
      : {}),
    sameAs: [
      config.instagramUrl,
      config.facebookUrl,
      config.tiktokUrl,
    ].filter(Boolean),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
      }}
    />
  );
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function formatPrice(value: number | string, language: 'pt' | 'en'): string {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) return '—';
  return price.toLocaleString(language === 'en' ? 'en-GB' : 'pt-PT', {
    style: 'currency',
    currency: 'EUR',
  });
}

export default async function EnterpriseBarbershopLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === SILENTRA_DEMO_PUBLIC_SLUG) {
    return <SilentraDemoBarbershop />;
  }

  const customWebsite = await getPurchasedCustomWebsite(slug);
  if (customWebsite) {
    if (slug !== customWebsite.public_slug)
      permanentRedirect(
        '/site/' + encodeURIComponent(customWebsite.public_slug),
      );
    return <PurchasedCustomWebsitePage website={customWebsite} />;
  }
  const data = await getLandingPageData(slug);
  if (!data) notFound();
  if (slug !== data.profile.slug) {
    permanentRedirect('/site/' + encodeURIComponent(data.profile.slug));
  }

  const profile = data.profile;
  const config: EnterpriseLandingPageConfig = profile.theme_config;
  const palette = resolveEnterpriseLandingPalette(config);
  const copy = LANDING_COPY[data.language];
  const canonicalProfileUrl = '/site/' + encodeURIComponent(profile.slug);
  const bookingUrl =
    '/barbershops/' + encodeURIComponent(profile.slug) + '?booking=1';
  const themeStyle = {
    backgroundColor: palette.background,
    color: palette.text,
  } satisfies CSSProperties;
  const panelStyle = {
    backgroundColor: palette.surface,
    borderColor: palette.border,
  } satisfies CSSProperties;
  const cardStyle = {
    backgroundColor: palette.card,
    borderColor: palette.border,
  } satisfies CSSProperties;
  const mutedStyle = { color: palette.muted } satisfies CSSProperties;
  const accentStyle = { color: palette.accent } satisfies CSSProperties;
  const primaryButtonStyle = {
    backgroundColor: palette.accent,
    color: palette.accentText,
  } satisfies CSSProperties;
  const safeCoverUrl = data.coverUrl?.replace(/["\\\n\r]/g, '');
  const heroBackground: CSSProperties = {
    backgroundImage: safeCoverUrl
      ? `linear-gradient(105deg, ${palette.background}f2 0%, ${palette.background}df 52%, ${palette.background}72 100%), url("${safeCoverUrl}")`
      : `radial-gradient(ellipse at 72% 15%, ${palette.accent}28, transparent 48%), linear-gradient(145deg, ${palette.surface}, ${palette.background})`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  };
  const avatarBackground: CSSProperties = data.avatarUrl
    ? {
        backgroundImage: `url("${data.avatarUrl.replace(/["\\\n\r]/g, '')}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {};
  const socialLinks = [
    { name: 'Instagram', url: config.instagramUrl },
    { name: 'Facebook', url: config.facebookUrl },
    { name: 'TikTok', url: config.tiktokUrl },
  ].filter((item) => item.url);
  const scheduleRows = WEEKDAY_KEYS.map((day) => {
    const hours = data.weeklySchedule[day];
    const work = hours.day_off
      ? copy.closed
      : hours.work_intervals.length
        ? hours.work_intervals
            .map(
              (interval) =>
                formatTime(interval.start) + ' – ' + formatTime(interval.end),
            )
            .join(' · ')
        : copy.hoursToConfirm;
    const breaks = hours.break_intervals
      .map(
        (interval) =>
          formatTime(interval.start) + ' – ' + formatTime(interval.end),
      )
      .join(' · ');
    return {
      key: day,
      label: WEEKDAY_LABELS[day][data.language],
      hours: work,
      breaks,
    };
  });
  const amenityLabels: Array<[keyof BarbershopAmenities, string]> = [
    ['wifi', copy.wifi],
    ['wheelchair_accessible', copy.wheelchairAccessible],
    ['accessible_entrance', copy.accessibleEntrance],
    ['accessible_toilet', copy.accessibleToilet],
    ['kids_friendly', copy.kidsFriendly],
    ['waiting_area', copy.waitingArea],
    ['restroom', copy.restroom],
    ['air_conditioning', copy.airConditioning],
    ['card_payments', copy.cardPayments],
    ['walk_ins', copy.walkIns],
    ['coffee', copy.coffee],
    ['water', copy.water],
    ['pet_friendly', copy.petFriendly],
    ['appointment_required', copy.appointmentRequired],
  ];
  const amenities = amenityLabels
    .filter(([key]) => data.amenities[key] === true)
    .map(([, label]) => label);
  if (data.amenities.parking === 'free') amenities.push(copy.parkingFree);
  if (data.amenities.parking === 'paid') amenities.push(copy.parkingPaid);
  const mapsQuery =
    data.latitude !== null && data.longitude !== null
      ? data.latitude + ',' + data.longitude
      : [profile.address, profile.city].filter(Boolean).join(', ');
  const mapsUrl = mapsQuery
    ? 'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(mapsQuery)
    : null;
  const showTeam = config.showTeam && data.professionals.length > 0;
  const showReviews = config.showReviews && data.reviewsCount > 0;
  const showAmenities = config.showAmenities && amenities.length > 0;
  const showAbout = Boolean(config.description.trim());
  const heroCentered = config.heroAlignment === 'center';

  return (
    <>
      <EnterpriseLandingStructuredData
        data={data}
        canonicalUrl={SITE_ORIGIN + '/site/' + encodeURIComponent(profile.slug)}
      />
      <main
        className="min-h-screen overflow-x-clip"
        style={themeStyle}
      >
        <header
          className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8"
          style={{ borderBottom: `1px solid ${palette.border}` }}
        >
          <Link
            href={canonicalProfileUrl}
            className="flex min-w-0 items-center gap-3"
            style={{ color: palette.text }}
          >
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold"
              style={{
                ...avatarBackground,
                borderColor: palette.border,
                backgroundColor: palette.surface,
                color: palette.accent,
              }}
              aria-hidden="true"
            >
              {!data.avatarUrl ? profile.name.slice(0, 1).toUpperCase() : null}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight">
                {profile.name}
              </span>
              <span
                className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={mutedStyle}
              >
                {copy.siteLabel}
              </span>
            </span>
          </Link>
          <nav
            aria-label={data.language === 'en' ? 'Website sections' : 'Secções do site'}
            className="flex max-w-full flex-wrap items-center justify-end gap-x-4 gap-y-2 text-xs font-medium"
          >
            <a href="#servicos" className="transition-opacity hover:opacity-70">
              {copy.services}
            </a>
            {showAbout && (
              <a href="#sobre" className="transition-opacity hover:opacity-70">
                {copy.about}
              </a>
            )}
            {showTeam && (
              <a href="#equipa" className="transition-opacity hover:opacity-70">
                {copy.team}
              </a>
            )}
            {showReviews && (
              <a href="#avaliacoes" className="transition-opacity hover:opacity-70">
                {copy.reviews}
              </a>
            )}
            <a href="#contactos" className="transition-opacity hover:opacity-70">
              {copy.location}
            </a>
          </nav>
          <Link
            href={bookingUrl}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl px-4 text-xs font-bold transition-opacity hover:opacity-85"
            style={primaryButtonStyle}
          >
            {copy.book}
          </Link>
        </header>

        <section
          className="mx-auto flex min-h-[510px] w-full max-w-7xl items-center overflow-hidden rounded-[2rem] border px-6 py-14 sm:px-10 lg:min-h-[610px] lg:px-16"
          style={{ ...heroBackground, borderColor: palette.border }}
        >
          <div
            className={heroCentered ? 'mx-auto w-full max-w-3xl' : 'w-full max-w-3xl'}
            style={{ textAlign: heroCentered ? 'center' : 'left' }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-[0.22em]"
              style={accentStyle}
            >
              {profile.city
                ? `${copy.barbershop} ${copy.in} ${profile.city}`
                : copy.barbershop}
            </p>
            <h1 className="mt-5 break-words text-4xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              {profile.name}
            </h1>
            <p
              className={heroCentered ? 'mx-auto mt-6 max-w-2xl text-base leading-7 sm:text-lg' : 'mt-6 max-w-2xl text-base leading-7 sm:text-lg'}
              style={mutedStyle}
            >
              {copy.intro}
            </p>
            <div className={heroCentered ? 'mt-8 flex flex-wrap justify-center gap-3' : 'mt-8 flex flex-wrap gap-3'}>
              <Link
                href={bookingUrl}
                className="inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-bold transition-opacity hover:opacity-85"
                style={primaryButtonStyle}
              >
                {copy.book}
              </Link>
              <a
                href="#servicos"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border px-5 text-sm font-semibold transition-colors hover:bg-white/5"
                style={{ borderColor: palette.border, color: palette.text }}
              >
                {copy.seeServices}
              </a>
            </div>
            {profile.tags.length > 0 && (
              <div className={heroCentered ? 'mt-8 flex flex-wrap justify-center gap-2' : 'mt-8 flex flex-wrap gap-2'}>
                {profile.tags.slice(0, 8).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border px-3 py-1.5 text-[11px] font-medium"
                    style={{
                      borderColor: palette.border,
                      backgroundColor: palette.surface,
                      color: palette.muted,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-3 px-5 py-7 sm:grid-cols-3 sm:px-8">
          <article className="rounded-2xl border p-4 sm:p-5" style={cardStyle}>
            <p className="text-xs font-semibold uppercase tracking-[.16em]" style={mutedStyle}>
              {copy.services}
            </p>
            <p className="mt-2 text-2xl font-semibold">{data.services.length}</p>
          </article>
          <article className="rounded-2xl border p-4 sm:p-5" style={cardStyle}>
            <p className="text-xs font-semibold uppercase tracking-[.16em]" style={mutedStyle}>
              {copy.averageRating}
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {data.reviewsCount > 0 ? `★ ${data.rating.toFixed(1)}` : '—'}
            </p>
            <p className="mt-1 text-xs" style={mutedStyle}>
              {data.reviewsCount} {copy.reviewsCount}
            </p>
          </article>
          <article className="rounded-2xl border p-4 sm:p-5" style={cardStyle}>
            <p className="text-xs font-semibold uppercase tracking-[.16em]" style={mutedStyle}>
              {copy.location}
            </p>
            <p className="mt-2 truncate text-base font-semibold">
              {profile.city || profile.address || copy.barbershop}
            </p>
            <p className="mt-1 text-xs" style={mutedStyle}>
              {profile.phone || profile.address || copy.siteLabel}
            </p>
          </article>
        </section>

        {showAbout && (
          <section
            id="sobre"
            className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:py-16"
          >
            <div className="max-w-3xl rounded-3xl border p-6 sm:p-9" style={panelStyle}>
              <p className="text-xs font-semibold uppercase tracking-[.2em]" style={accentStyle}>
                {copy.about}
              </p>
              <p className="mt-4 whitespace-pre-line text-base leading-8 sm:text-lg" style={mutedStyle}>
                {config.description}
              </p>
            </div>
          </section>
        )}

        <section
          id="servicos"
          className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:py-16"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.22em]" style={accentStyle}>
                {copy.services}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                {copy.seeServices}
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6" style={mutedStyle}>
              {data.language === 'en'
                ? 'Service prices and durations are shown before booking.'
                : 'Consulta os preços e a duração antes de confirmares a marcação.'}
            </p>
          </div>

          {data.services.length ? (
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.services.map((service) => (
                <article
                  key={service.id}
                  className="flex min-h-[210px] flex-col rounded-2xl border p-5 transition-transform duration-200 hover:-translate-y-0.5"
                  style={cardStyle}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-semibold">
                        {service.name}
                      </h3>
                      {service.popular && (
                        <span
                          className="mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
                          style={{
                            backgroundColor: palette.accent + '22',
                            color: palette.accent,
                          }}
                        >
                          {copy.popular}
                        </span>
                      )}
                    </div>
                    <p className="shrink-0 text-base font-semibold" style={accentStyle}>
                      {formatPrice(service.price, data.language)}
                    </p>
                  </div>
                  <p className="mt-3 text-sm" style={mutedStyle}>
                    {service.duration} {copy.minutes}
                  </p>
                  <div className="mt-auto pt-5">
                    <Link
                      href={bookingUrl + '&service=' + encodeURIComponent(service.id)}
                      className="inline-flex min-h-10 items-center text-sm font-semibold underline decoration-current/30 underline-offset-4 transition-opacity hover:opacity-70"
                      style={accentStyle}
                    >
                      {copy.bookService}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-8 rounded-2xl border p-5 text-sm" style={{ ...cardStyle, ...mutedStyle }}>
              {copy.noServices}
            </p>
          )}
        </section>

        {showTeam && (
          <section
            id="equipa"
            className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:py-16"
          >
            <div className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-[.2em]" style={accentStyle}>
                {copy.team}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                {copy.team}
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.professionals.map((professional) => (
                <article
                  key={professional.id}
                  className="flex items-center gap-3 rounded-2xl border p-4"
                  style={cardStyle}
                >
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: palette.accent + '22', color: palette.accent }}
                    aria-hidden="true"
                  >
                    {professional.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 truncate text-sm font-semibold">
                    {professional.name}
                  </span>
                </article>
              ))}
            </div>
          </section>
        )}

        {showReviews && (
          <section
            id="avaliacoes"
            className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:py-16"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.2em]" style={accentStyle}>
                  {copy.reviews}
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                  {copy.reviews}
                </h2>
              </div>
              <p className="text-sm" style={mutedStyle}>
                <span className="font-semibold" style={accentStyle}>★ {data.rating.toFixed(1)}</span>
                {' · '}{data.reviewsCount} {copy.reviewsCount}
              </p>
            </div>
            {data.reviews.length > 0 && (
              <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {data.reviews.map((review) => (
                  <article
                    key={review.id}
                    className="rounded-2xl border p-5"
                    style={cardStyle}
                  >
                    <p className="text-sm tracking-[.12em]" style={accentStyle}>
                      {'★'.repeat(Math.max(0, Math.min(5, Number(review.rating) || 0)))}
                    </p>
                    {review.comment && (
                      <p className="mt-3 whitespace-pre-line text-sm leading-6" style={mutedStyle}>
                        “{review.comment}”
                      </p>
                    )}
                    <div className="mt-5 flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: palette.border }}>
                      <span className="truncate text-sm font-semibold">{review.client_name}</span>
                      <time className="shrink-0 text-[10px]" style={mutedStyle} dateTime={review.created_at}>
                        {new Date(review.created_at).toLocaleDateString(data.language === 'en' ? 'en-GB' : 'pt-PT')}
                      </time>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {showAmenities && (
          <section className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8">
            <div className="rounded-3xl border p-6 sm:p-8" style={panelStyle}>
              <p className="text-xs font-semibold uppercase tracking-[.2em]" style={accentStyle}>
                {copy.amenities}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {amenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="rounded-full border px-3 py-2 text-xs font-medium"
                    style={{ borderColor: palette.border, backgroundColor: palette.card, color: palette.text }}
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        <section
          id="contactos"
          className="mx-auto grid w-full max-w-7xl gap-4 px-5 py-12 sm:grid-cols-2 sm:px-8 lg:py-16"
        >
          <article className="rounded-3xl border p-6 sm:p-8" style={cardStyle}>
            <p className="text-xs font-semibold uppercase tracking-[.2em]" style={accentStyle}>
              {copy.schedule}
            </p>
            <h2 className="mt-3 text-2xl font-semibold">{copy.schedule}</h2>
            <div className="mt-6 divide-y" style={{ borderColor: palette.border }}>
              {scheduleRows.map((row) => (
                <div key={row.key} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-medium">{row.label}</span>
                  <span className="text-sm" style={row.hours === copy.closed ? mutedStyle : { color: palette.text }}>
                    {row.hours}
                  </span>
                  {row.breaks && (
                    <span className="text-xs" style={mutedStyle}>
                      {copy.breakLabel}: {row.breaks}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border p-6 sm:p-8" style={cardStyle}>
            <p className="text-xs font-semibold uppercase tracking-[.2em]" style={accentStyle}>
              {copy.location}
            </p>
            <h2 className="mt-3 text-2xl font-semibold">{copy.location}</h2>
            <div className="mt-6 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={mutedStyle}>
                  {data.language === 'en' ? 'Address' : 'Morada'}
                </p>
                <p className="mt-1 text-sm leading-6">
                  {profile.address || copy.noAddress}
                  {profile.city ? <span className="block" style={mutedStyle}>{profile.city}</span> : null}
                </p>
              </div>
              {profile.phone && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={mutedStyle}>
                    {data.language === 'en' ? 'Phone' : 'Telefone'}
                  </p>
                  <a href={'tel:' + profile.phone} className="mt-1 inline-flex text-sm font-semibold underline decoration-current/30 underline-offset-4" style={accentStyle}>
                    {profile.phone}
                  </a>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-xs font-bold"
                    style={primaryButtonStyle}
                  >
                    {copy.directions}
                  </a>
                )}
                {profile.phone && (
                  <a
                    href={'tel:' + profile.phone}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border px-4 text-xs font-semibold"
                    style={{ borderColor: palette.border, color: palette.text }}
                  >
                    {copy.call}
                  </a>
                )}
              </div>
              {socialLinks.length > 0 && (
                <div className="border-t pt-4" style={{ borderColor: palette.border }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={mutedStyle}>
                    {copy.follow}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {socialLinks.map((social) => (
                      <a
                        key={social.name}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center rounded-lg border px-3 text-xs font-semibold"
                        style={{ borderColor: palette.border, color: palette.text }}
                      >
                        {social.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </article>
        </section>

        <footer
          className="mt-8 border-t px-5 py-8 text-center text-xs"
          style={{ borderColor: palette.border, color: palette.muted }}
        >
          <p>{profile.name} · {copy.siteLabel}</p>
          <p className="mt-2">{copy.footer}</p>
        </footer>
      </main>
    </>
  );
}
