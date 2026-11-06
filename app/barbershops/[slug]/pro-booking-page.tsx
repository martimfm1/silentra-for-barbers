'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';

import { useLanguage } from '@/context/LanguageContext';
import { DEFAULT_BARBERSHOP_BANNER } from '@/lib/barbershops/default-media';
import type { PublicProfileRecord } from '@/lib/barbershops/public-profile';
import type { MarketplaceShop } from '@/types/marketplace/shops';

const BookingDrawer = dynamic(
  () =>
    import('@/app/barbershops/components/booking-drawer').then(
      (module) => module.BookingDrawer,
    ),
  { ssr: false },
);

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(
  /\/$/,
  '',
);

export type ProBookingService = {
  id: string;
  name: string;
  price: number;
  duration: number;
};

export type ProBookingPageProps = {
  profile: Omit<PublicProfileRecord, 'owner_user_id'>;
  bookingOffer?: {
    serviceId: string;
    date: string;
    time: string;
    professionalId: string | null;
  } | null;
  services: ProBookingService[];
  openingTime: string | null;
  closingTime: string | null;
  closedDays?: string | null;
  hideClosedDays?: boolean;
  requireBirthDate?: boolean;
  /** Desktop split hero used by the dedicated Agenda do Victor page. */
  agendaHeroLayout?: boolean;
};

function getCoverUrl(value: string | null, barbershopId: string): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const clean = value.replace(/^\/+/, '');
  const objectPath = clean.startsWith('banner/')
    ? clean
    : `banner/${barbershopId}/${clean}`;
  return SUPABASE_URL
    ? `${SUPABASE_URL}/storage/v1/object/public/${objectPath}`
    : null;
}

