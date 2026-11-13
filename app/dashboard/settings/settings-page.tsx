'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  CreditCard,
  Check,
  ImageIcon,
  LogOut,
  Save,
  ShieldCheck,
  Trash2,
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { FeaturePlanBadge } from '@/components/billing/FeaturePlanBadge';
import { SettingsPushNotificationsPanel } from '@/components/dashboard/settings-push-notifications-panel';
import { AgendaViewSettings } from '@/app/dashboard/settings/agenda-view-settings';
import { PublicProfileSettingsCard } from '@/app/dashboard/settings/public-profile/public-profile-settings-card';
import {
  DashboardCustomizationDialog,
  useDashboardCustomization,
} from '@/app/dashboard/_components/DashboardCustomization';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
const INPUT_CLASS =
  'box-border block min-h-11 w-full min-w-0 max-w-full rounded-xl border-white/10 bg-white/5 text-sm';
const CARD_CLASS = 'border-0 bg-transparent p-0 text-zinc-50 shadow-none';

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
  time_limit_cancellation_hours: number;
  require_birth_date: boolean;
  allow_online_bookings: boolean;
  is_public_in_directory: boolean;
  auto_confirm_bookings: boolean;
  auto_confirm_manual_bookings: boolean;
  auto_complete_bookings: boolean;
  default_language: 'pt' | 'en';
  mbway_enabled: boolean;
  mbway_phone: string;
};

