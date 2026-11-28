'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  FileSpreadsheet,
  Lock,
  RefreshCw,
  Scissors,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { FeaturePlanBadge } from '@/components/billing/FeaturePlanBadge';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { PeriodReportsHistory } from '@/components/dashboard/periodic-business-reports';

type Analytics = {
  plan: 'free' | 'pro' | 'enterprise';
  period: {
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
  };
  overview: {
    revenue: number;
    previousRevenue: number;
    revenueChangePercent: number | null;
    appointments: number;
    completedAppointments: number;
    scheduledAppointments: number;
    cancelledAppointments: number;
    cancellationRate: number;
    newClients: number;
    totalClients: number;
    activeClientsInPeriod: number;
    serviceRevenue: number;
    productRevenue: number;
    rebookedClients: number;
    rebookingRate: number | null;
  };
  paymentMethods: {
    name: string;
    transactions: number;
    revenue: number;
  }[];
  revenueByDay: { date: string; value: number }[];
  topServices: { name: string; count: number; revenue: number }[];
  professionals: { name: string; appointments: number; revenue: number }[];
  clientAgeGroups: { label: string; count: number }[];
  enterprise?: {
    posRevenue: number;
    posTransactions: number;
    combinedRevenue: number;
    locations: { locationId: string; transactions: number; revenue: number }[];
  };
};

type Preset = '7' | '30' | '90' | 'year' | 'custom';
type RevenuePoint = {
  key: string;
  label: string;
  fullLabel: string;
  value: number;
};

const GLASS_PANEL = 'border-border/60 bg-card/60 shadow-[0_20px_70px_-46px_rgba(16,185,129,0.42)] backdrop-blur-2xl';

function copy(locale: string, pt: string, en: string) {
  return locale === 'en' ? en : pt;
}

