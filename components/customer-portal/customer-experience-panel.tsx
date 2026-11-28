'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import { PwaInstallButton } from '@/components/pwa-install-button';
import { triggerHapticFeedback } from '@/lib/haptics';

type PushStatus = {
  configured: boolean;
  publicKey: string | null;
  deviceCount: number;
};

type CalendarStatus = {
  enabled: boolean;
  feedUrl: string | null;
};

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const raw = window.atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

function isIosDevice(): boolean {
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isStandaloneApp(): boolean {
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    standaloneNavigator.standalone === true
  );
}

function CalendarSyncCard() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [calendar, setCalendar] = useState<CalendarStatus>({
    enabled: false,
    feedUrl: null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/customer-portal/calendar/settings', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const body = (await response.json()) as {
        enabled?: boolean;
        feedUrl?: string | null;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || t('customerPortal.calendarLoadError'));
      setCalendar({ enabled: body.enabled === true, feedUrl: body.feedUrl ?? null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('customerPortal.calendarLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (method: 'POST' | 'DELETE') => {
    setBusy(true);
    try {
      const response = await fetch('/api/customer-portal/calendar/settings', {
        method,
        headers: { Accept: 'application/json' },
      });
      const body = (await response.json()) as {
        enabled?: boolean;
        feedUrl?: string | null;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || t('customerPortal.calendarSaveError'));
      setCalendar({ enabled: body.enabled === true, feedUrl: body.feedUrl ?? null });
      toast.success(method === 'POST' ? t('customerPortal.calendarEnabled') : t('customerPortal.calendarDisabled'));
      triggerHapticFeedback('success');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('customerPortal.calendarSaveError'));
      triggerHapticFeedback('error');
    } finally {
      setBusy(false);
    }
  };

  const appleUrl = useMemo(
    () => calendar.feedUrl?.replace(/^https:/, 'webcal:') ?? '',
    [calendar.feedUrl],
  );
  const googleUrl = useMemo(
    () =>
      calendar.feedUrl
        ? 'https://calendar.google.com/calendar/u/0/r/settings/addbyurl?url=' +
          encodeURIComponent(calendar.feedUrl)
        : '',
    [calendar.feedUrl],
  );

  const copyLink = async () => {
    if (!calendar.feedUrl) return;
    try {
      await navigator.clipboard.writeText(calendar.feedUrl);
      toast.success(t('customerPortal.calendarCopied'));
      triggerHapticFeedback('success');
    } catch {
      toast.error(t('customerPortal.calendarCopyError'));
      triggerHapticFeedback('error');
    }
  };

  return (
    <article className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_14px_45px_rgba(0,0,0,0.12)] backdrop-blur-xl sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-300/[0.08] text-sky-100">
          <CalendarDays className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-zinc-50">{t('customerPortal.calendarTitle')}</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-400">{t('customerPortal.calendarDescription')}</p>
        </div>
        {calendar.enabled ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-2 py-1 text-[10px] font-medium text-emerald-100">
            <Check className="size-3" aria-hidden="true" />
            {t('customerPortal.calendarActive')}
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-4 text-xs text-zinc-500">{t('customerPortal.calendarLoading')}</p>
      ) : !calendar.enabled || !calendar.feedUrl ? (
        <div className="mt-4">
          <button
            type="button"
            data-haptic="selection"
            onClick={() => void update('POST')}
            disabled={busy}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-50 sm:w-auto"
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            {busy ? t('customerPortal.calendarWorking') : t('customerPortal.calendarEnable')}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <a
              href={appleUrl}
              data-haptic="selection"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-zinc-100 transition hover:bg-white/[0.08]"
            >
              <Smartphone className="size-4" aria-hidden="true" />
              {t('customerPortal.calendarApple')}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-haptic="selection"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-zinc-100 transition hover:bg-white/[0.08]"
            >
              <CalendarDays className="size-4" aria-hidden="true" />
              {t('customerPortal.calendarGoogle')}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
          <button
            type="button"
            data-haptic="selection"
            onClick={() => void copyLink()}
            className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.05]"
          >
            <Copy className="size-3.5" aria-hidden="true" />
            {t('customerPortal.calendarCopy')}
          </button>
          <p className="mt-3 rounded-xl border border-amber-300/10 bg-amber-300/[0.04] p-3 text-[11px] leading-5 text-amber-100/80">
            <ShieldCheck className="mr-1 inline size-3.5" aria-hidden="true" />
            {t('customerPortal.calendarPrivacy')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.07] pt-3">
            <button
              type="button"
              data-haptic="selection"
              onClick={() => {
                if (window.confirm(t('customerPortal.calendarRotateConfirm'))) {
                  void update('POST');
                }
              }}
              disabled={busy}
              className="min-h-9 rounded-lg border border-white/10 px-3 text-[11px] font-medium text-zinc-400 hover:bg-white/[0.05] disabled:opacity-50"
            >
              {t('customerPortal.calendarRotate')}
            </button>
            <button
              type="button"
              data-haptic="warning"
              onClick={() => {
                if (window.confirm(t('customerPortal.calendarDisableConfirm'))) {
                  void update('DELETE');
                }
              }}
              disabled={busy}
              className="min-h-9 rounded-lg px-3 text-[11px] font-medium text-rose-300 hover:bg-rose-400/[0.07] disabled:opacity-50"
            >
              {t('customerPortal.calendarDisable')}
            </button>
          </div>
        </>
      )}
    </article>
  );
}

