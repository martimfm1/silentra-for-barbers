'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, MapPin, Search, Tag, X } from 'lucide-react';
import { SiteNavbar } from '@/components/site-navbar';
import { useLanguage } from '@/context/LanguageContext';
import { SearchFilterBar } from './components/search-filter-bar';
import { MobileSearchFilterBar } from './components/mobile-search-filter-bar';
import { ShopCard } from './components/shop-card';
import { BookingDrawer } from './components/booking-drawer';
import { LocationRequest } from '@/components/location/location-request';
import type {
  MarketplaceDateFilter,
  MarketplaceSortFilter,
  UserCoordinates,
} from '@/types/marketplace/filters';
import type { MarketplaceShop } from '@/types/marketplace/shops';
import { fetchShops } from '@/lib/api';

const MapPreview = dynamic(
  () => import('./components/map-preview').then((module) => module.MapPreview),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-64 items-center justify-center bg-white/[0.02] text-sm text-zinc-500">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />A
          carregar mapa…
        </div>
      </div>
    ),
  },
);

export default function BarbershopsDirectoryPage() {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [shops, setShops] = useState<MarketplaceShop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<MarketplaceDateFilter>('Today');
  const [activeFilter, setActiveFilter] =
    useState<MarketplaceSortFilter>('All');
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const [bookingShop, setBookingShop] = useState<MarketplaceShop | null>(null);
  const [userLocation, setUserLocation] = useState<UserCoordinates | null>(
    null,
  );
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 260);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(false);

    fetchShops({
      query: debouncedQuery,
      date: activeDate,
      filter: activeFilter,
      userLocation,
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setShops(data);
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        console.error('[Marketplace] Failed to load shops:', error);
        setShops([]);
        setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, activeDate, activeFilter, userLocation, reloadKey]);

  const availableTags = useMemo(() => {
    const unique = new Map<string, string>();
    for (const shop of shops) {
      for (const rawTag of shop.tags ?? []) {
        const tag = rawTag.trim();
        if (!tag) continue;
        const key = tag.toLocaleLowerCase();
        if (!unique.has(key)) unique.set(key, tag);
      }
    }
    return [...unique.values()].sort((a, b) =>
      a.localeCompare(b, locale === 'pt' ? 'pt-PT' : 'en'),
    );
  }, [shops, locale]);

  useEffect(() => {
    if (
      activeTag &&
      !availableTags.some(
        (tag) => tag.toLocaleLowerCase() === activeTag.toLocaleLowerCase(),
      )
    ) {
      setActiveTag(null);
    }
  }, [activeTag, availableTags]);

  const visibleShops = useMemo(() => {
    if (!activeTag) return shops;
    const normalized = activeTag.toLocaleLowerCase();
    return shops.filter((shop) =>
      (shop.tags ?? []).some(
        (tag) => tag.trim().toLocaleLowerCase() === normalized,
      ),
    );
  }, [shops, activeTag]);

  const handleNavigateToShop = (shop: MarketplaceShop) =>
    router.push(`/barbershops/${encodeURIComponent(shop.slug)}`);

  const retryLoad = () => {
    setLoadError(false);
    setIsLoading(true);
    setReloadKey((value) => value + 1);
  };

  return (
    <div className="silentra-page-shell min-h-[100svh] overflow-x-clip text-zinc-50 antialiased mt-6 mb-6">
      <div className="silentra-page-grid" aria-hidden="true" />
      <SiteNavbar />
      <main className="relative z-10 mx-auto w-full max-w-7xl px-3 pb-[max(4rem,env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))] sm:px-6 sm:pb-16 sm:pt-28 lg:px-8 lg:pt-32">
        <header className="silentra-section-block overflow-hidden rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-8 lg:p-10 glassmorphism">
          <div
            className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-300/30 to-transparent"
            aria-hidden="true"
          />
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-300">
              <Search
                className="size-3.5 text-emerald-300"
                aria-hidden="true"
              />
              {t('directory.title')}
            </div>
            <h1 className="mt-4 max-w-2xl text-[1.95rem] font-semibold leading-[1.02] tracking-[-0.055em] text-zinc-50 sm:mt-5 sm:text-5xl">
              {t('directory.subtitle')}
            </h1>
            <p className="mt-3 max-w-2xl text-[13px] leading-5 text-zinc-400 sm:mt-4 sm:text-base sm:leading-6">
              {t('directory.intro')}
            </p>
          </div>

          <div className="mt-4 grid gap-2 sm:mt-7 sm:gap-3 lg:max-w-4xl">
            <LocationRequest
              value={userLocation}
              onChange={setUserLocation}
              autoRequest
              className="max-w-full min-w-0"
            />
            <div className="hidden sm:block">
              <SearchFilterBar
                query={query}
                setQuery={setQuery}
                activeDate={activeDate}
                setActiveDate={setActiveDate}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
                view={view}
                setView={setView}
                userLocation={userLocation}
                setUserLocation={setUserLocation}
              />
            </div>
            <div className="sm:hidden">
              <MobileSearchFilterBar
                query={query}
                setQuery={setQuery}
                activeDate={activeDate}
                setActiveDate={setActiveDate}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
                view={view}
                setView={setView}
                userLocation={userLocation}
                setUserLocation={setUserLocation}
              />
            </div>
          </div>

          {availableTags.length > 0 && (
            <div className="glassmorphism mt-2 rounded-2xl border border-white/10 bg-black/15 p-2 sm:mt-4 sm:p-4">
              <div className="mb-2 flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                <Tag className="size-3.5" aria-hidden="true" />
                {t('directory.categories')}
              </div>
              <div
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTag(null)}
                  aria-pressed={activeTag === null}
                  className={`min-h-10 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition active:scale-[0.98] ${activeTag === null ? 'border-white/30 bg-white text-zinc-950' : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-200'}`}
                >
                  {t('directory.all')}
                </button>
                {availableTags.map((tag) => {
                  const selected =
                    activeTag?.toLocaleLowerCase() === tag.toLocaleLowerCase();
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setActiveTag(selected ? null : tag)}
                      aria-pressed={selected}
                      className={`min-h-10 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition active:scale-[0.98] ${selected ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-200'}`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              {activeTag && (
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/5 pt-2 text-[11px] text-zinc-500">
                  <span className="min-w-0 truncate">
                    {t('directory.filter')}{' '}
                    <strong className="text-zinc-300">{activeTag}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTag(null)}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                    {t('directory.clear')}
                  </button>
                </div>
              )}
            </div>
          )}
        </header>

        <section className="mt-5 sm:mt-8">
          <div className="mb-3 flex flex-col gap-2.5 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="silentra-eyebrow mb-1">{t('directory.results')}</p>
              <p className="text-sm text-zinc-400" aria-live="polite">
                {isLoading
                  ? t('directory.searching')
                  : loadError
                    ? t('directory.loadError')
                    : `${visibleShops.length} ${visibleShops.length === 1 ? t('directory.foundOne') : t('directory.foundMany')}`}
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:hidden">
              <button
                type="button"
                onClick={() => setView('grid')}
                aria-pressed={view === 'grid'}
                className={`min-h-11 rounded-xl border px-3 text-xs font-semibold transition active:scale-[0.98] ${view === 'grid' ? 'border-white/20 bg-white text-zinc-950' : 'border-white/10 bg-white/[0.03] text-zinc-400'}`}
              >
                {t('directory.list')}
              </button>
              <button
                type="button"
                onClick={() => setView('map')}
                aria-pressed={view === 'map'}
                className={`min-h-11 rounded-xl border px-3 text-xs font-semibold transition active:scale-[0.98] ${view === 'map' ? 'border-white/20 bg-white text-zinc-950' : 'border-white/10 bg-white/[0.03] text-zinc-400'}`}
              >
                {t('directory.map')}
              </button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0">
              {isLoading ? (
                <div
                  className="silentra-section-block flex min-h-64 items-center justify-center rounded-3xl"
                  aria-live="polite"
                >
                  <div className="flex flex-col items-center gap-3 text-sm text-zinc-500">
                    <Loader2
                      className="size-6 animate-spin text-emerald-300"
                      aria-hidden="true"
                    />
                    <span>{t('directory.loadingShops')}</span>
                  </div>
                </div>
              ) : loadError ? (
                <div
                  className="silentra-section-block flex min-h-64 flex-col items-center justify-center rounded-3xl border-rose-400/10 p-7 text-center sm:p-12"
                  role="alert"
                >
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-rose-400/15 bg-rose-400/[0.05] text-rose-300">
                    <AlertTriangle className="size-5" aria-hidden="true" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-zinc-200">
                    {t('directory.loadError')}
                  </p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                    {t('directory.loadErrorHint')}
                  </p>
                  <button
                    type="button"
                    onClick={retryLoad}
                    className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    {t('directory.retry')}
                  </button>
                </div>
              ) : visibleShops.length === 0 ? (
                <div className="silentra-section-block rounded-3xl border-dashed p-7 text-center sm:p-12">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-zinc-400">
                    <Search className="size-5" aria-hidden="true" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-zinc-200">
                    {t('directory.noResults')}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    {t('directory.noResultsHint')}
                  </p>
                </div>
              ) : view === 'map' ? (
                <div className="h-[calc(100svh-15rem)] min-h-[28rem] max-h-[38rem] overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/60 shadow-2xl">
                  <MapPreview
                    shops={visibleShops}
                    view={view}
                    onSelectShop={handleNavigateToShop}
                    userLocation={userLocation}
                  />
                </div>
              ) : (
                <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                  {visibleShops.map((shop) => (
                    <ShopCard
                      key={shop.id}
                      shop={shop}
                      onNavigate={() => handleNavigateToShop(shop)}
                      onOpenBooking={() => setBookingShop(shop)}
                    />
                  ))}
                </div>
              )}
            </div>
            <aside className="hidden lg:block">
              <div className="sticky top-24 overflow-hidden rounded-3xl">
                <div className="mb-4 border-b border-white/8 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                    <MapPin
                      className="size-4 text-emerald-300"
                      aria-hidden="true"
                    />
                    Explora no mapa
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {t('directory.selectShopHint')}
                  </p>
                </div>
                <div className="min-h-[30rem] max-h-[38rem] overflow-hidden">
                  <MapPreview
                    shops={visibleShops}
                    view={view}
                    onSelectShop={handleNavigateToShop}
                    userLocation={userLocation}
                  />
                </div>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <BookingDrawer
        shop={bookingShop}
        isOpen={Boolean(bookingShop)}
        onClose={() => setBookingShop(null)}
      />
    </div>
  );
}