function money(value: number, locale: string) {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function dateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function shiftDate(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function humanDate(
  value: string,
  locale: string,
  style: 'short' | 'long' = 'short',
) {
  const date = new Date(value.slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'pt-PT', {
    day: '2-digit',
    month: style === 'long' ? 'long' : 'short',
    ...(style === 'long' ? { year: 'numeric' as const } : {}),
  }).format(date);
}

function dateDifference(from: string, to: string) {
  const start = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

function bucketDate(date: Date, mode: 'day' | 'week' | 'month') {
  const value = new Date(date);
  if (mode === 'month') {
    value.setDate(1);
  } else if (mode === 'week') {
    value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  }
  return dateInput(value);
}

function buildRevenueSeries(
  rows: Analytics['revenueByDay'],
  from: string,
  to: string,
  locale: string,
): RevenuePoint[] {
  if (!from || !to || from > to) return [];
  const days = dateDifference(from, to);
  const mode: 'day' | 'week' | 'month' =
    days > 120 ? 'month' : days > 42 ? 'week' : 'day';
  const totals = new Map<string, number>();
  const cursor = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');

  while (cursor <= end) {
    const key = bucketDate(cursor, mode);
    if (!totals.has(key)) totals.set(key, 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  rows.forEach((row) => {
    const date = new Date(row.date + 'T00:00:00');
    const key = bucketDate(date, mode);
    totals.set(key, (totals.get(key) ?? 0) + row.value);
  });

  return Array.from(totals.entries()).map(([key, value]) => {
    const date = new Date(key + 'T00:00:00');
    const labelOptions: Intl.DateTimeFormatOptions =
      mode === 'month'
        ? { month: 'short' }
        : mode === 'week'
          ? { day: '2-digit', month: 'short' }
          : { day: '2-digit', month: 'short' };
    const label = new Intl.DateTimeFormat(
      locale === 'en' ? 'en-GB' : 'pt-PT',
      labelOptions,
    ).format(date);
    return {
      key,
      label,
      fullLabel: humanDate(key, locale, 'long'),
      value: Math.round(value * 100) / 100,
    };
  });
}

function paymentLabel(value: string, locale: string) {
  const normalized = value.toLowerCase();
  if (normalized === 'cash' || normalized === 'dinheiro') {
    return copy(locale, 'Dinheiro', 'Cash');
  }
  if (
    normalized === 'card' ||
    normalized === 'cartão' ||
    normalized === 'cartao'
  ) {
    return copy(locale, 'Cartão', 'Card');
  }
  if (normalized === 'mbway' || normalized === 'mb way') return 'MB WAY';
  if (normalized === 'transfer' || normalized === 'bank_transfer') {
    return copy(locale, 'Transferência', 'Bank transfer');
  }
  if (normalized === 'unspecified') {
    return copy(locale, 'Não especificado', 'Unspecified');
  }
  return value;
}

function ageLabel(value: string, locale: string) {
  if (locale !== 'en') return value;
  const labels: Record<string, string> = {
    'Menos de 18': 'Under 18',
    '18–24': '18–24',
    '25–34': '25–34',
    '35–44': '35–44',
    '45–54': '45–54',
    '55–64': '55–64',
    '65+': '65+',
  };
  return labels[value] ?? value;
}

function downloadUrl(
  type: 'appointments' | 'clients' | 'pos',
  from: string,
  to: string,
  format: 'html' | 'excel',
) {
  const endpoint =
    format === 'excel'
      ? '/api/analytics/export-excel'
      : '/api/analytics/export';
  return (
    endpoint +
    '?type=' +
    type +
    '&from=' +
    encodeURIComponent(from) +
    '&to=' +
    encodeURIComponent(to)
  );
}

export default function AnalyticsPage() {
  const { hasFeature, plan, loading: accessLoading } = useFeatureAccess();
  const { t, locale } = useLanguage();
  const allowed = hasFeature('advanced_analytics');
  const today = dateInput(new Date());
  const initialFrom = dateInput(shiftDate(new Date(), -29));

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(today);
  const [draftFrom, setDraftFrom] = useState(initialFrom);
  const [draftTo, setDraftTo] = useState(today);
  const [preset, setPreset] = useState<Preset>('30');
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const requestControllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!allowed) return;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setLoading(true);
    setLoadError(false);
    try {
      const response = await fetch(
        '/api/analytics?from=' +
          encodeURIComponent(from) +
          '&to=' +
          encodeURIComponent(to),
        { cache: 'no-store', signal: controller.signal },
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? t('analyticsPage.loadError'));
      }
      if (!controller.signal.aborted) setData(json as Analytics);
    } catch (error) {
      if (controller.signal.aborted) return;
      setLoadError(true);
      toast.error(
        error instanceof Error
          ? error.message
          : t('analyticsPage.loadGenericError'),
      );
    } finally {
      if (requestControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, [allowed, from, to, t]);

  useEffect(() => {
    void load();
    return () => {
      const controller = requestControllerRef.current;
      requestControllerRef.current = null;
      controller?.abort();
    };
  }, [load]);

  const rangeIsValid =
    Boolean(draftFrom) &&
    Boolean(draftTo) &&
    draftFrom <= draftTo &&
    dateDifference(draftFrom, draftTo) <= 366;

  const applyPreset = (nextPreset: Exclude<Preset, 'custom'>) => {
    const end = new Date();
    const start =
      nextPreset === 'year'
        ? new Date(end.getFullYear(), 0, 1)
        : shiftDate(end, 1 - Number(nextPreset));
    const nextFrom = dateInput(start);
    const nextTo = dateInput(end);
    setPreset(nextPreset);
    setDraftFrom(nextFrom);
    setDraftTo(nextTo);
    setFrom(nextFrom);
    setTo(nextTo);
  };

  const applyCustomRange = () => {
    if (!rangeIsValid) return;
    setPreset('custom');
    if (from === draftFrom && to === draftTo) {
      void load();
      return;
    }
    setFrom(draftFrom);
    setTo(draftTo);
  };

  const analytics = data?.overview;
  const averageTicket =
    analytics && analytics.completedAppointments > 0
      ? analytics.revenue / analytics.completedAppointments
      : 0;
  const completionRate =
    analytics && analytics.appointments > 0
      ? (analytics.completedAppointments / analytics.appointments) * 100
      : 0;
  const revenuePerClient =
    analytics && analytics.activeClientsInPeriod > 0
      ? analytics.revenue / analytics.activeClientsInPeriod
      : 0;
  const cancellationRate = analytics?.cancellationRate ?? 0;
  const dailyAverage =
    analytics && dateDifference(from, to) > 0
      ? analytics.appointments / dateDifference(from, to)
      : 0;

  const revenueSeries = useMemo(
    () => (data ? buildRevenueSeries(data.revenueByDay, from, to, locale) : []),
    [data, from, to, locale],
  );
  const maxRevenue = Math.max(1, ...revenueSeries.map((item) => item.value));
  const maxServiceRevenue = Math.max(
    1,
    ...(data?.topServices.map((item) => item.revenue) ?? []),
  );
  const maxProfessionalRevenue = Math.max(
    1,
    ...(data?.professionals.map((item) => item.revenue) ?? []),
  );
  const maxAgeGroup = Math.max(
    1,
    ...(data?.clientAgeGroups.map((item) => item.count) ?? []),
  );
  const maxPaymentRevenue = Math.max(
    1,
    ...(data?.paymentMethods.map((item) => item.revenue) ?? []),
  );

  const insights = useMemo(() => {
    if (!data)
      return [] as { title: string; description: string; positive?: boolean }[];
    const items: { title: string; description: string; positive?: boolean }[] =
      [];
    const revenueChange = data.overview.revenueChangePercent;
    if (revenueChange !== null) {
      items.push({
        title:
          revenueChange >= 0
            ? copy(locale, 'Faturação em crescimento', 'Revenue is growing')
            : copy(
                locale,
                'Faturação abaixo do período anterior',
                'Revenue is below the previous period',
              ),
        description: t(
          revenueChange >= 0
            ? 'analyticsPage.revenueUp'
            : 'analyticsPage.revenueDown',
          {
            percent: Math.abs(revenueChange).toFixed(1),
          },
        ),
        positive: revenueChange >= 0,
      });
    }
    if (data.overview.rebookingRate !== null) {
      items.push({
        title: copy(locale, 'Regresso de clientes', 'Customer rebooking'),
        description: copy(
          locale,
          data.overview.rebookedClients +
            ' de ' +
            data.overview.activeClientsInPeriod +
            ' clientes com visita concluída já têm uma nova marcação futura (' +
            data.overview.rebookingRate.toFixed(1) +
            '%).',
          data.overview.rebookedClients +
            ' of ' +
            data.overview.activeClientsInPeriod +
            ' customers with a completed visit already have a future booking (' +
            data.overview.rebookingRate.toFixed(1) +
            '%).',
        ),
        positive: undefined,
      });
    }
    if (data.topServices[0]) {
      items.push({
        title: copy(
          locale,
          'Serviço com maior faturação',
          'Top revenue service',
        ),
        description:
          data.topServices[0].name +
          ' · ' +
          money(data.topServices[0].revenue, locale) +
          ' · ' +
          t('analyticsPage.bookingCount', { count: data.topServices[0].count }),
      });
    }
    if (data.overview.cancelledAppointments > 0) {
      items.push({
        title: copy(locale, 'Marcações canceladas', 'Cancelled bookings'),
        description: copy(
          locale,
          data.overview.cancelledAppointments +
            ' marcações foram canceladas (' +
            data.overview.cancellationRate.toFixed(1) +
            '% do total no período).',
          data.overview.cancelledAppointments +
            ' bookings were cancelled (' +
            data.overview.cancellationRate.toFixed(1) +
            '% of the period total).',
        ),
        positive: undefined,
      });
    }
    if (data.professionals[0]) {
      items.push({
        title: copy(
          locale,
          'Maior faturação por barbeiro',
          'Top barber by revenue',
        ),
        description:
          data.professionals[0].name +
          ' · ' +
          money(data.professionals[0].revenue, locale) +
          ' · ' +
          t('analyticsPage.completedBookings', {
            count: data.professionals[0].appointments,
          }),
      });
    }
    return items.slice(0, 4);
  }, [data, locale, t]);

  if (accessLoading) {
    return (
      <main className="relative isolate min-w-0 space-y-5 overflow-hidden px-3 py-5 sm:px-6 lg:px-8">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="relative isolate min-w-0 overflow-x-clip px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-24 top-8 size-72 rounded-full bg-primary/[0.12] blur-[110px]" />
          <div className="absolute right-[-7rem] top-[28rem] size-80 rounded-full bg-violet-500/[0.06] blur-[120px]" />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl space-y-5 sm:space-y-6">
          <header className="relative isolate overflow-hidden rounded-[1.75rem] border border-primary/20 bg-gradient-to-br from-card/95 via-card/75 to-primary/[0.09] p-5 shadow-[0_24px_90px_-48px_rgba(16,185,129,0.5)] backdrop-blur-2xl sm:rounded-[2rem] sm:p-7">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.08] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              <BarChart3 className="size-3.5" aria-hidden="true" />
              {t('analyticsPage.eyebrow')}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{t('analyticsPage.title')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t('analyticsPage.description')}</p>
          </header>
          <PeriodReportsHistory />
          <div className="mx-auto max-w-xl">
            <Card className={cn(GLASS_PANEL, 'relative isolate overflow-hidden border-primary/15')}>
              <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-primary/[0.12] blur-3xl" />
              <CardContent className="relative z-10 flex flex-col items-center gap-5 py-12 text-center sm:py-16">
                <span className="flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/20 to-transparent text-primary shadow-sm">
                  <Lock className="size-5" />
                </span>
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {t('analyticsPage.advancedTitle')}
                </h2>
                <FeaturePlanBadge feature="advanced_analytics" />
                <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                  {t('analyticsPage.upgradeDescription')}
                </p>
                <Button asChild className="min-h-11 w-full rounded-xl bg-gradient-to-r from-primary to-emerald-500 font-semibold text-primary-foreground shadow-lg shadow-primary/20 sm:w-auto">
                  <Link href="/dashboard/billing">
                    {t('analyticsPage.upgrade')}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  const noBookings = Boolean(
    data && data.overview.appointments === 0 && data.overview.revenue === 0,
  );

  return (
    <main className="relative isolate min-w-0 overflow-x-clip px-3 py-4 text-foreground sm:px-5 sm:py-6 lg:px-8 lg:py-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-28 top-10 size-80 rounded-full bg-primary/[0.12] blur-[110px]" />
        <div className="absolute right-[-8rem] top-[34rem] size-96 rounded-full bg-cyan-500/[0.07] blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 size-96 rounded-full bg-violet-500/[0.05] blur-[140px]" />
      </div>
      <div className="relative z-10 mx-auto max-w-7xl space-y-5 sm:space-y-6">
        <header className="relative isolate flex flex-col gap-4 overflow-hidden rounded-[1.75rem] border border-primary/20 bg-gradient-to-br from-card/95 via-card/75 to-primary/[0.09] p-5 shadow-[0_24px_90px_-48px_rgba(16,185,129,0.5)] backdrop-blur-2xl sm:rounded-[2rem] sm:p-7 lg:flex-row lg:items-end lg:justify-between lg:p-8">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.08] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary shadow-sm shadow-primary/10">
              <BarChart3 className="size-3.5" aria-hidden="true" />
              {t('analyticsPage.eyebrow')}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl lg:text-[2.65rem]">
              {t('analyticsPage.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
              {t('analyticsPage.description')}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
            className="min-h-11 w-full shrink-0 gap-2 sm:w-auto"
          >
            <RefreshCw
              className={cn('size-4', loading && 'animate-spin')}
              aria-hidden="true"
            />
            {t('analyticsPage.update')}
          </Button>
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-primary/[0.12] blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute bottom-[-5rem] right-1/3 size-40 rounded-full bg-cyan-400/[0.08] blur-3xl" />
        </header>

        <section
          aria-label={copy(locale, 'Filtros dos relatórios', 'Report filters')}
          className="relative isolate overflow-hidden rounded-[1.5rem] border border-border/60 bg-card/55 p-4 shadow-[0_18px_70px_-48px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:rounded-[1.75rem] sm:p-5"
        >
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-primary/[0.09] blur-3xl" />
          <div className="relative z-10 flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CalendarDays
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                {copy(locale, 'Período de análise', 'Reporting period')}
              </div>
              <span className="text-xs text-muted-foreground">
                {data
                  ? humanDate(data.period.from, locale, 'long') +
                    ' — ' +
                    humanDate(data.period.to, locale, 'long')
                  : humanDate(from, locale, 'long') +
                    ' — ' +
                    humanDate(to, locale, 'long')}
              </span>
            </div>
            <div
              role="group"
              aria-label={copy(locale, 'Períodos rápidos', 'Quick date ranges')}
              className="flex min-w-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {(
                [
                  ['7', copy(locale, '7 dias', '7 days')],
                  ['30', copy(locale, '30 dias', '30 days')],
                  ['90', copy(locale, '90 dias', '90 days')],
                  ['year', copy(locale, 'Este ano', 'Year to date')],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={preset === value}
                  onClick={() => applyPreset(value)}
                  className={cn(
                    'min-h-10 shrink-0 rounded-xl border px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    preset === value
                      ? 'border-primary/40 bg-gradient-to-r from-primary to-emerald-500 text-primary-foreground shadow-lg shadow-primary/20'
                      : 'border-border/70 bg-background/45 text-muted-foreground backdrop-blur-md hover:border-primary/25 hover:bg-primary/[0.06] hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
              {preset === 'custom' ? (
                <span className="inline-flex min-h-10 shrink-0 items-center rounded-xl border border-primary/25 bg-primary/10 px-3.5 text-xs font-semibold text-primary">
                  {copy(locale, 'Personalizado', 'Custom')}
                </span>
              ) : null}
            </div>
            <div className="grid min-w-0 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="min-w-0">
                <label
                  htmlFor="analytics-from"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t('analyticsPage.from')}
                </label>
                <Input
                  id="analytics-from"
                  type="date"
                  value={draftFrom}
                  max={draftTo || today}
                  onChange={(event) => {
                    setDraftFrom(event.target.value);
                    setPreset('custom');
                  }}
                  className="mt-1 min-h-11 w-full rounded-xl border-border/60 bg-background/45 text-base shadow-inner shadow-black/[0.02] backdrop-blur-md focus-visible:ring-primary/30"
                />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="analytics-to"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t('analyticsPage.to')}
                </label>
                <Input
                  id="analytics-to"
                  type="date"
                  value={draftTo}
                  min={draftFrom}
                  max={today}
                  onChange={(event) => {
                    setDraftTo(event.target.value);
                    setPreset('custom');
                  }}
                  className="mt-1 min-h-11 w-full rounded-xl border-border/60 bg-background/45 text-base shadow-inner shadow-black/[0.02] backdrop-blur-md focus-visible:ring-primary/30"
                />
              </div>
              <Button
                type="button"
                onClick={applyCustomRange}
                disabled={!rangeIsValid || loading}
                className="min-h-11 w-full gap-2 sm:w-auto sm:px-5"
              >
                <Activity className="size-4" aria-hidden="true" />
                {t('analyticsPage.update')}
              </Button>
            </div>
            {!rangeIsValid ? (
              <p role="alert" className="text-xs text-destructive">
                {copy(
                  locale,
                  'Escolhe um intervalo válido, com um máximo de 366 dias.',
                  'Choose a valid date range of up to 366 days.',
                )}
              </p>
            ) : null}
          </div>
        </section>

        <PeriodReportsHistory />

        {loading && !data ? (
          <div role="status" aria-live="polite" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-72 rounded-2xl" />
            <span className="sr-only">{t('analyticsPage.updating')}</span>
          </div>
        ) : loadError && !data ? (
          <Card className={GLASS_PANEL}>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <XCircle className="size-8 text-destructive" aria-hidden="true" />
              <p className="font-semibold">{t('analyticsPage.loadError')}</p>
              <p className="text-sm text-muted-foreground">
                {t('analyticsPage.loadGenericError')}
              </p>
              <Button
                type="button"
                onClick={() => void load()}
                className="min-h-11"
              >
                <RefreshCw className="mr-2 size-4" aria-hidden="true" />
                {copy(locale, 'Tentar novamente', 'Try again')}
              </Button>
            </CardContent>
          </Card>
        ) : data ? (
          <>
            <section
              aria-label={copy(locale, 'Indicadores principais', 'Key metrics')}
              className={cn(
                'grid grid-cols-2 gap-3 xl:grid-cols-5',
                loading && 'opacity-60',
              )}
            >
              <Metric
                featured
                title={t('analyticsPage.revenue')}
                value={money(data.overview.revenue, locale)}
                detail={
                  data.overview.revenueChangePercent === null
                    ? t('analyticsPage.noComparison')
                    : t('analyticsPage.vsPrevious', {
                        value:
                          (data.overview.revenueChangePercent >= 0 ? '+' : '') +
                          data.overview.revenueChangePercent.toFixed(1),
                      })
                }
                icon={<Wallet className="size-4" aria-hidden="true" />}
                tone={
                  data.overview.revenueChangePercent === null
                    ? 'neutral'
                    : data.overview.revenueChangePercent >= 0
                      ? 'positive'
                      : 'negative'
                }
              />
              <Metric
                title={t('analyticsPage.averageTicket')}
                value={money(averageTicket, locale)}
                detail={t('analyticsPage.perCompletedBooking')}
                icon={<Target className="size-4" aria-hidden="true" />}
              />
              <Metric
                title={copy(locale, 'Concluídas', 'Completed')}
                value={String(data.overview.completedAppointments)}
                detail={
                  data.overview.appointments > 0
                    ? data.overview.completedAppointments +
                      ' / ' +
                      data.overview.appointments +
                      ' ' +
                      copy(locale, 'marcações no período', 'bookings in period')
                    : copy(
                        locale,
                        'Sem marcações no período',
                        'No bookings in this period',
                      )
                }
                icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
              />
              <Metric
                title={copy(locale, 'Reagendamento', 'Rebooking')}
                value={
                  data.overview.rebookingRate === null
                    ? '—'
                    : data.overview.rebookingRate.toFixed(1) + '%'
                }
                detail={
                  data.overview.rebookingRate === null
                    ? copy(
                        locale,
                        'Sem clientes identificados suficientes',
                        'Not enough identified customers',
                      )
                    : data.overview.rebookedClients +
                      ' / ' +
                      data.overview.activeClientsInPeriod +
                      ' ' +
                      copy(locale, 'clientes', 'customers')
                }
                icon={<CalendarDays className="size-4" aria-hidden="true" />}
              />
              <Metric
                title={t('analyticsPage.cancellationRate')}
                value={
                  data.overview.appointments > 0
                    ? data.overview.cancellationRate.toFixed(1) + '%'
                    : '—'
                }
                detail={t('analyticsPage.cancellations', {
                  count: data.overview.cancelledAppointments,
                })}
                icon={<XCircle className="size-4" aria-hidden="true" />}
                tone="neutral"
              />
            </section>

            <section className="grid min-w-0 gap-4 xl:grid-cols-[1.55fr_1fr]">
              <Card className={cn(GLASS_PANEL, 'min-w-0 overflow-hidden')}>
                <CardHeader className="border-b border-border/70 pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <TrendingUp
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                        {t('analyticsPage.revenueOverTime')}
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy(
                          locale,
                          'Evolução da faturação concluída',
                          'Completed revenue over time',
                        )}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {money(data.overview.revenue, locale)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="min-w-0 p-3.5 sm:p-5">
                  {data.overview.revenue <= 0 || revenueSeries.length === 0 ? (
                    <Empty />
                  ) : (
                    <div
                      role="img"
                      aria-label={copy(
                        locale,
                        'Gráfico da faturação ao longo do período selecionado',
                        'Revenue chart across the selected period',
                      )}
                    >
                      <div className="flex h-40 min-w-0 items-end gap-1 sm:h-52 sm:gap-2">
                        {revenueSeries.map((item) => (
                          <div
                            key={item.key}
                            className="group flex h-full min-w-0 flex-1 flex-col justify-end"
                            title={
                              item.fullLabel + ' · ' + money(item.value, locale)
                            }
                          >
                            <div
                              className={cn(
                                'w-full rounded-t-md transition-[height,opacity] duration-300',
                                item.value > 0
                                  ? 'bg-gradient-to-t from-primary/70 via-primary to-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.18)] group-hover:brightness-110'
                                  : 'bg-muted/80',
                              )}
                              style={{
                                height:
                                  item.value > 0
                                    ? Math.max(
                                        (item.value / maxRevenue) * 100,
                                        3,
                                      ) + '%'
                                    : '2px',
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-muted-foreground sm:text-xs">
                        <span>{revenueSeries[0]?.label}</span>
                        {revenueSeries.length > 2 ? (
                          <span>
                            {
                              revenueSeries[
                                Math.floor(revenueSeries.length / 2)
                              ]?.label
                            }
                          </span>
                        ) : null}
                        <span>
                          {revenueSeries[revenueSeries.length - 1]?.label}
                        </span>
                      </div>
                      <ul className="sr-only">
                        {revenueSeries.map((item) => (
                          <li key={item.key}>
                            {item.fullLabel}: {money(item.value, locale)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className={cn(GLASS_PANEL, 'min-w-0')}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {copy(
                      locale,
                      'Composição da faturação',
                      'Revenue breakdown',
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {copy(
                      locale,
                      'Serviços concluídos e produtos registados',
                      'Completed services and recorded products',
                    )}
                  </p>
                </CardHeader>
                <CardContent className="space-y-5">
                  <RevenueMix
                    label={copy(locale, 'Serviços', 'Services')}
                    value={data.overview.serviceRevenue}
                    total={data.overview.revenue}
                    locale={locale}
                    accent="bg-primary"
                  />
                  <RevenueMix
                    label={copy(locale, 'Produtos', 'Products')}
                    value={data.overview.productRevenue}
                    total={data.overview.revenue}
                    locale={locale}
                    accent="bg-primary/75"
                  />
                  <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.10] via-primary/[0.035] to-transparent px-4 py-3.5 shadow-inner shadow-primary/[0.04]">
                    <p className="text-xs text-muted-foreground">
                      {copy(locale, 'Total registado', 'Recorded total')}
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {money(data.overview.revenue, locale)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="grid min-w-0 gap-4 xl:grid-cols-[1fr_1.3fr]">
              <Card className={cn(GLASS_PANEL, 'min-w-0')}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    {t('analyticsPage.operationalSummary')}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {t('analyticsPage.operationQuality')}
                  </p>
                </CardHeader>
                <CardContent className="space-y-1">
                  <Stat
                    label={t('analyticsPage.bookings')}
                    value={data.overview.appointments}
                  />
                  <Stat
                    label={t('analyticsPage.completed')}
                    value={data.overview.completedAppointments}
                  />
                  <Stat
                    label={t('analyticsPage.scheduled')}
                    value={data.overview.scheduledAppointments}
                  />
                  <Stat
                    label={t('analyticsPage.cancelled')}
                    value={data.overview.cancelledAppointments}
                  />
                  <Stat
                    label={copy(
                      locale,
                      'Média de marcações por dia',
                      'Average bookings per day',
                    )}
                    value={dailyAverage.toFixed(1)}
                  />
                  <div className="pt-3">
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">
                        {t('analyticsPage.completionRate')}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {completionRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted/70 ring-1 ring-border/40">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-300 shadow-[0_0_16px_rgba(16,185,129,0.35)] transition-[width] duration-500"
                        style={{
                          width:
                            Math.min(100, Math.max(0, completionRate)) + '%',
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(GLASS_PANEL, 'min-w-0')}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="size-4 text-primary" aria-hidden="true" />
                    {t('analyticsPage.customerHealth')}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {copy(
                      locale,
                      'Clientes com visitas concluídas e respetivo regresso',
                      'Customers with completed visits and their return activity',
                    )}
                  </p>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <MetricMini
                    label={t('analyticsPage.activeClients')}
                    value={String(data.overview.activeClientsInPeriod)}
                    detail={copy(
                      locale,
                      'Clientes únicos com marcação concluída',
                      'Unique customers with completed visits',
                    )}
                  />
                  <MetricMini
                    label={copy(
                      locale,
                      'Novos clientes registados',
                      'New customer records',
                    )}
                    value={String(data.overview.newClients)}
                    detail={copy(
                      locale,
                      'Registos criados no período',
                      'Records created in this period',
                    )}
                  />
                  <MetricMini
                    label={copy(
                      locale,
                      'Já têm nova marcação',
                      'Already rebooked',
                    )}
                    value={String(data.overview.rebookedClients)}
                    detail={copy(
                      locale,
                      'Marcações futuras pendentes ou confirmadas',
                      'Future pending or confirmed bookings',
                    )}
                  />
                  <MetricMini
                    label={t('analyticsPage.totalClients')}
                    value={String(data.overview.totalClients)}
                    detail={copy(
                      locale,
                      'Base total registada',
                      'Total registered customer base',
                    )}
                  />
                  <MetricMini
                    label={t('analyticsPage.revenuePerActiveClient')}
                    value={
                      data.overview.activeClientsInPeriod > 0
                        ? money(revenuePerClient, locale)
                        : '—'
                    }
                    detail={copy(
                      locale,
                      'Faturação por cliente identificado',
                      'Revenue per identified customer',
                    )}
                  />
                </CardContent>
              </Card>
            </section>

            <section className="grid min-w-0 gap-4 xl:grid-cols-2">
              <Card className={cn(GLASS_PANEL, 'min-w-0')}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Scissors
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    {t('analyticsPage.bestSellingServices')}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {copy(
                      locale,
                      'Ordenados pela faturação dos serviços, sem misturar vendas de produtos.',
                      'Ranked by service revenue, excluding product sales.',
                    )}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.topServices.length ? (
                    data.topServices.map((item, index) => (
                      <div key={item.name} className="min-w-0">
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-semibold text-muted-foreground">
                              {index + 1}
                            </span>
                            <span className="truncate font-medium">
                              {item.name}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums">
                            {money(item.revenue, locale)}
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-muted/70 ring-1 ring-border/40">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.25)] transition-[width] duration-500"
                            style={{
                              width:
                                Math.max(
                                  (item.revenue / maxServiceRevenue) * 100,
                                  2,
                                ) + '%',
                            }}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {t('analyticsPage.bookingCount', {
                            count: item.count,
                          })}
                          <span className="px-1.5 text-border">·</span>
                          {copy(locale, 'Média', 'Average') +
                            ' ' +
                            money(
                              item.count > 0 ? item.revenue / item.count : 0,
                              locale,
                            )}
                        </p>
                      </div>
                    ))
                  ) : (
                    <Empty />
                  )}
                </CardContent>
              </Card>

              <Card className={cn(GLASS_PANEL, 'min-w-0')}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="size-4 text-primary" aria-hidden="true" />
                    {t('analyticsPage.professionalPerformance')}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {t('analyticsPage.revenueAndBookings')}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.professionals.length ? (
                    data.professionals.map((item, index) => (
                      <div key={item.name} className="min-w-0">
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                              {item.name.trim().slice(0, 1).toUpperCase()}
                            </span>
                            <span className="truncate font-medium">
                              {item.name}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums">
                            {money(item.revenue, locale)}
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-muted/70 ring-1 ring-border/40">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary/80 to-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.2)] transition-[width] duration-500"
                            style={{
                              width:
                                Math.max(
                                  (item.revenue / maxProfessionalRevenue) * 100,
                                  2,
                                ) + '%',
                            }}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {t('analyticsPage.completedBookings', {
                            count: item.appointments,
                          })}
                          <span className="px-1.5 text-border">·</span>
                          {copy(
                            locale,
                            'Média por marcação',
                            'Average per booking',
                          ) +
                            ' ' +
                            money(
                              item.appointments > 0
                                ? item.revenue / item.appointments
                                : 0,
                              locale,
                            )}
                        </p>
                      </div>
                    ))
                  ) : (
                    <Empty />
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="grid min-w-0 gap-4 xl:grid-cols-2">
              <Card className={cn(GLASS_PANEL, 'min-w-0')}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    {copy(locale, 'Métodos de pagamento', 'Payment methods')}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {copy(
                      locale,
                      'Valor das marcações concluídas por método registado',
                      'Completed booking value by recorded payment method',
                    )}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.paymentMethods.length ? (
                    data.paymentMethods.map((item) => (
                      <div key={item.name} className="min-w-0">
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <span className="truncate font-medium">
                            {paymentLabel(item.name, locale)}
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums">
                            {money(item.revenue, locale)}
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-muted/70 ring-1 ring-border/40">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary/80 to-cyan-400"
                            style={{
                              width:
                                Math.max(
                                  (item.revenue / maxPaymentRevenue) * 100,
                                  2,
                                ) + '%',
                            }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.transactions +
                            ' ' +
                            copy(locale, 'marcações', 'bookings')}
                        </p>
                      </div>
                    ))
                  ) : (
                    <Empty />
                  )}
                </CardContent>
              </Card>

              {data.clientAgeGroups.length ? (
                <Card className={cn(GLASS_PANEL, 'min-w-0')}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {t('analyticsPage.ageProfile')}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {t('analyticsPage.knownAges')}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3.5">
                    {data.clientAgeGroups.map((item) => (
                      <div
                        key={item.label}
                        className="grid grid-cols-[5rem_1fr_2rem] items-center gap-2 text-xs"
                      >
                        <span className="text-muted-foreground">
                          {ageLabel(item.label, locale)}
                        </span>
                        <div className="h-2.5 overflow-hidden rounded-full bg-muted/70 ring-1 ring-border/40">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary/70 to-violet-400"
                            style={{
                              width:
                                Math.max((item.count / maxAgeGroup) * 100, 2) +
                                '%',
                            }}
                          />
                        </div>
                        <span className="text-right font-semibold tabular-nums">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </section>

            {insights.length ? (
              <section aria-labelledby="analytics-insights-title">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  <div>
                    <h2
                      id="analytics-insights-title"
                      className="text-base font-semibold"
                    >
                      {t('analyticsPage.automaticInsights')}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {t('analyticsPage.insightsDescription')}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {insights.map((item, index) => (
                    <div
                      key={item.title + String(index)}
                      className={cn(GLASS_PANEL, 'rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25')}
                    >
                      <div className="flex items-start gap-2">
                        {item.positive === undefined ? (
                          <Activity
                            className="mt-0.5 size-4 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                        ) : item.positive ? (
                          <ArrowUpRight
                            className="mt-0.5 size-4 shrink-0 text-emerald-500"
                            aria-hidden="true"
                          />
                        ) : (
                          <ArrowDownRight
                            className="mt-0.5 size-4 shrink-0 text-amber-500"
                            aria-hidden="true"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {data.enterprise ? (
              <section aria-labelledby="analytics-enterprise-title">
                <Card className={cn(GLASS_PANEL, 'min-w-0 overflow-hidden')}>
                  <CardHeader className="pb-3">
                    <CardTitle
                      id="analytics-enterprise-title"
                      className="text-base"
                    >
                      {t('analyticsPage.enterpriseFinance')}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {t('analyticsPage.posCombined')}
                    </p>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-3">
                    <MetricMini
                      label={t('analyticsPage.posRevenue')}
                      value={money(data.enterprise.posRevenue, locale)}
                    />
                    <MetricMini
                      label={t('analyticsPage.posTransactions')}
                      value={String(data.enterprise.posTransactions)}
                    />
                    <MetricMini
                      label={t('analyticsPage.combinedRevenue')}
                      value={money(data.enterprise.combinedRevenue, locale)}
                    />
                  </CardContent>
                </Card>
              </section>
            ) : null}

            {noBookings ? (
              <Card className={cn(GLASS_PANEL, 'border-dashed border-primary/20')}>
                <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                  <CalendarDays
                    className="size-8 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <h2 className="font-semibold">
                    {copy(
                      locale,
                      'Ainda não existem dados neste período',
                      'No data for this period yet',
                    )}
                  </h2>
                  <p className="max-w-md text-sm text-muted-foreground">
                    {copy(
                      locale,
                      'Experimenta outro intervalo ou abre a agenda para registar as primeiras marcações.',
                      'Try another date range or open the calendar to record your first bookings.',
                    )}
                  </p>
                  <Button asChild variant="outline" className="min-h-11">
                    <Link href="/dashboard/agenda">
                      {copy(locale, 'Abrir agenda', 'Open calendar')}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            <section aria-labelledby="analytics-exports-title">
              <Card className={cn(GLASS_PANEL, 'overflow-hidden')}>
                <CardHeader className="border-b border-border/70 bg-muted/20 pb-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle
                        id="analytics-exports-title"
                        className="flex flex-wrap items-center gap-2 text-base"
                      >
                        <Download
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                        {t('analyticsPage.exportData')}
                        <FeaturePlanBadge feature="advanced_reports" />
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t('analyticsPage.exportDescription')}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {humanDate(from, locale, 'long')} —{' '}
                      {humanDate(to, locale, 'long')}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
                  <ExportCard
                    title={t('analyticsPage.bookingsReport')}
                    description={t('analyticsPage.bookingsReportDescription')}
                    type="appointments"
                    from={from}
                    to={to}
                  />
                  <ExportCard
                    title={t('analyticsPage.clientsReport')}
                    description={t('analyticsPage.clientsReportDescription')}
                    type="clients"
                    from={from}
                    to={to}
                  />
                  {plan === 'enterprise' ? (
                    <ExportCard
                      title={t('analyticsPage.financialReport')}
                      description={t(
                        'analyticsPage.financialReportDescription',
                      )}
                      type="pos"
                      from={from}
                      to={to}
                    />
                  ) : (
                    <div className="flex flex-col justify-between rounded-2xl border border-dashed border-border bg-muted/10 p-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">
                            {t('analyticsPage.financialReport')}
                          </p>
                          <FeaturePlanBadge minimumPlan="enterprise" />
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {t('analyticsPage.availableEnterprise')}
                        </p>
                      </div>
                      <Button
                        asChild
                        variant="outline"
                        className="mt-4 min-h-11 w-full"
                      >
                        <Link href="/plans">
                          {t('analyticsPage.viewEnterprise')}
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        ) : null}

        {loadError && data ? (
          <p
            role="status"
            className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300"
          >
            {copy(
              locale,
              'Não foi possível atualizar os dados. Estás a ver a última versão carregada.',
              'Could not refresh the data. You are viewing the last successfully loaded version.',
            )}
          </p>
        ) : null}
        {loading && data ? (
          <p
            role="status"
            aria-live="polite"
            className="text-center text-xs text-muted-foreground"
          >
            {t('analyticsPage.updating')}
          </p>
        ) : null}
      </div>
    </main>
  );
}

function Metric({
  title,
  value,
  detail,
  icon,
  tone = 'neutral',
  featured = false,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: 'positive' | 'negative' | 'neutral';
  featured?: boolean;
}) {
  return (
    <Card
      className={cn(
        GLASS_PANEL,
        'min-w-0 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25',
        featured &&
          'relative col-span-2 border-primary/30 bg-gradient-to-br from-primary/[0.18] via-card/70 to-emerald-500/[0.06] shadow-[0_20px_70px_-42px_rgba(16,185,129,0.55)] xl:col-span-1',
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
          <span className="min-w-0 truncate">{title}</span>
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-gradient-to-br from-primary/[0.15] via-primary/[0.06] to-transparent text-primary shadow-sm',
              featured && 'bg-primary/10 text-primary',
            )}
          >
            {icon}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className={cn('break-words text-2xl font-semibold tracking-[-0.04em] tabular-nums sm:text-[1.7rem]', featured && 'text-3xl sm:text-[2rem]')}>
          {value}
        </p>
        <p
          className={cn(
            'mt-1 min-h-8 text-[11px] leading-4',
            tone === 'positive'
              ? 'text-emerald-600 dark:text-emerald-400'
              : tone === 'negative'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground',
          )}
        >
          {detail}
        </p>
      </CardContent>
    </Card>
  );
}

function MetricMini({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className={cn(GLASS_PANEL, 'min-w-0 rounded-2xl bg-background/35 p-3.5 transition-all hover:border-primary/20')}>
      <p className="text-xs leading-4 text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {detail ? (
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5 last:border-0">
      <span className="min-w-0 text-sm text-muted-foreground">{label}</span>
      <span className="shrink-0 font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function RevenueMix({
  label,
  value,
  total,
  locale,
  accent,
}: {
  label: string;
  value: number;
  total: number;
  locale: string;
  accent: string;
}) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums">
          {money(value, locale)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted/70 ring-1 ring-border/40">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300',
            accent,
          )}
          style={{ width: percent + '%' }}
        />
      </div>
      <p className="mt-1 text-right text-[11px] text-muted-foreground">
        {percent.toFixed(1)}%
      </p>
    </div>
  );
}

function Empty() {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <BarChart3
        className="size-6 text-muted-foreground/60"
        aria-hidden="true"
      />
      <p className="text-sm text-muted-foreground">
        {t('analyticsPage.noData')}
      </p>
    </div>
  );
}

function ExportCard({
  title,
  description,
  type,
  from,
  to,
}: {
  title: string;
  description: string;
  type: 'appointments' | 'clients' | 'pos';
  from: string;
  to: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex min-w-0 flex-col justify-between rounded-xl border border-border/70 bg-background p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileSpreadsheet className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button asChild variant="outline" className="min-h-10 w-full">
          <a href={downloadUrl(type, from, to, 'html')}>
            <Download className="mr-2 size-4" aria-hidden="true" />
            {t('analyticsPage.report')}
          </a>
        </Button>
        <Button asChild className="min-h-10 w-full">
          <a href={downloadUrl(type, from, to, 'excel')}>
            <FileSpreadsheet className="mr-2 size-4" aria-hidden="true" />
            {t('analyticsPage.excel')}
          </a>
        </Button>
      </div>
    </div>
  );
}
