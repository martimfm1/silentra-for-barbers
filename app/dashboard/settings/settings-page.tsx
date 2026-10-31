'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
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
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  | 'rules'
  | 'appearance'
  | 'billing'
  | 'account';
const INPUT_CLASS = 'min-h-11 max-w-sm rounded-xl border-white/10 bg-white/5 text-sm';
type SettingsDialog = 'business' | 'location' | 'hours' | 'rules';
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
  minimum_booking_notice_minutes: number;
  allow_online_bookings: boolean;
  is_public_in_directory: boolean;
  time_limit_cancellation_hours: number;
  auto_confirm_bookings: boolean;
  auto_complete_bookings: boolean;
  default_language: 'pt' | 'en';
  mbway_enabled: boolean;
  mbway_phone: string;
};
const sections: [Section, string, string, typeof Settings][] = [
  ['overview', 'Visão geral', 'Estado da configuração', Settings],
  ['business', 'Informações', 'Nome, contactos e preferências públicas', Store],
  ['location', 'Localização', 'Morada e características do espaço', MapPin],
  ['hours', 'Horários', 'Funcionamento da barbearia', Clock3],
  ['rules', 'Regras', 'Antecedência, cancelamento e confirmações', CalendarCheck2],
  ['appearance', 'Aparência', 'Logótipo e imagem de capa', ImageIcon],
  ['billing', 'Plano e faturação', 'Subscrição e faturas', CreditCard],
  ['account', 'Conta e segurança', 'Sessão e acesso', ShieldCheck],
];
const sectionGroups: {
  id: 'barbershopGroup' | 'bookingGroup' | 'accountGroup';
  sections: Section[];
}[] = [
  { id: 'barbershopGroup', sections: ['business', 'location', 'appearance'] },
  { id: 'bookingGroup', sections: ['hours', 'rules'] },
  { id: 'accountGroup', sections: ['billing', 'account'] },
];
const days = [
  ['Monday', 'Monday', 'Segunda-feira'],
  ['Tuesday', 'Tuesday', 'Terça-feira'],
  ['Wednesday', 'Wednesday', 'Quarta-feira'],
  ['Thursday', 'Thursday', 'Quinta-feira'],
  ['Friday', 'Friday', 'Sexta-feira'],
  ['Saturday', 'Saturday', 'Sábado'],
  ['Sunday', 'Sunday', 'Domingo'],
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
  minimum_booking_notice_minutes: Math.max(
    0,
    Math.min(43200, Math.round(Number(v.minimum_booking_notice_minutes ?? 0))),
  ),
  allow_online_bookings: v.allow_online_bookings ?? true,
  is_public_in_directory: v.is_public_in_directory ?? true,
  time_limit_cancellation_hours: Math.max(
    0,
    Math.min(720, Number(v.time_limit_cancellation_hours ?? 24)),
  ),
  auto_confirm_bookings: v.auto_confirm_bookings === true,
  auto_complete_bookings: v.auto_complete_bookings === true,
  default_language: v.default_language === 'en' ? 'en' : 'pt',
  mbway_enabled: v.mbway_enabled === true,
  mbway_phone: v.mbway_phone ?? '',
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
  const { t, setLocale, locale } = useLanguage();
  const { barbershopId } = useBarbershop();
  const { hasFeature, loading: planLoading, plan } = useFeatureAccess();
  const canDirectory = hasFeature('directory_visibility');
  const canManualMbway = hasFeature('manual_mbway_prepayment');
  const automationAllowed = plan === 'pro' || plan === 'enterprise';
  const [section, setSection] = useState<Section>('overview');
  const [activeDialog, setActiveDialog] = useState<SettingsDialog | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [config, setConfig] = useState<Config>(normalize({}));
  const [noticeUnit, setNoticeUnit] = useState<'minutes' | 'hours'>('minutes');
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
    if (c.error) toast.error(t('settingsPage.loadFailed'));
    if (c.data) {
      const n = normalize(c.data);
      setConfig(n);
      setInitial(n);
      setNoticeUnit(
        n.minimum_booking_notice_minutes > 0 &&
          n.minimum_booking_notice_minutes % 60 === 0
          ? 'hours'
          : 'minutes',
      );
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
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase(locale === 'en' ? 'en-GB' : 'pt-PT');
    return q
      ? sections.filter(([id]) => {
          const label = t(`settingsPage.${id}`).toLocaleLowerCase();
          const description = t(`settingsPage.${id}Description`).toLocaleLowerCase();
          const group = sectionGroups.find((item) => item.sections.includes(id));
          const groupLabel = group ? t(`settingsPage.${group.id}`).toLocaleLowerCase() : '';
          return `${label} ${description} ${groupLabel}`.includes(q);
        })
      : sections;
  }, [search, t, locale]);
  const navigationGroups = useMemo(
    () =>
      sectionGroups
        .map((group) => ({
          ...group,
          entries: filtered.filter(([id]) => group.sections.includes(id)),
        }))
        .filter((group) => group.entries.length > 0),
    [filtered],
  );
  const set = (patch: Partial<Config>) =>
    setConfig((c) => ({ ...c, ...patch }));
  function closeSettingsDialog() {
    setActiveDialog(null);
    setSection('overview');
  }
  function go(s: Section) {
    setSection(s);
    if (
      s === 'business' ||
      s === 'location' ||
      s === 'hours' ||
      s === 'rules'
    ) {
      setActiveDialog(s);
      return;
    }
    setActiveDialog(null);
    requestAnimationFrame(() =>
      document
        .getElementById(`settings-${s}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }
  async function saveAll() {
    if (!barbershopId || !dirty || saving) return;
    if (config.opening_time >= config.closing_time)
      return toast.error(t('settingsPage.openingAfterClosing'));
    if (
      (config.lunch_start && !config.lunch_end) ||
      (!config.lunch_start && config.lunch_end) ||
      (config.lunch_start &&
        config.lunch_end &&
        config.lunch_start >= config.lunch_end)
    )
      return toast.error(t('settingsPage.lunchInvalid'));
    if (
      !Number.isInteger(config.minimum_booking_notice_minutes) ||
      config.minimum_booking_notice_minutes < 0 ||
      config.minimum_booking_notice_minutes > 43200
    )
      return toast.error(t('settingsPage.minimumBookingNoticeInvalid'));
    setSaving(true);
    try {
      const payload = { ...config };
      if (!canDirectory)
        delete (payload as Partial<Config>).is_public_in_directory;
      if (!canManualMbway) {
        delete (payload as Partial<Config>).mbway_enabled;
        delete (payload as Partial<Config>).mbway_phone;
      }
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
        if (!r.ok) throw new Error(t('settingsPage.locationUpdateFailed'));
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
        if (!r.ok) throw new Error(t('settingsPage.amenitiesSaveFailed'));
      }
      const n = normalize(c.data ?? config);
      setConfig(n);
      setInitial(n);
      setInitialAmenities(amenities);
      setLocale(n.default_language);
      setSuggestion(null);
      toast.success(t('settingsPage.saved'));
      setActiveDialog(null);
      setSection('overview');
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t('settingsPage.saveFailed'));
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
    if (r.error) return toast.error(t('settingsPage.imageUpdateFailed'));
    if (type === 'avatar') {
      setAvatarPreviewError(false);
      setAvatarTick(Date.now());
    } else {
      setBannerPreviewError(false);
      setBannerTick(Date.now());
    }
    toast.success(
      type === 'avatar'
        ? t('settingsPage.logoUpdated')
        : t('settingsPage.coverUpdated'),
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
  const setupStepStatus = {
    business: config.name.trim().length >= 2,
    location: config.address.trim().length >= 6,
    hours: Boolean(
      config.opening_time &&
      config.closing_time &&
      config.opening_time < config.closing_time,
    ),
    rules:
      Number.isInteger(config.minimum_booking_notice_minutes) &&
      config.minimum_booking_notice_minutes >= 0 &&
      Number.isInteger(config.time_limit_cancellation_hours) &&
      config.time_limit_cancellation_hours >= 0,
  };
  const completedSetupSteps = Object.values(setupStepStatus).filter(Boolean).length;
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
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('settingsPage.search')}
                  aria-label={t('settingsPage.search')}
                  className={`${INPUT_CLASS} max-w-none pl-9`}
                />
              </div>
              <nav
                aria-label={t('settingsPage.navigation')}
                className="rounded-2xl border border-white/10 bg-white/[.02] p-2"
              >
                {filtered.some(([id]) => id === 'overview') && (
                  <button
                    type="button"
                    onClick={() => go('overview')}
                    aria-current={section === 'overview' ? 'location' : undefined}
                    className={cn(
                      'mb-3 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium',
                      section === 'overview'
                        ? 'bg-white/[.07] text-zinc-100'
                        : 'text-zinc-400 hover:bg-white/[.04] hover:text-white',
                    )}
                  >
                    <Settings className="size-4" aria-hidden="true" />
                    {t('settingsPage.overview')}
                  </button>
                )}
                {navigationGroups.map((group) => (
                  <section key={group.id} className="mt-3 first:mt-0">
                    <h2 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-500">
                      {t(`settingsPage.${group.id}`)}
                    </h2>
                    <div className="grid gap-1">
                      {group.entries.map(([id, , , Icon]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => go(id)}
                          aria-current={section === id ? 'location' : undefined}
                          className={cn(
                            'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors',
                            section === id
                              ? 'bg-white/[.07] text-zinc-100'
                              : 'text-zinc-500 hover:bg-white/[.04] hover:text-zinc-100',
                          )}
                        >
                          <Icon className="size-4 shrink-0" aria-hidden="true" />
                          <span>{t(`settingsPage.${id}`)}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </nav>
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
                  aria-label={t('settingsPage.search')}
                  className={`${INPUT_CLASS} max-w-none pl-9`}
                />
              </div>
              <Select value={section} onValueChange={(value) => go(value as Section)}>
                <SelectTrigger
                  aria-label={t('settingsPage.section')}
                  className="h-11 w-[min(48%,14rem)] min-w-0 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-200"
                >
                  <SelectValue placeholder={t('settingsPage.section')} />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="end"
                  className="w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]"
                >
                  {section !== 'overview' && !filtered.some(([id]) => id === section) && (
                    <SelectItem value={section}>{t(`settingsPage.${section}`)}</SelectItem>
                  )}
                  {filtered.some(([id]) => id === 'overview') && (
                    <SelectItem value="overview">{t('settingsPage.overview')}</SelectItem>
                  )}
                  {navigationGroups.map((group) => (
                    <SelectGroup key={group.id}>
                      <SelectLabel>{t(`settingsPage.${group.id}`)}</SelectLabel>
                      {group.entries.map(([id]) => (
                        <SelectItem key={id} value={id}>
                          {t(`settingsPage.${id}`)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <section id="settings-overview">
              <Card className={CARD_CLASS}>
                <CardContent className="space-y-6 p-5 sm:p-7">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-300">
                      {t('settingsPage.overviewEyebrow')}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
                      {t('settingsPage.overviewTitle')}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                      {t('settingsPage.overviewDescription')}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-zinc-300">{t('settingsPage.setupProgress')}</span>
                      <span className="font-semibold tabular-nums text-emerald-300">{completedSetupSteps}/4</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={t('settingsPage.setupProgress')}
                      aria-valuemin={0}
                      aria-valuemax={4}
                      aria-valuenow={completedSetupSteps}
                      className="h-2 overflow-hidden rounded-full bg-white/10"
                    >
                      <div
                        className="h-full rounded-full bg-emerald-400 transition-[width] duration-300"
                        style={{ width: `${completedSetupSteps * 25}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => go('business')}
                      className="group flex min-h-36 min-w-0 flex-col items-start rounded-2xl border border-white/10 bg-white/[.025] p-4 text-left transition hover:border-emerald-400/30 hover:bg-emerald-400/[.04]"
                    >
                      <span className="flex w-full items-center justify-between">
                        <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-400/10 text-xs font-bold text-emerald-300">{setupStepStatus.business ? <CheckCircle2 className="size-4" aria-hidden="true" /> : '01'}</span>
                        <Store className="size-4 text-zinc-500 transition group-hover:text-emerald-300" />
                      </span>
                      <span className="mt-3 text-sm font-semibold text-zinc-100">{t('settingsPage.business')}</span>
                      <span className="mt-1 line-clamp-1 text-xs text-zinc-500">{config.name || t('settingsPage.notConfigured')}</span>
                      <span className="mt-auto pt-3 text-xs font-semibold text-emerald-300">{t('settingsPage.openSection')} <ArrowUpRight className="ml-1 inline size-3.5" /></span>
                    </button>
                    <button
                      type="button"
                      onClick={() => go('location')}
                      className="group flex min-h-36 min-w-0 flex-col items-start rounded-2xl border border-white/10 bg-white/[.025] p-4 text-left transition hover:border-emerald-400/30 hover:bg-emerald-400/[.04]"
                    >
                      <span className="flex w-full items-center justify-between">
                        <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-400/10 text-xs font-bold text-emerald-300">{setupStepStatus.location ? <CheckCircle2 className="size-4" aria-hidden="true" /> : '02'}</span>
                        <MapPin className="size-4 text-zinc-500 transition group-hover:text-emerald-300" />
                      </span>
                      <span className="mt-3 text-sm font-semibold text-zinc-100">{t('settingsPage.location')}</span>
                      <span className="mt-1 line-clamp-1 text-xs text-zinc-500">{config.address || t('settingsPage.notConfigured')}</span>
                      <span className="mt-auto pt-3 text-xs font-semibold text-emerald-300">{t('settingsPage.openSection')} <ArrowUpRight className="ml-1 inline size-3.5" /></span>
                    </button>
                    <button
                      type="button"
                      onClick={() => go('hours')}
                      className="group flex min-h-36 min-w-0 flex-col items-start rounded-2xl border border-white/10 bg-white/[.025] p-4 text-left transition hover:border-emerald-400/30 hover:bg-emerald-400/[.04]"
                    >
                      <span className="flex w-full items-center justify-between">
                        <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-400/10 text-xs font-bold text-emerald-300">{setupStepStatus.hours ? <CheckCircle2 className="size-4" aria-hidden="true" /> : '03'}</span>
                        <Clock3 className="size-4 text-zinc-500 transition group-hover:text-emerald-300" />
                      </span>
                      <span className="mt-3 text-sm font-semibold text-zinc-100">{t('settingsPage.hours')}</span>
                      <span className="mt-1 line-clamp-1 text-xs text-zinc-500">{config.opening_time} – {config.closing_time}</span>
                      <span className="mt-auto pt-3 text-xs font-semibold text-emerald-300">{t('settingsPage.openSection')} <ArrowUpRight className="ml-1 inline size-3.5" /></span>
                    </button>
                    <button
                      type="button"
                      onClick={() => go('rules')}
                      className="group flex min-h-36 min-w-0 flex-col items-start rounded-2xl border border-white/10 bg-white/[.025] p-4 text-left transition hover:border-emerald-400/30 hover:bg-emerald-400/[.04]"
                    >
                      <span className="flex w-full items-center justify-between">
                        <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-400/10 text-xs font-bold text-emerald-300">{setupStepStatus.rules ? <CheckCircle2 className="size-4" aria-hidden="true" /> : '04'}</span>
                        <CalendarCheck2 className="size-4 text-zinc-500 transition group-hover:text-emerald-300" />
                      </span>
                      <span className="mt-3 text-sm font-semibold text-zinc-100">{t('settingsPage.rules')}</span>
                      <span className="mt-1 line-clamp-1 text-xs text-zinc-500">{config.time_limit_cancellation_hours === 0 ? t('settingsPage.cancellationWindowNoLimitShort') : t('settingsPage.cancellationWindowSummary', { hours: config.time_limit_cancellation_hours })}</span>
                      <span className="mt-auto pt-3 text-xs font-semibold text-emerald-300">{t('settingsPage.openSection')} <ArrowUpRight className="ml-1 inline size-3.5" /></span>
                    </button>
                  </div>
                  <p className="text-xs leading-5 text-zinc-600">{t('settingsPage.saveAllHint')}</p>
                </CardContent>
              </Card>
            </section>
            <Dialog
              open={activeDialog === 'business'}
              onOpenChange={(open) => open ? setActiveDialog('business') : closeSettingsDialog()}
            >
              <DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('settingsPage.business')}</DialogTitle>
                  <DialogDescription>{t('settingsPage.businessDialogDescription')}</DialogDescription>
                </DialogHeader>
                <Card className={CARD_CLASS}>
                  <CardContent className="grid gap-5 sm:grid-cols-2 ">
                    <div className="grid gap-2">
                    <label htmlFor="settings-shop-name">{t('settingsPage.shopName')}</label>
                    <Input
                      id="settings-shop-name"
                      value={config.name}
                      onChange={(e) => set({ name: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="settings-shop-phone">{t('settingsPage.phone')}</label>
                    <Input
                      id="settings-shop-phone"
                      type="tel"
                      value={config.phone}
                      onChange={(e) => set({ phone: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="sm:col-span-2 grid gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.03] p-4">
                    <label
                      htmlFor="settings-default-language"
                      className="text-sm font-medium"
                    >
                      {t('settingsLanguage.title')}
                    </label>
                    <p className="text-xs text-zinc-500">
                      {t('settingsLanguage.description')}
                    </p>
                    <Select
                      value={config.default_language}
                      onValueChange={(value) =>
                        set({ default_language: value === 'en' ? 'en' : 'pt' })
                      }
                    >
                      <SelectTrigger
                        id="settings-default-language"
                        className="h-11 w-full max-w-sm rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-200"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)]">
                        <SelectItem value="pt">Português (Portugal)</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-white/[.02] p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{t('settingsPage.mbwayTitle')}</p>
                          {!canManualMbway && <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-200">PRO</span>}
                        </div>
                        <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">{t('settingsPage.mbwayDescription')}</p>
                      </div>
                      <Switch
                        disabled={!canManualMbway}
                        checked={canManualMbway && config.mbway_enabled}
                        onCheckedChange={(value) => canManualMbway && set({ mbway_enabled: value })}
                        aria-label={t('settingsPage.mbwayEnabled')}
                      />
                    </div>
                    <div className="mt-4 grid gap-2 sm:max-w-md">
                      <label htmlFor="settings-mbway-phone" className="text-xs font-medium text-zinc-300">{t('settingsPage.mbwayPhone')}</label>
                      <Input
                        id="settings-mbway-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder={t('settingsPage.mbwayPhonePlaceholder')}
                        value={config.mbway_phone}
                        disabled={!canManualMbway || !config.mbway_enabled}
                        onChange={(event) => set({ mbway_phone: event.target.value })}
                        className={INPUT_CLASS}
                      />
                      <p className="text-xs leading-5 text-zinc-600">{t('settingsPage.mbwayWhatsappNotice')}</p>
                    </div>
                    {!canManualMbway && (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[.04] p-3">
                        <p className="text-xs text-zinc-400">{t('settingsPage.mbwayProRequired')}</p>
                        <Button asChild size="sm" variant="outline"><Link href="/dashboard/billing">{t('settingsPage.upgradePlan')}</Link></Button>
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.02] p-4">
                    <div>
                      <p className="text-sm font-medium">
                        {t('settingsPage.directoryVisibility')}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600">
                        {t('settingsPage.directoryDescription')}
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
                <DialogFooter className="border-t border-white/10 pt-4 sm:justify-between">
                <Button type="button" variant="ghost" onClick={closeSettingsDialog}>
                  {t('settingsPage.closeDialog')}
                </Button>
                <Button
                  type="button"
                  onClick={() => void saveAll()}
                  disabled={!dirty || saving}
                  className="bg-white text-zinc-950 hover:bg-zinc-100"
                >
                  {saving ? <Spinner className="mr-2 size-4" /> : <Save className="mr-2 size-4" />}
                  {saving ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
                </Button>
              </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog
              open={activeDialog === 'location'}
              onOpenChange={(open) => open ? setActiveDialog('location') : closeSettingsDialog()}
            >
              <DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('settingsPage.location')}</DialogTitle>
                  <DialogDescription>{t('settingsPage.locationDialogDescription')}</DialogDescription>
                </DialogHeader>
                <Card className={CARD_CLASS}>
                  <CardContent className="space-y-6 ">
                    <div className="w-full max-w-2xl">
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
                  </div>
                  {suggestion && (
                    <p className="text-xs text-emerald-300">
                      {t('settingsPage.selectedAddress', {
                        address: suggestion.fullAddress,
                      })}
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
                    <p className="text-sm font-medium">
                      {t('settingsPage.parking')}
                    </p>
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
                <DialogFooter className="border-t border-white/10 pt-4 sm:justify-between">
                <Button type="button" variant="ghost" onClick={closeSettingsDialog}>
                  {t('settingsPage.closeDialog')}
                </Button>
                <Button
                  type="button"
                  onClick={() => void saveAll()}
                  disabled={!dirty || saving}
                  className="bg-white text-zinc-950 hover:bg-zinc-100"
                >
                  {saving ? <Spinner className="mr-2 size-4" /> : <Save className="mr-2 size-4" />}
                  {saving ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
                </Button>
              </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog
              open={activeDialog === 'hours'}
              onOpenChange={(open) => open ? setActiveDialog('hours') : closeSettingsDialog()}
            >
              <DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('settingsPage.hours')}</DialogTitle>
                  <DialogDescription>{t('settingsPage.hoursDialogDescription')}</DialogDescription>
                </DialogHeader>
                <Card className={CARD_CLASS}>
                  <CardContent className="space-y-6 ">
                    <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <label
                        htmlFor="settings-opening-time"
                        className="text-sm font-medium text-zinc-200"
                      >
                        {t('settingsPage.openingTime')}
                      </label>
                      <Input
                        id="settings-opening-time"
                        type="time"
                        aria-label={t('settingsPage.openingTime')}
                        value={config.opening_time}
                        onChange={(e) => set({ opening_time: e.target.value })}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label
                        htmlFor="settings-closing-time"
                        className="text-sm font-medium text-zinc-200"
                      >
                        {t('settingsPage.closingTime')}
                      </label>
                      <Input
                        id="settings-closing-time"
                        type="time"
                        aria-label={t('settingsPage.closingTime')}
                        value={config.closing_time}
                        onChange={(e) => set({ closing_time: e.target.value })}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-zinc-200">
                      {t('settingsPage.lunchBreak')}
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <label
                          htmlFor="settings-lunch-start"
                          className="text-sm font-medium text-zinc-300"
                        >
                          {t('settingsPage.lunchStart')}
                        </label>
                        <Input
                          id="settings-lunch-start"
                          type="time"
                          aria-label={t('settingsPage.lunchStart')}
                          value={config.lunch_start}
                          onChange={(e) => set({ lunch_start: e.target.value })}
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="grid gap-2">
                        <label
                          htmlFor="settings-lunch-end"
                          className="text-sm font-medium text-zinc-300"
                        >
                          {t('settingsPage.lunchEnd')}
                        </label>
                        <Input
                          id="settings-lunch-end"
                          type="time"
                          aria-label={t('settingsPage.lunchEnd')}
                          value={config.lunch_end}
                          onChange={(e) => set({ lunch_end: e.target.value })}
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-zinc-200">
                      {t('settingsPage.daysOffInHours')}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {days.map(([v, enLabel, ptLabel]) => {
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
                            {locale === 'pt' ? ptLabel : enLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  </CardContent>
                </Card>
                <DialogFooter className="border-t border-white/10 pt-4 sm:justify-between">
                <Button type="button" variant="ghost" onClick={closeSettingsDialog}>
                  {t('settingsPage.closeDialog')}
                </Button>
                <Button
                  type="button"
                  onClick={() => void saveAll()}
                  disabled={!dirty || saving}
                  className="bg-white text-zinc-950 hover:bg-zinc-100"
                >
                  {saving ? <Spinner className="mr-2 size-4" /> : <Save className="mr-2 size-4" />}
                  {saving ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
                </Button>
              </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog
              open={activeDialog === 'rules'}
              onOpenChange={(open) => open ? setActiveDialog('rules') : closeSettingsDialog()}
            >
              <DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('settingsPage.rules')}</DialogTitle>
                  <DialogDescription>{t('settingsPage.rulesDialogDescription')}</DialogDescription>
                </DialogHeader>
                <Card className={CARD_CLASS}>
                  <CardContent className="space-y-6 ">
                    <div className="grid gap-2">
                    <label
                      htmlFor="settings-minimum-booking-notice"
                      className="text-sm font-medium text-zinc-200"
                    >
                      {t('settingsPage.minimumBookingNotice')}
                    </label>
                    <div className="grid max-w-lg grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <Input
                        id="settings-minimum-booking-notice"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={noticeUnit === 'hours' ? 720 : 43200}
                        step={noticeUnit === 'hours' ? 0.25 : 1}
                        value={
                          noticeUnit === 'hours'
                            ? config.minimum_booking_notice_minutes / 60
                            : config.minimum_booking_notice_minutes
                        }
                        onChange={(e) => {
                          const amount = Number(e.target.value);
                          if (!Number.isFinite(amount)) return;
                          const minutes = Math.round(
                            amount * (noticeUnit === 'hours' ? 60 : 1),
                          );
                          set({
                            minimum_booking_notice_minutes: Math.max(
                              0,
                              Math.min(43200, minutes),
                            ),
                          });
                        }}
                        aria-label={t('settingsPage.minimumBookingNotice')}
                        className={INPUT_CLASS}
                      />
                      <Select
                        value={noticeUnit}
                        onValueChange={(value) => setNoticeUnit(value as 'minutes' | 'hours')}
                      >
                        <SelectTrigger
                          aria-label={t('settingsPage.noticeUnit')}
                          className="h-11 w-28 min-w-0 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-200"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper" className="w-32">
                          <SelectItem value="minutes">{t('settingsPage.noticeMinutes')}</SelectItem>
                          <SelectItem value="hours">{t('settingsPage.noticeHours')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[.02] p-4">
                    {!automationAllowed && (
                      <p className="text-xs text-amber-300">
                        {t('settingsPage.automationPlanRequired')}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">
                          {t('settingsPage.allowOnline')}
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
                      <label htmlFor="settings-cancellation-window" className="text-sm font-medium">
                        {t('settingsPage.cancellationWindow')}
                      </label>
                    </div>
                    <Input
                      id="settings-cancellation-window"
                      type="number"
                      min={0}
                      max={720}
                      step={1}
                      value={config.time_limit_cancellation_hours}
                      aria-label={t('settingsPage.cancellationWindow')}
                      onChange={(e) =>
                        set({
                          time_limit_cancellation_hours: Number(e.target.value),
                        })
                      }
                      className={`${INPUT_CLASS} mt-4 max-w-48`}
                    />
                    <p className="mt-2 max-w-xl text-xs leading-5 text-zinc-500">
                      {config.time_limit_cancellation_hours === 0
                        ? t('settingsPage.cancellationWindowNoLimit')
                        : t('settingsPage.cancellationWindowHelp', {
                            hours: config.time_limit_cancellation_hours,
                          })}
                    </p>
                  </div>
                  </CardContent>
                </Card>
                <DialogFooter className="border-t border-white/10 pt-4 sm:justify-between">
                <Button type="button" variant="ghost" onClick={closeSettingsDialog}>
                  {t('settingsPage.closeDialog')}
                </Button>
                <Button
                  type="button"
                  onClick={() => void saveAll()}
                  disabled={!dirty || saving}
                  className="bg-white text-zinc-950 hover:bg-zinc-100"
                >
                  {saving ? <Spinner className="mr-2 size-4" /> : <Save className="mr-2 size-4" />}
                  {saving ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
                </Button>
              </DialogFooter>
              </DialogContent>
            </Dialog>
            <section id="settings-appearance">
              <Card className={CARD_CLASS}>
                <CardHeader>
                  <CardTitle>{t('settingsPage.appearance')}</CardTitle>

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
                    <Link href="/dashboard/billing">
                      {t('settingsPage.openBilling')}
                    </Link>
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
                    {logoutLoading
                      ? t('settingsPage.logoutLoading')
                      : t('settingsPage.logout')}
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
              {saving
                ? t('settingsPage.saving')
                : t('settingsPage.saveChanges')}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