export default function ProBookingPage({
  profile,
  bookingOffer = null,
  services,
  openingTime,
  closingTime,
  closedDays,
  hideClosedDays = false,
  requireBirthDate = true,
  agendaHeroLayout = false,
}: ProBookingPageProps) {
  const { t, locale } = useLanguage();
  const [activeBookingOffer, setActiveBookingOffer] = useState(bookingOffer);
  const [bookingOpen, setBookingOpen] = useState(Boolean(bookingOffer));
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    bookingOffer?.serviceId ?? null,
  );
  const barbershopId = profile.barbershop_id || profile.id;
  // Keep this page on the exact object uploaded by Dashboard > Settings > Appearance.
  // Do not use shops.cover_url here: the settings uploader writes to this canonical path.
  const settingsBannerUrl = SUPABASE_URL
    ? `${SUPABASE_URL}/storage/v1/object/public/banner/${barbershopId}/banner.webp`
    : null;
  const cover =
    settingsBannerUrl ||
    getCoverUrl(profile.cover_url, barbershopId) ||
    DEFAULT_BARBERSHOP_BANNER;
  const bookingShop: MarketplaceShop = {
    id: profile.id,
    barbershop_id: barbershopId,
    plan: profile.plan,
    reviewsCount: 0,
    closing_time: closingTime || '',
    opening_time: openingTime || '',
    closed_days: closedDays ?? null,
    name: profile.name,
    slug: profile.slug,
    address: profile.address || undefined,
    city: profile.city || '',
    distanceKm: 0,
    hours: '',
    price: String(services[0]?.price ?? 0),
    rating: 0,
    reviews: '0',
    nextSlot: '',
    tags: profile.tags ?? [],
  };
  const currency = new Intl.NumberFormat(
    locale === 'en' ? 'en-GB' : 'pt-PT',
    { style: 'currency', currency: 'EUR' },
  );

  const openBooking = (serviceId: string) => {
    setActiveBookingOffer(null);
    setSelectedServiceId(serviceId);
    setBookingOpen(true);
  };

  return (
    <main
      className={
        agendaHeroLayout
          ? 'relative min-h-dvh overflow-x-clip bg-[#09090b] text-white'
          : 'min-h-screen overflow-x-clip bg-[#f7f7f5] text-[#171717]'
      }
    >
      {agendaHeroLayout ? (
        <section className="relative isolate flex min-h-dvh items-center overflow-hidden px-4 py-8 sm:px-7 sm:py-12 lg:px-10 lg:py-14">
          <div
            className="absolute inset-0 -z-20 bg-cover bg-center"
            style={{ backgroundImage: 'url("' + cover + '")' }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 -z-10 bg-[linear-gradient(105deg,rgba(0,0,0,.84)_0%,rgba(0,0,0,.72)_48%,rgba(0,0,0,.82)_100%)]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_18%_48%,rgba(255,255,255,.10),transparent_42%)]"
            aria-hidden="true"
          />

          <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-8 py-6 sm:gap-10 lg:grid-cols-[minmax(0,.88fr)_minmax(520px,1.12fr)] lg:gap-12 xl:gap-16">
            <div className="flex min-w-0 flex-col items-start text-left">
              <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 text-xs font-medium tracking-wide text-white/90 shadow-lg backdrop-blur-md sm:text-sm">
                <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.9)]" />
                {locale === 'en' ? 'Online booking' : 'Agendamento online'}
              </span>
              <h1 className="mt-6 max-w-3xl break-words text-[clamp(2.75rem,6.4vw,6.5rem)] font-semibold leading-[.98] tracking-[-.055em] text-white [text-wrap:balance] drop-shadow-[0_8px_35px_rgba(0,0,0,.45)]">
                {profile.name}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
                {locale === 'en'
                  ? 'Choose your service and book the time that works for you.'
                  : 'Escolhe o serviço e reserva o horário que te convém.'}
              </p>
              <div className="mt-10 hidden items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.34em] text-white/45 sm:flex">
                <span>{locale === 'en' ? 'Powered by' : 'Powered by'}</span>
                <span className="text-xs tracking-[0.28em] text-white/80">
                  SILENTRA
                </span>
              </div>
            </div>

            <section
              aria-labelledby="agenda-service-heading"
              className="w-full min-w-0 overflow-hidden rounded-[26px] border border-white/10 bg-[#101013]/90 p-4 shadow-[0_32px_100px_rgba(0,0,0,.48)] backdrop-blur-2xl sm:rounded-[30px] sm:p-6 lg:p-7"
            >
              <header className="mb-5 border-b border-white/10 pb-5 sm:mb-6 sm:pb-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45 sm:text-xs">
                  {t('proBookingPage.onlineBooking')}
                </p>
                <h2
                  id="agenda-service-heading"
                  className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl"
                >
                  {locale === 'en' ? 'Choose your service' : 'Escolhe o teu serviço'}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">
                  {locale === 'en'
                    ? 'Select a service to continue and reserve your appointment.'
                    : 'Seleciona um serviço para continuares e reservares o teu horário.'}
                </p>
              </header>

              {services.length > 0 ? (
                <div className="space-y-2.5 sm:space-y-3">
                  {services.map((service) => (
                    <article
                      key={service.id}
                      className="flex min-w-0 flex-col gap-4 rounded-2xl border border-white/[0.075] bg-white/[0.035] px-4 py-4 transition-colors duration-200 hover:border-white/[0.15] hover:bg-white/[0.055] sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-base font-semibold leading-6 text-white sm:text-lg">
                          {service.name}
                        </h3>
                        <p className="mt-1 text-xs text-white/45 sm:text-sm">
                          {t('proBookingPage.duration', {
                            minutes: service.duration,
                          })}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end sm:gap-5">
                        <p className="text-base font-semibold tabular-nums text-white sm:text-lg">
                          {currency.format(service.price)}
                        </p>
                        <button
                          type="button"
                          onClick={() => openBooking(service.id)}
                          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-white px-5 text-xs font-semibold text-[#111114] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#101013] sm:min-w-28"
                        >
                          {t('proBookingPage.choose')}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-8 text-center text-sm text-white/55">
                  {t('proBookingPage.noServices')}
                </p>
              )}

              <footer className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 text-center text-[11px] text-white/40 sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:text-left">
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-start">
                  <Link
                    href="/booking-terms"
                    className="underline decoration-white/25 underline-offset-4 transition hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    {locale === 'en' ? 'Booking policy' : 'Política de reservas'}
                  </Link>
                  <Link
                    href="/privacy"
                    className="underline decoration-white/25 underline-offset-4 transition hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    {locale === 'en' ? 'Privacy policy' : 'Política de privacidade'}
                  </Link>
                </div>
                <span className="font-semibold tracking-[0.24em] text-white/60">
                  SILENTRA
                </span>
              </footer>
            </section>
          </div>
        </section>
      ) : (
        <>
          <section
            className="relative flex min-h-[250px] items-center justify-center bg-[#d8d8d2] bg-cover bg-center px-5 py-12 text-center sm:min-h-[330px] sm:pb-16"
            style={{
              backgroundImage: 'linear-gradient(90deg,rgba(0,0,0,.48),rgba(0,0,0,.16)),url("' + cover + '")',
            }}
          >
            <div className="mx-auto w-full max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">
                {t('proBookingPage.eyebrow')}
              </p>
              <h1 className="mt-3 max-w-2xl break-words text-3xl font-semibold tracking-tight text-white drop-shadow sm:text-5xl">
                {profile.name}
              </h1>
            </div>
          </section>

          <section className="relative z-10 mx-auto -mt-7 w-full max-w-3xl px-4 pb-16 sm:px-6">
            <div className="overflow-hidden rounded-sm bg-white shadow-[0_14px_50px_rgba(0,0,0,.08)]">
              <header className="border-b border-[#ededeb] px-5 py-7 sm:px-9 sm:py-8">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#8a8a84]">
                  {t('proBookingPage.onlineBooking')}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {t('proBookingPage.title')}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#777771]">
                  {t('proBookingPage.subtitle')}
                </p>
              </header>

              <div className="px-5 sm:px-9">
                <h3 className="py-5 text-xs font-semibold uppercase tracking-[0.14em] text-[#777771]">
                  {t('proBookingPage.services')}
                </h3>
                {services.length > 0 ? (
                  services.map((service, index) => (
                    <article
                      key={service.id}
                      className={`border-t border-[#ededeb] py-5 sm:py-6 ${index === services.length - 1 ? 'border-b' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <h4 className="break-words text-base font-semibold text-[#222] sm:text-lg">
                            {service.name}
                          </h4>
                          <p className="mt-1 text-sm text-[#85857f]">
                            {t('proBookingPage.duration', {
                              minutes: service.duration,
                            })}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-base font-semibold tabular-nums">
                            {currency.format(service.price)}
                          </p>
                          <button
                            type="button"
                            onClick={() => openBooking(service.id)}
                            className="mt-3 inline-flex min-h-10 items-center justify-center bg-[#171717] px-4 text-xs font-semibold text-white transition hover:bg-[#3b3b38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#171717]"
                          >
                            {t('proBookingPage.choose')}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="border-y border-[#ededeb] py-8 text-sm text-[#777771]">
                    {t('proBookingPage.noServices')}
                  </p>
                )}
              </div>

              <footer className="px-5 py-6 text-center text-xs text-[#969690] sm:px-9">
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                  <Link
                    href="/booking-terms"
                    className="underline underline-offset-4 hover:text-[#333]"
                  >
                    {locale === 'en' ? 'Booking policy' : 'Política de reservas'}
                  </Link>
                  <Link
                    href="/privacy"
                    className="underline underline-offset-4 hover:text-[#333]"
                  >
                    {locale === 'en' ? 'Privacy policy' : 'Política de privacidade'}
                  </Link>
                </div>
                <p className="mt-3">
                  {t('proBookingPage.poweredBy')}{' '}
                  <span className="font-semibold tracking-wide text-[#555]">
                    SILENTRA
                  </span>
                </p>
              </footer>
            </div>
          </section>
        </>
      )}


      <BookingDrawer
        shop={bookingShop}
        isOpen={bookingOpen}
        onClose={() => {
          setBookingOpen(false);
          setSelectedServiceId(null);
          setActiveBookingOffer(null);
        }}
        selectedServiceId={selectedServiceId}
        selectedDate={activeBookingOffer?.date}
        selectedTime={activeBookingOffer?.time}
        selectedProfessionalId={activeBookingOffer?.professionalId}
        appearance="agenda"
        hideClosedDays={hideClosedDays}
        requireBirthDate={requireBirthDate}
        onSuccess={() => {
          setBookingOpen(false);
          setActiveBookingOffer(null);
        }}
      />
    </main>
  );
}
