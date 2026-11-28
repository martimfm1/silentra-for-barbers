"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Lightbulb,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

type PeriodType = 'day' | 'week' | 'month';
type ReportData = {
  revenue: number;
  serviceRevenue: number;
  productRevenue: number;
  pointOfSaleRevenue: number;
  previousRevenue: number;
  revenueChangePercent: number | null;
  appointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  cancellationRate: number;
  averageTicket: number;
  uniqueClients: number;
  newClients: number;
  rebookedClients: number;
  rebookingRate: number | null;
  topService: { name: string; count: number; revenue: number } | null;
  bestRevenueDay: { date: string; revenue: number } | null;
  busiestDay: { date: string; appointments: number } | null;
  pointOfSaleTransactions: number;
};
type Report = {
  id: string;
  period_type: PeriodType;
  period_start: string;
  period_end: string;
  data: ReportData;
  viewed_at: string | null;
  completed_at: string | null;
  created_at: string;
};

const copy = (locale: string, pt: string, en: string) => locale === 'en' ? en : pt;
const money = (value: number, locale: string) => new Intl.NumberFormat(
  locale === 'en' ? 'en-GB' : 'pt-PT',
  { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 },
).format(Number.isFinite(value) ? value : 0);

function formatDate(value: string, locale: string, long = false) {
  const date = new Date(value.slice(0, 10) + 'T12:00:00');
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'pt-PT', {
    day: '2-digit', month: long ? 'long' : 'short', ...(long ? { year: 'numeric' as const } : {}),
  }).format(date);
}

function periodName(type: PeriodType, locale: string) {
  if (type === 'day') return copy(locale, 'Fecho do dia', 'Daily close');
  if (type === 'week') return copy(locale, 'Fecho da semana', 'Weekly close');
  return copy(locale, 'Fecho do mês', 'Monthly close');
}

function periodRange(report: Report, locale: string) {
  return report.period_start === report.period_end
    ? formatDate(report.period_start, locale, true)
    : formatDate(report.period_start, locale) + ' – ' + formatDate(report.period_end, locale, true);
}

function insights(report: Report, locale: string) {
  const data = report.data;
  const result: { title: string; description: string }[] = [];
  if (data.revenueChangePercent !== null) {
    const up = data.revenueChangePercent >= 0;
    result.push({
      title: copy(locale, up ? 'Faturação em crescimento' : 'Faturação abaixo do período anterior',
        up ? 'Revenue is growing' : 'Revenue is below the previous period'),
      description: copy(locale,
        (up ? 'Subiu ' : 'Desceu ') + Math.abs(data.revenueChangePercent).toFixed(1) + '% face ao período anterior.',
        'It ' + (up ? 'increased' : 'decreased') + ' by ' + Math.abs(data.revenueChangePercent).toFixed(1) + '% vs the previous period.'),
    });
  }
  if (data.cancellationRate >= 12 && data.appointments > 0) {
    result.push({
      title: copy(locale, 'Atenção aos cancelamentos', 'Review cancellations'),
      description: copy(locale,
        data.cancellationRate.toFixed(1) + '% das marcações foram canceladas. Revê os horários com mais cancelamentos e reforça os lembretes.',
        data.cancellationRate.toFixed(1) + '% of bookings were cancelled. Review the busiest cancellation slots and reinforce reminders.'),
    });
  }
  if (data.rebookingRate !== null && data.rebookingRate < 40 && data.uniqueClients >= 3) {
    result.push({
      title: copy(locale, 'Melhora a fidelização', 'Improve customer retention'),
      description: copy(locale,
        'Apenas ' + data.rebookingRate.toFixed(1) + '% dos clientes com marcações concluídas já têm outra visita agendada. Sugere a próxima visita antes de saírem.',
        'Only ' + data.rebookingRate.toFixed(1) + '% of customers with completed bookings already have another visit booked. Encourage rebooking before they leave.'),
    });
  }
  if (data.topService) {
    result.push({
      title: copy(locale, 'Serviço em destaque', 'Top-performing service'),
      description: data.topService.name + ' — ' + money(data.topService.revenue, locale) +
        ' (' + data.topService.count + ' ' + copy(locale, 'marcações concluídas', 'completed bookings') + ').',
    });
  }
  if (data.newClients > 0) {
    result.push({
      title: copy(locale, 'Novos clientes', 'New customers'),
      description: copy(locale,
        'Entraram ' + data.newClients + ' novos clientes. Incentiva-os a regressar com uma recomendação de manutenção adequada.',
        data.newClients + ' new customers joined. Encourage them to return with a suitable maintenance recommendation.'),
    });
  }
  if (data.busiestDay) {
    result.push({
      title: copy(locale, 'Dia de maior procura', 'Busiest day'),
      description: formatDate(data.busiestDay.date, locale, true) + ' · ' +
        data.busiestDay.appointments + ' ' + copy(locale, 'marcações', 'bookings') + '.',
    });
  }
  return result.slice(0, 4);
}

