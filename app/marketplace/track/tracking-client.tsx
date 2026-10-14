'use client';

declare global {
  interface Window {
    __SILENTRA_CONSUME_MARKETPLACE_TRACKING_TOKEN__?: () => string | null;
  }
}

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Clock3,
  MapPin,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-react';

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled';

type TrackingEvent = {
  id: string;
  previousStatus: OrderStatus | null;
  status: OrderStatus;
  message: string | null;
  createdAt: string;
};

type TrackedOrder = {
  reference: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  updatedAt: string;
  fulfillmentMethod: 'pickup' | 'delivery';
  shipping: {
    address: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
  shopName: string;
  items: Array<{ name: string; quantity: number; total: number }>;
  history: TrackingEvent[];
};

type Translate = (key: string, variables?: Record<string, unknown>) => string;

function statusLabel(status: OrderStatus, t: Translate): string {
  return t(`orderTracking.status.${status}`);
}

function statusDescription(status: OrderStatus, t: Translate): string {
  return t(`orderTracking.description.${status}`);
}

const PICKUP_STEPS: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'completed',
];
const DELIVERY_STEPS: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'shipped',
  'delivered',
  'completed',
];
const VALID_STATUSES = new Set<OrderStatus>([
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseTrackedOrder(value: unknown): TrackedOrder | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.reference !== 'string' ||
    typeof value.status !== 'string' ||
    !VALID_STATUSES.has(value.status as OrderStatus) ||
    !Number.isFinite(Number(value.total)) ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string' ||
    (value.fulfillmentMethod !== 'pickup' &&
      value.fulfillmentMethod !== 'delivery') ||
    typeof value.shopName !== 'string' ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.history)
  ) {
    return null;
  }

  const items = value.items
    .filter(
      (item): item is Record<string, unknown> =>
        isRecord(item) &&
        typeof item.name === 'string' &&
        Number.isFinite(Number(item.quantity)) &&
        Number(item.quantity) > 0 &&
        Number.isFinite(Number(item.total)),
    )
    .map((item) => ({
      name: item.name as string,
      quantity: Number(item.quantity),
      total: Number(item.total),
    }));

  const history = value.history
    .filter(
      (event): event is Record<string, unknown> =>
        isRecord(event) &&
        typeof event.id === 'string' &&
        typeof event.status === 'string' &&
        VALID_STATUSES.has(event.status as OrderStatus) &&
        typeof event.createdAt === 'string',
    )
    .map((event) => ({
      id: event.id as string,
      previousStatus:
        typeof event.previousStatus === 'string' &&
        VALID_STATUSES.has(event.previousStatus as OrderStatus)
          ? (event.previousStatus as OrderStatus)
          : null,
      status: event.status as OrderStatus,
      message: typeof event.message === 'string' ? event.message : null,
      createdAt: event.createdAt as string,
    }));

  let shipping: TrackedOrder['shipping'] = null;
  if (isRecord(value.shipping)) {
    shipping = {
      address:
        typeof value.shipping.address === 'string'
          ? value.shipping.address
          : null,
      city:
        typeof value.shipping.city === 'string' ? value.shipping.city : null,
      postalCode:
        typeof value.shipping.postalCode === 'string'
          ? value.shipping.postalCode
          : null,
      country:
        typeof value.shipping.country === 'string'
          ? value.shipping.country
          : null,
    };
  }

  return {
    reference: value.reference,
    status: value.status as OrderStatus,
    total: Number(value.total),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    fulfillmentMethod: value.fulfillmentMethod,
    shipping,
    shopName: value.shopName,
    items,
    history,
  };
}

function money(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(Number.isFinite(value) ? value : 0);
}

