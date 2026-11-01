'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { Clock3, MapPin, Phone } from 'lucide-react';
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
  services: ProBookingService[];
  openingTime: string | null;
  closingTime: string | null;
  closedDays?: string | null;
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
  services,
  openingTime,
  closingTime,
  closedDays,
}: ProBookingPageProps) {
  const { t, locale } = useLanguage();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const barbershopId = profile.barbershop_id || profile.id;
  const cover =
    getCoverUrl(profile.cover_url, barbershopId) || DEFAULT_BARBERSHOP_BANNER;
  const bookingShop: MarketplaceShop = {
    id: profile.id,
    barbershop_id: barbershopId,
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
    setSelectedServiceId(serviceId);
    setBookingOpen(true);
  };

  return (
    <main className="min-h-screen overflow-x-clip bg-[#f7f7f5] text-[#171717]">
      <section
        className="relative flex min-h-[250px] items-end bg-[#d8d8d2] bg-cover bg-center px-5 pb-12 pt-16 sm:min-h-[330px] sm:pb-16"
        style={{
          backgroundImage: `linear-gradient(90deg,rgba(0,0,0,.48),rgba(0,0,0,.16)),url("${cover}")`,
        }}
      >
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">
            {t('proBookingPage.eyebrow')}
          </p>
          <h1 className="mt-3 max-w-2xl break-words text-3xl font-semibold tracking-tight text-white drop-shadow sm:text-5xl">
            {profile.name}
          </h1>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/85">
            {(profile.address || profile.city) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden="true" />
                {[profile.address, profile.city].filter(Boolean).join(', ')}
              </span>
            )}
            {profile.phone && (
              <a
                href={`tel:${profile.phone}`}
                className="inline-flex items-center gap-1.5 underline underline-offset-4"
              >
                <Phone className="size-3.5" aria-hidden="true" />
                {profile.phone}
              </a>
            )}
            {(openingTime || closingTime) && (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-3.5" aria-hidden="true" />
                {openingTime?.slice(0, 5) || '--:--'} –{' '}
                {closingTime?.slice(0, 5) || '--:--'}
              </span>
            )}
          </div>
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

      <BookingDrawer
        shop={bookingShop}
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        selectedServiceId={selectedServiceId}
        appearance="agenda"
        onSuccess={() => setBookingOpen(false)}
      />
    </main>
  );
}
