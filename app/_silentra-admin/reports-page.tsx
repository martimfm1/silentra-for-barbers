'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  Download,
  Mail,
  RefreshCw,
  ShoppingBag,
  Users,
} from 'lucide-react';

type Daily = {
  date: string;
  barbershops: number;
  users: number;
  appointments: number;
  revenue: number;
  apiRequests: number;
  apiErrors: number;
};
type StatusCount = { status: string; count: number };
type Report = {
  generatedAt: string;
  days: number;
  totals: {
    barbershops: number;
    users: number;
    appointments: number;
    subscriptions: number;
    activeSubscriptions: number;
    marketplaceOrders: number;
  };
  period: {
    newBarbershops: number;
    newUsers: number;
    appointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    paidSubscriptionRequests: number;
    subscriptionRevenue: number;
    posRevenue: number;
    posTransactions: number;
    marketplaceOrders: number;
    marketplaceRevenue: number;
    apiRequests: number;
    apiErrors: number;
    marketingSent: number;
    marketingFailed: number;
    automationRuns: number;
    automationFailed: number;
    openSupportConversations: number;
  };
  appointmentStatuses: StatusCount[];
  subscriptionStatuses: StatusCount[];
  daily: Daily[];
  recentActivity: Array<{
    action: string;
    entityType: string;
    createdAt: string;
    metadata: { barbershop_id?: string | null; plan?: string | null; request_type?: string | null };
  }>;
};

const statusLabels: Record<string, string> = {
  scheduled: 'Agendadas',
  pending: 'Pendentes',
  completed: 'Concluídas',
  cancelled: 'Canceladas',
  canceled: 'Canceladas',
  active: 'Ativas',
  trialing: 'Em período experimental',
  past_due: 'Pagamento em atraso',
  unpaid: 'Por pagar',
  expired: 'Expiradas',
  rejected: 'Rejeitadas',
  refunded: 'Reembolsadas',
  paid: 'Pagas',
};

