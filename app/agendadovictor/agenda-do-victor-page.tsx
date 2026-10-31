'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import type { PublicProfileRecord } from '@/lib/barbershops/public-profile';
import type { MarketplaceShop } from '@/types/marketplace/shops';
import { DEFAULT_BARBERSHOP_BANNER } from '@/lib/barbershops/default-media';

const BookingDrawer = dynamic(
  () =>
    import('@/app/barbershops/components/booking-drawer').then(
      (module) => module.BookingDrawer,
    ),
  { ssr: false },
);

type AgendaService = {
  id: string;
  name: string;
  price: number;
  duration: number;
};
type AgendaShop = {
  id: string;
  slug: string;
  city: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  opening_time: string | null;
  closing_time: string | null;
  closed_days: string | null;
};

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(
  /\/$/,
  '',
);

function coverUrl(value: string | null, barbershopId: string) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const clean = value.replace(/^\//, '');
  return SUPABASE_URL
    ? `${SUPABASE_URL}/storage/v1/object/public/${clean.startsWith('banner/') ? clean : `banner/${barbershopId}/${clean}`}`
    : null;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
}

export default function AgendaDoVictorPage({
  profile,
  shop,
  services,
}: {
  profile: Omit<PublicProfileRecord, 'owner_user_id'>;
  shop: AgendaShop;
  services: AgendaService[];
}) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const image =
    coverUrl(profile.cover_url, profile.barbershop_id || profile.id) ||
    DEFAULT_BARBERSHOP_BANNER;
  const bookingShop: MarketplaceShop = {
    id: shop.id,
    barbershop_id: profile.barbershop_id || profile.id,
    reviewsCount: 0,
    closing_time: shop.closing_time || '',
    opening_time: shop.opening_time || '',
    closed_days: shop.closed_days,
    name: profile.name,
    slug: shop.slug,
    address: shop.address || undefined,
    city: shop.city || '',
    distanceKm: 0,
    hours: '',
    price: String(services[0]?.price ?? 0),
    rating: 0,
    reviews: '0',
    nextSlot: '',
    tags: [],
    lat: shop.lat ?? undefined,
    lng: shop.lng ?? undefined,
  };

  const openBooking = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setBookingOpen(true);
  };

  return (
    <main className="min-h-screen overflow-x-clip bg-[#f7f7f5] text-[#171717]">
      <section
        className="relative flex min-h-[290px] items-center justify-center bg-[#d8d8d2] bg-cover bg-center px-5 py-16 sm:min-h-[390px]"
        style={
          image
            ? {
                backgroundImage: `linear-gradient(rgba(0,0,0,.24),rgba(0,0,0,.32)),url("${image}")`,
              }
            : undefined
        }
      >
        {!image && (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#e7e7e1_0%,_#c9c9c1_100%)]" />
        )}
        <div className="absolute inset-0 bg-black/20" />
        <h1 className="relative z-10 text-center text-3xl font-semibold tracking-[0.16em] text-white drop-shadow sm:text-5xl">
          AGENDA DO VICTOR
        </h1>
      </section>

      <section className="relative z-10 mx-auto -mt-10 w-full max-w-3xl px-4 pb-16 sm:-mt-14 sm:px-6">
        <div className="overflow-hidden rounded-sm bg-white shadow-[0_14px_50px_rgba(0,0,0,.08)]">
          <header className="border-b border-[#ededeb] px-5 py-7 sm:px-9 sm:py-9">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8a8a84]">
              {profile.name}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Nova marcação
            </h2>
            <p className="mt-2 text-sm text-[#777771]">
              Seleciona o serviço que pretendes marcar.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#777771]">
              {profile.address && (
                <span>
                  {profile.address}
                  {profile.city ? `, ${profile.city}` : ''}
                </span>
              )}
              {!profile.address && profile.city && <span>{profile.city}</span>}
              {profile.phone && (
                <a
                  className="underline underline-offset-4 hover:text-[#222]"
                  href={`tel:${profile.phone}`}
                >
                  {profile.phone}
                </a>
              )}
              {(shop.opening_time || shop.closing_time) && (
                <span>
                  Horário: {shop.opening_time?.slice(0, 5) || '--:--'} –{' '}
                  {shop.closing_time?.slice(0, 5) || '--:--'}
                </span>
              )}
            </div>
          </header>

          <div className="px-5 sm:px-9">
            <h3 className="py-5 text-xs font-semibold uppercase tracking-[0.14em] text-[#777771]">
              Selecionar um serviço
            </h3>
            {services.length ? (
              services.map((service, index) => (
                <article
                  key={service.id}
                  className={`border-t border-[#ededeb] py-5 sm:py-6 ${index === services.length - 1 ? 'border-b' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="text-base font-semibold text-[#222] sm:text-lg">
                        {service.name}
                      </h4>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#85857f]">
                        Serviço profissional · {service.duration} minutos
                      </p>
                      <button
                        type="button"
                        className="mt-1 text-xs font-medium text-[#66665f] underline underline-offset-4"
                        onClick={() => openBooking(service.id)}
                      >
                        Ler mais
                      </button>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-semibold tabular-nums">
                        {formatPrice(service.price)}
                      </p>
                      <button
                        type="button"
                        onClick={() => openBooking(service.id)}
                        className="mt-3 inline-flex min-h-10 items-center justify-center bg-[#171717] px-4 text-xs font-semibold text-white transition hover:bg-[#3b3b38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#171717]"
                      >
                        Escolher
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="border-y border-[#ededeb] py-8 text-sm text-[#777771]">
                Não existem serviços disponíveis para marcação neste momento.
              </p>
            )}
          </div>

          <footer className="px-5 py-6 text-center text-xs text-[#969690] sm:px-9">
            <Link
              href="/terms"
              className="underline underline-offset-4 hover:text-[#333]"
            >
              Política de privacidade e cookies
            </Link>
            <p className="mt-3">
              Powered by{' '}
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
