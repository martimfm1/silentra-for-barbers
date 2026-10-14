'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  Map,
  LayoutGrid,
  X,
  MapPin,
  Star,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  MarketplaceDateFilter,
  MarketplaceSortFilter,
  UserCoordinates,
} from '@/types/marketplace/filters';
import type { SearchFilterBarProps } from '@/types/marketplace/components';
import { useLanguage } from '@/context/LanguageContext';

const DATE_PILLS: MarketplaceDateFilter[] = ['Today', 'Tomorrow'];
const FILTER_PILLS: MarketplaceSortFilter[] = ['All', 'Near Me', 'Top Rated'];

export function MobileSearchFilterBar({
  query,
  setQuery,
  activeDate,
  setActiveDate,
  activeFilter,
  setActiveFilter,
  view,
  setView,
  userLocation,
  setUserLocation,
}: SearchFilterBarProps) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState(query);
  const [isLocating, setIsLocating] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => setSearchTerm(query), [query]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalized = searchTerm.trimStart();
      if (normalized !== query) setQuery(normalized);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchTerm, query, setQuery]);

  const handleClear = useCallback(() => {
    setSearchTerm('');
    setQuery('');
  }, [setQuery]);
  const requestLocation = useCallback(() => {
    if (userLocation) {
      setActiveFilter('Near Me');
      return;
    }
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setActiveFilter('Near Me');
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 120000 },
    );
  }, [setActiveFilter, setUserLocation, userLocation]);
  const handleFilterClick = (pill: MarketplaceSortFilter) => {
    if (pill === 'Near Me' && !userLocation) {
      requestLocation();
      return;
    }
    setActiveFilter(pill);
  };
  const filterLabel =
    activeFilter === 'Near Me'
      ? userLocation
        ? t('directory.nearYou')
        : t('directory.nearMe')
      : activeFilter === 'Top Rated'
        ? t('directory.topRated')
        : t('directory.all');
  const isCustomDate = /^\d{4}-\d{2}-\d{2}$/.test(activeDate);

  return (
    <div
      role="search"
      aria-label={t('directory.searchShops')}
      className="glassmorphism w-full min-w-0 rounded-2xl border border-white/10 bg-zinc-900/95 p-2 shadow-xl backdrop-blur-md"
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
        <div className="relative flex min-w-0 items-center rounded-xl border border-white/10 bg-black/25 px-2.5 focus-within:border-emerald-400/30 focus-within:ring-2 focus-within:ring-emerald-400/10">
          <Search
            className="size-4 shrink-0 text-zinc-400"
            aria-hidden="true"
          />
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={t('directory.searchShop')}
            aria-label={t('directory.searchShop')}
            className="ml-2 min-w-0 flex-1 bg-transparent py-2.5 text-[16px] text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              aria-label={t('directory.clearSearch')}
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((value) => !value)}
          aria-expanded={filtersOpen}
          aria-controls="mobile-marketplace-filters"
          aria-label={t('directory.openFilters')}
          className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${filtersOpen ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/[0.04] text-zinc-300'}`}
        >
          <SlidersHorizontal className="size-5" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div
          className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1"
          role="group"
          aria-label={t('directory.resultsView')}
        >
          <button
            type="button"
            onClick={() => setView('grid')}
            aria-pressed={view === 'grid'}
            className={`inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold transition active:scale-[0.98] ${view === 'grid' ? 'bg-white text-zinc-950' : 'text-zinc-400'}`}
          >
            <LayoutGrid className="size-3.5" />
            {t('directory.list')}
          </button>
          <button
            type="button"
            onClick={() => setView('map')}
            aria-pressed={view === 'map'}
            className={`inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold transition active:scale-[0.98] ${view === 'map' ? 'bg-white text-zinc-950' : 'text-zinc-400'}`}
          >
            <Map className="size-3.5" />
            {t('directory.map')}
          </button>
        </div>
        <div
          className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1"
          role="group"
          aria-label={t('directory.availability')}
        >
          {DATE_PILLS.map((pill) => (
            <button
              key={pill === 'All' ? t('directory.all') : pill === 'Near Me' ? t('directory.nearMe') : t('directory.topRated')}
              type="button"
              onClick={() => setActiveDate(pill)}
              aria-pressed={activeDate === pill}
              className={`min-h-9 min-w-0 rounded-lg px-2 text-[11px] font-semibold transition active:scale-[0.98] ${activeDate === pill ? 'bg-white/15 text-zinc-50' : 'text-zinc-400'}`}
            >
              {pill === 'Today' ? t('directory.today') : t('directory.tomorrow')}
            </button>
          ))}
        </div>
      </div>

      <div className=" mt-2 flex min-w-0 items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.025] px-2.5 py-1.5">
        <span className="min-w-0 truncate text-[11px] font-medium text-zinc-400">
          Filtro: <span className="text-zinc-200">{filterLabel}</span>
        </span>
        {userLocation ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-emerald-300">
            <MapPin className="size-3" />
            Localização ativa
          </span>
        ) : null}
      </div>

      {filtersOpen ? (
        <div
          id="mobile-marketplace-filters"
          className="mt-2 grid gap-2 rounded-xl border border-white/10 bg-black/20 p-2"
        >
          <div className="grid grid-cols-3 gap-1.5">
            {FILTER_PILLS.map((pill) => (
              <button
                key={pill === 'All' ? t('directory.all') : pill === 'Near Me' ? t('directory.nearMe') : t('directory.topRated')}
                type="button"
                onClick={() => handleFilterClick(pill)}
                disabled={pill === 'Near Me' && isLocating}
                aria-pressed={activeFilter === pill}
                className={`min-h-10 min-w-0 rounded-lg border px-1.5 text-[10px] font-semibold transition active:scale-[0.98] disabled:opacity-60 ${activeFilter === pill ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/[0.03] text-zinc-400'}`}
              >
                <span className="inline-flex min-w-0 items-center justify-center gap-1 truncate">
                  {pill === 'Near Me' ? (
                    isLocating ? (
                      <Loader2 className="size-3 shrink-0 animate-spin" />
                    ) : (
                      <MapPin className="size-3 shrink-0" />
                    )
                  ) : pill === 'Top Rated' ? (
                    <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />
                  ) : null}
                  {pill === 'All'
                    ? 'Todas'
                    : pill === 'Near Me'
                      ? 'Perto'
                      : 'Top'}
                </span>
              </button>
            ))}
          </div>
          <label
            className="text-[10px] font-medium text-zinc-500"
            htmlFor="mobile-marketplace-date"
          >
            Data personalizada
          </label>
          <input
            id="mobile-marketplace-date"
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={isCustomDate ? activeDate : ''}
            onChange={(event) =>
              setActiveDate(
                (event.target.value || 'Today') as MarketplaceDateFilter,
              )
            }
            className="min-h-10 w-full rounded-lg border border-white/10 bg-zinc-950 px-2.5 text-sm text-zinc-200 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
          />
        </div>
      ) : null}
    </div>
  );
}