function PeriodIcon({
  type,
  className = 'size-4',
}: {
  type: PeriodType;
  className?: string;
}) {
  const Icon = type === 'day'
    ? CalendarClock
    : type === 'week'
      ? CalendarRange
      : CalendarDays;
  return <Icon className={className} aria-hidden="true" />;
}

function ReportDetails({ report, locale }: { report: Report; locale: string }) {
  const data = report.data;
  const recommendations = useMemo(() => insights(report, locale), [report, locale]);
  const cards = [
    [copy(locale, 'Marcações concluídas', 'Completed bookings'), String(data.completedAppointments),
      data.appointments + ' ' + copy(locale, 'no total', 'in total'), CheckCircle2],
    [copy(locale, 'Ticket médio', 'Average ticket'), money(data.averageTicket, locale),
      copy(locale, 'Por marcação concluída', 'Per completed booking'), CircleDollarSign],
    [copy(locale, 'Clientes atendidos', 'Customers served'), String(data.uniqueClients),
      data.newClients + ' ' + copy(locale, 'novos', 'new'), Users],
    [copy(locale, 'Cancelamentos', 'Cancellations'), data.cancellationRate.toFixed(1) + '%',
      data.cancelledAppointments + ' ' + copy(locale, 'marcações', 'bookings'), CalendarDays],
  ] as const;
  const change = data.revenueChangePercent;

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="relative isolate overflow-hidden rounded-[1.5rem] border border-primary/20 bg-gradient-to-br from-primary/[0.16] via-card/75 to-emerald-500/[0.055] p-4 shadow-[0_22px_70px_-46px_rgba(16,185,129,0.5)] backdrop-blur-xl sm:rounded-[1.75rem] sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 size-64 rounded-full bg-primary/[0.14] blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-[-5rem] left-1/3 size-48 rounded-full bg-cyan-400/[0.08] blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/35 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary backdrop-blur-md">
              <PeriodIcon type={report.period_type} className="size-3.5" />
              {periodName(report.period_type, locale)}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{periodRange(report, locale)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground/80">
              {copy(locale, 'Resumo do período fechado', 'Closed-period summary')}
            </p>
          </div>
          <div className="min-w-0 sm:text-right">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground sm:justify-end">
              <CircleDollarSign className="size-3.5 text-primary" />
              {copy(locale, 'Faturação registada', 'Recorded revenue')}
            </p>
            <p className="mt-1 break-words text-3xl font-semibold tracking-[-0.045em] tabular-nums sm:text-4xl">
              {money(data.revenue, locale)}
            </p>
            {change !== null ? (
              <span className={'mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ' +
                (change >= 0
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                  : 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300')}>
                {change >= 0
                  ? <ArrowUpRight className="size-3.5" />
                  : <ArrowDownRight className="size-3.5" />}
                {change >= 0 ? '+' : '−'}{Math.abs(change).toFixed(1)}%
                <span className="font-medium opacity-80">{copy(locale, 'face ao período anterior', 'vs previous period')}</span>
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {cards.map(([label, value, detail, Icon], index) => (
          <div
            key={label}
            className="group relative min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card/55 p-3.5 shadow-[0_14px_44px_-34px_rgba(0,0,0,0.65)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card/75 sm:p-4"
          >
            <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-7 size-20 rounded-full bg-primary/[0.07] blur-2xl transition-opacity group-hover:opacity-100" />
            <div className="relative flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-gradient-to-br from-primary/15 to-transparent text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 truncate text-[11px] font-medium leading-4 text-muted-foreground sm:text-xs">{label}</span>
            </div>
            <p className="relative mt-3 break-words text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{value}</p>
            <p className="relative mt-1 min-h-8 text-[10px] leading-4 text-muted-foreground sm:text-[11px]">{detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-2xl border border-border/60 bg-card/50 p-4 shadow-[0_16px_48px_-36px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl border border-primary/15 bg-gradient-to-br from-primary/15 to-transparent text-primary">
              <CircleDollarSign className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">{copy(locale, 'Origem da faturação', 'Revenue sources')}</p>
              <p className="text-[11px] text-muted-foreground">{copy(locale, 'De onde veio a receita', 'Where revenue came from')}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{copy(locale, 'Serviços', 'Services')}</span>
              <strong className="shrink-0 tabular-nums">{money(data.serviceRevenue, locale)}</strong>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{copy(locale, 'Extras nas marcações', 'Booking extras')}</span>
              <strong className="shrink-0 tabular-nums">{money(data.productRevenue, locale)}</strong>
            </div>
            {data.pointOfSaleTransactions > 0 ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{copy(locale, 'Vendas POS', 'POS sales')}</span>
                <strong className="shrink-0 tabular-nums">{money(data.pointOfSaleRevenue, locale)}</strong>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-gradient-to-r from-primary/[0.10] to-transparent px-3.5 py-3">
              <strong className="text-sm">{copy(locale, 'Total', 'Total')}</strong>
              <strong className="text-base tabular-nums text-primary">{money(data.revenue, locale)}</strong>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/50 p-4 shadow-[0_16px_48px_-36px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl border border-violet-500/15 bg-gradient-to-br from-violet-500/15 to-transparent text-violet-500">
              <Users className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">{copy(locale, 'Fidelização e serviços', 'Retention and services')}</p>
              <p className="text-[11px] text-muted-foreground">{copy(locale, 'Sinais sobre os teus clientes', 'Signals about your customers')}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 text-muted-foreground">{copy(locale, 'Clientes com nova marcação', 'Customers rebooked')}</span>
              <strong className="shrink-0 tabular-nums">{data.rebookedClients}{data.rebookingRate !== null ? ' · ' + data.rebookingRate.toFixed(1) + '%' : ''}</strong>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{copy(locale, 'Serviço mais vendido', 'Top service')}</span>
              <strong className="max-w-[55%] truncate text-right">{data.topService?.name ?? copy(locale, 'Sem dados', 'No data')}</strong>
            </div>
            {data.bestRevenueDay ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{copy(locale, 'Dia com mais faturação', 'Highest-revenue day')}</span>
                <strong className="shrink-0">{formatDate(data.bestRevenueDay.date, locale)}</strong>
              </div>
            ) : null}
            {data.busiestDay ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{copy(locale, 'Dia com mais marcações', 'Busiest day')}</span>
                <strong className="shrink-0">{formatDate(data.busiestDay.date, locale)}</strong>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl border border-amber-500/15 bg-gradient-to-br from-amber-500/15 to-transparent text-amber-500">
            <Lightbulb className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold">{copy(locale, 'O que podes melhorar', 'Opportunities to improve')}</p>
            <p className="text-[11px] text-muted-foreground">{copy(locale, 'Sugestões com base nos resultados', 'Suggestions based on your results')}</p>
          </div>
        </div>
        {recommendations.length ? (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {recommendations.map((item) => (
              <div key={item.title} className="rounded-2xl border border-border/60 bg-card/45 p-3.5 backdrop-blur-xl sm:p-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/[0.10] text-primary">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border/70 bg-card/35 p-4 text-xs leading-5 text-muted-foreground backdrop-blur-xl">
            {copy(locale, 'Continua a registar marcações para receberes recomendações mais úteis.', 'Keep recording bookings to receive more useful recommendations.')}
          </p>
        )}
      </section>

      <p className="rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5 text-[10px] leading-4 text-muted-foreground">
        {copy(locale, 'A faturação inclui serviços e extras de marcações concluídas. No Enterprise inclui também vendas POS. Não representa lucro líquido.', 'Revenue includes services and extras from completed bookings. Enterprise also includes POS sales. It does not represent net profit.')}
      </p>
    </div>
  );
}

async function markViewed(id: string) {
  const response = await fetch('/api/periodic-reports', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'viewed' }),
  });
  if (!response.ok) throw new Error('Could not mark report as viewed');
}

async function markCompleted(ids: string[]) {
  const response = await fetch('/api/periodic-reports', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'complete', ids }),
  });
  if (!response.ok) throw new Error('Could not complete reports');
}

export function DashboardClosingReports({ barbershopId }: { barbershopId: string }) {
  const { locale } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const selected = reports.find((report) => report.id === selectedId) ?? null;

  useEffect(() => {
    if (!barbershopId) return;
    const controller = new AbortController();
    setLoading(true);
    void fetch('/api/periodic-reports', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Reports unavailable');
        return payload as { unreadReports?: Report[] };
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        const unread = Array.isArray(payload.unreadReports) ? payload.unreadReports : [];
        const order: Record<PeriodType, number> = { day: 0, week: 1, month: 2 };
        unread.sort((a, b) => order[a.period_type] - order[b.period_type] ||
          b.period_start.localeCompare(a.period_start));
        setReports(unread);
        setSelectedId(unread[0]?.id ?? null);
        setOpen(unread.length > 0);
      })
      .catch((error) => { if (!controller.signal.aborted) console.error('Automatic report load failed', error); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [barbershopId]);

  async function completeReports() {
    if (completing || reports.length === 0) return;
    setCompleting(true);
    try {
      await markCompleted(reports.map((report) => report.id));
      setReports([]);
      setSelectedId(null);
      setOpen(false);
    } catch (error) {
      console.error('Report completion failed', error);
      toast.error(copy(locale, 'Não foi possível concluir os resumos. Tenta novamente.', 'Could not complete the summaries. Please try again.'));
    } finally {
      setCompleting(false);
    }
  }

  if (loading || reports.length === 0) return null;
  const index = reports.findIndex((report) => report.id === selectedId);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-[1.75rem] border border-border/70 bg-background/85 p-0 shadow-[0_32px_110px_-45px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:rounded-[2rem]">
        <DialogHeader className="relative isolate overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/[0.15] via-card/80 to-card/45 px-5 py-5 text-left sm:px-7 sm:py-6">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-primary/[0.15] blur-3xl" />
          <div className="relative flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/20 to-transparent text-primary shadow-sm">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
                {copy(locale, 'Resumo da tua barbearia', 'Your barbershop summary')}
              </DialogTitle>
              <DialogDescription className="mt-1 max-w-2xl text-sm leading-5">
                {copy(locale, 'Os resultados dos últimos períodos fechados, com indicadores e oportunidades de melhoria.', 'Results from recently closed periods, with useful metrics and opportunities to improve.')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 p-4 sm:p-6">
          {reports.length > 1 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label={copy(locale, 'Resumos disponíveis', 'Available summaries')}>
              {reports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setSelectedId(report.id)}
                  aria-pressed={report.id === selectedId}
                  className={'inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
                    (report.id === selectedId
                      ? 'border-primary/40 bg-gradient-to-r from-primary to-emerald-500 text-primary-foreground shadow-lg shadow-primary/20'
                      : 'border-border/70 bg-card/45 text-muted-foreground hover:border-primary/25 hover:bg-primary/[0.06] hover:text-foreground')}
                >
                  <PeriodIcon type={report.period_type} className="size-3.5" />
                  <span>{periodName(report.period_type, locale)}</span>
                  <span className="opacity-75">· {formatDate(report.period_start, locale)}</span>
                </button>
              ))}
            </div>
          ) : null}

          {selected ? <ReportDetails report={selected} locale={locale} /> : null}
        </div>

        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border/60 bg-background/80 px-4 py-3 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold tabular-nums">{copy(locale, 'Resumo', 'Summary')} {index + 1} / {reports.length}</p>
            <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-[width]" style={{ width: ((index + 1) / reports.length) * 100 + '%' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button size="sm" variant="outline" type="button" disabled={index <= 0 || completing} onClick={() => setSelectedId(reports[index - 1]?.id ?? null)} className="min-h-10 rounded-xl border-border/70 bg-card/45">
              {copy(locale, 'Anterior', 'Previous')}
            </Button>
            <Button size="sm" variant="outline" type="button" disabled={index < 0 || index >= reports.length - 1 || completing} onClick={() => setSelectedId(reports[index + 1]?.id ?? null)} className="min-h-10 rounded-xl border-border/70 bg-card/45">
              {copy(locale, 'Seguinte', 'Next')}
            </Button>
            <Button size="sm" type="button" disabled={completing} onClick={() => void completeReports()} className="col-span-2 min-h-10 rounded-xl bg-gradient-to-r from-primary to-emerald-500 font-semibold text-primary-foreground shadow-lg shadow-primary/20 sm:col-span-1">
              <CheckCircle2 className="mr-1.5 size-4" aria-hidden="true" />
              {completing ? copy(locale, 'A guardar…', 'Saving…') : copy(locale, 'Concluir', 'Done')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PeriodReportsHistory() {
  const { locale } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Report | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/periodic-reports', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Reports unavailable');
        return payload as { reports?: Report[] };
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setReports(Array.isArray(payload.reports) ? payload.reports : []);
        setVisibleCount(12);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const onSelect = (report: Report) => {
    setSelected(report);
    if (!report.viewed_at) {
      void markViewed(report.id).catch((failure) => console.error('Report view update failed', failure));
      setReports((items) => items.map((item) => item.id === report.id
        ? { ...item, viewed_at: new Date().toISOString() } : item));
    }
  };

  return (
    <section className="relative isolate space-y-4 overflow-hidden rounded-[1.75rem] border border-border/60 bg-card/35 p-4 shadow-[0_20px_70px_-48px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:rounded-[2rem] sm:p-5">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-primary/[0.10] blur-3xl" />
      <div className="relative z-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/20 to-transparent text-primary">
              <CalendarRange className="size-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">{copy(locale, 'Fechos automáticos', 'Automatic summaries')}</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">{copy(locale, 'Histórico de desempenho', 'Performance history')}</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy(locale, 'Consulta os resumos do dia, da semana e do mês.', 'Review daily, weekly and monthly summaries.')}</p>
            </div>
          </div>
          {!loading && !error && reports.length > 0 ? (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-background/45 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
              <BarChart3 className="size-3.5 text-primary" />
              {reports.length} {copy(locale, 'resumos guardados', 'saved summaries')}
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </div>
        ) : error ? (
          <div className="mt-4 rounded-2xl border border-rose-500/15 bg-rose-500/[0.06] p-4 text-sm text-muted-foreground">
            {copy(locale, 'Não foi possível carregar os resumos guardados.', 'Could not load saved summaries.')}
          </div>
        ) : reports.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-border/70 bg-background/25 px-5 py-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.08] text-primary">
              <CalendarDays className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-semibold">{copy(locale, 'Ainda não existem resumos', 'No summaries yet')}</p>
            <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
              {copy(locale, 'O primeiro será criado automaticamente depois do próximo fecho de horário.', 'The first will be created automatically after the next business close.')}
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {reports.slice(0, visibleCount).map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => onSelect(report)}
                className="group relative min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card/85 via-card/55 to-primary/[0.045] p-4 text-left shadow-[0_16px_50px_-38px_rgba(0,0,0,0.65)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_24px_70px_-40px_rgba(16,185,129,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-primary/[0.10] blur-2xl transition-opacity group-hover:opacity-100" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.10] text-primary">
                        <PeriodIcon type={report.period_type} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{periodName(report.period_type, locale)}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{periodRange(report, locale)}</p>
                      </div>
                    </div>
                    {!report.viewed_at ? (
                      <span className="shrink-0 rounded-full border border-primary/20 bg-primary/[0.10] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-primary">
                        {copy(locale, 'Novo', 'New')}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-5 break-words text-2xl font-semibold tracking-[-0.04em] tabular-nums sm:text-[1.75rem]">{money(report.data.revenue, locale)}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {report.data.completedAppointments} {copy(locale, 'concluídas', 'completed')} · {report.data.newClients} {copy(locale, 'novos clientes', 'new customers')}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
                    <span className="text-xs font-semibold text-primary">{copy(locale, 'Ver resumo', 'View summary')}</span>
                    <span className="flex size-7 items-center justify-center rounded-full border border-border/60 bg-background/45 text-muted-foreground transition-all group-hover:border-primary/25 group-hover:bg-primary/10 group-hover:text-primary">
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && !error && reports.length > visibleCount ? (
          <div className="flex justify-center">
            <Button type="button" variant="outline" size="sm" onClick={() => setVisibleCount((count) => count + 12)} className="min-h-10 rounded-xl border-border/70 bg-background/45 px-4 backdrop-blur-md">
              {copy(locale, 'Mostrar mais resumos', 'Show more summaries')}
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(value) => { if (!value) setSelected(null); }}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-[1.75rem] border border-border/70 bg-background/85 p-0 shadow-[0_32px_110px_-45px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:rounded-[2rem]">
          <DialogHeader className="relative isolate overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/[0.15] via-card/80 to-card/45 px-5 py-5 text-left sm:px-7 sm:py-6">
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-primary/[0.15] blur-3xl" />
            <div className="relative flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/20 to-transparent text-primary shadow-sm">
                <PeriodIcon type={selected?.period_type ?? 'day'} className="size-5" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {selected ? periodName(selected.period_type, locale) : copy(locale, 'Resumo', 'Summary')}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm leading-5">
                  {selected ? periodRange(selected, locale) : ''}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-4 sm:p-6">
            {selected ? <ReportDetails report={selected} locale={locale} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