export function CustomerExperiencePanel() {
  const { t, locale } = useLanguage();
  const [supported, setSupported] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const readCurrentSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    const registration = await navigator.serviceWorker.getRegistration('/');
    return registration?.pushManager.getSubscription() ?? null;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/customer-portal/notifications', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const body = (await response.json()) as PushStatus & { error?: string };
      if (!response.ok) throw new Error(body.error || t('customerPortal.notificationsLoadError'));

      setConfigured(body.configured === true);
      setPublicKey(body.publicKey ?? null);
      setDeviceCount(Number(body.deviceCount ?? 0));

      const hasSupport =
        'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window;
      setSupported(hasSupport);
      setPermission(hasSupport ? Notification.permission : 'unsupported');

      if (hasSupport) {
        const subscription = await readCurrentSubscription();
        if (subscription) {
          const statusResponse = await fetch('/api/customer-portal/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ action: 'status', endpoint: subscription.endpoint }),
          });
          const statusBody = (await statusResponse.json()) as { subscribed?: boolean };
          setSubscribed(statusResponse.ok && statusBody.subscribed === true);
        } else {
          setSubscribed(false);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('customerPortal.notificationsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [readCurrentSubscription, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const enable = async () => {
    if (!supported || !publicKey || !configured) {
      toast.error(t('customerPortal.notificationsUnavailable'));
      return;
    }

    if (isIosDevice() && !isStandaloneApp()) {
      toast.info(t('customerPortal.notificationsIosInstall'));
      return;
    }

    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        toast.error(
          result === 'denied'
            ? t('customerPortal.notificationsDenied')
            : t('customerPortal.notificationsPermissionDismissed'),
        );
        triggerHapticFeedback('warning');
        return;
      }

      const registration =
        (await navigator.serviceWorker.getRegistration('/')) ??
        (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const platform = isIosDevice()
        ? 'ios'
        : /Android/i.test(navigator.userAgent)
          ? 'android'
          : 'desktop';
      const response = await fetch('/api/customer-portal/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON(), platform }),
      });
      const body = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error || t('customerPortal.notificationsEnableError'));

      setSubscribed(true);
      setDeviceCount((count) => Math.max(count, 1));
      toast.success(t('customerPortal.notificationsEnabled'));
      triggerHapticFeedback('success');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('customerPortal.notificationsEnableError'));
      triggerHapticFeedback('error');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const subscription = await readCurrentSubscription();
      if (subscription) {
        const response = await fetch('/api/customer-portal/notifications', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        const body = (await response.json()) as { success?: boolean; error?: string };
        if (!response.ok) throw new Error(body.error || t('customerPortal.notificationsDisableError'));
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      toast.success(t('customerPortal.notificationsDisabled'));
      triggerHapticFeedback('success');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('customerPortal.notificationsDisableError'));
      triggerHapticFeedback('error');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/customer-portal/notifications/test', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const body = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error || t('customerPortal.notificationsTestError'));
      toast.success(t('customerPortal.notificationsTestSent'));
      triggerHapticFeedback('success');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('customerPortal.notificationsTestError'));
      triggerHapticFeedback('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label={t('customerPortal.experienceTitle')}
      className="grid min-w-0 gap-3 lg:grid-cols-2"
    >
      <article className="min-w-0 rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[0.075] via-white/[0.035] to-sky-300/[0.035] p-4 shadow-[0_14px_45px_rgba(0,0,0,0.12)] backdrop-blur-xl sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/[0.09] text-emerald-100">
            <Smartphone className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-zinc-50">{t('customerPortal.appInstallTitle')}</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-400">{t('customerPortal.appInstallDescription')}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <PwaInstallButton locale={locale} />
          <span className="text-[11px] leading-5 text-zinc-500">
            {t('customerPortal.appInstallHint')}
          </span>
        </div>
      </article>

      <article className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_14px_45px_rgba(0,0,0,0.12)] backdrop-blur-xl sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-300/[0.08] text-sky-100">
            {subscribed ? <BellRing className="size-5" aria-hidden="true" /> : <Bell className="size-5" aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-zinc-50">{t('customerPortal.notificationsTitle')}</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-400">{t('customerPortal.notificationsDescription')}</p>
          </div>
          {subscribed ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-2 py-1 text-[10px] font-medium text-emerald-100">
              <Check className="size-3" aria-hidden="true" />
              {t('customerPortal.notificationsActive')}
            </span>
          ) : null}
        </div>

        <p className="mt-3 text-[11px] leading-5 text-zinc-500">
          {loading
            ? t('customerPortal.notificationsLoading')
            : !supported
              ? t('customerPortal.notificationsUnsupported')
              : !configured
                ? t('customerPortal.notificationsUnavailable')
                : permission === 'denied'
                  ? t('customerPortal.notificationsDenied')
                  : t('customerPortal.notificationsDeviceCount', { count: deviceCount })}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {!subscribed ? (
            <button
              type="button"
              data-haptic="selection"
              onClick={() => void enable()}
              disabled={busy || loading || !supported || !configured}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-45"
            >
              <Bell className="size-4" aria-hidden="true" />
              {busy ? t('customerPortal.notificationsWorking') : t('customerPortal.notificationsEnable')}
            </button>
          ) : (
            <>
              <button
                type="button"
                data-haptic="selection"
                onClick={() => void test()}
                disabled={busy}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-45"
              >
                <BellRing className="size-4" aria-hidden="true" />
                {t('customerPortal.notificationsTest')}
              </button>
              <button
                type="button"
                data-haptic="warning"
                onClick={() => void disable()}
                disabled={busy}
                className="min-h-10 rounded-xl border border-white/10 px-3 text-xs font-medium text-zinc-400 hover:bg-white/[0.05] disabled:opacity-45"
              >
                {t('customerPortal.notificationsDisable')}
              </button>
            </>
          )}
        </div>
        <p className="mt-3 text-[10px] leading-5 text-zinc-600">
          {t('customerPortal.notificationsPrivacy')}
        </p>
      </article>

      <div className="lg:col-span-2">
        <CalendarSyncCard />
      </div>
    </section>
  );
}
