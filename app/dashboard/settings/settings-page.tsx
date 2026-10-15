'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarCheck2,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  ImageIcon,
  LogOut,
  MapPin,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBarbershop } from '@/context/BarbershopContext';
import { useLanguage } from '@/context/LanguageContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { cn } from '@/lib/utils';
import {
  DEFAULT_BARBERSHOP_AVATAR,
  DEFAULT_BARBERSHOP_BANNER,
} from '@/lib/barbershops/default-media';
import { processAndUploadImage } from '@/lib/utils/upload-image';
import { barbershopService } from '@/app/dashboard/_services/barbershop.service';
import { authService } from '@/app/dashboard/_services/auth.service';
import {
  AddressAutocomplete,
  type AddressSuggestion,
} from '@/components/location/address-autocomplete';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import {
  DEFAULT_BARBERSHOP_AMENITIES,
  normalizeBarbershopAmenities,
  type BarbershopAmenities,
} from '@/lib/barbershops/amenities';

type Section =
  | 'overview'
  | 'business'
  | 'location'
  | 'hours'
  | 'appearance'
  | 'billing'
  | 'account';
const INPUT_CLASS = 'min-h-11 rounded-xl border-white/10 bg-white/5 text-sm';
const CARD_CLASS = 'rounded-2xl border border-white/10 bg-white/[.02]';
type Config = {
  name: string;
  phone: string;
  address: string;
  opening_time: string;
  closing_time: string;
  lunch_start: string;
  lunch_end: string;
  closed_days: string;
  allow_online_bookings: boolean;
  is_public_in_directory: boolean;
  time_limit_cancellation_hours: number;
  auto_confirm_bookings: boolean;
  auto_complete_bookings: boolean;
  default_language: 'pt' | 'en';
};
const sections: [Section, string, string, typeof Settings][] = [
  ['overview', 'Visão geral', 'Estado da configuração', Settings],
  ['business', 'Negócio', 'Identidade e dados públicos', Store],
  ['location', 'Localização', 'Morada e informações do espaço', MapPin],
  ['hours', 'Horários', 'Funcionamento e regras', Clock3],
  ['appearance', 'Aparência', 'Logótipo e imagem de capa', ImageIcon],
  ['billing', 'Plano e faturação', 'Subscrição e faturas', CreditCard],
  ['account', 'Conta e segurança', 'Sessão e acesso', ShieldCheck],
];
const days = [
  ['Monday', 'Segunda-feira'],
  ['Tuesday', 'Terça-feira'],
  ['Wednesday', 'Quarta-feira'],
  ['Thursday', 'Quinta-feira'],
  ['Friday', 'Sexta-feira'],
  ['Saturday', 'Sábado'],
  ['Sunday', 'Domingo'],
] as const;
const amenitiesKeys = [
  'wifi',
  'wheelchair_accessible',
  'accessible_entrance',
  'accessible_toilet',
  'kids_friendly',
  'waiting_area',
  'restroom',
  'air_conditioning',
  'card_payments',
  'walk_ins',
  'coffee',
  'water',
  'pet_friendly',
  'appointment_required',
] as const;
const normalize = (v: Partial<Config>): Config => ({
  name: v.name ?? '',
  phone: v.phone ?? '',
  address: v.address ?? '',
  opening_time: v.opening_time ?? '09:00',
  closing_time: v.closing_time ?? '19:00',
  lunch_start: v.lunch_start ?? '',
  lunch_end: v.lunch_end ?? '',
  closed_days: v.closed_days ?? 'None',
  allow_online_bookings: v.allow_online_bookings ?? true,
  is_public_in_directory: v.is_public_in_directory ?? true,
  time_limit_cancellation_hours: Math.max(
    0,
    Math.min(720, Number(v.time_limit_cancellation_hours ?? 24)),
  ),
  auto_confirm_bookings: v.auto_confirm_bookings === true,
  auto_complete_bookings: v.auto_complete_bookings === true,
  default_language: v.default_language === 'en' ? 'en' : 'pt',
});
const closedList = (v: string) =>
  !v || v === 'None'
    ? []
    : v
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);