function dateTime(value: string, locale: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function countryLabel(value: string | null): string {
  if (!value) return '';
  if (value.toUpperCase() === 'PT') return 'Portugal';
  return value;
}

export default function MarketplaceOrderTrackingClient() {
  const { locale, t } = useLanguage();
  const formatLocale = locale === 'pt' ? 'pt-PT' : 'en-GB';
  const [token, setToken] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const requestInFlight = useRef(false);
  const activeRef = useRef(true);
  const initialTokenRef = useRef<string | null>(null);
  const fragmentProcessedRef = useRef(false);

  const loadOrder = useCallback(
    async (capability: string, quiet = false) => {
      if (requestInFlight.current) return;
      requestInFlight.current = true;
      if (quiet) setRefreshing(true);
      else setLoading(true);
      setError('');

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12_000);

      try {
        const response = await fetch('/api/marketplace/orders/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          credentials: 'same-origin',
          referrerPolicy: 'no-referrer',
          signal: controller.signal,
          body: JSON.stringify({ token: capability }),
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          if (response.status === 404 && activeRef.current) setOrder(null);
          throw new Error(t('orderTracking.loadError'));
        }

        const parsed = isRecord(payload)
          ? parseTrackedOrder(payload.order)
          : null;
        if (!parsed) {
          throw new Error(t('orderTracking.invalidResponse'));
        }
        if (activeRef.current) {
          setOrder(parsed);
          setLastUpdated(new Date().toISOString());
          setError('');
        }
      } catch (cause) {
        if (activeRef.current) {
          setError(
            cause instanceof Error && cause.name === 'AbortError'
              ? t('orderTracking.timeout')
              : cause instanceof Error
                ? cause.message
                : t('orderTracking.loadError'),
          );
        }
      } finally {
        window.clearTimeout(timeout);
        requestInFlight.current = false;
        if (activeRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [t],
  );

  useEffect(() => {
    activeRef.current = true;

    // Effects are intentionally replayed by React Strict Mode in development.
    // Keep the first fragment in a ref so that replay after URL scrubbing does
    // not incorrectly conclude that the customer opened a bare tracking page.
    if (!fragmentProcessedRef.current) {
      const fragmentToken = new URLSearchParams(
        window.location.hash.slice(1),
      ).get('token');
      const bootstrapToken =
        window.__SILENTRA_CONSUME_MARKETPLACE_TRACKING_TOKEN__?.() ?? null;
      delete window.__SILENTRA_CONSUME_MARKETPLACE_TRACKING_TOKEN__;
      initialTokenRef.current = fragmentToken ?? bootstrapToken;
      fragmentProcessedRef.current = true;

      // Defence in depth: the root bootstrap normally scrubs this before GTM,
      // Whop Pixel and hydration; repeat the operation before any API call.
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      );
    }

    const tokenFromFragment = initialTokenRef.current;
    if (!tokenFromFragment) {
      setError(t('orderTracking.missingToken'));
      setLoading(false);
      return () => {
        activeRef.current = false;
      };
    }

    setToken(tokenFromFragment);
    void loadOrder(tokenFromFragment);

    return () => {
      activeRef.current = false;
    };
  }, [loadOrder]);

  useEffect(() => {
    if (!token) return;

    // Refresh in the background at a restrained interval and only when this
    // page is visible. The customer can always refresh manually.
    const interval = window.setInterval(() => {
      if (!document.hidden) void loadOrder(token, true);
    }, 120_000);

    return () => window.clearInterval(interval);
  }, [token, loadOrder]);

  const steps =
    order?.fulfillmentMethod === 'delivery' ||
    order?.status === 'shipped' ||
    order?.status === 'delivered'
      ? DELIVERY_STEPS
      : PICKUP_STEPS;
  const activeStep = order ? steps.indexOf(order.status) : -1;
  const cancelled = order?.status === 'cancelled';

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-white/10 bg-zinc-950/85">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/marketplace"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl text-sm text-zinc-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <ArrowLeft className="size-4" />
            {t('orderTracking.marketplace')}
          </Link>
          <span className="text-xs font-semibold tracking-[0.14em] text-zinc-600">
            SILENTRA
          </span>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-200">
              <ShieldCheck className="size-3.5" />
              {t('orderTracking.privateAccess')}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t('orderTracking.title')}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
              {t('orderTracking.subtitle')}
            </p>
          </div>

          {token && (
            <button
              type="button"
              onClick={() => void loadOrder(token, true)}
              disabled={loading || refreshing}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`size-4 ${refreshing || loading ? 'animate-spin' : ''}`}
              />
              {t('orderTracking.refreshStatus')}
            </button>
          )}
        </div>

        {loading && (
          <div
            className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-8"
            aria-live="polite"
          >
            <div className="flex items-center gap-3 text-sm text-zinc-400">
              <RefreshCw className="size-4 animate-spin text-emerald-300" />
              {t('orderTracking.loading')}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" />
              <div className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" />
              <div className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" />
            </div>
          </div>
        )}

        {error && !loading && (
          <section
            role="alert"
            className="mt-8 rounded-3xl border border-rose-400/20 bg-rose-400/[0.04] p-6 sm:p-8"
          >
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-rose-300" />
              <div>
                <h2 className="font-semibold text-rose-100">
                  {t('orderTracking.loadError')}
                </h2>
                <p className="mt-2 text-sm leading-6 text-rose-100/75">
                  {error}
                </p>
                {token && (
                  <button
                    type="button"
                    onClick={() => void loadOrder(token)}
                    className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-300/20 px-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/10"
                  >
                    <RefreshCw className="size-4" />
                    {t('orderTracking.retry')}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {order && !loading && (
          <div className="mt-8 space-y-5">
            <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
              <div className="border-b border-white/10 p-5 sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      {t('orderTracking.reference')}
                    </p>
                    <p className="mt-2 font-mono text-lg font-semibold tracking-wide text-white">
                      #{order.reference}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-sm text-zinc-400">
                      <Store className="size-4 text-emerald-300" />
                      {order.shopName}
                    </div>
                  </div>
                  <div
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-2 text-sm font-semibold ${
                      cancelled
                        ? 'border-rose-300/20 bg-rose-300/[0.06] text-rose-200'
                        : order.status === 'completed' ||
                            order.status === 'delivered'
                          ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200'
                          : 'border-sky-300/20 bg-sky-300/[0.06] text-sky-200'
                    }`}
                  >
                    {cancelled ? (
                      <CircleAlert className="size-4" />
                    ) : (
                      <PackageCheck className="size-4" />
                    )}
                    {statusLabel(order.status, t)}
                  </div>
                </div>
                <p className="mt-5 max-w-2xl text-sm leading-6 text-zinc-400">
                  {statusDescription(order.status, t)}
                </p>
              </div>

              {!cancelled && (
                <div className="p-5 sm:p-7">
                  <h2 className="text-sm font-semibold text-white">
                    {t('orderTracking.progress')}
                  </h2>
                  <ol className="mt-5 space-y-3">
                    {steps.map((step, index) => {
                      const isDone = index <= activeStep;
                      const isCurrent = step === order.status;
                      return (
                        <li
                          key={step}
                          className={`flex items-center gap-3 rounded-xl border p-3 ${
                            isCurrent
                              ? 'border-emerald-300/20 bg-emerald-300/[0.04]'
                              : 'border-white/[0.06] bg-white/[0.015]'
                          }`}
                          aria-current={isCurrent ? 'step' : undefined}
                        >
                          <span
                            className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${
                              isDone
                                ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200'
                                : 'border-white/10 bg-white/[0.02] text-zinc-600'
                            }`}
                          >
                            {isDone ? (
                              <CheckCircle2 className="size-4" />
                            ) : (
                              <Clock3 className="size-4" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-medium ${
                                isCurrent
                                  ? 'text-emerald-200'
                                  : isDone
                                    ? 'text-zinc-200'
                                    : 'text-zinc-600'
                              }`}
                            >
                              {statusLabel(step, t)}
                            </p>
                            {isCurrent && (
                              <p className="mt-1 text-xs text-zinc-500">
                                {t('orderTracking.currentStatus')}
                              </p>
                            )}
                          </div>
                          {isCurrent && (
                            <span className="shrink-0 rounded-full bg-emerald-300/10 px-2 py-1 text-[10px] font-semibold text-emerald-200">
                              {t('orderTracking.current')}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </section>

            <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
              <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">
                    {t('orderTracking.history')}
                  </h2>
                  <span className="text-xs text-zinc-600">
                    {order.history.length}{' '}
                    {order.history.length === 1
                      ? t('orderTracking.historyCountOne')
                      : t('orderTracking.historyCountMany')}
                  </span>
                </div>

                {order.history.length === 0 ? (
                  <p className="mt-5 rounded-2xl border border-white/10 p-4 text-sm leading-6 text-zinc-500">
                    {t('orderTracking.noHistory')}
                  </p>
                ) : (
                  <ol className="mt-6 space-y-0">
                    {order.history.map((event, index) => {
                      const isLatest = index === order.history.length - 1;
                      return (
                        <li
                          key={event.id}
                          className="relative flex gap-4 pb-6 last:pb-0"
                        >
                          <div className="relative flex w-5 shrink-0 justify-center">
                            {index < order.history.length - 1 && (
                              <span className="absolute bottom-0 top-5 w-px bg-white/10" />
                            )}
                            <span
                              className={`relative z-10 mt-0.5 flex size-5 items-center justify-center rounded-full ${
                                isLatest
                                  ? 'bg-emerald-300 text-zinc-950'
                                  : 'border border-white/15 bg-zinc-900 text-zinc-500'
                              }`}
                            >
                              <CheckCircle2 className="size-3" />
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-zinc-100">
                              {statusLabel(event.status, t)}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-zinc-400">
                              {event.message ||
                                statusDescription(event.status, t)}
                            </p>
                            <time
                              dateTime={event.createdAt}
                              className="mt-2 block text-xs text-zinc-600"
                            >
                              {dateTime(event.createdAt, formatLocale)}
                            </time>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>

              <div className="space-y-5">
                <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
                  <div className="flex items-center gap-2">
                    {order.fulfillmentMethod === 'delivery' ? (
                      <Truck className="size-4 text-emerald-300" />
                    ) : (
                      <Store className="size-4 text-emerald-300" />
                    )}
                    <h2 className="text-base font-semibold">
                      {order.fulfillmentMethod === 'delivery'
                        ? t('orderTracking.deliveryDetails')
                        : t('orderTracking.pickup')}
                    </h2>
                  </div>
                  {order.fulfillmentMethod === 'delivery' ? (
                    order.shipping?.address ? (
                      <div className="mt-4 flex gap-3 text-sm leading-6 text-zinc-300">
                        <MapPin className="mt-1 size-4 shrink-0 text-zinc-500" />
                        <div>
                          <p>{order.shipping.address}</p>
                          <p>
                            {[order.shipping.postalCode, order.shipping.city]
                              .filter(Boolean)
                              .join(' ')}
                          </p>
                          {countryLabel(order.shipping.country) && (
                            <p>
                              {countryLabel(
                                order.shipping.country,
                                formatLocale,
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm leading-6 text-zinc-500">
                        {t('orderTracking.shopHandlesDelivery')}
                      </p>
                    )
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-zinc-400">
                      {t('orderTracking.pickupPending')}
                    </p>
                  )}
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
                  <h2 className="text-base font-semibold">
                    {t('orderTracking.summary')}
                  </h2>
                  <div className="mt-4 space-y-3">
                    {order.items.map((item, index) => (
                      <div
                        key={item.name + '-' + index}
                        className="flex items-start justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="break-words text-zinc-200">
                            {item.name}
                          </p>
                          <p className="mt-1 text-xs text-zinc-600">
                            {t('orderTracking.quantity', {
                              quantity: item.quantity,
                            })}
                          </p>
                        </div>
                        <p className="shrink-0 font-medium tabular-nums text-zinc-200">
                          {money(item.total, formatLocale)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                    <span className="text-sm text-zinc-500">
                      {t('orderTracking.total')}
                    </span>
                    <span className="text-xl font-semibold tabular-nums text-white">
                      {money(order.total, formatLocale)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-zinc-600">
                    {t('orderTracking.fulfillmentNotice')}
                  </p>
                </section>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
              <p>
                {t('orderTracking.createdAt', {
                  date: dateTime(order.createdAt, formatLocale),
                })}
              </p>
              <p>
                {lastUpdated
                  ? t('orderTracking.lastChecked', {
                      date: dateTime(lastUpdated, formatLocale),
                    })
                  : t('orderTracking.lastChanged', {
                      date: dateTime(order.updatedAt, formatLocale),
                    })}
              </p>
            </div>
            <p className="text-xs leading-5 text-zinc-700">
              {t('orderTracking.privacyNotice')}
            </p>
          </div>
        )}

        {!loading && !error && !order && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-6 text-sm text-zinc-500">
            {t('orderTracking.unavailable')}
          </div>
        )}

        <footer className="mt-12 border-t border-white/10 pt-5 text-xs leading-5 text-zinc-700">
          SILENTRA · You think. We do.
        </footer>
      </div>
    </main>
  );
}
