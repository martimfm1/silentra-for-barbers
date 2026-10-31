import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, MapPin, Scissors, ArrowUpRight } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PublishedWebsite = {
  shop_name: string;
  booking_slug: string;
  public_slug: string;
  site_title: string | null;
  site_description: string | null;
  hero_image_url: string | null;
  primary_cta_label: string | null;
};

async function getPublishedWebsite(
  slug: string,
): Promise<PublishedWebsite | null> {
  const database = createAdminClient();
  const { data, error } = await database
    .from('custom_website_requests')
    .select(
      'shop_name, booking_slug, public_slug, site_title, site_description, hero_image_url, primary_cta_label',
    )
    .eq('public_slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (error) {
    console.error('[CUSTOM_WEBSITE_PUBLIC_LOOKUP_FAILED]', {
      code: error.code,
    });
    return null;
  }
  return data as PublishedWebsite | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const website = await getPublishedWebsite(slug);
  if (!website) return { title: 'Site não encontrado | Silentra' };
  const title = website.site_title || website.shop_name;
  const description =
    website.site_description ||
    `Conhece ${website.shop_name} e marca o teu próximo serviço.`;
  return {
    title,
    description,
    alternates: {
      canonical: `https://barbers.silentra.me/site/${encodeURIComponent(slug)}`,
    },
    openGraph: {
      title,
      description,
      images: website.hero_image_url ? [website.hero_image_url] : undefined,
      type: 'website',
      siteName: website.shop_name,
    },
  };
}

export default async function CustomBarbershopWebsitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const website = await getPublishedWebsite(slug);
  if (!website) notFound();

  const title = website.site_title || website.shop_name;
  const description =
    website.site_description ||
    `Descobre os serviços de ${website.shop_name} e marca o teu próximo horário online.`;
  const bookingUrl = `/barbershops/${encodeURIComponent(website.booking_slug)}?booking=1`;

  return (
    <main className="min-h-screen overflow-x-clip bg-[#090b0e] text-zinc-50">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
        <Link
          href={`/site/${encodeURIComponent(slug)}`}
          className="flex min-w-0 items-center gap-3"
          aria-label={website.shop_name}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
            <Scissors className="size-5 text-emerald-300" aria-hidden="true" />
          </span>
          <span className="truncate text-sm font-semibold tracking-wide">
            {website.shop_name}
          </span>
        </Link>
        <Link
          href={bookingUrl}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-xs font-bold text-zinc-950 transition hover:bg-emerald-200 sm:text-sm"
        >
          {website.primary_cta_label || 'Marcar horário'}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </header>

      <section className="mx-auto grid min-h-[72dvh] w-full max-w-7xl items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-12 lg:py-20">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200 sm:text-xs">
            <span className="size-1.5 rounded-full bg-emerald-300" />
            Barbearia · Marcações online
          </span>
          <h1 className="mt-6 max-w-3xl break-words text-4xl font-semibold leading-[1.03] tracking-[-0.055em] sm:text-5xl lg:text-7xl">
            {title}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg sm:leading-8">
            {description}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={bookingUrl}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-200"
            >
              <CalendarDays className="size-4" aria-hidden="true" />
              {website.primary_cta_label || 'Marcar horário'}
            </Link>
            <Link
              href={bookingUrl}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-5 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.07]"
            >
              Ver serviços
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <p className="mt-5 text-xs text-zinc-600">
            Marcações online simples e seguras.
          </p>
        </div>

        <div className="relative min-w-0">
          <div
            className="absolute -inset-5 rounded-[2rem] bg-emerald-400/[0.06] blur-3xl"
            aria-hidden="true"
          />
          <div className="relative aspect-[4/5] max-h-[620px] overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900/70 shadow-[0_35px_100px_rgba(0,0,0,0.45)] sm:aspect-[5/4] lg:aspect-[4/5]">
            {website.hero_image_url ? (
              <img
                src={website.hero_image_url}
                alt={`Imagem de apresentação de ${website.shop_name}`}
                className="absolute inset-0 size-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_25%,rgba(16,185,129,0.22),transparent_35%),linear-gradient(145deg,#171a1f,#090b0e_65%)]">
                <div className="absolute inset-8 rounded-[1.5rem] border border-white/[0.07]" />
                <div className="absolute bottom-8 left-8 right-8 rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl sm:bottom-10 sm:left-10 sm:right-10 sm:p-6">
                  <Scissors
                    className="size-7 text-emerald-300"
                    aria-hidden="true"
                  />
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
                    O teu próximo corte
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">
                    {website.shop_name}
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">
                    Marca online, escolhe o teu horário.
                  </p>
                </div>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent p-5 pt-20 sm:p-7 sm:pt-24">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-2 text-xs text-zinc-100 backdrop-blur-xl">
                <MapPin
                  className="size-3.5 text-emerald-300"
                  aria-hidden="true"
                />
                Reserva diretamente online
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 pb-14 sm:px-8 sm:pb-20 lg:px-12">
        <div className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Marcações online
            </p>
            <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
              Pronto para marcar?
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Escolhe o serviço e encontra um horário disponível.
            </p>
          </div>
          <Link
            href={bookingUrl}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 text-sm font-bold text-zinc-950 hover:bg-emerald-200"
          >
            {website.primary_cta_label || 'Marcar horário'}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <footer className="pt-8 text-center text-xs text-zinc-600">
          Site criado com a Silentra for Barbers.
        </footer>
      </section>
    </main>
  );
}
