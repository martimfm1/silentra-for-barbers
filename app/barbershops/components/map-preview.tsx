'use client';

import dynamic from 'next/dynamic';
import { motion } from 'motion/react';
import { Navigation } from 'lucide-react';
import { SilentraLoading } from '@/components/ui/silentra-loading';
import type { MapPreviewProps } from '@/types/marketplace/components';

const MapInner = dynamic(() => import('./map-inner'), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-full w-full items-center justify-center rounded-3xl bg-zinc-950 text-zinc-200"
      aria-label="A carregar o mapa"
      role="status"
    >
      <SilentraLoading variant="compact" message="A carregar o mapa…" />
    </div>
  ),
});

export function MapPreview({
  shops,
  view,
  onSelectShop,
  userLocation,
}: MapPreviewProps) {
  return (
    <motion.aside
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="glassmorphism rounded-3xl border border-white/10 bg-zinc-950/90 p-4 text-zinc-100 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:sticky"
      aria-label="Mapa e resultados de barbearias"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
            Mapa
          </p>
          <h3 className="mt-2 text-xl font-semibold text-zinc-50">
            Barbearias próximas
          </h3>
        </div>
        <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-zinc-100">
          {view === 'grid' ? 'Sincronizado' : 'Mapa ativo'}
        </span>
      </div>

      <style>{`
        [aria-label="Mapa e resultados de barbearias"] .map-preview-canvas > div:first-child > div:last-child {
          display: none;
        }
      `}</style>

      <div className="map-preview-shell relative mt-5 overflow-hidden rounded-3xl border border-white/15 bg-zinc-950 shadow-inner">
        <div className="map-preview-canvas relative h-[440px] overflow-hidden">
          <MapInner
            shops={shops}
            onSelectShop={onSelectShop}
            userLocation={userLocation}
          />

          <div className="pointer-events-none absolute left-4 top-4 z-[1000] inline-flex items-center gap-2 rounded-full border border-white/15 bg-zinc-950/95 px-3 py-2 text-xs font-medium text-zinc-100 shadow-lg backdrop-blur-md">
            <Navigation
              className="size-3.5 text-emerald-300"
              aria-hidden="true"
            />
            {userLocation
              ? 'A mostrar a tua localização'
              : 'Localização opcional'}
          </div>

          <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-[1000] rounded-2xl border border-white/15 bg-zinc-950/95 p-4 shadow-lg backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div>
                <div className="font-semibold text-zinc-50">
                  Resultados disponíveis
                </div>
                <div className="mt-0.5 text-xs font-medium text-zinc-300">
                  {shops.length}{' '}
                  {shops.length === 1 ? 'barbearia' : 'barbearias'} no mapa
                </div>
              </div>
              <div className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                {userLocation
                  ? 'Ordenação por distância'
                  : 'Localização desligada'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5 border-t border-white/10 bg-zinc-950/90 px-4 py-2.5 text-[10px] leading-4 text-zinc-500 sm:text-[11px]">
          <span>©</span>
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-zinc-700 underline-offset-2 transition hover:text-zinc-300"
          >
            OpenStreetMap
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="https://carto.com/attributions"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-zinc-700 underline-offset-2 transition hover:text-zinc-300"
          >
            CARTO
          </a>
        </div>
      </div>
    </motion.aside>
  );
}
