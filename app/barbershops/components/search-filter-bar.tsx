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

export function SearchFilterBar({
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchTerm !== query) setQuery(searchTerm.trimStart());
    }, 450);
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
        const location: UserCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(location);
        setActiveFilter('Near Me');
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 },
    );
  }, [setActiveFilter, setUserLocation, userLocation]);

  const handleFilterClick = (pill: MarketplaceSortFilter) => {
    if (pill === 'Near Me' && !userLocation) {
      requestLocation();
      return;
    }
    setActiveFilter(pill);
  };

  return (
    <div
      role="search"
      aria-label={t('directory.searchShops')}
      className="glassmorphism flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-900/80 p-3 shadow-xl backdrop-blur-md"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex min-w-0 flex-1 items-center rounded-xl bg-white/5 px-3.5 py-2.5 transition-all focus-within:bg-white/10 focus-within:ring-2 focus-within:ring-emerald-400/30">
          <Search
            className="h-4 w-4 shrink-0 text-zinc-400"
            aria-hidden="true"
          />
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('directory.searchByAddress')}
            aria-label={t('directory.searchByAddress')}
            className="ml-2.5 w-full bg-transparent text-base text-zinc-100 outline-none placeholder:text-zinc-500 sm:text-sm"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              aria-label={t('directory.clearSearch')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div
          className="flex shrink-0 items-center rounded-xl bg-white/5 p-1"
          role="group"
          aria-label={t('directory.resultsView')}
        >
          <button
            type="button"
            onClick={() => setView('grid')}
            aria-pressed={view === 'grid'}
            aria-label={t('directory.gridView')}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 transition-all sm:flex-none ${view === 'grid' ? 'bg-white/15 text-zinc-50 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <LayoutGrid className="h-4 w-4" />{' '}
            <span className="text-xs sm:hidden">{t('directory.list')}</span>
          </button>
          <button
            type="button"
            onClick={() => setView('map')}
            aria-pressed={view === 'map'}
            aria-label={t('directory.mapView')}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 transition-all sm:flex-none ${view === 'map' ? 'bg-white/15 text-zinc-50 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Map className="h-4 w-4" />{' '}
            <span className="text-xs sm:hidden">{t('directory.map')}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div
            className="flex shrink-0 items-center rounded-xl bg-white/5 p-1"
            role="group"
            aria-label={t('directory.day')}
          >
            {DATE_PILLS.map((pill) => {
              const isActive = activeDate === pill;
              return (
                <button
                  key={pill}
                  type="button"
                  onClick={() => setActiveDate(pill)}
                  aria-pressed={isActive}
                  className={`min-h-10 rounded-lg px-3 text-xs font-semibold transition-all ${isActive ? 'bg-zinc-100 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  {pill === 'Today'
                    ? t('directory.today')
                    : t('directory.tomorrow')}
                </button>
              );
            })}
          </div>

          <label className="sr-only" htmlFor="marketplace-date">
            Escolher data
          </label>
          <input
            id="marketplace-date"
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={/^\d{4}-\d{2}-\d{2}$/.test(activeDate) ? activeDate : ''}
            onChange={(event) =>
              setActiveDate(
                event.target.value
                  ? (event.target.value as `${number}-${number}-${number}`)
                  : 'Today',
              )
            }
            className="min-h-10 shrink-0 rounded-lg border border-white/10 bg-zinc-950 px-3 text-xs text-zinc-200 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
          />

          <div className="h-5 w-px shrink-0 bg-white/10" />

          <div
            className="flex shrink-0 items-center gap-1 rounded-xl bg-white/5 p-1"
            role="group"
            aria-label={t('directory.filters')}
          >
            {FILTER_PILLS.map((pill) => {
              const isActive = activeFilter === pill;
              return (
                <button
                  key={pill}
                  type="button"
                  onClick={() => handleFilterClick(pill)}
                  aria-pressed={isActive}
                  disabled={pill === 'Near Me' && isLocating}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-all ${isActive ? 'bg-white/15 font-semibold text-zinc-50 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'} disabled:opacity-60`}
                >
                  {pill === 'Near Me' ? (
                    isLocating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
                    ) : (
                      <MapPin className="h-3.5 w-3.5 text-sky-400" />
                    )
                  ) : null}
                  {pill === 'Top Rated' ? (
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  ) : null}
                  {pill === 'All'
                    ? 'Todas'
                    : pill === 'Near Me'
                      ? userLocation
                        ? 'Perto de si'
                        : 'Perto de mim'
                      : 'Melhor avaliadas'}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