function number(value: number) {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(value);
}
function money(value: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value);
}
function date(value: string) {
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short' }).format(new Date(value));
}
function dateTime(value: string) {
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function MetricCard({ title, value, note, icon: Icon, accent = 'neutral' }: {
  title: string; value: string; note: string; icon: typeof Activity; accent?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const color = accent === 'good' ? 'text-emerald-300' : accent === 'warn' ? 'text-amber-300' : accent === 'bad' ? 'text-rose-300' : 'text-zinc-300';
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-zinc-400">{title}</p>
          <p className="mt-2 break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl">{value}</p>
        </div>
        <span className="rounded-xl border border-white/10 bg-white/[0.04] p-2"><Icon className={`size-4 ${color}`} /></span>
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-500">{note}</p>
    </article>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-zinc-950/70 p-4 sm:p-5">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-white sm:text-base">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-5 text-zinc-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function MiniBars({ title, rows, keys }: { title: string; rows: Daily[]; keys: Array<{ key: 'barbershops' | 'users' | 'appointments'; label: string }> }) {
  const max = Math.max(1, ...rows.flatMap((row) => keys.map((item) => row[item.key])));
  const step = Math.max(1, Math.ceil(rows.length / 15));
  const visible = rows.filter((_, index) => index % step === 0 || index === rows.length - 1);
  return (
    <Panel title={title} description="Novos registos por dia, agrupados para facilitar a leitura no telemóvel.">
      <div className="flex flex-wrap gap-3 pb-4">
        {keys.map((item) => <span key={item.key} className="inline-flex items-center gap-2 text-xs text-zinc-400"><span className="size-2 rounded-full bg-emerald-300" />{item.label}</span>)}
      </div>
      <div className="flex h-40 items-end gap-1 border-b border-white/10 pb-1 sm:h-52">
        {visible.map((row) => (
          <div key={row.date} title={`${date(row.date)} · ${keys.map((item) => `${item.label}: ${row[item.key]}`).join(' · ')}`} className="flex h-full min-w-0 flex-1 items-end gap-px">
            {keys.map((item, index) => (
              <div key={item.key} className={`min-w-0 flex-1 rounded-t-sm ${index === 0 ? 'bg-emerald-300/80' : index === 1 ? 'bg-sky-300/70' : 'bg-violet-300/70'}`} style={{ height: `${Math.max(row[item.key] ? 4 : 0, (row[item.key] / max) * 100)}%` }} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-zinc-600"><span>{rows[0] ? date(rows[0].date) : '—'}</span><span>{rows.at(-1) ? date(rows.at(-1)!.date) : '—'}</span></div>
    </Panel>
  );
}

function StatusBars({ title, rows }: { title: string; rows: StatusCount[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <Panel title={title}>
      {rows.length ? <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.status}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-zinc-300">{statusLabels[row.status] ?? row.status}</span>
              <span className="shrink-0 tabular-nums text-zinc-400">{number(row.count)} <span className="text-zinc-600">({percent(row.count, total)}%)</span></span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-emerald-300/80" style={{ width: `${percent(row.count, total)}%` }} /></div>
          </div>
        ))}
      </div> : <p className="text-sm text-zinc-500">Sem dados para apresentar.</p>}
    </Panel>
  );
}

export default function PlatformReportsPage() {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/silentra-admin/reports?days=${days}`, { cache: 'no-store' });
      const payload = await response.json() as { ok?: boolean; error?: string; report?: Report };
      if (!response.ok || !payload.ok || !payload.report) throw new Error(payload.error || 'Não foi possível carregar os relatórios.');
      setReport(payload.report);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao carregar os relatórios.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const csv = useMemo(() => {
    if (!report) return '';
    const rows = [
      ['Data', 'Barbearias novas', 'Utilizadores novos', 'Marcações', 'Receita (EUR)', 'Pedidos API', 'Erros API'],
      ...report.daily.map((row) => [row.date, row.barbershops, row.users, row.appointments, row.revenue.toFixed(2), row.apiRequests, row.apiErrors]),
    ];
    return rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n');
  }, [report]);

  function exportCsv() {
    if (!csv) return;
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `silentra-relatorios-${days}d.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const p = report?.period;
  const totals = report?.totals;

  return (
    <main className="min-h-screen bg-[#09090b] px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/silentra-admin" className="mb-4 inline-flex items-center gap-2 text-xs text-zinc-400 transition hover:text-white"><ArrowLeft className="size-4" />Voltar ao painel admin</Link>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300">SILENTRA · ADMIN</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Relatórios da plataforma</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Visão global da utilização, crescimento, faturação registada, marcações, marketplace, marketing, automações, suporte e saúde da API.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
              {[7, 30, 90].map((value) => <button key={value} onClick={() => setDays(value)} className={`rounded-lg px-3 py-2 text-xs font-medium transition ${days === value ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'}`}>{value} dias</button>)}
            </div>
            <button onClick={exportCsv} disabled={!report || loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/[0.05] disabled:opacity-40"><Download className="size-4" />Exportar CSV</button>
            <button onClick={() => void load()} disabled={loading} aria-label="Atualizar relatórios" className="rounded-xl border border-white/10 p-2.5 text-zinc-300 hover:bg-white/[0.05] disabled:opacity-40"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </header>

        {error ? <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div><p className="font-medium">{error}</p><button onClick={() => void load()} className="mt-2 underline underline-offset-4">Tentar novamente</button></div></div> : null}
        {loading && !report ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]" />)}</div> : null}

        {report ? <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <span>Período: últimos {report.days} dias · totais de utilização acumulados desde o início</span>
            <span>Atualizado {dateTime(report.generatedAt)}{loading ? ' · a atualizar…' : ''}</span>
          </div>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Barbearias" value={number(totals!.barbershops)} note={`+${number(p!.newBarbershops)} no período`} icon={Building2} accent="good" />
            <MetricCard title="Utilizadores" value={number(totals!.users)} note={`+${number(p!.newUsers)} no período`} icon={Users} accent="good" />
            <MetricCard title="Marcações" value={number(totals!.appointments)} note={`${number(p!.completedAppointments)} concluídas no período`} icon={CalendarCheck} />
            <MetricCard title="Subscrições ativas" value={number(totals!.activeSubscriptions)} note={`${number(totals!.subscriptions)} subscrições no total`} icon={CreditCard} accent="good" />
            <MetricCard title="Receita de subscrições" value={money(p!.subscriptionRevenue)} note={`${number(p!.paidSubscriptionRequests)} pedidos pagos registados`} icon={CreditCard} />
            <MetricCard title="Vendas POS" value={money(p!.posRevenue)} note={`${number(p!.posTransactions)} transações pagas/concluídas`} icon={BarChart3} />
            <MetricCard title="Marketplace" value={money(p!.marketplaceRevenue)} note={`${number(p!.marketplaceOrders)} encomendas no período`} icon={ShoppingBag} />
            <MetricCard title="Pedidos API" value={number(p!.apiRequests)} note={`${number(p!.apiErrors)} erros HTTP 5xx (${percent(p!.apiErrors, p!.apiRequests)}%)`} icon={Activity} accent={p!.apiErrors ? 'warn' : 'good'} />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <MiniBars title="Crescimento da plataforma" rows={report.daily} keys={[{ key: 'barbershops', label: 'Barbearias' }, { key: 'users', label: 'Utilizadores' }, { key: 'appointments', label: 'Marcações' }]} />
            <Panel title="Receita diária registada" description="Subscrições manuais marcadas como pagas + vendas POS concluídas/pagas. Não representa receita Stripe reconciliada.">
              <div className="flex h-40 items-end gap-1 border-b border-white/10 pb-1 sm:h-52">
                {report.daily.map((row) => {
                  const max = Math.max(1, ...report.daily.map((item) => item.revenue));
                  return <div key={row.date} title={`${date(row.date)} · ${money(row.revenue)}`} className="flex h-full min-w-0 flex-1 items-end"><div className="w-full rounded-t-sm bg-emerald-300/80" style={{ height: `${Math.max(row.revenue ? 3 : 0, (row.revenue / max) * 100)}%` }} /></div>;
                })}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-zinc-600"><span>{report.daily[0] ? date(report.daily[0].date) : '—'}</span><span>{report.daily.at(-1) ? date(report.daily.at(-1)!.date) : '—'}</span></div>
            </Panel>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <StatusBars title="Estado das marcações · período selecionado" rows={report.appointmentStatuses} />
            <StatusBars title="Estado das subscrições · total da plataforma" rows={report.subscriptionStatuses} />
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Marketing enviado" value={number(p!.marketingSent)} note={`${number(p!.marketingFailed)} falhas registadas`} icon={Mail} accent={p!.marketingFailed ? 'warn' : 'good'} />
            <MetricCard title="Automações" value={number(p!.automationRuns)} note={`${number(p!.automationFailed)} execuções falhadas`} icon={Activity} accent={p!.automationFailed ? 'warn' : 'good'} />
            <MetricCard title="Suporte em aberto" value={number(p!.openSupportConversations)} note="Conversas que ainda não estão fechadas ou resolvidas" icon={Users} />
            <MetricCard title="Encomendas" value={number(totals!.marketplaceOrders)} note={`${number(p!.marketplaceOrders)} criadas no período selecionado`} icon={ShoppingBag} />
          </section>

          <Panel title="Atividade administrativa recente" description="Registos de auditoria sem expor mensagens, emails ou outros dados pessoais.">
            {report.recentActivity.length ? <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs">
              <thead><tr className="border-b border-white/10 text-zinc-500"><th className="pb-3 pr-4 font-medium">Ação</th><th className="pb-3 pr-4 font-medium">Área</th><th className="pb-3 text-right font-medium">Data</th></tr></thead>
              <tbody>{report.recentActivity.map((item, index) => <tr key={`${item.createdAt}-${index}`} className="border-b border-white/[0.05] last:border-0"><td className="py-3 pr-4 font-medium text-zinc-200">{item.action.replace(/[._-]+/g, ' ')}</td><td className="py-3 pr-4 text-zinc-400">{item.entityType}</td><td className="py-3 text-right text-zinc-500">{dateTime(item.createdAt)}</td></tr>)}</tbody>
            </table></div> : <p className="text-sm text-zinc-500">Ainda não existem eventos de auditoria.</p>}
          </Panel>
          <p className="text-[11px] leading-5 text-zinc-600">Os valores dependem dos registos disponíveis na base de dados e da instrumentação ativa. Os totais de receita apresentados não substituem a reconciliação contabilística/Stripe. Última atualização: {dateTime(report.generatedAt)}.</p>
        </> : null}
      </div>
    </main>
  );
}
