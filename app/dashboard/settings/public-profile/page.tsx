'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Globe2,
  ImageIcon,
  Lock,
  Save,
  Sparkles,
  Wifi,
  Car,
  Accessibility,
  Baby,
  Armchair,
  CreditCard,
  Wind,
  Coffee,
  Dog,
  DoorOpen,
  GlassWater,
  Toilet,
  CalendarCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DEFAULT_BARBERSHOP_AMENITIES,
  normalizeBarbershopAmenities,
  type BarbershopAmenities,
} from '@/lib/barbershops/amenities';

const inputClass =
  'min-h-11 rounded-xl border-white/10 bg-white/[0.04] text-zinc-100 placeholder:text-zinc-600';

type Profile = {
  slug: string;
  custom_slug: string | null;
  public_profile_enabled: boolean;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  theme_config: Record<string, unknown>;
  amenities?: BarbershopAmenities;
  plan: 'free' | 'pro' | 'enterprise';
  canCustomizeSlug: boolean;
  canCustomizeEnterprise: boolean;
};

type AmenityOption = {
  key: keyof Omit<BarbershopAmenities, 'parking'>;
  label: string;
  description: string;
  Icon: typeof Wifi;
};

const AMENITIES: AmenityOption[] = [
  {
    key: 'wifi',
    label: 'Wi-Fi',
    description: 'Internet disponível para clientes.',
    Icon: Wifi,
  },
  {
    key: 'wheelchair_accessible',
    label: 'Acessível a cadeira de rodas',
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
    label: 'Sala/área de espera',
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
    description: 'Aceita pagamentos com cartão/contactless.',
    Icon: CreditCard,
  },
  {
    key: 'walk_ins',
    label: 'Atendimento sem marcação',
    description: 'Aceita clientes sem agendamento.',
    Icon: CalendarCheck,
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
    Icon: CalendarCheck,
  },
];