export default function SettingsPageOrganized() {
  const router = useRouter();
  const { t, setLocale } = useLanguage();
  const { barbershopId } = useBarbershop();
  const { hasFeature, loading: planLoading, plan } = useFeatureAccess();
  const canDirectory = hasFeature('directory_visibility');
  const automationAllowed = plan === 'pro' || plan === 'enterprise';
  const [section, setSection] = useState<Section>('overview');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [config, setConfig] = useState<Config>(normalize({}));
  const [initial, setInitial] = useState<Config | null>(null);
  const [amenities, setAmenities] = useState<BarbershopAmenities>(
    DEFAULT_BARBERSHOP_AMENITIES,
  );
  const [initialAmenities, setInitialAmenities] = useState(
    DEFAULT_BARBERSHOP_AMENITIES,
  );
  const [suggestion, setSuggestion] = useState<AddressSuggestion | null>(null);
  const [avatarTick, setAvatarTick] = useState(0);
  const [bannerTick, setBannerTick] = useState(0);
  const [avatarPreviewError, setAvatarPreviewError] = useState(false);
  const [bannerPreviewError, setBannerPreviewError] = useState(false);
  const [uploading, setUploading] = useState<'avatar' | 'banner' | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    if (!barbershopId) return;
    setLoading(true);
    const [c, p] = await Promise.all([
      barbershopService.getConfig(barbershopId),
      fetch('/api/barbershops/public-profile', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      }),
    ]);
    if (c.error)
      toast.error(
        c.error.message || t('settingsPage.loadFailed'),
      );
    if (c.data) {
      const n = normalize(c.data);
      setConfig(n);
      setInitial(n);
    }
    try {
      const body = await p.json();
      if (p.ok) {
        const n = normalizeBarbershopAmenities(body.data?.amenities);
        setAmenities(n);
        setInitialAmenities(n);
      }
    } catch {
      toast.error(t('settingsPage.publicLoadFailed'));
    }
    setLoading(false);
  }, [barbershopId, t]);
  useEffect(() => {
    void load();
  }, [load]);
  const dirty = useMemo(
    () =>
      JSON.stringify(config) !== JSON.stringify(initial) ||
      JSON.stringify(amenities) !== JSON.stringify(initialAmenities) ||
      suggestion !== null,
    [config, initial, amenities, initialAmenities, suggestion],
  );
  const closed = useMemo(
    () => closedList(config.closed_days),
    [config.closed_days],
  );
  const completion = useMemo(
    () =>
      Math.round(
        ([
          config.name,
          config.phone,
          config.address,
          config.opening_time && config.closing_time,
          config.allow_online_bookings,
        ].filter(Boolean).length /
          5) *
          100,
      ),
    [config],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? sections.filter(([id]) => {
          const label = t(`settingsPage.${id}`).toLowerCase();
          const description = t(`settingsPage.${id}Description`).toLowerCase();
          return `${label} ${description}`.includes(q);
        })
      : sections;
  }, [search, t]);
  const set = (patch: Partial<Config>) =>
    setConfig((c) => ({ ...c, ...patch }));
  function go(s: Section) {
    setSection(s);
    requestAnimationFrame(() =>
      document
        .getElementById(`settings-${s}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }
  async function saveAll() {
    if (!barbershopId || !dirty || saving) return;
    if (config.opening_time >= config.closing_time)
      return toast.error(
        t('settingsPage.openingAfterClosing'),
      );
    if (
      (config.lunch_start && !config.lunch_end) ||
      (!config.lunch_start && config.lunch_end) ||
      (config.lunch_start &&
        config.lunch_end &&
        config.lunch_start >= config.lunch_end)
    )
      return toast.error(t('settingsPage.lunchInvalid));
    setSaving(true);
    try {
      const payload = { ...config };
      if (!canDirectory)
        delete (payload as Partial<Config>).is_public_in_directory;
      if (!automationAllowed) {
        payload.auto_confirm_bookings = initial?.auto_confirm_bookings ?? false;
        payload.auto_complete_bookings =
          initial?.auto_complete_bookings ?? false;
      }
      const c = await barbershopService.updateConfig(barbershopId, payload);
      if (c.error) throw c.error;
      if (suggestion) {
        const r = await fetch(`/api/barbershops/${barbershopId}/location`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: suggestion.fullAddress || config.address,
            latitude: suggestion.lat,
            longitude: suggestion.lng,
          }),
        });
        const b = await r.json().catch(() => ({}));
        if (!r.ok)
          throw new Error(
            b.error || t('settingsPage.locationUpdateFailed'),
          );
      }
      if (JSON.stringify(amenities) !== JSON.stringify(initialAmenities)) {
        const r = await fetch('/api/barbershops/public-profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ amenities }),
        });
        const b = await r.json().catch(() => ({}));
        if (!r.ok)
          throw new Error(
            b.error || t('settingsPage.amenitiesSaveFailed'),
          );
      }
      const n = normalize(c.data ?? config);
      setConfig(n);
      setInitial(n);
      setInitialAmenities(amenities);
      setLocale(n.default_language);
      setSuggestion(null);
      toast.success(t('settingsPage.saved'));
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : t('settingsPage.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  }
  function reset() {
    if (initial) setConfig(initial);
    setAmenities(initialAmenities);
    setSuggestion(null);
  }
  async function upload(type: 'avatar' | 'banner', file: File) {
    if (!barbershopId) return;
    setUploading(type);
    const r = await processAndUploadImage({
      file,
      bucket: type,
      path: `${barbershopId}/${type}.webp`,
      maxWidth: type === 'avatar' ? 400 : 1400,
      quality: 0.85,
    });
    setUploading(null);
    if (r.error)
      return toast.error(
        r.error.message || t('settingsPage.imageUpdateFailed'),
      );
    if (type === 'avatar') {
      setAvatarPreviewError(false);
      setAvatarTick(Date.now());
    } else {
      setBannerPreviewError(false);
      setBannerTick(Date.now());
    }
    toast.success(
      type === 'avatar' ? t('settingsPage.logoUpdated') : t('settingsPage.coverUpdated'),
    );
  }
  async function logout() {
    setLogoutLoading(true);
    try {
      await authService.logout();
      router.replace('/login');
      router.refresh();
    } catch {
      toast.error(t('settingsPage.logoutFailed'));
      setLogoutLoading(false);
    }
  }
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') || '';
  const avatar =
    barbershopId && origin
      ? `${origin}/storage/v1/object/public/avatar/${barbershopId}/avatar.webp?t=${avatarTick}`
      : null;
  const banner =
    barbershopId && origin
      ? `${origin}/storage/v1/object/public/banner/${barbershopId}/banner.webp?t=${bannerTick}`
      : null;
  if (loading || planLoading)
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Spinner className="size-7" />
      </div>
    );
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto max-w-7xl px-4 pb-28 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-30 -mx-4 border-b bg-zinc-950/10 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/dashboard"
                aria-label={t('settingsPage.backToDashboard')}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.03]"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold sm:text-2xl">
                  {t('settingsPage.title')}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {dirty && (
                <Button
                  variant="ghost"
                  onClick={reset}
                  className="hidden sm:inline-flex"
                >
                  {t('settingsPage.discard')}
                </Button>
              )}
              <Button
                onClick={() => void saveAll()}
                disabled={!dirty || saving}
                className="min-h-10 rounded-xl bg-white text-zinc-950 hover:bg-zinc-100"
              >
                {saving ? (
                  <Spinner className="mr-2 size-4" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                {saving
                  ? t('settingsPage.saving')
                  : dirty
                    ? t('settingsPage.saveChanges')
                    : t('settingsPage.allSaved')}
              </Button>
            </div>
          </div>
          {dirty && (
            <p className="mt-2 text-right text-[11px] text-amber-300">
              {t('settingsPage.unsavedChanges')}
            </p>
          )}
        </header>
        <div className="mt-5 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-3">
              <nav className="rounded-2xl border border-white/10 bg-white/[.02] p-2">
                {filtered.map(([id, label, desc, Icon]) => (
                  <button
                    key={id}
                    onClick={() => go(id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left',
                      section === id
                        ? 'bg-white/[.07] text-zinc-100'
                        : 'text-zinc-500 hover:bg-white/[.04]',
                    )}
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-white/[.03]">
                      <Icon className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{t(`settingsPage.${id}`)}</span>
                      <span className="block truncate text-[11px] text-zinc-600">
                        {t(id === 'overview' ? 'settingsPage.overviewStatus' : `settingsPage.${id}Description`)}
                      </span>
                    </span>
                  </button>
                ))}
              </nav>
              <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[.04] p-4">
                <p className="text-xs font-semibold text-emerald-300">
                  {t('settingsPage.configuration')}
                </p>
                <p className="mt-2 text-2xl font-semibold">{completion}%</p>
                <div className="mt-2 h-1.5 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>
            </div>
          </aside>
          <div className="min-w-0 space-y-6">
            <div className="flex gap-2 lg:hidden">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('settingsPage.search')}
                  className={`${INPUT_CLASS} pl-9`}
                />
              </div>
              <select
                aria-label={t('settingsPage.section')}
                value={section}
                onChange={(e) => go(e.target.value as Section)}
                className="min-h-11 max-w-[48%] rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-200"
              >
                {sections.map(([id, label]) => (
                  <option key={id} value={id}>
                    {t(`settingsPage.${id}`)}
                  </option>
                ))}
              </select>
            </div>
            <section id="settings-overview">
              <Card className={CARD_CLASS}>
                <CardContent className="p-6 sm:p-8">
                  <p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-400">
                    {t('settingsPage.overviewEyebrow')}
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold">
                    {t('settingsPage.overviewTitle')}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
                    {t('settingsPage.overviewDescription')}
                  </p>
                </CardContent>
              </Card>
            </section>
            <section id="settings-business">
              <Card className={CARD_CLASS}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="size-4 text-emerald-400" />
                    {t('settingsPage.business')}
                  </CardTitle>
                  <CardDescription>
                    {t('settingsPage.publicInfo')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label>{t('settingsPage.shopName')}</label>
                    <Input
                      value={config.name}
                      onChange={(e) => set({ name: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label>{t('settingsPage.phone')}</label>
                    <Input
                      type="tel"
                      value={config.phone}
                      onChange={(e) => set({ phone: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="sm:col-span-2 grid gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.03] p-4">
                    <label htmlFor="settings-default-language" className="text-sm font-medium">{t('settingsLanguage.title')}</label>
                    <p className="text-xs text-zinc-500">{t('settingsLanguage.description')}</p>
                    <select
                      id="settings-default-language"
                      value={config.default_language}
                      onChange={(event) => set({ default_language: event.target.value === 'en' ? 'en' : 'pt' })}
                      className={INPUT_CLASS}
                    >
                      <option value="pt">Português (Portugal)</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.02] p-4">
                    <div>
                      <p className="text-sm font-medium">
                        {t('settingsPage.directoryVisibility')}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600">
                        Mostra ou esconde a barbearia na descoberta pública.
                      </p>
                    </div>
                    <Switch
                      disabled={!canDirectory}
                      checked={canDirectory && config.is_public_in_directory}
                      onCheckedChange={(v) =>
                        canDirectory && set({ is_public_in_directory: v })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </section>
            <section id="settings-location">
              <Card className={CARD_CLASS}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="size-4 text-emerald-400" />
                    {t('settingsPage.locationInfo')}
                  </CardTitle>
                  <CardDescription>
                    {t('settingsPage.locationDescriptionLong')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <AddressAutocomplete
                    value={config.address}
                    onChange={(v) => {
                      set({ address: v });
                      setSuggestion(null);
                    }}
                    onSelect={(s) => {
                      setSuggestion(s);
                      set({ address: s.fullAddress || s.streetWithNumber });
                    }}
                    inputId="settings-address"
                    placeholder={t('settingsPage.searchAddress')}
                    className="border-white/10 bg-white/5"
                  />
                  {suggestion && (
                    <p className="text-xs text-emerald-300">
                      {t('settingsPage.selectedAddress', { address: suggestion.fullAddress })}
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {amenitiesKeys.map((k) => (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={amenities[k]}
                        onClick={() =>
                          setAmenities((a) => ({ ...a, [k]: !a[k] }))
                        }
                        className={cn(
                          'flex min-h-12 items-center justify-between rounded-xl border px-4 text-left text-sm',
                          amenities[k]
                            ? 'border-emerald-400/30 bg-emerald-400/[.06] text-emerald-200'
                            : 'border-white/10 bg-white/[.02] text-zinc-400',
                        )}
                      >
                        {t(`settingsPage.amenities.${k}`)}
                        {amenities[k] && <Check className="size-4" />}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-2 sm:max-w-md">
                    <p className="text-sm font-medium">{t('settingsPage.parking')}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          ['none', t('settingsPage.noParking')],
                          ['free', t('settingsPage.freeParking')],
                          ['paid', t('settingsPage.paidParking')],
                        ] as const
                      ).map(([v, l]) => (
                        <button
                          key={v}
                          type="button"
                          role="radio"
                          aria-checked={amenities.parking === v}
                          onClick={() =>
                            setAmenities((a) => ({ ...a, parking: v }))
                          }
                          className={cn(
                            'min-h-11 rounded-xl border text-sm',
                            amenities.parking === v
                              ? 'border-emerald-400/30 bg-emerald-400/[.08] text-emerald-200'
                              : 'border-white/10 bg-white/[.02] text-zinc-400',
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
            <section id="settings-hours">
              <Card className={CARD_CLASS}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock3 className="size-4 text-blue-400" />
                    {t('settingsPage.hoursRules')}
                  </CardTitle>
                  <CardDescription>
                    {t('settingsPage.hoursRulesDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      type="time"
                      value={config.opening_time}
                      onChange={(e) => set({ opening_time: e.target.value })}
                      className={INPUT_CLASS}
                    />
                    <Input
                      type="time"
                      value={config.closing_time}
                      onChange={(e) => set({ closing_time: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      type="time"
                      value={config.lunch_start}
                      onChange={(e) => set({ lunch_start: e.target.value })}
                      className={INPUT_CLASS}
                    />
                    <Input
                      type="time"
                      value={config.lunch_end}
                      onChange={(e) => set({ lunch_end: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {days.map(([v]) => {
                      const active = closed.includes(v);
                      return (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            const n = active
                              ? closed.filter((x) => x !== v)
                              : [...closed, v];
                            set({
                              closed_days: n.length ? n.join(',') : 'None',
                            });
                          }}
                          className={cn(
                            'min-h-12 rounded-xl border px-3 text-left text-sm',
                            active
                              ? 'border-emerald-400/30 bg-emerald-400/[.06] text-emerald-200'
                              : 'border-white/10 bg-white/[.02] text-zinc-400',
                          )}
                        >
                          {l}
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[.02] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">
                          {t('settingsPage.allowOnline')}
                        </p>
                        <p className="text-xs text-zinc-600">
                          {t('settingsPage.allowOnlineDescription')}
                        </p>
                      </div>
                      <Switch
                        checked={config.allow_online_bookings}
                        onCheckedChange={(v) =>
                          set({ allow_online_bookings: v })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                      <div>
                        <p className="text-sm font-medium">
                          {t('settingsPage.autoConfirm')}
                        </p>
                        <p className="text-xs text-zinc-600">
                          {t('settingsPage.autoConfirmDescription')}
                        </p>
                      </div>
                      <Switch
                        disabled={!automationAllowed}
                        checked={
                          automationAllowed && config.auto_confirm_bookings
                        }
                        onCheckedChange={(v) =>
                          automationAllowed && set({ auto_confirm_bookings: v })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                      <div>
                        <p className="text-sm font-medium">
                          {t('settingsPage.autoComplete')}
                        </p>
                        <p className="text-xs text-zinc-600">
                          {t('settingsPage.autoCompleteDescription')}
                        </p>
                      </div>
                      <Switch
                        disabled={!automationAllowed}
                        checked={
                          automationAllowed && config.auto_complete_bookings
                        }
                        onCheckedChange={(v) =>
                          automationAllowed &&
                          set({ auto_complete_bookings: v })
                        }
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                    <div className="flex items-center gap-2">
                      <CalendarCheck2 className="size-4 text-amber-300" />
                      <p className="text-sm font-medium">
                        {t('settingsPage.cancellationWindow')}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={720}
                      step={1}
                      value={config.time_limit_cancellation_hours}
                      onChange={(e) =>
                        set({
                          time_limit_cancellation_hours: Number(e.target.value),
                        })
                      }
                      className={`${INPUT_CLASS} mt-4 sm:max-w-xs`}
                    />
                  </div>
                </CardContent>
              </Card>
            </section>
            <section id="settings-appearance">
              <Card className={CARD_CLASS}>
                <CardHeader>
                  <CardTitle>{t('settingsPage.appearance')}</CardTitle>
                  <CardDescription>
                    {t('settingsPage.appearanceDescriptionLong')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
                    <div className="relative h-52">
                      <Image
                        src={
                          bannerPreviewError || !banner
                            ? DEFAULT_BARBERSHOP_BANNER
                            : banner
                        }
                        alt={t('settingsPage.bannerAlt')}
                        fill
                        className="object-cover"
                        unoptimized
                        onError={() => setBannerPreviewError(true)}
                      />
                      <div className="absolute inset-x-4 bottom-4 flex items-end justify-between">
                        <div className="flex size-16 overflow-hidden rounded-2xl border-2 border-zinc-950 bg-zinc-800">
                          <Image
                            src={
                              avatarPreviewError || !avatar
                                ? DEFAULT_BARBERSHOP_AVATAR
                                : avatar
                            }
                            alt={t('settingsPage.avatarAlt')}
                            width={128}
                            height={128}
                            className="h-full w-full object-cover"
                            unoptimized
                            onError={() => setAvatarPreviewError(true)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => bannerRef.current?.click()}
                            disabled={uploading === 'banner'}
                          >
                            <ImageIcon className="mr-2 size-4" />
                            {t('settingsPage.cover')}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => avatarRef.current?.click()}
                            disabled={uploading === 'avatar'}
                          >
                            <Camera className="mr-2 size-4" />
                            {t('settingsPage.logo')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <input
                    ref={avatarRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload('avatar', f);
                      e.currentTarget.value = '';
                    }}
                  />
                  <input
                    ref={bannerRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload('banner', f);
                      e.currentTarget.value = '';
                    }}
                  />
                </CardContent>
              </Card>
            </section>
            <section id="settings-billing">
              <Card className="border-emerald-500/20 bg-emerald-500/[.04]">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-400">
                      {t('settingsPage.billing')}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">
                      {t('settingsPage.billingTitle')}
                    </h2>
                  </div>
                  <Button asChild>
                    <Link href="/dashboard/billing">{t('settingsPage.openBilling')}</Link>
                  </Button>
                </CardContent>
              </Card>
            </section>
            <section id="settings-account">
              <Card className={CARD_CLASS}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-400" />
                    {t('settingsPage.accountSecurity')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void logout()}
                    disabled={logoutLoading}
                  >
                    <LogOut className="mr-2 size-4" />
                    {logoutLoading ? t('settingsPage.logoutLoading') : t('settingsPage.logout')}
                  </Button>
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </div>
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/95 p-3 backdrop-blur-xl sm:hidden">
          <div className="mx-auto flex max-w-xl gap-2">
            <Button variant="ghost" onClick={reset} className="min-h-11 flex-1">
              {t('settingsPage.discard')}
            </Button>
            <Button
              onClick={() => void saveAll()}
              disabled={saving}
              className="min-h-11 flex-1 bg-white text-zinc-950"
            >
              {saving ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
