'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Accessibility,
  Armchair,
  ArrowLeft,
  Baby,
  Calendar,
  Car,
  CheckCircle2,
  Coffee,
  CreditCard,
  Dog,
  DoorOpen,
  GlassWater,
  MapPin,
  Phone,
  Star,
  Toilet,
  Wifi,
  Wind,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import type { BarbershopAmenities } from '@/lib/barbershops/amenities';
import type { BarbershopPublicDetails } from './services/public-barbershop.service';
import { publicBarbershopService } from './services/public-barbershop.service';
import { formatClosedDays } from '@/lib/utils/format-closed-days';
import {
  DEFAULT_BARBERSHOP_AVATAR,
  DEFAULT_BARBERSHOP_BANNER,
} from '@/lib/barbershops/default-media';

const BookingDrawer = dynamic(
  () =>
    import('../components/booking-drawer').then(
      (module) => module.BookingDrawer,
    ),
  { ssr: false },
);
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(
  /\/$/,
  '',
);

type PublicData = BarbershopPublicDetails & { amenities?: BarbershopAmenities };

type AmenityItem = { label: string; Icon: typeof Wifi };

function storageUrl(
  bucket: 'avatar' | 'banner',
  value: string | null | undefined,
  entityId: string | null | undefined,
) {
  if (!SUPABASE_URL) return null;
  if (value) {
    if (/^https?:\/\//.test(value)) return value;
    const clean = value.replace(/^\//, '');
    return clean.startsWith(`${bucket}/`)
      ? `${SUPABASE_URL}/storage/v1/object/public/${clean}`
      : `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${clean}`;
  }
  return entityId
    ? `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${entityId}/${bucket}.webp`
    : null;
}

function formatTime(value?: string | null) {
  return value ? value.slice(0, 5) : '--:--';
}

function amenityItems(amenities: BarbershopAmenities): AmenityItem[] {
  return [
    amenities.wifi && { label: 'Wi-Fi', Icon: Wifi },
    amenities.wheelchair_accessible && {
      label: 'Acesso para cadeira de rodas',
      Icon: Accessibility,
    },
    amenities.accessible_entrance && {
      label: 'Entrada acessível',
      Icon: DoorOpen,
    },
    amenities.accessible_toilet && {
      label: 'WC acessível',
      Icon: Accessibility,
    },
    amenities.kids_friendly && { label: 'Adequado para crianças', Icon: Baby },
    amenities.waiting_area && { label: 'Área de espera', Icon: Armchair },
    amenities.restroom && { label: 'Casa de banho', Icon: Toilet },
    amenities.air_conditioning && { label: 'Ar condicionado', Icon: Wind },
    amenities.card_payments && {
      label: 'Pagamento por cartão',
      Icon: CreditCard,
    },
    amenities.walk_ins && { label: 'Atendimento sem marcação', Icon: Calendar },
    amenities.coffee && { label: 'Café', Icon: Coffee },
    amenities.water && { label: 'Água', Icon: GlassWater },
    amenities.pet_friendly && { label: 'Pet friendly', Icon: Dog },
    amenities.appointment_required && {
      label: 'Agendamento obrigatório',
      Icon: Calendar,
    },
  ].filter(Boolean) as AmenityItem[];
}

export default function BarbershopPublicPageFinal({
  initialData,
  loyaltyEnabled = false,
}: {
  slug: string;
  loyaltyEnabled?: boolean;
  initialData: BarbershopPublicDetails;
}) {
  const shop = initialData as PublicData;
  const { locale } = useLanguage();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [reviewToken, setReviewToken] = useState('');
  const [reviewName, setReviewName] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSent, setReviewSent] = useState(false);
  const [avatarImageError, setAvatarImageError] = useState(false);
  const [bannerImageError, setBannerImageError] = useState(false);

  useEffect(() => {
    const browserWindow = window as Window & {
      __SILENTRA_REVIEW_TOKEN__?: string | null;
    };
    const url = new URL(window.location.href);
    const token =
      browserWindow.__SILENTRA_REVIEW_TOKEN__ ||
      url.searchParams.get('review_token') ||
      '';
    browserWindow.__SILENTRA_REVIEW_TOKEN__ = null;
    if (/^[A-Za-z0-9_-]{43}$/.test(token)) setReviewToken(token);
    if (url.searchParams.has('review_token')) {
      url.searchParams.delete('review_token');
      window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }, []);

  const targetId = shop.barbershop_id || shop.id;
  const avatarUrl = storageUrl('avatar', shop.avatar_url, targetId);
  const bannerUrl = storageUrl('banner', shop.cover_url, targetId);
  const displayedAvatarUrl =
    avatarImageError || !avatarUrl ? DEFAULT_BARBERSHOP_AVATAR : avatarUrl;
  const displayedBannerUrl =
    bannerImageError || !bannerUrl ? DEFAULT_BARBERSHOP_BANNER : bannerUrl;
  const amenities = shop.amenities;
  const rating = Number(shop.rating ?? 0);

  async function submitReview(event: React.FormEvent) {
    event.preventDefault();
    setReviewError('');
    setReviewSent(false);
    if (!reviewName.trim() || reviewRating < 1) {
      setReviewError(
        'Indica o teu nome e uma classificação de 1 a 5 estrelas.',
      );
      return;
    }
    setReviewLoading(true);
    const result = await publicBarbershopService.submitReview({
      barbershop_id: shop.id,
      client_name: reviewName.trim(),
      rating: reviewRating,
      comment: reviewText.trim(),
      review_token: reviewToken,
    });
    setReviewLoading(false);
    if (result.error || !result.data) {
      setReviewError(
        result.error?.message || 'Não foi possível enviar a avaliação.',
      );
      return;
    }
    setReviewName('');
    setReviewText('');
    setReviewRating(0);
    setReviewToken('');
    setReviewSent(true);
  }

  const bookingShop = {
    id: shop.id,
    barbershop_id: targetId,
    name: shop.name,
    slug: shop.slug,
    city: shop.city || '',
    address: shop.address || '',
    price: String(shop.price ?? 0),
    rating,
    reviewsCount: shop.reviewsCount,
    opening_time: shop.opening_time || '',
    closing_time: shop.closing_time || '',
    hours: `${formatTime(shop.opening_time)} - ${formatTime(shop.closing_time)}`,
    distanceKm: 0,
    reviews: String(shop.reviewsCount),
    nextSlot: '',
    tags: shop.tags || [],
  };

  return (
    <main className="silentra-page-shell pb-24 text-foreground">
      <section className="relative h-64 overflow-hidden border-b border-white/[0.08] sm:h-80">
        <Image
          src={displayedBannerUrl}
          alt={`Banner da ${shop.name}`}
          fill
          priority
          sizes="100vw"
          onError={() => setBannerImageError(true)}
          className="object-cover opacity-45"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-background via-background/45 to-transparent"
          aria-hidden="true"
        />
        <Link
          href="/barbershops"
          className="absolute left-4 top-4 z-10 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/65 px-3.5 text-sm font-medium text-zinc-200 backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Voltar
        </Link>
      </section>

      <div className="silentra-page-content pt-0!">
        <section className="relative -mt-16 sm:-mt-24">
          <div className="silentra-surface-raised rounded-3xl p-4 sm:p-6 glassmorphism">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex min-w-0 items-end gap-4">
                <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl border-4 border-zinc-950 bg-zinc-900 shadow-2xl sm:size-32">
                  <Image
                    src={displayedAvatarUrl}
                    alt={`Logótipo de ${shop.name}`}
                    fill
                    sizes="128px"
                    onError={() => setAvatarImageError(true)}
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-heading text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                      {shop.name}
                    </h1>
                    {shop.city && (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
                        {shop.city}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-400 sm:text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <Star
                        className="size-4 fill-amber-300 text-amber-300"
                        aria-hidden="true"
                      />{' '}
                      {rating.toFixed(1)} ({shop.reviewsCount})
                    </span>
                    {shop.address && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-4" aria-hidden="true" />{' '}
                        {shop.address}
                      </span>
                    )}
                    {shop.phone && (
                      <a
                        href={`tel:${shop.phone}`}
                        className="inline-flex items-center gap-1.5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      >
                        <Phone className="size-4" aria-hidden="true" />{' '}
                        {shop.phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {shop.landing_page_url && (
                  <Link
                    href={shop.landing_page_url}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-zinc-100 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    Ver website
                  </Link>
                )}
                <Button
                  type="button"
                  onClick={() => {
                    setSelectedServiceId(null);
                    setBookingOpen(true);
                  }}
                  className="min-h-11 rounded-xl bg-zinc-50 px-5 text-sm font-semibold text-zinc-950 hover:bg-white focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <Calendar className="mr-2 size-4" aria-hidden="true" />
                  Agendar horário
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section
          className="mt-6 grid gap-3 sm:grid-cols-3"
          aria-label="Horários da barbearia"
        >
          <div className="silentra-section-block rounded-2xl p-4 mt-0 glassmorphism">
            <p className="text-xs text-zinc-500">Horário</p>
            <p className="mt-1 text-sm font-semibold">
              {formatTime(shop.opening_time)} - {formatTime(shop.closing_time)}
            </p>
          </div>
          {shop.lunch_start && shop.lunch_end && (
            <div className="silentra-section-block rounded-2xl p-4 glassmorphism">
              <p className="text-xs text-zinc-500">Pausa</p>
              <p className="mt-1 text-sm font-semibold">
                {formatTime(shop.lunch_start)} - {formatTime(shop.lunch_end)}
              </p>
            </div>
          )}
          <div className="silentra-section-block rounded-2xl p-4 glassmorphism">
            <p className="text-xs text-zinc-500">{locale === 'en' ? 'Closed days' : 'Dias de fecho'}</p>
            <p className="mt-1 text-sm font-semibold">
              {formatClosedDays(shop.closed_days, locale === 'en' ? 'en' : 'pt') || (locale === 'en' ? 'None' : 'Nenhum')}
            </p>
          </div>
        </section>

        {amenities && (
          <section
            className="silentra-section-block mt-4 rounded-3xl p-5 sm:p-6 glassmorphism"
            aria-labelledby="amenities-heading"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="silentra-eyebrow">Estabelecimento</p>
                <h2
                  id="amenities-heading"
                  className="silentra-page-title !text-2xl sm:!text-3xl"
                >
                  Comodidades e acessibilidade
                </h2>
                <p className="silentra-page-description !mt-2 !text-sm">
                  Informação útil antes da tua visita.
                </p>
              </div>
              {amenities.parking !== 'none' && (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300">
                  <Car className="size-4" aria-hidden="true" />
                  {amenities.parking === 'free'
                    ? 'Estacionamento gratuito'
                    : 'Estacionamento pago'}
                </span>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {amenityItems(amenities).map(({ label, Icon }) => (
                <span
                  key={label}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-zinc-200"
                >
                  <Icon
                    className="size-4 text-emerald-300"
                    aria-hidden="true"
                  />
                  {label}
                </span>
              ))}
              {!amenityItems(amenities).length &&
                amenities.parking === 'none' && (
                  <p className="text-sm text-zinc-500">
                    A barbearia ainda não indicou comodidades.
                  </p>
                )}
            </div>
          </section>
        )}

        <section
          className="silentra-section-block mt-4 rounded-3xl p-5 sm:p-6 glassmorphism"
          aria-labelledby="services-heading"
        >
          <p className="silentra-eyebrow">Serviços</p>
          <h2
            id="services-heading"
            className="silentra-page-title !text-2xl sm:!text-3xl"
          >
            Escolhe o que queres marcar
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {shop.services.map((service) => (
              <article
                key={service.id}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.018] p-4 glassmorphim"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-zinc-100">
                      {service.name}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      {service.duration} min
                    </p>
                  </div>
                  <span className="font-semibold">
                    €{Number(service.price).toFixed(2)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedServiceId(service.id);
                    setBookingOpen(true);
                  }}
                  className="mt-4 min-h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] text-xs font-semibold text-zinc-100 focus-visible:ring-2 focus-visible:ring-emerald-400 glassmorphim"
                >
                  Agendar este serviço
                </Button>
              </article>
            ))}
          </div>
        </section>

        <section
          className="silentra-section-block mt-4 rounded-3xl p-5 sm:p-6 glassmorphism"
          aria-labelledby="reviews-heading"
        >
          <p className="silentra-eyebrow">Confiança</p>
          <h2
            id="reviews-heading"
            className="silentra-page-title !text-2xl sm:!text-3xl"
          >
            Avaliações
          </h2>
          {reviewSent ? (
            <p className="mt-5 text-sm text-emerald-300" role="status">
              Avaliação enviada. Obrigado por partilhares a tua experiência.
            </p>
          ) : reviewToken ? (
            <form
              onSubmit={submitReview}
              className="mt-5 grid gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4 sm:grid-cols-2"
            >
            <label className="grid gap-1 text-xs text-zinc-500">
              Nome
              <input
                value={reviewName}
                onChange={(e) => setReviewName(e.target.value)}
                autoComplete="name"
                required
                className="min-h-11 rounded-xl border border-white/10 bg-white/[0.025] px-3 text-sm text-zinc-100 outline-none focus-visible:border-emerald-400/45 focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            </label>
            <div>
              <span className="text-xs text-zinc-500">Classificação</span>
              <div
                className="mt-1 flex"
                aria-label="Classificação de 1 a 5 estrelas"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} estrelas`}
                    aria-pressed={reviewRating === value}
                    onClick={() => setReviewRating(value)}
                    className="flex size-10 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <Star
                      className={`size-5 ${value <= reviewRating ? 'fill-amber-300 text-amber-300' : 'text-zinc-600'}`}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </div>
            <label className="grid gap-1 text-xs text-zinc-500 sm:col-span-2">
              Comentário
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                className="min-h-24 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3 text-sm text-zinc-100 outline-none focus-visible:border-emerald-400/45 focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            </label>
            {reviewError && (
              <p className="text-xs text-red-300 sm:col-span-2" role="alert">
                {reviewError}
              </p>
            )}
            <Button
              type="submit"
              disabled={reviewLoading}
              className="min-h-11 sm:col-span-2 sm:w-fit"
            >
              {reviewLoading ? 'A enviar…' : 'Enviar avaliação'}
            </Button>
            </form>
          ) : (
            <p className="mt-4 text-sm leading-6 text-zinc-500">
              Só é possível enviar uma avaliação através do link recebido por email após um atendimento concluído.
            </p>
          )}
          <div className="mt-5 grid gap-3">
            {shop.reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.014] p-4"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-sm">{review.client_name}</strong>
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                    <Star
                      className="size-3.5 fill-amber-300 text-amber-300"
                      aria-hidden="true"
                    />
                    {review.rating}/5
                  </span>
                </div>
                {review.comment && (
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {review.comment}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        {loyaltyEnabled && (
          <section className="mt-4 rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.03] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-400/10 p-2 text-emerald-300">
                  <CheckCircle2 className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
                    Fidelização
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    Volta. Acumula. Ganha.
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Ganha pontos nas tuas visitas e troca-os por recompensas.
                  </p>
                </div>
              </div>
              <Link
                href={`/barbershops/${encodeURIComponent(shop.slug)}/loyalty`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-300 px-4 text-xs font-bold text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                Ver fidelização
              </Link>
            </div>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-2xl sm:hidden">
        <Button
          type="button"
          onClick={() => {
            setSelectedServiceId(null);
            setBookingOpen(true);
          }}
          className="min-h-12 w-full rounded-xl bg-emerald-300 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-950/20 hover:bg-emerald-200"
        >
          <Calendar className="mr-2 size-4" aria-hidden="true" />
          Agendar horário
        </Button>
      </div>

      <BookingDrawer
        shop={bookingShop}
        isOpen={bookingOpen}
        onClose={() => {
          setBookingOpen(false);
          setSelectedServiceId(null);
        }}
        selectedServiceId={selectedServiceId}
      />
    </main>
  );
}
