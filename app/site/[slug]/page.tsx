import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
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

interface LandingPageData {
  profile: PublicProfileRecord;
  services: LandingService[];
  openingTime: string | null;
  closingTime: string | null;
  coverUrl: string | null;
  avatarUrl: string | null;
}

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://barbers.silentra.me'
).replace(/\/$/, '');

function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
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
    const { data: entitlement, error: entitlementError } = await database
      .from('barbershop_landing_pages')
      .select('status, template_version')
      .eq('barbershop_id', barbershopId)
      .maybeSingle();

    if (entitlementError) {
      console.error('[ENTERPRISE_LANDING_PAGE_LOOKUP_FAILED]', {
        operation: 'entitlement',
        code: entitlementError.code ?? 'UNKNOWN',
      });
      return null;
    }
    if (!entitlement || entitlement.status !== 'active') return null;

    const [
      { data: services, error: servicesError },
      { data: hours, error: hoursError },
    ] = await Promise.all([
      database
        .from('services')
        .select('id, name, price, duration, popular')
        .eq('barbershop_id', barbershopId)
        .order('popular', { ascending: false })
        .order('name', { ascending: true })
        .limit(50),
      database
        .from('barbershops')
        .select('opening_time, closing_time')
        .eq('id', barbershopId)
        .maybeSingle(),
    ]);

    if (servicesError || hoursError) {
      console.error('[ENTERPRISE_LANDING_PAGE_LOOKUP_FAILED]', {
        operation: 'public_content',
        services: servicesError?.code ?? null,
        hours: hoursError?.code ?? null,
      });
      return null;
    }

    return {
      profile,
      services: (services ?? []) as LandingService[],
      openingTime: hours?.opening_time ?? null,
      closingTime: hours?.closing_time ?? null,
      coverUrl: safeHttpsUrl(profile.cover_url),
      avatarUrl: safeHttpsUrl(profile.avatar_url),
    };
  },
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getLandingPageData(slug);
  if (!data) return { robots: { index: false, follow: false } };

  const canonicalPath = '/site/' + encodeURIComponent(data.profile.slug);
  const title =
    data.profile.seo_title?.trim() || data.profile.name + ' | Website oficial';
  const description =
    data.profile.seo_description?.trim() ||
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

function formatTime(value: string | null): string {
  return value ? value.slice(0, 5) : 'A confirmar';
}

export default async function EnterpriseBarbershopLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getLandingPageData(slug);
  if (!data) notFound();
  if (slug !== data.profile.slug) {
    permanentRedirect('/site/' + encodeURIComponent(data.profile.slug));
  }

  const profile = data.profile;
  const canonicalProfileUrl = '/barbershops/' + encodeURIComponent(profile.slug);
  const heroBackground = data.coverUrl
    ? {
        backgroundImage:
          'linear-gradient(105deg, rgba(9,9,11,.97) 0%, rgba(9,9,11,.83) 52%, rgba(9,9,11,.46) 100%), url("' +
          data.coverUrl.replace(/["\\\n\r]/g, '') +
          '")',
      }
    : undefined;
  const avatarBackground = data.avatarUrl
    ? {
        backgroundImage:
          'url("' + data.avatarUrl.replace(/["\\\n\r]/g, '') + '")',
        backgroundSize: 'cover',
      }
    : undefined;

  return (
    <main className="min-h-screen overflow-x-clip bg-zinc-950 text-zinc-50">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href={canonicalProfileUrl} className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-zinc-900 bg-center bg-no-repeat text-sm font-semibold text-emerald-200"
            style={avatarBackground}
            aria-hidden="true"
          >
            {!data.avatarUrl ? profile.name.slice(0, 1).toUpperCase() : null}
          </span>
          <span className="truncate text-sm font-semibold tracking-tight">
            {profile.name}
          </span>
        </Link>
        <span className="text-right text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          Website oficial
        </span>
      </header>

      <section
        className="mx-auto flex min-h-[500px] w-full max-w-7xl items-center rounded-[2rem] border border-white/10 bg-zinc-900/60 px-6 py-14 sm:px-10 lg:min-h-[600px] lg:px-16"
        style={heroBackground}
      >
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
            {profile.city ? 'Barbearia em ' + profile.city : 'Barbearia'}
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            {profile.name}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
            O teu próximo corte começa aqui. Descobre os nossos serviços,
            consulta os preços e reserva o teu horário online.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={canonicalProfileUrl + '#services-heading'}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              Agendar agora
            </Link>
            <Link
              href={canonicalProfileUrl}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-5 text-sm font-semibold text-white transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              Perfil e avaliações
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
            {profile.address && <span>{profile.address}</span>}
            {profile.phone && (
              <a className="hover:text-white" href={'tel:' + profile.phone}>
                {profile.phone}
              </a>
            )}
          </div>
        </div>
      </section>

      <section
        id="servicos"
        className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:py-20"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
              Serviços
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Escolhe o teu próximo serviço.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-zinc-500">
            Preços e duração disponíveis antes de marcares.
          </p>
        </div>

        {data.services.length ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.services.map((service) => (
              <article
                key={service.id}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition hover:border-emerald-300/30 hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-zinc-100">{service.name}</h3>
                    <p className="mt-2 text-sm text-zinc-500">
                      {service.duration} min
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-semibold text-emerald-200">
                    {Number(service.price).toLocaleString('pt-PT', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </p>
                </div>
                <Link
                  href={canonicalProfileUrl + '#services-heading'}
                  className="mt-5 inline-flex min-h-10 items-center text-sm font-semibold text-zinc-200 underline decoration-white/20 underline-offset-4 hover:text-emerald-200"
                >
                  Agendar este serviço
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-zinc-500">
            A barbearia está a preparar o catálogo de serviços. Consulta o perfil
            para mais informações.
          </p>
        )}
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-3 px-5 pb-16 sm:grid-cols-2 sm:px-8">
        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Horário
          </p>
          <p className="mt-3 text-xl font-semibold text-white">
            {formatTime(data.openingTime)} – {formatTime(data.closingTime)}
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Localização
          </p>
          <p className="mt-3 text-base font-semibold text-white">
            {profile.address || 'Contacta a barbearia para confirmar a morada'}
          </p>
          {profile.city && <p className="mt-1 text-sm text-zinc-500">{profile.city}</p>}
        </article>
      </section>

      <footer className="border-t border-white/10 px-5 py-7 text-center text-xs text-zinc-600">
        Website criado com{' '}
        <span className="font-semibold text-zinc-400">Silentra for Barbers</span>
      </footer>
    </main>
  );
}
