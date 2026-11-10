'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { FeaturePlanBadge } from '@/components/billing/FeaturePlanBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
const INPUT_CLASS = 'box-border block min-h-11 w-full min-w-0 max-w-full rounded-xl border-white/10 bg-white/5 text-sm sm:max-w-sm';
const CARD_CLASS = 'border border-white/10 bg-white/[.02] text-zinc-50';

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
  const { hasFeature, loading: planLoading, plan } = useFeatureAccess();
  const canDirectory = hasFeature('directory_visibility');
  const canManualMbway = hasFeature('manual_mbway_prepayment');
  const automationAllowed = plan === 'pro' || plan === 'enterprise';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      const n = normalize(c.data ?? config);
      setConfig(n);
      setInitial(n);
      setLocale(n.default_language);
      setSuggestion(null);
      toast.success(t('settingsPage.saved'));
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t('settingsPage.saveFailed'));
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
        toast.error(result.error.message || t('settingsPage.imageUpdateFailed'));
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
      const response = await fetch('/api/dashboard/barbershop-deletion/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || t('barbershopDeletion.requestFailed'));
      setDeleteCodeSent(true);
      toast.success(t('barbershopDeletion.codeSent'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('barbershopDeletion.requestFailed'));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function confirmBarbershopDeletion() {
    if (!deletePassword || !/^\d{6}$/.test(deleteCode) || deleteLoading) return;
    setDeleteLoading(true);
    try {
      const response = await fetch('/api/dashboard/barbershop-deletion/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ password: deletePassword, code: deleteCode }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || t('barbershopDeletion.deleteFailed'));
      toast.success(t('barbershopDeletion.deleted'));
      router.replace(result.redirectTo || '/onboarding');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('barbershopDeletion.deleteFailed'));
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
        className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-50"
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
                className="space-y-4 rounded-2xl border border-white/10 bg-white/[.02] p-5"
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
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
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
          <div className="min-w-0 space-y-6">
            <section id="settings-business" className="scroll-mt-24">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">{t('settingsPage.business')}</h2>
                  <p className="text-sm leading-5 text-zinc-500">{t('settingsPage.businessDialogDescription')}</p>
                </div>
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
                  <div className="sm:col-span-2 grid gap-2 border-t border-white/10 pt-5">
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
                        className="box-border h-11 w-full min-w-0 max-w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-200 sm:max-w-sm"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]">
                        <SelectItem value="pt">Português (Portugal)</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 space-y-4 border-t border-white/10 pt-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{t('settingsPage.mbwayTitle')}</p>
                          <FeaturePlanBadge feature="manual_mbway_prepayment" />
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
                    <div className="grid gap-2 sm:max-w-md">
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
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                        <p className="text-xs text-zinc-400">{t('settingsPage.mbwayProRequired')}</p>
                        <Button asChild size="sm" variant="outline"><Link href="/dashboard/billing">{t('settingsPage.upgradePlan')}</Link></Button>
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between gap-4 border-t border-white/10 pt-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">
                          {t('settingsPage.directoryVisibility')}
                        </p>
                        <FeaturePlanBadge feature="directory_visibility" />
                      </div>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        {canDirectory
                          ? t('settingsPage.directoryDescription')
                          : locale === 'en'
                            ? 'Your barbershop stays visible in the directory on Free. Upgrade to Pro to hide it from search results.'
                            : 'No plano Free, a tua barbearia aparece sempre no diretório. Com o Pro, podes ocultá-la dos resultados.'}
                      </p>
                    </div>
                    <Switch
                      disabled={!canDirectory || planLoading || saving}
                      checked={!canDirectory || config.is_public_in_directory}
                      onCheckedChange={(value) =>
                        canDirectory && set({ is_public_in_directory: value })
                      }
                      aria-label={locale === 'en' ? 'Show barbershop in public directory' : 'Mostrar barbearia no diretório público'}
                    />
                  </div>
                  </CardContent>
                </Card>
              </div>
            </section>
            <section id="settings-location" className="scroll-mt-24">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">{t('settingsPage.location')}</h2>
                  <p className="text-sm leading-5 text-zinc-500">{t('settingsPage.locationDialogDescription')}</p>
                </div>
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
                  </CardContent>
                </Card>
              </div>
            </section>
            <section id="settings-hours" className="scroll-mt-24">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">{t('settingsPage.hours')}</h2>
                  <p className="text-sm leading-5 text-zinc-500">{t('settingsPage.hoursDialogDescription')}</p>
                </div>
                <Card className={CARD_CLASS}>
                  <CardContent className="space-y-6 ">
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
                        onChange={(e) => set({ opening_time: e.target.value })}
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
                        onChange={(e) => set({ closing_time: e.target.value })}
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
                          onChange={(e) => set({ lunch_start: e.target.value })}
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
                              'box-border min-h-12 w-full min-w-0 max-w-full rounded-xl border px-3 text-left text-sm',
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
              </div>
            </section>
            <section id="settings-rules" className="scroll-mt-24">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">{t('settingsPage.rules')}</h2>
                  <p className="text-sm leading-5 text-zinc-500">{t('settingsPage.rulesDialogDescription')}</p>
                </div>
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
                  <div className="space-y-4 border-t border-white/10 pt-5">
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
                    <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t('settingsPage.autoConfirmManual')}</p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">{t('settingsPage.autoConfirmManualDescription')}</p>
                      </div>
                      <Switch
                        checked={config.auto_confirm_manual_bookings}
                        onCheckedChange={(v) => set({ auto_confirm_manual_bookings: v })}
                        aria-label={t('settingsPage.autoConfirmManual')}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
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
                          automationAllowed && set({ auto_confirm_bookings: v })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
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
                  <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-200">{t('settingsPage.requireBirthDate')}</p>
                      <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500">{t('settingsPage.requireBirthDateDescription')}</p>
                    </div>
                    <Switch
                      checked={config.require_birth_date}
                      onCheckedChange={(value) => set({ require_birth_date: value })}
                      aria-label={t('settingsPage.requireBirthDate')}
                    />
                  </div>
                  </CardContent>
                </Card>
              </div>
            </section>
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
            <section id="settings-billing">
              <Card className={CARD_CLASS}>
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
            <section id="settings-danger" className="scroll-mt-24">
              <Card className={CARD_CLASS}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-rose-200">
                    <Trash2 className="size-4" />
                    {t('barbershopDeletion.dangerZone')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-zinc-100">{t('barbershopDeletion.title')}</p>
                    <p className="max-w-2xl text-sm leading-6 text-zinc-400">{t('barbershopDeletion.description')}</p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="min-h-11"
                  >
                    <Trash2 className="mr-2 size-4" />
                    {t('barbershopDeletion.openButton')}
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
      <AlertDialog open={deleteDialogOpen} onOpenChange={closeBarbershopDeletionDialog}>
        <AlertDialogContent className="max-h-[90dvh] overflow-y-auto border border-rose-500/20 bg-zinc-950 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-200">{t('barbershopDeletion.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {deleteCodeSent ? t('barbershopDeletion.codeDescription') : t('barbershopDeletion.confirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="delete-barbershop-password" className="text-sm font-medium text-zinc-200">
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
                <label htmlFor="delete-barbershop-code" className="text-sm font-medium text-zinc-200">
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
                  onChange={(event) => setDeleteCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={INPUT_CLASS}
                  disabled={deleteLoading}
                />
                <p className="text-xs text-zinc-500">{t('barbershopDeletion.codeExpiry')}</p>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading} onClick={() => closeBarbershopDeletionDialog(false)}>
              {t('barbershopDeletion.cancel')}
            </AlertDialogCancel>
            {!deleteCodeSent ? (
              <Button type="button" variant="destructive" onClick={() => void requestBarbershopDeletionCode()} disabled={deleteLoading || !deletePassword}>
                {deleteLoading ? <Spinner className="mr-2 size-4" /> : null}
                {deleteLoading ? t('barbershopDeletion.sending') : t('barbershopDeletion.sendCode')}
              </Button>
            ) : (
              <Button type="button" variant="destructive" onClick={() => void confirmBarbershopDeletion()} disabled={deleteLoading || !deletePassword || deleteCode.length !== 6}>
                {deleteLoading ? <Spinner className="mr-2 size-4" /> : <Trash2 className="mr-2 size-4" />}
                {deleteLoading ? t('barbershopDeletion.deleting') : t('barbershopDeletion.deleteForever')}
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
