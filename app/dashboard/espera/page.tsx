'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Scissors,
  UserRound,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

type WaitlistEntry = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  preferred_date: string;
  preferred_time_start: string | null;
  preferred_time_end: string | null;
  status: 'waiting' | 'offered' | 'booked' | 'cancelled' | 'expired';
  created_at: string;
  services?: { name?: string | null } | Array<{ name?: string | null }> | null;
  professionals?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

function relationName(
  relation: WaitlistEntry['services'] | WaitlistEntry['professionals'],
  fallback: string,
) {
  const value = Array.isArray(relation) ? relation[0] : relation;
  return value?.name || fallback;
}

function dateLabel(value: string, locale: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'pt-PT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default function WaitlistPage() {
  const { locale } = useLanguage();
  const en = locale === 'en';
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch('/api/dashboard/waitlist', {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success)
        throw new Error(payload.error || 'WAITLIST_LOAD_FAILED');
      setEntries(Array.isArray(payload.entries) ? payload.entries : []);
    } catch {
      toast.error(en ? 'Could not load the waitlist.' : 'Não foi possível carregar a lista de espera.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [en]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleEntries = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(en ? 'en-GB' : 'pt-PT');
    return entries.filter((entry) => {
      if (statusFilter === 'active' && !['waiting', 'offered'].includes(entry.status))
        return false;
      if (statusFilter !== 'active' && statusFilter !== 'all' && entry.status !== statusFilter)
        return false;
      if (!term) return true;
      return [
        entry.customer_name,
        entry.customer_email,
        entry.customer_phone,
        relationName(entry.services, ''),
        relationName(entry.professionals, ''),
      ].some((value) => value.toLocaleLowerCase(en ? 'en-GB' : 'pt-PT').includes(term));
    });
  }, [entries, en, search, statusFilter]);

  const activeCount = entries.filter((entry) => ['waiting', 'offered'].includes(entry.status)).length;

  async function updateEntry(entry: WaitlistEntry, status: 'booked' | 'cancelled' | 'expired') {
    setUpdatingId(entry.id);
    try {
      const response = await fetch('/api/dashboard/waitlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, status }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success)
        throw new Error(payload.error || 'WAITLIST_UPDATE_FAILED');
      toast.success(
        status === 'booked'
          ? en ? 'Entry marked as booked.' : 'Pedido marcado como reservado.'
          : en ? 'Entry removed from the active waitlist.' : 'Pedido removido da lista ativa.',
      );
      await load(true);
    } catch {
      toast.error(en ? 'Could not update this entry.' : 'Não foi possível atualizar este pedido.');
    } finally {
      setUpdatingId(null);
    }
  }

  const statusLabel = (status: WaitlistEntry['status']) => {
    const labels = en
      ? { waiting: 'Waiting', offered: 'Offer sent', booked: 'Booked', cancelled: 'Cancelled', expired: 'Expired' }
      : { waiting: 'À espera', offered: 'Vaga proposta', booked: 'Reservado', cancelled: 'Cancelado', expired: 'Expirado' };
    return labels[status];
  };

  return (
    <main className="silentra-page-shell dashboard-page">
      <div className="silentra-page-grid" aria-hidden="true" />
      <div className="relative z-10 mx-auto w-full max-w-[100rem] px-3 py-5 sm:px-5 sm:py-8 lg:px-8 lg:py-10">
        <header className="mb-5 flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="silentra-eyebrow mb-1">{en ? 'CUSTOMER RETENTION' : 'RETENÇÃO DE CLIENTES'}</p>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-zinc-50 sm:text-3xl">
              {en ? 'Waitlist' : 'Lista de espera'}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
              {en
                ? 'Keep track of customers waiting for an opening at your barbershop.'
                : 'Acompanha os clientes que aguardam uma vaga na tua barbearia.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-4 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/70">
                {en ? 'Active requests' : 'Pedidos ativos'}
              </p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-emerald-100">{activeCount}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0"
              onClick={() => void load(true)}
              disabled={refreshing}
              aria-label={en ? 'Refresh waitlist' : 'Atualizar lista de espera'}
            >
              <RefreshCw className={refreshing ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            </Button>
          </div>
        </header>

        <section className="rounded-2xl border border-white/[0.075] bg-black/20 p-3 backdrop-blur-xl sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" aria-hidden="true" />
              <span className="sr-only">{en ? 'Search requests' : 'Pesquisar pedidos'}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={en ? 'Search by customer, email or phone' : 'Pesquisar por cliente, email ou telefone'}
                className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-400/30"
              />
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={en ? 'Filter requests' : 'Filtrar pedidos'}>
              {[
                ['active', en ? 'Active' : 'Ativos'],
                ['all', en ? 'All' : 'Todos'],
                ['booked', en ? 'Booked' : 'Reservados'],
                ['cancelled', en ? 'Cancelled' : 'Cancelados'],
                ['expired', en ? 'Expired' : 'Expirados'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={statusFilter === value}
                  onClick={() => setStatusFilter(value)}
                  className={`min-h-10 shrink-0 rounded-xl border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${statusFilter === value ? 'border-emerald-400/30 bg-emerald-400/[0.1] text-emerald-200' : 'border-white/10 bg-white/[0.02] text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-3 py-6">
              {[0, 1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]" />)}
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-zinc-400">
                <Clock3 className="size-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-zinc-100">
                {search || statusFilter !== 'active'
                  ? en ? 'No matching requests' : 'Não existem pedidos correspondentes'
                  : en ? 'Your waitlist is empty' : 'A lista de espera está vazia'}
              </h2>
              <p className="mt-1 max-w-md text-sm leading-6 text-zinc-500">
                {en
                  ? 'When a customer requests a date with no available times, their request will appear here.'
                  : 'Quando um cliente pedir uma data sem horários disponíveis, o pedido aparecerá aqui.'}
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {visibleEntries.map((entry) => (
                <article key={entry.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-zinc-100">{entry.customer_name}</h2>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${entry.status === 'waiting' ? 'border-amber-300/20 bg-amber-300/[0.06] text-amber-200' : entry.status === 'booked' ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200' : 'border-white/10 bg-white/[0.04] text-zinc-400'}`}>
                          {statusLabel(entry.status)}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2 xl:grid-cols-4">
                        <span className="flex min-w-0 items-center gap-2"><CalendarDays className="size-3.5 shrink-0 text-zinc-600" aria-hidden="true" />{dateLabel(entry.preferred_date, locale)}</span>
                        <span className="flex min-w-0 items-center gap-2"><Scissors className="size-3.5 shrink-0 text-zinc-600" aria-hidden="true" />{relationName(entry.services, en ? 'Service unavailable' : 'Serviço indisponível')}</span>
                        <span className="flex min-w-0 items-center gap-2"><UserRound className="size-3.5 shrink-0 text-zinc-600" aria-hidden="true" />{relationName(entry.professionals, en ? 'Any barber' : 'Qualquer barbeiro')}</span>
                        <span className="flex min-w-0 items-center gap-2"><Clock3 className="size-3.5 shrink-0 text-zinc-600" aria-hidden="true" />{entry.preferred_time_start && entry.preferred_time_end ? `${entry.preferred_time_start.slice(0,5)}–${entry.preferred_time_end.slice(0,5)}` : en ? 'Any time' : 'Qualquer horário'}</span>
                      </div>
                      <div className="mt-3 flex flex-col gap-2 text-xs text-zinc-500 sm:flex-row sm:flex-wrap sm:gap-4">
                        <a className="flex min-h-8 items-center gap-2 hover:text-zinc-200" href={`mailto:${entry.customer_email}`}><Mail className="size-3.5" aria-hidden="true" />{entry.customer_email}</a>
                        <a className="flex min-h-8 items-center gap-2 hover:text-zinc-200" href={`tel:${entry.customer_phone}`}><Phone className="size-3.5" aria-hidden="true" />{entry.customer_phone}</a>
                      </div>
                    </div>
                    {['waiting', 'offered'].includes(entry.status) && (
                      <div className="grid shrink-0 grid-cols-2 gap-2 lg:w-48 lg:grid-cols-1">
                        <Button
                          type="button"
                          className="min-h-11"
                          disabled={updatingId === entry.id}
                          onClick={() => void updateEntry(entry, 'booked')}
                        >
                          <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />
                          {en ? 'Mark booked' : 'Marcar reservada'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          disabled={updatingId === entry.id}
                          onClick={() => void updateEntry(entry, 'cancelled')}
                        >
                          <XCircle className="mr-2 size-4" aria-hidden="true" />
                          {en ? 'Remove' : 'Remover'}
                        </Button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
