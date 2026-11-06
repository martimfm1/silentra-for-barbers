'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  Armchair,
  Baby,
  CalendarCheck2,
  Car,
  Check,
  Coffee,
  CreditCard,
  Dog,
  DoorOpen,
  GlassWater,
  Sparkles,
  Toilet,
  Wifi,
  Wind,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { SilentraLoading } from '@/components/ui/silentra-loading';
import {
  DEFAULT_BARBERSHOP_AMENITIES,
  normalizeBarbershopAmenities,
  type BarbershopAmenities,
} from '@/lib/barbershops/amenities';

const OPTIONS = [
  {
    key: 'wifi',
    label: 'Wi-Fi',
    description: 'Internet disponível para clientes.',
    Icon: Wifi,
  },
  {
    key: 'wheelchair_accessible',
    label: 'Acesso para cadeira de rodas',
    description: 'Espaço preparado para mobilidade reduzida.',
    Icon: Accessibility,
  },
  {
    key: 'accessible_entrance',
    label: 'Entrada acessível',
    description: 'Entrada sem barreiras ou com acesso adaptado.',
    Icon: DoorOpen,
  },
  {
    key: 'accessible_toilet',
    label: 'WC acessível',
    description: 'Casa de banho adaptada.',
    Icon: Accessibility,
  },
  {
    key: 'kids_friendly',
    label: 'Adequado para crianças',
    description: 'Atende crianças e famílias.',
    Icon: Baby,
  },
  {
    key: 'waiting_area',
    label: 'Área de espera',
    description: 'Lugar para aguardar confortavelmente.',
    Icon: Armchair,
  },
  {
    key: 'restroom',
    label: 'Casa de banho',
    description: 'WC disponível no estabelecimento.',
    Icon: Toilet,
  },
  {
    key: 'air_conditioning',
    label: 'Ar condicionado',
    description: 'Climatização disponível.',
    Icon: Wind,
  },
  {
    key: 'card_payments',
    label: 'Pagamento por cartão',
    description: 'Aceita cartão e contactless.',
    Icon: CreditCard,
  },
  {
    key: 'walk_ins',
    label: 'Atendimento sem marcação',
    description: 'Aceita clientes sem agendamento.',
    Icon: CalendarCheck2,
  },
  {
    key: 'coffee',
    label: 'Café',
    description: 'Café disponível para clientes.',
    Icon: Coffee,
  },
  {
    key: 'water',
    label: 'Água',
    description: 'Água disponível para clientes.',
    Icon: GlassWater,
  },
  {
    key: 'pet_friendly',
    label: 'Pet friendly',
    description: 'Animais de companhia são bem-vindos.',
    Icon: Dog,
  },
  {
    key: 'appointment_required',
    label: 'Agendamento obrigatório',
    description: 'É necessário marcar antes de visitar.',
    Icon: CalendarCheck2,
  },
] as const;

type AmenityBooleanKey = Exclude<keyof BarbershopAmenities, 'parking'>;

type PublicProfileResponse = {
  data?: { amenities?: unknown };
  error?: string;
};

