'use client';

import Image from 'next/image';
import React, { useState, useMemo } from 'react';
import { MapPin, Clock, Star, Scissors, ArrowRight, Eye } from 'lucide-react';
import type { ShopCardProps } from '@/types/marketplace/components';
import type { BarbershopPublicDetails } from '@/app/barbershops/[slug]/services/public-barbershop.service';

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(
  /\/$/,
  '',
);

type ExtendedBarbershopDetails = BarbershopPublicDetails & {
  barbershop_id?: string;
  avatar_path?: string;
  cover_path?: string;
  banner_path?: string;
  banner_url?: string;
  reviewsCount?: number;
  reviews?: number;
  hours?: string;
};

function getStorageUrl(
  bucket: 'avatar' | 'banner',
  pathOrUrl?: string | null,
  barbershopId?: string | null,
): string | null {
  if (!SUPABASE_URL) return null;
  if (pathOrUrl) {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://'))
      return pathOrUrl;
    const cleanPath = pathOrUrl.replace(/^\//, '');
    if (cleanPath.startsWith(`${bucket}/`))
      return `${SUPABASE_URL}/storage/v1/object/public/${cleanPath}`;
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${cleanPath}`;
  }
  return barbershopId
    ? `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${barbershopId}/${bucket}.webp`
    : null;
}

const formatDisplayPrice = (rawPrice: unknown): string => {
  if (rawPrice === null || rawPrice === undefined || rawPrice === '')
    return '15.00€';
  if (typeof rawPrice === 'number')
    return Number.isFinite(rawPrice) ? `${rawPrice.toFixed(2)}€` : '15.00€';
  if (typeof rawPrice === 'string') {
    const parsed = parseFloat(
      rawPrice.replace(',', '.').replace(/[^0-9.]/g, ''),
    );
    if (Number.isFinite(parsed)) return `${parsed.toFixed(2)}€`;
  }
  return '15.00€';
};

export const ShopCard: React.FC<ShopCardProps> = ({
  shop: rawShop,
  onNavigate,
  onOpenBooking,
}) => {
  const shop = rawShop as unknown as ExtendedBarbershopDetails | undefined;
  const shopAsMarket = rawShop;
  const [avatarError, setAvatarError] = useState(false);
  const [bannerError, setBannerError] = useState(false);
  const barbershopId = shop?.barbershop_id || null;
  const ratingValue = typeof shop?.rating === 'number' ? shop.rating : 0;
  const totalReviews =
    typeof shop?.reviewsCount === 'number'
      ? shop.reviewsCount
      : Number(shop?.reviews || 0);

  const avatarUrl = useMemo(
    () =>
      shop
        ? getStorageUrl(
            'avatar',
            shop.avatar_url || shop.avatar_path,
            barbershopId,
          )
        : null,
    [shop, barbershopId],
  );
  const bannerUrl = useMemo(
    () =>
      shop
        ? getStorageUrl(
            'banner',
            shop.cover_url ||
              shop.cover_path ||
              shop.banner_path ||
              shop.banner_url,
            barbershopId,
          )
        : null,
    [shop, barbershopId],
  );

  if (!shop)
    return (
      <div className="h-72 w-full animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4" />
    );

  const hasRating = ratingValue > 0;
  const displayPrice = formatDisplayPrice(shop.price);

  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/75 shadow-xl shadow-black/10 backdrop-blur-3xl transition-colors sm:hover:border-white/25">
      <button
        type="button"
        onClick={() => onNavigate?.(rawShop)}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-inset"
        aria-label={`Ver detalhes de ${shop.name}`}
      >
        <div className="relative h-32 w-full overflow-hidden border-b border-white/10 bg-zinc-900 sm:h-36">
          {bannerUrl && !bannerError ? (
            <Image
              src={bannerUrl}
              alt={`Banner ${shop.name || ''}`}
              fill
              sizes="(max-width: 767px) 100vw, 50vw"
              quality={60}
              unoptimized
              loading="lazy"
              onError={() => setBannerError(true)}
              className="object-cover opacity-50 transition-transform duration-500 sm:group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
        </div>
        <div className="relative px-4 pb-4 sm:p-5 sm:pt-0">
          <div className="-mt-7 mb-3 flex items-end justify-between gap-2">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-zinc-950 bg-zinc-900 text-zinc-300 shadow-xl sm:h-15 sm:w-15">
              {avatarUrl && !avatarError ? (
                <Image
                  src={avatarUrl}
                  alt={shop.name || 'Barbearia'}
                  fill
                  sizes="60px"
                  quality={65}
                  loading="lazy"
                  onError={() => setAvatarError(true)}
                  className="object-cover"
                />
              ) : (
                <Scissors className="h-6 w-6 text-zinc-500" />
              )}
            </div>
            <div className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-950/90 px-2.5 py-1 text-xs font-semibold shadow-sm">
              <Star
                className={`h-3.5 w-3.5 ${hasRating ? 'fill-white text-white' : 'text-zinc-600'}`}
              />
              <span className={hasRating ? 'text-white' : 'text-zinc-400'}>
                {ratingValue.toFixed(1)}
              </span>
              <span className="text-[10px] font-normal text-zinc-500">
                ({totalReviews})
              </span>
            </div>
          </div>
          <div className="space-y-2.5">
            <h3 className="truncate text-base font-extrabold text-white transition-colors sm:text-lg sm:group-hover:text-zinc-200">
              {shop.name}
            </h3>
            <div className="space-y-1.5 text-xs text-zinc-400">
              {(shop.address || shop.city) && (
                <div className="flex min-w-0 items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  <span className="line-clamp-2">
                    {shop.address
                      ? `${shop.address}${shop.city ? `, ${shop.city}` : ''}`
                      : shop.city}
                  </span>
                </div>
              )}
              {shopAsMarket.distanceKm > 0 && (
                <div className="flex items-center gap-1.5 text-emerald-300">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {shopAsMarket.distanceKm.toFixed(1)} km de distância
                  </span>
                </div>
              )}
              {shop.hours && (
                <div className="flex min-w-0 items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  <span className="truncate">{shop.hours}</span>
                </div>
              )}
            </div>
            {shop.tags && shop.tags.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {shop.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="max-w-[8rem] shrink-0 truncate rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] text-zinc-300"
                  >
                    #{tag}
                  </span>
                ))}
                {shop.tags.length > 3 && (
                  <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.02] px-1.5 py-1 text-[10px] text-zinc-500">
                    +{shop.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </button>
      <div className="mt-auto grid grid-cols-1 gap-3 border-t border-white/10 bg-zinc-950/50 p-3.5 sm:grid-cols-[1fr_auto] sm:items-end sm:p-5">
        <div className="min-w-0">
          <span className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            A partir de
          </span>
          <span className="text-base font-extrabold text-white sm:text-lg">
            {displayPrice}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate?.(rawShop);
            }}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-zinc-200 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:w-auto"
          >
            <Eye className="h-3.5 w-3.5 text-zinc-400" />
            <span>Detalhes</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenBooking?.(rawShop);
            }}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-bold text-zinc-950 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:w-auto"
          >
            <span>Agendar</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
};
