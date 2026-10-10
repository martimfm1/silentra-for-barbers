'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, MapPin, Navigation, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UserCoordinates } from '@/types/marketplace/filters';

interface LocationRequestProps {
  value: UserCoordinates | null;
  onChange: (value: UserCoordinates | null) => void;
  autoRequest?: boolean;
  className?: string;
}

type LocationState =
  'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

const AUTO_REQUEST_KEY = 'silentra:location-auto-requested';

function wasAutoRequestStarted() {
  try {
    return sessionStorage.getItem(AUTO_REQUEST_KEY) === '1';
  } catch {
    return false;
  }
}

function markAutoRequestStarted() {
  try {
    sessionStorage.setItem(AUTO_REQUEST_KEY, '1');
  } catch {
    // Optional client storage.
  }
}

export function LocationRequest({
  value,
  onChange,
  autoRequest = false,
  className,
}: LocationRequestProps) {
  const [state, setState] = useState<LocationState>(value ? 'granted' : 'idle');
  const requestedRef = useRef(false);

  const requestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setState('unsupported');
      return;
    }
    if (requestedRef.current && state === 'requesting') return;
    requestedRef.current = true;
    setState('requesting');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: UserCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        onChange(location);
        setState('granted');
      },
      (error) => {
        console.warn('[LOCATION_PERMISSION]', error.code, error.message);
        setState(error.code === 1 ? 'denied' : 'idle');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 },
    );
  }, [onChange, state]);

  useEffect(() => {
    // Remove coordinates saved by older versions; precise location stays in memory only.
    try {
      sessionStorage.removeItem('silentra:user-location');
    } catch {
      // Optional client storage.
    }

    if (
      autoRequest &&
      !value &&
      !requestedRef.current &&
      !wasAutoRequestStarted()
    ) {
      markAutoRequestStarted();
      const timer = window.setTimeout(requestLocation, 250);
      return () => window.clearTimeout(timer);
    }
  }, [autoRequest, onChange, requestLocation, value]);

  if (state === 'granted' && value) {
    return (
      <div className={className}>
        <div className="max-w-200px truncate flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-100">
                Localização ativa
              </p>
              <p className="truncate text-xs text-zinc-500">
                Os resultados podem ser ordenados pela distância.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setState('idle');
              requestedRef.current = false;
            }}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-zinc-500 hover:bg-white/10 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            aria-label="Remover localização"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  if (state === 'unsupported') {
    return (
      <div className={className}>
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3 text-xs text-amber-200">
          Este navegador não disponibiliza a localização. Pode continuar a
          pesquisar por cidade ou morada.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950/70 p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <MapPin className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100">
              Encontrar barbearias perto de si
            </p>
            <p className="mt-0.5 text-xs leading-5 text-zinc-500">
              Ative a localização para melhorar a ordem dos resultados e centrar
              o mapa na sua posição.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={requestLocation}
          disabled={state === 'requesting'}
          className="min-h-11 shrink-0 rounded-xl bg-zinc-50 text-zinc-950 hover:bg-white"
        >
          {state === 'requesting' ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Navigation className="mr-2 size-4" />
          )}
          {state === 'requesting' ? 'A localizar…' : 'Ativar localização'}
        </Button>
      </div>
      {state === 'denied' ? (
        <p className="mt-2 text-xs text-zinc-500" role="status">
          A localização foi bloqueada. Ative-a nas permissões do navegador e
          tente novamente.
        </p>
      ) : null}
    </div>
  );
}