export default function PublicProfileSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [slug, setSlug] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [amenities, setAmenities] = useState<BarbershopAmenities>(
    DEFAULT_BARBERSHOP_AMENITIES,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/barbershops/public-profile', {
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.data)
        throw new Error(
          body.error || 'Não foi possível carregar o perfil público.',
        );
      const next = body.data as Profile;
      setProfile(next);
      setSlug(next.custom_slug || next.slug || '');
      setSeoTitle(next.seo_title || '');
      setSeoDescription(next.seo_description || '');
      setOgImageUrl(next.og_image_url || '');
      setAmenities(normalizeBarbershopAmenities(next.amenities));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar o perfil público.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      const response = await fetch('/api/barbershops/public-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(profile.canCustomizeSlug ? { slug } : {}),
          ...(profile.canCustomizeEnterprise
            ? { seoTitle, seoDescription, ogImageUrl }
            : {}),
          amenities,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error || 'Não foi possível guardar.');
      setAmenities(normalizeBarbershopAmenities(body.data?.amenities));
      toast.success('Presença online atualizada.');
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível guardar.',
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = useMemo(() => {
    const flags = AMENITIES.filter((item) => amenities[item.key]);
    return flags.length + (amenities.parking !== 'none' ? 1 : 0);
  }, [amenities]);

  function toggle(key: AmenityOption['key']) {
    setAmenities((current) => ({ ...current, [key]: !current[key] }));
  }

  if (loading)
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-12 text-white">
        <div className="mx-auto max-w-4xl animate-pulse rounded-3xl border border-white/10 bg-white/[0.02] p-8">
          <div className="h-8 w-1/3 rounded bg-white/10" />
          <div className="mt-6 h-12 rounded bg-white/10" />
          <div className="mt-4 h-40 rounded bg-white/10" />
        </div>
      </main>
    );
  if (!profile) return null;

  const publicUrl = `/barbershops/${encodeURIComponent(profile.custom_slug || profile.slug)}`;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/dashboard/settings"
              className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Definições
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
              Presença online
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Página pública da barbearia
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              Define o que os clientes precisam de saber antes de visitar ou
              reservar.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
            {profile.plan}
          </span>
        </header>

        <section
          className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7"
          aria-labelledby="amenities-title"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Sparkles
                  className="size-5 text-emerald-400"
                  aria-hidden="true"
                />
                <h2 id="amenities-title" className="font-semibold">
                  Informações do estabelecimento
                </h2>
              </div>
              <p className="mt-2 text-sm text-zinc-500">
                Clica nas opções que são verdadeiras para a tua barbearia. Só as
                selecionadas aparecem publicamente.
              </p>
            </div>
            <span className="text-xs text-zinc-600" aria-live="polite">
              {selectedCount} selecionada(s)
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:col-span-2">
              <div className="flex items-start gap-3">
                <Car
                  className="mt-0.5 size-5 text-sky-300"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Estacionamento</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Indica ao cliente se existe estacionamento e se é gratuito
                    ou pago.
                  </p>
                  <select
                    aria-label="Disponibilidade de estacionamento"
                    value={amenities.parking}
                    onChange={(e) =>
                      setAmenities((current) => ({
                        ...current,
                        parking: e.target
                          .value as BarbershopAmenities['parking'],
                      }))
                    }
                    className="mt-3 min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-100"
                  >
                    <option value="none">Não tem estacionamento</option>
                    <option value="free">Estacionamento gratuito</option>
                    <option value="paid">Estacionamento pago</option>
                  </select>
                </div>
              </div>
            </div>
            {AMENITIES.map(({ key, label, description, Icon }) => {
              const checked = amenities[key];
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => toggle(key)}
                  className={`group flex min-h-[92px] items-start gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${checked ? 'border-emerald-400/30 bg-emerald-400/[0.06]' : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.035]'}`}
                >
                  <span
                    className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border ${checked ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/[0.03] text-zinc-500'}`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
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
        </section>

        <section
          className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7"
          aria-labelledby="url-title"
        >
          <div className="flex items-center gap-3">
            <Globe2 className="size-5 text-emerald-400" aria-hidden="true" />
            <h2 id="url-title" className="font-semibold">
              URL público
            </h2>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <span className="hidden shrink-0 px-3 text-xs text-zinc-600 md:inline">
                barbers.silentra.me/barbershops/
              </span>
              <Input
                aria-label="Slug público"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                disabled={!profile.canCustomizeSlug}
                className="min-h-11 border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 md:px-0"
              />
            </div>
            {profile.canCustomizeSlug ? (
              <span className="text-xs text-emerald-300">Incluído no Enterprise</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
                <Lock className="size-3" aria-hidden="true" /> Exclusivo do Enterprise
              </span>
            )}
          </div>
        </section>

        <section
          className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7"
          aria-labelledby="seo-title"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="size-5 text-amber-300" aria-hidden="true" />
            <h2 id="seo-title" className="font-semibold">
              SEO avançado
            </h2>
          </div>
          {profile.canCustomizeEnterprise ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-2">
                <label
                  htmlFor="seo-title-input"
                  className="text-sm font-medium"
                >
                  Título SEO
                </label>
                <Input
                  id="seo-title-input"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  maxLength={60}
                  className={inputClass}
                />
              </div>
              <div className="grid gap-2">
                <label
                  htmlFor="seo-description-input"
                  className="text-sm font-medium"
                >
                  Descrição SEO
                </label>
                <Textarea
                  id="seo-description-input"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  maxLength={160}
                  className={`${inputClass} min-h-28 resize-none`}
                />
              </div>
            </div>
          ) : (
            <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-500">
              <Lock className="size-4" aria-hidden="true" /> SEO avançado está
              disponível no Enterprise.
            </div>
          )}
        </section>

        <section
          className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7"
          aria-labelledby="og-title"
        >
          <div className="flex items-center gap-3">
            <ImageIcon className="size-5 text-violet-300" aria-hidden="true" />
            <h2 id="og-title" className="font-semibold">
              Open Graph
            </h2>
          </div>
          {profile.canCustomizeEnterprise ? (
            <div className="mt-5 grid gap-2">
              <label htmlFor="og-url" className="text-sm font-medium">
                URL da imagem OG
              </label>
              <Input
                id="og-url"
                value={ogImageUrl}
                onChange={(e) => setOgImageUrl(e.target.value)}
                className={inputClass}
                placeholder="https://.../og-image.webp"
              />
              <p className="text-xs text-zinc-600">Recomendado: 1200×630.</p>
            </div>
          ) : (
            <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-500">
              <Lock className="size-4" aria-hidden="true" /> Imagem OG
              personalizada está disponível no Enterprise.
            </div>
          )}
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <ExternalLink className="size-4" aria-hidden="true" /> Ver página
            pública
          </Link>
          <Button
            aria-label={saving ? "A guardar perfil público" : "Guardar alterações"}
            onClick={() => void save()}
            disabled={saving}
            className="min-h-11 rounded-xl bg-zinc-100 px-5 text-zinc-950 hover:bg-white"
          >
            {saving ? (
              'A guardar…'
            ) : (
              <>
                <Save className="mr-2 size-4" aria-hidden="true" />
                Guardar alterações
              </>
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}