const days = [
  ['Monday', 'Monday', 'Segunda-feira'],
  ['Tuesday', 'Tuesday', 'Terça-feira'],
  ['Wednesday', 'Wednesday', 'Quarta-feira'],
  ['Thursday', 'Thursday', 'Quinta-feira'],
  ['Friday', 'Friday', 'Sexta-feira'],
  ['Saturday', 'Saturday', 'Sábado'],
  ['Sunday', 'Sunday', 'Domingo'],
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
  time_limit_cancellation_hours: Math.max(
    0,
    Math.min(720, Math.round(Number(v.time_limit_cancellation_hours ?? 24))),
  ),
  require_birth_date: v.require_birth_date !== false,
  allow_online_bookings: v.allow_online_bookings ?? true,
  is_public_in_directory: v.is_public_in_directory ?? true,
  auto_confirm_bookings: v.auto_confirm_bookings === true,
  auto_confirm_manual_bookings: v.auto_confirm_manual_bookings !== false,
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
  const customization = useDashboardCustomization();
  const { hasFeature, loading: planLoading, plan } = useFeatureAccess();
  const canDirectory = hasFeature('directory_visibility');
  const canManualMbway = hasFeature('manual_mbway_prepayment');
  const automationAllowed = plan === 'pro' || plan === 'enterprise';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [directorySaving, setDirectorySaving] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteCodeSent, setDeleteCodeSent] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [config, setConfig] = useState<Config>(normalize({}));
  const [noticeUnit, setNoticeUnit] = useState<'minutes' | 'hours'>('minutes');
  const [initial, setInitial] = useState<Config | null>(null);
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
    const c = await barbershopService.getConfig(barbershopId);
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
    setLoading(false);
  }, [barbershopId, t]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const targetId = window.location.hash.slice(1);
    if (!targetId) return;
    const target = document.getElementById(targetId);
    const accordion = target?.closest(
      'details[data-settings-category]',
    ) as HTMLDetailsElement | null;
    if (!target || !accordion) return;
    accordion.open = true;
    requestAnimationFrame(() =>
      target.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }, []);
  const dirty = useMemo(
    () =>
      JSON.stringify(config) !== JSON.stringify(initial) || suggestion !== null,
    [config, initial, suggestion],
  );
  const closed = useMemo(
    () => closedList(config.closed_days),
    [config.closed_days],
  );
  const set = (patch: Partial<Config>) =>
    setConfig((c) => ({ ...c, ...patch }));
  async function handleDirectoryVisibilityChange(visible: boolean) {
    if (
      !barbershopId ||
      !canDirectory ||
      directorySaving ||
      config.is_public_in_directory === visible
    ) {
      return;
    }

    const previousValue = config.is_public_in_directory;
    setDirectorySaving(true);
    setConfig((current) => ({
      ...current,
      is_public_in_directory: visible,
    }));

    try {
      const result = await barbershopService.updateConfig(barbershopId, {
        is_public_in_directory: visible,
      });
      if (result.error) throw result.error;
      if (result.data?.is_public_in_directory !== visible) {
        throw new Error(
          locale === 'en'
            ? 'Directory visibility could not be saved. Please try again.'
            : 'Não foi possível guardar a visibilidade no diretório. Tenta novamente.',
        );
      }

      setConfig((current) => ({
        ...current,
        is_public_in_directory: visible,
      }));
      setInitial((current) =>
        current
          ? { ...current, is_public_in_directory: visible }
          : current,
      );
      toast.success(
        visible
          ? locale === 'en'
            ? 'Your barbershop is visible in the directory.'
            : 'A tua barbearia está visível no diretório.'
          : locale === 'en'
            ? 'Your barbershop is hidden from the directory.'
            : 'A tua barbearia está oculta do diretório.',
      );
    } catch (error) {
      setConfig((current) => ({
        ...current,
        is_public_in_directory: previousValue,
      }));
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : locale === 'en'
            ? 'Could not update directory visibility.'
            : 'Não foi possível atualizar a visibilidade no diretório.',
      );
    } finally {
      setDirectorySaving(false);
    }
  }

  async function saveAll() {
    if (!barbershopId || !dirty || saving || directorySaving) return;
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
    if (
      !Number.isInteger(config.time_limit_cancellation_hours) ||
      config.time_limit_cancellation_hours < 0 ||
      config.time_limit_cancellation_hours > 720
    )
      return toast.error(
        locale === 'en'
          ? 'Cancellation notice must be between 0 and 720 hours.'
          : 'A antecedência de cancelamento deve estar entre 0 e 720 horas.',
      );
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
      const n = normalize(c.data ?? config);
      setConfig(n);
      setInitial(n);
      setLocale(n.default_language);
      setSuggestion(null);
      toast.success(t('settingsPage.saved'));
    } catch (e) {
      toast.error(
        e instanceof Error && e.message
          ? e.message
          : t('settingsPage.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  }
  function reset() {
    if (initial) setConfig(initial);
    setSuggestion(null);
  }
  async function upload(type: 'avatar' | 'banner', file: File) {
    if (!barbershopId) {
      toast.error(t('settingsPage.imageUpdateFailed'));
      return;
    }

    setUploading(type);
    try {
      const result = await processAndUploadImage({
        file,
        bucket: type,
        path: `${barbershopId}/${type}.webp`,
        maxWidth: type === 'avatar' ? 400 : 1400,
        quality: 0.85,
      });

      if (result.error) {
        console.error(`[Barbershop ${type} Upload Failed]`, {
          message: result.error.message,
          fileType: file.type || 'unknown',
          fileSize: file.size,
          barbershopId,
        });
        toast.error(
          result.error.message || t('settingsPage.imageUpdateFailed'),
        );
        return;
      }

      if (!result.data?.publicUrl) {
        toast.error(t('settingsPage.imageUpdateFailed'));
        return;
      }

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
    } catch (error) {
      console.error(`[Barbershop ${type} Upload Unexpected Error]`, error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t('settingsPage.imageUpdateFailed'),
      );
    } finally {
      setUploading(null);
    }
  }
  async function requestBarbershopDeletionCode() {
    if (!deletePassword || deleteLoading) return;
    setDeleteLoading(true);
    try {
      const response = await fetch(
        '/api/dashboard/barbershop-deletion/request-code',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ password: deletePassword }),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.error || t('barbershopDeletion.requestFailed'));
      setDeleteCodeSent(true);
      toast.success(t('barbershopDeletion.codeSent'));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('barbershopDeletion.requestFailed'),
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  async function confirmBarbershopDeletion() {
    if (!deletePassword || !/^\d{6}$/.test(deleteCode) || deleteLoading) return;
    setDeleteLoading(true);
    try {
      const response = await fetch(
        '/api/dashboard/barbershop-deletion/confirm',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ password: deletePassword, code: deleteCode }),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.error || t('barbershopDeletion.deleteFailed'));
      toast.success(t('barbershopDeletion.deleted'));
      router.replace(result.redirectTo || '/onboarding');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('barbershopDeletion.deleteFailed'),
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  function closeBarbershopDeletionDialog(open: boolean) {
    if (deleteLoading) return;
    setDeleteDialogOpen(open);
    if (!open) {
      setDeletePassword('');
      setDeleteCode('');
      setDeleteCodeSent(false);
    }
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
      <main
        className="settings-page min-h-screen bg-transparent px-4 py-6 text-zinc-50"
        aria-busy="true"
        aria-label={t('settingsPage.title')}
      >
        <div className="mx-auto max-w-7xl space-y-6 sm:px-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-5">
            <div className="space-y-2">
              <div className="h-6 w-36 animate-pulse rounded-lg bg-white/10" />
              <div className="h-3 w-52 animate-pulse rounded bg-white/[.06]" />
            </div>
            <div className="h-10 w-10 animate-pulse rounded-xl bg-white/10" />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="space-y-4 border-b border-white/[.07] pb-5"
              >
                <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
                <div className="h-10 w-full animate-pulse rounded-xl bg-white/[.06]" />
                <div className="h-10 w-4/5 animate-pulse rounded-xl bg-white/[.06]" />
                <div className="h-10 w-3/5 animate-pulse rounded-xl bg-white/[.06]" />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  return (
    <main className="settings-page min-h-screen bg-transparent text-zinc-50">
      <div className="mx-auto max-w-7xl px-4 pb-28 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-30 -mx-4 border-b bg-zinc-950/10 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/dashboard"
                aria-label={t('settingsPage.backToDashboard')}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.03]"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <div className="min-w-0">
                <h1 className="whitespace-nowrap text-lg font-semibold leading-tight tracking-tight sm:text-2xl">
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
                aria-label={
                  saving
                    ? t('settingsPage.saving')
                    : dirty
                      ? t('settingsPage.saveChanges')
                      : t('settingsPage.allSaved')
                }
                className="min-h-10 w-10 shrink-0 rounded-xl bg-white px-0 text-zinc-950 hover:bg-zinc-100 sm:w-auto sm:px-4"
              >
                {saving ? (
                  <Spinner className="mr-0 size-4 sm:mr-2" />
                ) : (
                  <Save className="mr-0 size-4 sm:mr-2" />
                )}
                <span className="sr-only sm:not-sr-only">
                  {saving
                    ? t('settingsPage.saving')
                    : dirty
                      ? t('settingsPage.saveChanges')
                      : t('settingsPage.allSaved')}
                </span>
              </Button>
            </div>
          </div>
          {dirty && (
            <p className="mt-2 text-right text-[11px] text-amber-300">
              {t('settingsPage.unsavedChanges')}
            </p>
          )}
        </header>
        <div className="mt-5">
          <p className="mb-3 text-xs leading-5 text-zinc-500">{locale === 'en' ? 'Everything that controls how your barbershop works, looks and accepts bookings.' : 'Tudo o que define como a tua barbearia funciona, se apresenta e recebe marcações.'}</p>
          <div className="min-w-0 space-y-3">
            <details open data-settings-category className="settings-accordion group min-w-0 overflow-hidden rounded-xl border border-white/[.08] bg-white/[.012]">
  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 [&::-webkit-details-marker]:hidden">
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-zinc-100">{locale === 'en' ? 'Information' : 'Informações'}</span>
      <span className="mt-0.5 block text-xs leading-5 text-zinc-500">{locale === 'en' ? 'Business details, location and appearance.' : 'Dados da barbearia, localização e apresentação.'}</span>
    </span>
    <ChevronDown className="size-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
  </summary>
  <div className="settings-accordion-content border-t border-white/[.07] px-4 pb-4 pt-4 sm:px-5">
<section id="settings-business" className="scroll-mt-24">
              <div className="space-y-4">
                <div className="hidden">
                  <h2 className="text-lg font-semibold">
                    {t('settingsPage.business')}
                  </h2>
                  <p className="text-sm leading-5 text-zinc-500">
                    {t('settingsPage.businessDialogDescription')}
                  </p>
                </div>
                <Card className={CARD_CLASS}>
                  <CardContent className="grid gap-5 sm:grid-cols-2 ">
                    <div className="grid gap-2">
                      <label htmlFor="settings-shop-name">
                        {t('settingsPage.shopName')}
                      </label>
                      <Input
                        id="settings-shop-name"
                        value={config.name}
                        onChange={(e) => set({ name: e.target.value })}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="settings-shop-phone">
                        {t('settingsPage.phone')}
                      </label>
                      <Input
                        id="settings-shop-phone"
                        type="tel"
                        value={config.phone}
                        onChange={(e) => set({ phone: e.target.value })}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="sm:col-span-2 grid gap-2 border-t border-white/[.07] pt-5">
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
                          set({
                            default_language: value === 'en' ? 'en' : 'pt',
                          })
                        }
                      >
                        <SelectTrigger
                          id="settings-default-language"
                          className="box-border h-11 w-full min-w-0 max-w-full rounded-xl border border-white/10 bg-white/[.04] px-3 text-sm text-zinc-200"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          className="w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]"
                        >
                          <SelectItem value="pt">
                            Português (Portugal)
                          </SelectItem>
                          <SelectItem value="en">English</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2 space-y-4 border-t border-white/[.07] pt-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">
                              {t('settingsPage.mbwayTitle')}
                            </p>
                            <FeaturePlanBadge feature="manual_mbway_prepayment" />
                          </div>
                          <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
                            {t('settingsPage.mbwayDescription')}
                          </p>
                        </div>
                        <Switch
                          disabled={!canManualMbway}
                          checked={canManualMbway && config.mbway_enabled}
                          onCheckedChange={(value) =>
                            canManualMbway && set({ mbway_enabled: value })
                          }
                          aria-label={t('settingsPage.mbwayEnabled')}
                        />
                      </div>
                      <div className="grid gap-2 sm:max-w-md">
                        <label
                          htmlFor="settings-mbway-phone"
                          className="text-xs font-medium text-zinc-300"
                        >
                          {t('settingsPage.mbwayPhone')}
                        </label>
                        <Input
                          id="settings-mbway-phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder={t('settingsPage.mbwayPhonePlaceholder')}
                          value={config.mbway_phone}
                          disabled={!canManualMbway || !config.mbway_enabled}
                          onChange={(event) =>
                            set({ mbway_phone: event.target.value })
                          }
                          className={INPUT_CLASS}
                        />
                        <p className="text-xs leading-5 text-zinc-600">
                          {t('settingsPage.mbwayWhatsappNotice')}
                        </p>
                      </div>
                      {!canManualMbway && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[.07] pt-4">
                          <p className="text-xs text-zinc-400">
                            {t('settingsPage.mbwayProRequired')}
                          </p>
                          <Button asChild size="sm" variant="outline">
                            <Link href="/dashboard/billing">
                              {t('settingsPage.upgradePlan')}
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                    
                  </CardContent>
                </Card>
              </div>
            </section>
<div className="mt-4 border-t border-white/[.07] pt-4">
  <section id="settings-location" className="scroll-mt-24">
              <div className="space-y-4">
                <div className="hidden">
                  <h2 className="text-lg font-semibold">
                    {t('settingsPage.location')}
                  </h2>
                  <p className="text-sm leading-5 text-zinc-500">
                    {t('settingsPage.locationDialogDescription')}
                  </p>
                </div>
                <Card className={CARD_CLASS}>
                  <CardContent className="space-y-4 ">
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
                  </CardContent>
                </Card>
              </div>
            </section>
</div>
<details data-settings-subcategory className="settings-subaccordion group mt-4 min-w-0 overflow-hidden rounded-xl border border-white/[.08] bg-transparent">
  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 [&::-webkit-details-marker]:hidden">
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-zinc-100">{locale === 'en' ? 'Appearance' : 'Aparência'}</span>
      <span className="mt-0.5 block text-xs leading-5 text-zinc-500">{locale === 'en' ? 'Manage your barbershop identity and personalize the dashboard and agenda.' : 'Gere a identidade da barbearia e personaliza a dashboard e a agenda.'}</span>
    </span>
    <ChevronDown className="size-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
  </summary>
  <div className="settings-accordion-content space-y-4 border-t border-white/[.07] px-4 py-4 sm:px-5">
    <section id="settings-appearance">
              <Card className={CARD_CLASS}>
                <CardHeader className="hidden">
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
                            disabled={uploading !== null}
                          >
                            <ImageIcon className="mr-2 size-4" />
                            {t('settingsPage.cover')}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => avatarRef.current?.click()}
                            disabled={uploading !== null}
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
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{locale === 'en' ? 'Dashboard customization' : 'Personalização da dashboard'}</CardTitle>
        <p className="text-xs leading-5 text-zinc-500">{locale === 'en' ? 'Choose shortcuts, visible sections and the dashboard accent colour.' : 'Escolhe os atalhos, as secções visíveis e a cor de destaque da dashboard.'}</p>
      </CardHeader>
      <CardContent>
        <DashboardCustomizationDialog customization={customization} locale={locale} />
      </CardContent>
    </Card>
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{locale === 'en' ? 'Agenda layout' : 'Layout da agenda'}</CardTitle>
        <p className="text-xs leading-5 text-zinc-500">{locale === 'en' ? 'Choose how appointments are displayed by default.' : 'Escolhe como queres ver as marcações por defeito.'}</p>
      </CardHeader>
      <CardContent>
        <AgendaViewSettings />
      </CardContent>
    </Card>
  </div>
</details>
  </div>
</details>
            
            <details data-settings-category className="settings-accordion group min-w-0 overflow-hidden rounded-xl border border-white/[.08] bg-white/[.012]">
  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 [&::-webkit-details-marker]:hidden">
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-zinc-100">{t('settingsPage.hours')}</span>
      <span className="mt-0.5 block text-xs leading-5 text-zinc-500">{t('settingsPage.hoursDialogDescription')}</span>
    </span>
    <ChevronDown className="size-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
  </summary>
  <div className="settings-accordion-content border-t border-white/[.07] px-4 pb-4 pt-4 sm:px-5">
<section id="settings-hours" className="scroll-mt-24">
              <div className="space-y-4">
                <div className="hidden">
                  <h2 className="text-lg font-semibold">
                    {t('settingsPage.hours')}
                  </h2>
                  <p className="text-sm leading-5 text-zinc-500">
                    {t('settingsPage.hoursDialogDescription')}
                  </p>
                </div>
                <Card className={CARD_CLASS}>
                  <CardContent className="space-y-4 ">
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
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
                          onChange={(e) =>
                            set({ opening_time: e.target.value })
                          }
                          className={cn(INPUT_CLASS, 'color-scheme-dark')}
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
                          onChange={(e) =>
                            set({ closing_time: e.target.value })
                          }
                          className={cn(INPUT_CLASS, 'color-scheme-dark')}
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-zinc-200">
                        {t('settingsPage.lunchBreak')}
                      </h3>
                      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
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
                            onChange={(e) =>
                              set({ lunch_start: e.target.value })
                            }
                            className={cn(INPUT_CLASS, 'color-scheme-dark')}
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
                            className={cn(INPUT_CLASS, 'color-scheme-dark')}
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
                          const label = locale === 'pt' ? ptLabel : enLabel;
                          return (
                            <div
                              key={v}
                              className="flex min-h-11 min-w-0 items-center justify-between gap-3 border-b border-white/[.07] py-2"
                            >
                              <span className="min-w-0 truncate text-sm text-zinc-300">
                                {label}
                              </span>
                              <Switch
                                checked={active}
                                onCheckedChange={(checked) => {
                                  const nextDays = checked
                                    ? [...closed, v]
                                    : closed.filter((day) => day !== v);
                                  set({
                                    closed_days: nextDays.length
                                      ? nextDays.join(',')
                                      : 'None',
                                  });
                                }}
                                aria-label={
                                  locale === 'en'
                                    ? `Set ${label} as a closed day`
                                    : `Definir ${label} como dia de encerramento`
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
  </div>
</details>
            <details data-settings-category className="settings-accordion group min-w-0 overflow-hidden rounded-xl border border-white/[.08] bg-white/[.012]">
  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 [&::-webkit-details-marker]:hidden">
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-zinc-100">{locale === 'en' ? 'Booking rules' : 'Regras de marcação'}</span>
      <span className="mt-0.5 block text-xs leading-5 text-zinc-500">{locale === 'en' ? 'Availability, confirmations and cancellation behaviour.' : 'Disponibilidade, confirmações e regras de cancelamento.'}</span>
    </span>
    <ChevronDown className="size-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
  </summary>
  <div className="settings-accordion-content border-t border-white/[.07] px-4 pb-4 pt-4 sm:px-5">
<section id="settings-rules" className="scroll-mt-24">
              <div className="space-y-4">
                <div className="hidden">
                  <h2 className="text-lg font-semibold">
                    {t('settingsPage.rules')}
                  </h2>
                  <p className="text-sm leading-5 text-zinc-500">
                    {t('settingsPage.rulesDialogDescription')}
                  </p>
                </div>
                <Card className={CARD_CLASS}>
                  <CardContent className="space-y-4 ">
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
                          onValueChange={(value) =>
                            setNoticeUnit(value as 'minutes' | 'hours')
                          }
                        >
                          <SelectTrigger
                            aria-label={t('settingsPage.noticeUnit')}
                            className="h-11 w-28 min-w-0 rounded-xl border border-white/10 bg-white/[.04] px-3 text-sm text-zinc-200"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper" className="w-32">
                            <SelectItem value="minutes">
                              {t('settingsPage.noticeMinutes')}
                            </SelectItem>
                            <SelectItem value="hours">
                              {t('settingsPage.noticeHours')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-2 border-t border-white/[.07] pt-5">
                      <div className="min-w-0">
                        <label htmlFor="settings-cancellation-notice" className="text-sm font-medium text-zinc-200">
                          {locale === 'en' ? 'Cancellation notice' : 'Antecedência para cancelamentos'}
                        </label>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                          {locale === 'en'
                            ? 'How many hours before an appointment customers can cancel or reschedule.'
                            : 'Com quantas horas de antecedência os clientes podem cancelar ou reagendar uma marcação.'}
                        </p>
                      </div>
                      <Select
                        value={String(config.time_limit_cancellation_hours)}
                        onValueChange={(value) => set({ time_limit_cancellation_hours: Number(value) })}
                      >
                        <SelectTrigger id="settings-cancellation-notice" className="h-11 w-full min-w-0 sm:max-w-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectItem value="0">{locale === 'en' ? 'No minimum' : 'Sem prazo mínimo'}</SelectItem>
                          <SelectItem value="2">{locale === 'en' ? '2 hours' : '2 horas'}</SelectItem>
                          <SelectItem value="6">{locale === 'en' ? '6 hours' : '6 horas'}</SelectItem>
                          <SelectItem value="12">{locale === 'en' ? '12 hours' : '12 horas'}</SelectItem>
                          <SelectItem value="24">{locale === 'en' ? '24 hours' : '24 horas'}</SelectItem>
                          <SelectItem value="48">{locale === 'en' ? '48 hours' : '48 horas'}</SelectItem>
                          <SelectItem value="72">{locale === 'en' ? '72 hours' : '72 horas'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-4 border-t border-white/[.07] pt-5">
                      {!automationAllowed && (
                        <div className="flex flex-wrap items-center gap-2">
                          <FeaturePlanBadge feature="automated_reminders" />
                          <p className="text-xs text-amber-300">
                            {t('settingsPage.automationPlanRequired')}
                          </p>
                        </div>
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
                      <div className="flex items-center justify-between gap-4 border-t border-white/[.07] pt-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {t('settingsPage.autoConfirmManual')}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-zinc-500">
                            {t('settingsPage.autoConfirmManualDescription')}
                          </p>
                        </div>
                        <Switch
                          checked={config.auto_confirm_manual_bookings}
                          onCheckedChange={(v) =>
                            set({ auto_confirm_manual_bookings: v })
                          }
                          aria-label={t('settingsPage.autoConfirmManual')}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 border-t border-white/[.07] pt-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">
                              {t('settingsPage.autoConfirm')}
                            </p>
                            <FeaturePlanBadge feature="automated_reminders" />
                          </div>
                        </div>
                        <Switch
                          disabled={!automationAllowed}
                          checked={
                            automationAllowed && config.auto_confirm_bookings
                          }
                          onCheckedChange={(v) =>
                            automationAllowed &&
                            set({ auto_confirm_bookings: v })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 border-t border-white/[.07] pt-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">
                              {t('settingsPage.autoComplete')}
                            </p>
                            <FeaturePlanBadge feature="automated_reminders" />
                          </div>
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
                    <div className="flex items-center justify-between gap-4 border-t border-white/[.07] pt-5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-200">
                          {t('settingsPage.requireBirthDate')}
                        </p>
                        <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500">
                          {t('settingsPage.requireBirthDateDescription')}
                        </p>
                      </div>
                      <Switch
                        checked={config.require_birth_date}
                        onCheckedChange={(value) =>
                          set({ require_birth_date: value })
                        }
                        aria-label={t('settingsPage.requireBirthDate')}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
  </div>
</details>
            
            
            <details id="public-profile" data-settings-category className="settings-accordion group min-w-0 overflow-hidden rounded-xl border border-white/[.08] bg-white/[.012]">
  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 [&::-webkit-details-marker]:hidden">
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-zinc-100">{locale === 'en' ? 'Public profile' : 'Perfil público'}</span>
      <span className="mt-0.5 block text-xs leading-5 text-zinc-500">{locale === 'en' ? 'Manage the information customers see and how your barbershop appears in search.' : 'Gere a informação que os clientes veem e a forma como a tua barbearia aparece nas pesquisas.'}</span>
    </span>
    <ChevronDown className="size-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
  </summary>
  <div className="settings-accordion-content border-t border-white/[.07] px-4 py-4 sm:px-5">
    <PublicProfileSettingsCard
      directoryVisible={config.is_public_in_directory}
      onDirectoryVisibilityChange={handleDirectoryVisibilityChange}
      canDirectory={canDirectory}
      directorySaving={saving || directorySaving || planLoading}
    />
  </div>
</details>
            
<details data-settings-category className="settings-accordion group min-w-0 overflow-hidden rounded-xl border border-white/[.08] bg-white/[.012]">
  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 [&::-webkit-details-marker]:hidden">
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-zinc-100">{locale === 'en' ? 'Notifications' : 'Notificações'}</span>
      <span className="mt-0.5 block text-xs leading-5 text-zinc-500">{locale === 'en' ? 'Manage booking alerts on this device.' : 'Gere os avisos de novas marcações neste dispositivo.'}</span>
    </span>
    <ChevronDown className="size-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
  </summary>
  <div className="settings-accordion-content border-t border-white/[.07] px-4 pb-4 pt-4 sm:px-5">
<section id="settings-notifications" className="scroll-mt-24">
              <div className="space-y-4">
                <div className="hidden">
                  <h2 className="text-lg font-semibold">
                    {locale === 'en' ? 'Notifications' : 'Notificações'}
                  </h2>
                  <p className="text-sm leading-5 text-zinc-500">
                    {locale === 'en'
                      ? 'Manage operational booking alerts on this device.'
                      : 'Gere neste dispositivo os avisos operacionais de novas marcações.'}
                  </p>
                </div>
                <SettingsPushNotificationsPanel />
              </div>
            </section>
  </div>
</details>
            
            
            
            <details data-settings-category className="settings-accordion settings-account-security group min-w-0 overflow-hidden rounded-xl border border-white/[.08] bg-white/[.012]">
  <summary className="flex min-h-[5.25rem] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 [&::-webkit-details-marker]:hidden sm:px-5">
    <span className="flex min-w-0 items-center gap-3">
      <span className="account-security-icon" aria-hidden="true">
        <ShieldCheck className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="account-security-eyebrow">{locale === 'en' ? 'ACCOUNT CONTROL' : 'CONTROLO DA CONTA'}</span>
        <span className="mt-0.5 block text-sm font-semibold text-zinc-100">{t('settingsPage.accountSecurity')}</span>
        <span className="mt-1 block max-w-xl text-xs leading-5 text-zinc-500">{locale === 'en' ? 'Manage account access, subscription and barbershop security.' : 'Gere o acesso à conta, a subscrição e a segurança da barbearia.'}</span>
      </span>
    </span>
    <span className="flex shrink-0 items-center gap-2">
      <span className="account-security-count">{locale === 'en' ? '3 areas' : '3 áreas'}</span>
      <ChevronDown className="size-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
    </span>
  </summary>
  <div className="settings-accordion-content space-y-3">
    <section id="settings-account" className="settings-account-security-panel">
      <Card className={CARD_CLASS}>
        <CardContent className="flex flex-col gap-4 p-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="account-security-panel-icon" aria-hidden="true">
              <ShieldCheck className="size-4" />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="account-security-panel-eyebrow">{locale === 'en' ? 'ACCOUNT ACCESS' : 'ACESSO À CONTA'}</p>
              <p className="text-sm font-medium text-zinc-100">{locale === 'en' ? 'Current session' : 'Sessão atual'}</p>
              <p className="text-xs leading-5 text-zinc-500">{locale === 'en' ? 'Sign out from this device.' : 'Termina a sessão neste dispositivo.'}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void logout()}
            disabled={logoutLoading}
            className="min-h-10 w-full shrink-0 rounded-xl border-white/10 bg-white/[.035] sm:w-auto"
          >
            <LogOut className="mr-2 size-4" />
            {logoutLoading
              ? t('settingsPage.logoutLoading')
              : t('settingsPage.logout')}
          </Button>
        </CardContent>
      </Card>
    </section>

    <section id="settings-billing" className="settings-account-security-panel">
      <Card className={CARD_CLASS}>
        <CardContent className="flex flex-col gap-3 p-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="account-security-panel-icon" aria-hidden="true">
              <CreditCard className="size-4" />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="account-security-panel-eyebrow">{t('settingsPage.billing')}</p>
              <h2 className="text-sm font-semibold text-zinc-100">{t('settingsPage.billingTitle')}</h2>
              <p className="text-xs leading-5 text-zinc-500">{locale === 'en' ? 'Manage your plan and billing details.' : 'Gere o teu plano e consulta os dados de faturação.'}</p>
            </div>
          </div>
          <Button asChild className="min-h-10 w-full shrink-0 rounded-xl sm:w-auto">
            <Link href="/dashboard/billing">
              {t('settingsPage.openBilling')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </section>

    <section id="settings-danger" className="settings-account-security-panel settings-account-security-panel--danger scroll-mt-24">
      <Card className={CARD_CLASS}>
        <CardContent className="flex flex-col gap-4 p-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="account-security-panel-icon account-security-panel-icon--danger" aria-hidden="true">
              <Trash2 className="size-4" />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="account-security-panel-eyebrow account-security-panel-eyebrow--danger">{locale === 'en' ? 'DANGER ZONE' : 'ZONA DE PERIGO'}</p>
              <p className="text-sm font-semibold text-zinc-100">{t('barbershopDeletion.title')}</p>
              <p className="max-w-2xl text-xs leading-5 text-zinc-400">{t('barbershopDeletion.description')}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
            className="min-h-10 w-full shrink-0 rounded-xl sm:w-auto"
          >
            <Trash2 className="mr-2 size-4" />
            {t('barbershopDeletion.openButton')}
          </Button>
        </CardContent>
      </Card>
    </section>
  </div>
</details>
          </div>
        </div>
      </div>
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={closeBarbershopDeletionDialog}
      >
        <AlertDialogContent className="max-h-[90dvh] overflow-y-auto border border-rose-500/20 bg-zinc-950 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-200">
              {t('barbershopDeletion.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {deleteCodeSent
                ? t('barbershopDeletion.codeDescription')
                : t('barbershopDeletion.confirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="delete-barbershop-password"
                className="text-sm font-medium text-zinc-200"
              >
                {t('barbershopDeletion.password')}
              </label>
              <Input
                id="delete-barbershop-password"
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                className={INPUT_CLASS}
                disabled={deleteLoading}
              />
            </div>
            {deleteCodeSent && (
              <div className="space-y-2">
                <label
                  htmlFor="delete-barbershop-code"
                  className="text-sm font-medium text-zinc-200"
                >
                  {t('barbershopDeletion.emailCode')}
                </label>
                <Input
                  id="delete-barbershop-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={deleteCode}
                  onChange={(event) =>
                    setDeleteCode(
                      event.target.value.replace(/\D/g, '').slice(0, 6),
                    )
                  }
                  className={INPUT_CLASS}
                  disabled={deleteLoading}
                />
                <p className="text-xs text-zinc-500">
                  {t('barbershopDeletion.codeExpiry')}
                </p>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteLoading}
              onClick={() => closeBarbershopDeletionDialog(false)}
            >
              {t('barbershopDeletion.cancel')}
            </AlertDialogCancel>
            {!deleteCodeSent ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void requestBarbershopDeletionCode()}
                disabled={deleteLoading || !deletePassword}
              >
                {deleteLoading ? <Spinner className="mr-2 size-4" /> : null}
                {deleteLoading
                  ? t('barbershopDeletion.sending')
                  : t('barbershopDeletion.sendCode')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void confirmBarbershopDeletion()}
                disabled={
                  deleteLoading || !deletePassword || deleteCode.length !== 6
                }
              >
                {deleteLoading ? (
                  <Spinner className="mr-2 size-4" />
                ) : (
                  <Trash2 className="mr-2 size-4" />
                )}
                {deleteLoading
                  ? t('barbershopDeletion.deleting')
                  : t('barbershopDeletion.deleteForever')}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/95 p-3 backdrop-blur-xl sm:hidden">
          <div className="mx-auto flex max-w-xl gap-2">
            <Button variant="ghost" onClick={reset} className="min-h-11 flex-1">
              {t('settingsPage.discard')}
            </Button>
            <Button
              onClick={() => void saveAll()}
              disabled={saving || directorySaving}
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
