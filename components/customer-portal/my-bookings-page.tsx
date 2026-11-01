'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  CalendarDays,
  Clock3,
  Eye,
  LogOut,
  Mail,
  MapPin,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { LoyaltySummary } from '@/components/customer-portal/loyalty-summary';

type Appointment = {
  id: string;
  dateHour: string;
  durationMinutes: number;
  status: string;
  serviceName: string;
  professionalName: string | null;
  barbershopName: string;
  barbershopAddress: string | null;
};
type Availability = {
  date: string;
  availableSlots: string[];
  closedDay: boolean;
  blockedIntervals: Array<{
    startTime: string | null;
    endTime: string | null;
    reason: string;
  }>;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(value));
const formatShortDate = (value: string) =>
  new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
const statusLabel = (value: string) =>
  ({
    scheduled: 'Confirmada',
    pending: 'Pendente',
    cancelled: 'Cancelada',
    completed: 'Concluída',
  })[value] ?? value;

export function MyBookingsPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [past, setPast] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [details, setDetails] = useState<Appointment | null>(null);
  const [reschedule, setReschedule] = useState<Appointment | null>(null);
  const [date, setDate] = useState('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/customer-portal/appointments', {
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setSessionEmail(null);
        return;
      }
      if (!response.ok)
        throw new Error(
          data.error || 'Não foi possível carregar as marcações.',
        );
      setSessionEmail(data.email ?? null);
      setUpcoming(data.upcoming ?? []);
      setPast(data.past ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar as marcações.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/customer-portal/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || 'Não foi possível enviar o código.');
      setStep('code');
      toast.success('Código enviado. Verifica o teu email.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar o código.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/customer-portal/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Código inválido.');
      setCode('');
      await load();
      toast.success('Email confirmado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Código inválido.');
    } finally {
      setLoading(false);
    }
  }

  async function cancel(id: string) {
    if (!window.confirm('Queres mesmo cancelar esta marcação?')) return;
    setActionId(id);
    try {
      const response = await fetch(`/api/customer-portal/appointments/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || 'Não foi possível cancelar.');
      await load();
      setDetails(null);
      toast.success('Marcação cancelada.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível cancelar.',
      );
    } finally {
      setActionId(null);
    }
  }

  async function getAvailability(item: Appointment, nextDate: string) {
    setAvailabilityLoading(true);
    try {
      const response = await fetch(
        `/api/customer-portal/appointments/${item.id}?date=${encodeURIComponent(nextDate)}`,
        { cache: 'no-store' },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || 'Não foi possível carregar os horários.');
      setAvailability({
        date: nextDate,
        availableSlots: data.availableSlots ?? [],
        closedDay: Boolean(data.closedDay),
        blockedIntervals: data.blockedIntervals ?? [],
      });
    } catch (error) {
      setAvailability(null);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os horários.',
      );
    } finally {
      setAvailabilityLoading(false);
    }
  }

  function openReschedule(item: Appointment) {
    setDetails(null);
    const initial = item.dateHour.slice(0, 10);
    setReschedule(item);
    setDate(initial);
    setAvailability(null);
    void getAvailability(item, initial);
  }

  async function rescheduleTo(slot: string) {
    if (!reschedule) return;
    setActionId(reschedule.id);
    try {
      const response = await fetch(
        `/api/customer-portal/appointments/${reschedule.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, slot }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || 'Não foi possível reagendar.');
      setReschedule(null);
      setAvailability(null);
      await load();
      toast.success('Marcação reagendada.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível reagendar.',
      );
    } finally {
      setActionId(null);
    }
  }

  async function logout() {
    await fetch('/api/customer-portal/logout', { method: 'POST' });
    setSessionEmail(null);
    setUpcoming([]);
    setPast([]);
    setStep('email');
    setCode('');
    setDetails(null);
    setReschedule(null);
  }

  return (
    <div className="min-h-screen overflow-x-clip text-zinc-100 antialiased">
      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pt-28 lg:px-8 lg:pt-32">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-3xl">
            <Link
              href="/barbershops"
              className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 hover:text-zinc-300"
            >
              Explorar barbearias
            </Link>
            <h1 className="mt-3 max-w-2xl text-[2.25rem] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-5xl">
              As tuas marcações, num só lugar.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
              Consulta as tuas próximas visitas, vê todos os detalhes e gere a
              marcação sem criar uma conta.
            </p>
          </div>
          {sessionEmail && (
            <button
              onClick={logout}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-zinc-300 hover:bg-white/[0.06] sm:self-auto"
            >
              <LogOut className="size-4" /> Sair
            </button>
          )}
        </header>

        {!sessionEmail ? (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_0.58fr]">
            <div className="glassmorphism rounded-[2rem] border border-white/10 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.25)] sm:p-8">
              {step === 'email' ? (
                <form onSubmit={requestCode} className="space-y-5">
                  <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                    <Mail className="size-5 text-emerald-200" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Passo 1
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">
                      Introduz o teu email
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                      Usa o mesmo email que usaste numa marcação.
                    </p>
                  </div>
                  <label className="block">
                    <span className="sr-only">Email</span>
                    <input
                      required
                      autoComplete="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="nome@email.com"
                      className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.025] px-4 placeholder:text-zinc-600 outline-none focus:border-white/30"
                    />
                  </label>
                  <button
                    disabled={loading}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-40"
                  >
                    {loading ? 'A enviar…' : 'Enviar código'}
                    <ArrowRight className="size-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={verifyCode} className="space-y-5">
                  <div className="flex size-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
                    <ShieldCheck className="size-5 text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Passo 2
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">
                      Confirma o teu email
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                      Enviámos um código de 6 dígitos para{' '}
                      <span className="text-zinc-200">{email}</span>.
                    </p>
                  </div>
                  <label className="block">
                    <span className="sr-only">Código de confirmação</span>
                    <input
                      required
                      autoFocus
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(event) =>
                        setCode(
                          event.target.value.replace(/\D/g, '').slice(0, 6),
                        )
                      }
                      placeholder="000000"
                      className="h-16 w-full rounded-xl border border-white/10 bg-white/[0.025] px-4 text-center text-3xl tracking-[0.3em] outline-none focus:border-white/30"
                    />
                  </label>
                  <button
                    disabled={loading || code.length !== 6}
                    className="min-h-12 w-full rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950 disabled:opacity-40"
                  >
                    {loading ? 'A confirmar…' : 'Confirmar email'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setCode('');
                    }}
                    className="w-full text-sm text-zinc-500 hover:text-zinc-300"
                  >
                    Usar outro email
                  </button>
                </form>
              )}
            </div>
            <aside className="glassmorphism rounded-[2rem] border border-white/10 p-5 sm:p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Como funciona
              </p>
              <div className="mt-6 space-y-5">
                {[
                  'Introduz o email usado nas reservas.',
                  'Recebe um código único.',
                  'Vê e gere as tuas marcações.',
                ].map((text, index) => (
                  <div key={text} className="flex gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-zinc-400">{text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-7 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-zinc-500">
                Não precisas de criar uma conta. O email serve apenas para
                confirmar o teu acesso.
              </div>
            </aside>
          </section>
        ) : (
          <section className="space-y-6">
            <div className="glassmorphism flex flex-col gap-3 rounded-2xl border border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                  Área do cliente
                </p>
                <p className="mt-1 truncate text-sm text-zinc-200">
                  {sessionEmail}
                </p>
              </div>
              <button
                onClick={() => void load()}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-zinc-300 hover:bg-white/5"
              >
                <RefreshCw className="size-3.5" /> Atualizar
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
              <section className="min-w-0">
                <div className="mb-4 flex items-end justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Agenda
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                      Próximas marcações
                    </h2>
                  </div>
                  {!loading && upcoming.length > 0 && (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-zinc-300">
                      {upcoming.length}
                    </span>
                  )}
                </div>
                {loading ? (
                  <div className="glassmorphism flex h-40 items-center justify-center rounded-3xl border border-white/10 text-sm text-zinc-500">
                    A carregar…
                  </div>
                ) : upcoming.length === 0 ? (
                  <div className="glassmorphism flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 p-10 text-center sm:p-14">
                    <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-400">
                      <Calendar className="size-6" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold">
                      Não tens próximas marcações
                    </h3>
                    <p className="mt-1 max-w-sm text-sm leading-relaxed text-zinc-400">
                      Explora as barbearias disponíveis e faz uma nova marcação.
                    </p>
                    <Link
                      href="/barbershops"
                      className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-zinc-950"
                    >
                      Explorar barbearias
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {upcoming.map((item) => (
                      <article
                        key={item.id}
                        className="glassmorphism overflow-hidden rounded-2xl border border-white/10 p-4 shadow-[0_16px_45px_rgba(0,0,0,0.16)] sm:p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold uppercase tracking-wider text-zinc-400">
                              {item.barbershopName}
                            </p>
                            <h3 className="mt-1 text-lg font-semibold text-white">
                              {item.serviceName}
                            </h3>
                          </div>
                          <span className="w-fit shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                            {statusLabel(item.status)}
                          </span>
                        </div>
                        <div className="mt-5 grid gap-2 sm:grid-cols-3">
                          <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-xs text-zinc-300">
                            <CalendarDays className="size-4 shrink-0 text-emerald-400" />
                            <span className="truncate">
                              {formatShortDate(item.dateHour)}
                            </span>
                          </div>
                          <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-xs text-zinc-300">
                            <Clock3 className="size-4 shrink-0 text-emerald-400" />
                            <span className="truncate">
                              {item.durationMinutes} min ·{' '}
                              {item.professionalName || 'Qualquer barbeiro'}
                            </span>
                          </div>
                          {item.barbershopAddress && (
                            <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-xs text-zinc-300">
                              <MapPin className="size-4 shrink-0 text-emerald-400" />
                              <span className="truncate">
                                {item.barbershopAddress}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="mt-5 flex flex-col gap-2 border-t border-white/5 pt-4 sm:flex-row sm:justify-end">
                          <button
                            disabled={actionId === item.id}
                            onClick={() => setDetails(item)}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs font-semibold text-zinc-200 hover:bg-white/[0.07] disabled:opacity-50"
                          >
                            <Eye className="size-4" /> Ver detalhes
                          </button>
                          <button
                            disabled={actionId === item.id}
                            onClick={() => openReschedule(item)}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-4 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
                          >
                            Reagendar
                          </button>
                          <button
                            disabled={actionId === item.id}
                            onClick={() => void cancel(item.id)}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <aside className="space-y-4 lg:sticky lg:top-28">
                <LoyaltySummary />
              </aside>
            </div>

            {past.length > 0 && (
              <section>
                <div className="border-b border-white/10 pb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Histórico
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    Marcações anteriores
                  </h2>
                </div>
                <div className="mt-3 grid gap-2">
                  {past.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setDetails(item)}
                      className="glassmorphism flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 px-4 py-3 text-left hover:border-white/20"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-300">
                          {item.serviceName} · {item.barbershopName}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {formatShortDate(item.dateHour)}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-zinc-500">
                        {statusLabel(item.status)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </section>
        )}
      </main>

      {details && (
        <div
          className="fixed inset-0 z-[220] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-appointment-details"
        >
          <div className="glassmorphism max-h-[82dvh] w-full overflow-y-auto rounded-t-[1.75rem] border border-white/10 bg-zinc-950/95 p-5 shadow-2xl sm:max-w-lg sm:rounded-[1.75rem] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                  Detalhes da marcação
                </p>
                <h2
                  id="customer-appointment-details"
                  className="mt-2 text-xl font-semibold"
                >
                  {details.serviceName}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {details.barbershopName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetails(null)}
                aria-label="Fechar detalhes"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-zinc-400 hover:bg-white/5"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-6 grid gap-2.5">
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <p className="text-xs text-zinc-500">Data e hora</p>
                <p className="mt-1 text-sm font-medium text-zinc-100">
                  {formatDate(details.dateHour)}
                </p>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <p className="text-xs text-zinc-500">Duração</p>
                  <p className="mt-1 text-sm font-medium text-zinc-100">
                    {details.durationMinutes} minutos
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <p className="text-xs text-zinc-500">Barbeiro</p>
                  <p className="mt-1 text-sm font-medium text-zinc-100">
                    {details.professionalName || 'Qualquer barbeiro'}
                  </p>
                </div>
              </div>
              {details.barbershopAddress && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <p className="text-xs text-zinc-500">Morada</p>
                  <p className="mt-1 text-sm font-medium text-zinc-100">
                    {details.barbershopAddress}
                  </p>
                </div>
              )}
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <p className="text-xs text-zinc-500">Estado</p>
                <p className="mt-1 text-sm font-medium text-zinc-100">
                  {statusLabel(details.status)}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              {details.status !== 'cancelled' &&
                details.status !== 'completed' && (
                  <>
                    <button
                      onClick={() => void cancel(details.id)}
                      disabled={actionId === details.id}
                      className="min-h-11 rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 text-sm text-red-300 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => openReschedule(details)}
                      disabled={actionId === details.id}
                      className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950 disabled:opacity-50"
                    >
                      Reagendar
                    </button>
                  </>
                )}
            </div>
          </div>
        </div>
      )}

      {reschedule && (
        <div
          className="fixed inset-0 z-[230] flex items-end bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Reagendar marcação"
        >
          <div className="glassmorphism max-h-[88dvh] w-full overflow-y-auto rounded-t-[2rem] border border-white/10 bg-zinc-950/95 p-5 shadow-2xl sm:max-w-lg sm:rounded-[2rem] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                  Reagendar
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  Escolhe um novo horário
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {reschedule.serviceName} · {reschedule.barbershopName}
                </p>
              </div>
              <button
                onClick={() => setReschedule(null)}
                aria-label="Fechar"
                className="flex size-10 items-center justify-center rounded-xl border border-white/10 text-zinc-400 hover:bg-white/5"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <label className="mt-6 block text-xs font-medium text-zinc-400">
              Nova data
              <input
                type="date"
                min={new Intl.DateTimeFormat('en-CA', {
                  timeZone: 'Europe/Lisbon',
                }).format(new Date())}
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  void getAvailability(reschedule, event.target.value);
                }}
                className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-zinc-100 outline-none focus:border-white/30"
              />
            </label>
            {availabilityLoading ? (
              <div className="py-10 text-center text-sm text-zinc-500">
                A procurar horários…
              </div>
            ) : availability?.closedDay ? (
              <div className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] p-4 text-sm text-amber-100">
                Barbearia fechada neste dia. Escolhe outra data.
              </div>
            ) : availability && availability.availableSlots.length > 0 ? (
              <div className="mt-6">
                <p className="text-xs font-medium text-zinc-400">
                  Horários disponíveis
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {availability.availableSlots.map((slot) => (
                    <button
                      key={slot}
                      disabled={actionId === reschedule.id}
                      onClick={() => void rescheduleTo(slot)}
                      className="min-h-11 rounded-xl border border-white/10 bg-white/[0.025] text-sm font-medium hover:border-emerald-400/30 hover:bg-emerald-400/[0.07] disabled:opacity-50"
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            ) : availability ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm text-zinc-500">
                Não há horários disponíveis nesta data. Escolhe outro dia.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
