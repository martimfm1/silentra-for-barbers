"use client";

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, CheckCircle2, ChevronRight, Lightbulb, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
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

function ReportDetails({ report, locale }: { report: Report; locale: string }) {
  const data = report.data;
  const recommendations = useMemo(() => insights(report, locale), [report, locale]);
  const cards = [
    [copy(locale, 'Marcações concluídas', 'Completed bookings'), String(data.completedAppointments),
      data.appointments + ' ' + copy(locale, 'no total', 'in total'), CheckCircle2],
    [copy(locale, 'Ticket médio', 'Average ticket'), money(data.averageTicket, locale),
      copy(locale, 'Por marcação concluída', 'Per completed booking'), BarChart3],
    [copy(locale, 'Clientes atendidos', 'Customers served'), String(data.uniqueClients),
      data.newClients + ' ' + copy(locale, 'novos', 'new'), Users],
    [copy(locale, 'Cancelamentos', 'Cancellations'), data.cancellationRate.toFixed(1) + '%',
      data.cancelledAppointments + ' ' + copy(locale, 'marcações', 'bookings'), CalendarDays],
  ] as const;
  const change = data.revenueChangePercent;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{periodName(report.period_type, locale)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{periodRange(report, locale)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{copy(locale, 'Faturação registada', 'Recorded revenue')}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{money(data.revenue, locale)}</p>
          {change !== null ? <p className={change >= 0 ? 'mt-1 text-xs text-emerald-600' : 'mt-1 text-xs text-rose-500'}>
            {change >= 0 ? '+' : '−'}{Math.abs(change).toFixed(1)}% {copy(locale, 'face ao período anterior', 'vs previous period')}
          </p> : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {cards.map(([label, value, detail, Icon]) => (
          <div key={label} className="min-w-0 rounded-2xl border bg-card p-3.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="size-4 shrink-0 text-primary" /><span className="truncate">{label}</span>
            </div>
            <p className="mt-2 truncate text-xl font-semibold tabular-nums">{value}</p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy(locale, 'Origem da faturação', 'Revenue sources')}</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><span>{copy(locale, 'Serviços', 'Services')}</span><strong>{money(data.serviceRevenue, locale)}</strong></div>
            <div className="flex justify-between gap-3"><span>{copy(locale, 'Extras nas marcações', 'Booking extras')}</span><strong>{money(data.productRevenue, locale)}</strong></div>
            {data.pointOfSaleTransactions > 0 ? <div className="flex justify-between gap-3"><span>{copy(locale, 'Vendas POS', 'POS sales')}</span><strong>{money(data.pointOfSaleRevenue, locale)}</strong></div> : null}
            <div className="flex justify-between gap-3 border-t pt-2"><strong>{copy(locale, 'Total', 'Total')}</strong><strong className="text-primary">{money(data.revenue, locale)}</strong></div>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy(locale, 'Fidelização e serviços', 'Retention and services')}</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><span>{copy(locale, 'Clientes com nova marcação', 'Customers rebooked')}</span><strong>{data.rebookedClients}{data.rebookingRate !== null ? ' · ' + data.rebookingRate.toFixed(1) + '%' : ''}</strong></div>
            <div className="flex justify-between gap-3"><span>{copy(locale, 'Serviço mais vendido', 'Top service')}</span><strong className="max-w-[55%] truncate">{data.topService?.name ?? copy(locale, 'Sem dados', 'No data')}</strong></div>
            {data.bestRevenueDay ? <div className="flex justify-between gap-3"><span>{copy(locale, 'Dia com mais faturação', 'Highest-revenue day')}</span><strong>{formatDate(data.bestRevenueDay.date, locale)}</strong></div> : null}
            {data.busiestDay ? <div className="flex justify-between gap-3"><span>{copy(locale, 'Dia com mais marcações', 'Busiest day')}</span><strong>{formatDate(data.busiestDay.date, locale)}</strong></div> : null}
          </div>
        </div>
      </div>
      {recommendations.length ? <section className="space-y-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Lightbulb className="size-4 text-primary" />{copy(locale, 'O que podes melhorar', 'Opportunities to improve')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {recommendations.map((item) => <div key={item.title} className="rounded-xl border bg-card p-3">
            <p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
          </div>)}
        </div>
      </section> : <p className="rounded-xl border bg-card p-3 text-xs text-muted-foreground">{copy(locale, 'Continua a registar marcações para receberes recomendações mais úteis.', 'Keep recording bookings to receive more useful recommendations.')}</p>}
      <p className="text-[10px] leading-4 text-muted-foreground">{copy(locale, 'A faturação inclui serviços e extras de marcações concluídas. No Enterprise inclui também vendas POS. Não representa lucro líquido.', 'Revenue includes services and extras from completed bookings. Enterprise also includes POS sales. It does not represent net profit.')}</p>
    </div>
  );
}

async function markViewed(id: string) {
  const response = await fetch('/api/periodic-reports', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error('Could not mark report as viewed');
}

export function DashboardClosingReports({ barbershopId }: { barbershopId: string }) {
  const { locale } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    if (!open || !selected || selected.viewed_at) return;
    void markViewed(selected.id).then(() => {
      setReports((items) => items.map((item) => item.id === selected.id
        ? { ...item, viewed_at: new Date().toISOString() } : item));
    }).catch((error) => console.error('Report view update failed', error));
  }, [open, selected]);

  if (loading || reports.length === 0) return null;
  const index = reports.findIndex((report) => report.id === selectedId);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-xl sm:text-2xl">{copy(locale, 'Resumo da tua barbearia', 'Your barbershop summary')}</DialogTitle>
        <DialogDescription>{copy(locale, 'Os resultados dos últimos períodos fechados, com indicadores e oportunidades de melhoria.', 'Results from recently closed periods, with useful metrics and opportunities to improve.')}</DialogDescription>
      </DialogHeader>
      {reports.length > 1 ? <div className="flex flex-wrap gap-2">
        {reports.map((report) => <button key={report.id} type="button" onClick={() => setSelectedId(report.id)}
          aria-pressed={report.id === selectedId}
          className={'min-h-9 rounded-full border px-3 text-xs font-medium ' +
            (report.id === selectedId ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground')}>
          {periodName(report.period_type, locale)} · {formatDate(report.period_start, locale)}
        </button>)}
      </div> : null}
      {selected ? <ReportDetails report={selected} locale={locale} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">{index + 1} / {reports.length}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" type="button" disabled={index <= 0}
            onClick={() => setSelectedId(reports[index - 1]?.id ?? null)}>{copy(locale, 'Anterior', 'Previous')}</Button>
          <Button size="sm" variant="outline" type="button" disabled={index < 0 || index >= reports.length - 1}
            onClick={() => setSelectedId(reports[index + 1]?.id ?? null)}>{copy(locale, 'Seguinte', 'Next')}</Button>
          <Button size="sm" type="button" onClick={() => setOpen(false)}>{copy(locale, 'Concluir', 'Done')}</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
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

  return <section className="space-y-3">
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{copy(locale, 'Fechos automáticos', 'Automatic summaries')}</p>
      <h2 className="mt-1 text-lg font-semibold">{copy(locale, 'Histórico de desempenho', 'Performance history')}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{copy(locale, 'Consulta os resumos do dia, da semana e do mês.', 'Review daily, weekly and monthly summaries.')}</p>
    </div>
    {loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /></div>
      : error ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">{copy(locale, 'Não foi possível carregar os resumos guardados.', 'Could not load saved summaries.')}</p>
      : reports.length === 0 ? <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">{copy(locale, 'Ainda não existem resumos fechados. O primeiro será criado automaticamente depois do próximo fecho de horário.', 'There are no closed summaries yet. The first is created after the next business close.')}</div>
      : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {reports.slice(0, visibleCount).map((report) => <button key={report.id} type="button" onClick={() => onSelect(report)}
          className="group min-w-0 rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <div className="flex items-start justify-between gap-2">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">{periodName(report.period_type, locale)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{periodRange(report, locale)}</p></div>
            {!report.viewed_at ? <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{copy(locale, 'Novo', 'New')}</span> : null}
          </div>
          <p className="mt-4 text-xl font-semibold tabular-nums">{money(report.data.revenue, locale)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{report.data.completedAppointments} {copy(locale, 'concluídas', 'completed')} · {report.data.newClients} {copy(locale, 'novos clientes', 'new customers')}</p>
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">{copy(locale, 'Ver resumo', 'View summary')} <ChevronRight className="size-3.5" /></p>
        </button>)}
      </div>}
    {!loading && !error && reports.length > visibleCount ? <div className="flex justify-center">
      <Button type="button" variant="outline" size="sm" onClick={() => setVisibleCount((count) => count + 12)}>
        {copy(locale, 'Mostrar mais resumos', 'Show more summaries')} <ChevronRight className="ml-1 size-4" />
      </Button>
    </div> : null}
    <Dialog open={Boolean(selected)} onOpenChange={(value) => { if (!value) setSelected(null); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{selected ? periodName(selected.period_type, locale) : copy(locale, 'Resumo', 'Summary')}</DialogTitle><DialogDescription>{selected ? periodRange(selected, locale) : ''}</DialogDescription></DialogHeader>
        {selected ? <ReportDetails report={selected} locale={locale} /> : null}
      </DialogContent>
    </Dialog>
  </section>;
}