export function SettingsAmenitiesPanel({
  barbershopId,
}: {
  barbershopId: string;
}) {
  const [amenities, setAmenities] = useState<BarbershopAmenities>(
    DEFAULT_BARBERSHOP_AMENITIES,
  );
  const [initialAmenities, setInitialAmenities] = useState<BarbershopAmenities>(
    DEFAULT_BARBERSHOP_AMENITIES,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/barbershops/public-profile', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        const body = (await response
          .json()
          .catch(() => ({}))) as PublicProfileResponse;
        if (!response.ok)
          throw new Error(
            body.error ||
              'Não foi possível carregar as informações do estabelecimento.',
          );
        return body;
      })
      .then((body) => {
        if (!active) return;
        const normalized = normalizeBarbershopAmenities(body.data?.amenities);
        setAmenities(normalized);
        setInitialAmenities(normalized);
      })
      .catch((error) => {
        if (active)
          toast.error(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar as informações do estabelecimento.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [barbershopId]);

  const dirty = useMemo(
    () => JSON.stringify(amenities) !== JSON.stringify(initialAmenities),
    [amenities, initialAmenities],
  );
  const selectedCount = useMemo(
    () =>
      OPTIONS.filter(({ key }) => amenities[key]).length +
      (amenities.parking !== 'none' ? 1 : 0),
    [amenities],
  );

  function toggle(key: AmenityBooleanKey) {
    setAmenities((current) => ({ ...current, [key]: !current[key] }));
  }

  async function save() {
    if (!dirty) return;
    setSaving(true);
    try {
      const response = await fetch('/api/barbershops/public-profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ amenities }),
      });
      const body = (await response
        .json()
        .catch(() => ({}))) as PublicProfileResponse;
      if (!response.ok)
        throw new Error(
          body.error || 'Não foi possível guardar as informações.',
        );
      const normalized = normalizeBarbershopAmenities(
        body.data?.amenities ?? amenities,
      );
      setAmenities(normalized);
      setInitialAmenities(normalized);
      toast.success('Informações do estabelecimento guardadas.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível guardar as informações.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="mt-6 border-white/10 bg-black/30">
        <CardContent className="flex min-h-40 items-center justify-center">
          <SilentraLoading variant="compact" message="A carregar as informações…" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="mt-6 border-emerald-500/20 bg-emerald-500/[0.035] backdrop-blur-md"
      aria-labelledby="settings-amenities-title"
    >
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle
              id="settings-amenities-title"
              className="flex items-center gap-2 text-lg text-zinc-100"
            >
              <Sparkles
                className="size-4 text-emerald-400"
                aria-hidden="true"
              />{' '}
              Informações do estabelecimento
            </CardTitle>
            <CardDescription className="mt-1 text-xs leading-5 text-zinc-400">
              Clica para selecionar o que é verdadeiro. As opções selecionadas
              aparecem automaticamente na página pública da barbearia.
            </CardDescription>
          </div>
          <span className="text-xs text-zinc-500" aria-live="polite">
            {selectedCount} selecionada(s)
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-start gap-3">
            <Car
              className="mt-0.5 size-5 shrink-0 text-sky-300"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Estacionamento</p>
              <p className="mt-1 text-xs text-zinc-500">
                Escolhe uma única opção para evitar informação ambígua.
              </p>
              <div
                className="mt-3 grid gap-2 sm:grid-cols-3"
                role="radiogroup"
                aria-label="Estacionamento"
              >
                {(
                  [
                    ['none', 'Não tem'],
                    ['free', 'Gratuito'],
                    ['paid', 'Pago'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={amenities.parking === value}
                    onClick={() =>
                      setAmenities((current) => ({
                        ...current,
                        parking: value,
                      }))
                    }
                    className={`min-h-11 rounded-xl border px-3 text-sm text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${amenities.parking === value ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:bg-white/[0.05]'}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span>{label}</span>
                      {amenities.parking === value && (
                        <Check className="size-4 shrink-0" aria-hidden="true" />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map(({ key, label, description, Icon }) => {
            const checked = amenities[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={checked}
                onClick={() => toggle(key)}
                className={`group flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${checked ? 'border-emerald-400/30 bg-emerald-400/[0.06]' : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.035]'}`}
              >
                <span
                  className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border ${checked ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/[0.03] text-zinc-500'}`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                    <span>{label}</span>
                    {checked && (
                      <Check
                        className="size-4 text-emerald-300"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-zinc-500">
                    {description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-600">
            Estas informações ficam visíveis publicamente quando selecionadas.
          </p>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="min-h-11 rounded-xl bg-zinc-50 text-zinc-950 hover:bg-white"
          >
            {saving ? <Spinner className="mr-2 size-4" /> : null}
            {saving ? 'A guardar…' : 'Guardar informações'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
