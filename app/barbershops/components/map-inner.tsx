'use client';

import { useEffect } from 'react';
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapInnerProps } from '@/types/marketplace/components';
import type { MarketplaceShop } from '@/types/marketplace/shops';
import { Navigation, Star } from 'lucide-react';

const shopIcon = L.divIcon({
  className: 'custom-map-pin',
  html: `
    <div class="relative flex size-10 items-center justify-center" aria-hidden="true">
      <div class="absolute -inset-1.5 rounded-full bg-emerald-300/20 blur-md"></div>
      <div class="relative flex size-10 items-center justify-center rounded-full border-2 border-emerald-200/80 bg-zinc-950 text-emerald-100 shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

const userIcon = L.divIcon({
  className: 'custom-user-location-pin',
  html: `<div class="relative flex size-9 items-center justify-center" aria-hidden="true"><span class="absolute inset-0 animate-ping rounded-full bg-sky-300/25"></span><span class="relative size-4 rounded-full border-2 border-white bg-sky-500 shadow-[0_0_0_4px_rgba(14,165,233,0.16),0_6px_20px_rgba(14,165,233,0.4)]"></span></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function MapBoundsController({
  shops,
  userLocation,
}: Pick<MapInnerProps, 'shops' | 'userLocation'>) {
  const map = useMap();

  useEffect(() => {
    const validShops = shops.filter(
      (shop) => Number.isFinite(shop.lat) && Number.isFinite(shop.lng),
    );
    const points: [number, number][] = validShops.map((shop) => [
      shop.lat!,
      shop.lng!,
    ]);
    if (userLocation)
      points.push([userLocation.latitude, userLocation.longitude]);

    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], userLocation ? 14 : 13, { animate: true });
      return;
    }

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15, animate: true });
  }, [shops, userLocation, map]);

  return null;
}

export default function MapInner({
  shops,
  onSelectShop,
  userLocation,
}: MapInnerProps) {
  const defaultCenter: [number, number] = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : [38.7223, -9.1393];
  const cartoApiKey = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim();
  const cartoTileUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png${cartoApiKey ? `?key=${encodeURIComponent(cartoApiKey)}` : ''}`;

  return (
    <div className="h-full w-full">
      <style>{`
        .custom-leaflet-popup .leaflet-popup-content-wrapper,
        .custom-leaflet-popup .leaflet-popup-tip {
          background: #18181b;
          color: #f4f4f5;
          border: 1px solid rgba(255,255,255,.14);
          box-shadow: 0 18px 50px rgba(0,0,0,.42);
        }
        .custom-leaflet-popup .leaflet-popup-content {
          margin: 12px 14px;
          min-width: 220px;
        }
        .custom-leaflet-popup .leaflet-popup-close-button {
          color: #d4d4d8 !important;
          font-size: 22px !important;
          font-weight: 700;
          line-height: 1;
          padding: 8px 10px !important;
          border-radius: 10px;
        }
        .custom-leaflet-popup .leaflet-popup-close-button:hover,
        .custom-leaflet-popup .leaflet-popup-close-button:focus-visible {
          color: #fff !important;
          background: rgba(255,255,255,.08);
          outline: 2px solid rgba(52,211,153,.78);
          outline-offset: 2px;
        }
        .leaflet-control-zoom a {
          display: flex !important;
          align-items: center;
          justify-content: center;
          width: 38px !important;
          height: 38px !important;
          background: #18181b !important;
          color: #f4f4f5 !important;
          border-color: rgba(255,255,255,.14) !important;
          font-size: 22px !important;
          line-height: 1 !important;
        }
        .leaflet-control-zoom a:hover,
        .leaflet-control-zoom a:focus-visible {
          background: #27272a !important;
          color: #fff !important;
          outline: 2px solid rgba(52,211,153,.78);
          outline-offset: 2px;
        }
        .leaflet-container { font: inherit; background: #09090b; }
        @media (max-width: 640px) {
          .custom-leaflet-popup .leaflet-popup-content { min-width: 190px; margin: 11px 12px; }
          .leaflet-control-zoom a { width: 42px !important; height: 42px !important; }
        }
      `}</style>
      <div className="h-full w-full overflow-hidden rounded-3xl">
        <MapContainer
          center={defaultCenter}
          zoom={12}
          scrollWheelZoom
          keyboard
          attributionControl={false}
          className="h-full w-full rounded-3xl"
          aria-label="Mapa de barbearias próximas"
        >
          <TileLayer url={cartoTileUrl} subdomains="abcd" maxZoom={20} />

          <MapBoundsController shops={shops} userLocation={userLocation} />

          {userLocation ? (
            <>
              <Circle
                center={[userLocation.latitude, userLocation.longitude]}
                radius={45}
                pathOptions={{
                  color: '#7dd3fc',
                  fillColor: '#38bdf8',
                  fillOpacity: 0.1,
                  weight: 2,
                }}
              />
              <Marker
                position={[userLocation.latitude, userLocation.longitude]}
                icon={userIcon}
                zIndexOffset={1000}
              >
                <Popup className="custom-leaflet-popup">
                  <div className="p-1">
                    <div className="flex items-center gap-2">
                      <Navigation
                        className="size-4 text-sky-300"
                        aria-hidden="true"
                      />
                      <span className="font-semibold text-zinc-50">
                        A tua localização
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-zinc-300">
                      Usada apenas para calcular a proximidade das barbearias.
                    </p>
                  </div>
                </Popup>
              </Marker>
            </>
          ) : null}

          {shops.map((shop: MarketplaceShop) => {
            if (!Number.isFinite(shop.lat) || !Number.isFinite(shop.lng))
              return null;

            return (
              <Marker
                key={shop.id}
                position={[shop.lat!, shop.lng!]}
                icon={shopIcon}
                keyboard
              >
                <Popup className="custom-leaflet-popup">
                  <div className="p-1">
                    <div className="flex items-start justify-between gap-3 pr-2">
                      <h5 className="font-semibold leading-5 text-zinc-50">
                        {shop.name}
                      </h5>
                      <div className="flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-200">
                        <Star
                          className="size-3 fill-amber-300 text-amber-300"
                          aria-hidden="true"
                        />
                        <span>{shop.rating}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-zinc-300">
                      {shop.city}
                      {shop.distanceKm > 0
                        ? ` · ${shop.distanceKm.toFixed(1)} km`
                        : ''}{' '}
                      · {shop.price}
                    </p>
                    <button
                      type="button"
                      onClick={() => onSelectShop(shop)}
                      className="mt-3 min-h-11 w-full rounded-xl bg-emerald-300 px-3 py-2 text-xs font-bold text-zinc-950 shadow-[0_8px_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                    >
                      Ver barbearia
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <div className="flex items-center justify-end gap-1.5 px-1 pt-2 text-[10px] leading-4 text-zinc-500 sm:text-[11px]">
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
  );
}
