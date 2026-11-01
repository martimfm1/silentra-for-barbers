'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  Pencil,
  Clock3,
  Mail,
  MessageSquareText,
  Phone,
  Scissors,
  UserRound,
} from 'lucide-react';
import type { Client } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { appointmentService } from '@/app/dashboard/_services/appointments.service';
import { clientsService } from '@/app/dashboard/_services/clients.service';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ClientProfile = Client & { created_at?: string };

type ClientHistoryEntry = {
  id: string;
  date_hour: string;
  status: string;
  payment_method?: string | null;
  payment_status?: string | null;
  services?: { name?: string | null; price?: number | string | null } | null;
  professionals?: { name?: string | null } | null;
};

type ClientNoteEntry = {
  id: string;
  content: string;
  author_id: string;
  created_at: string;
  updated_at?: string;
};

type ClientProfileDialogProps = {
  client: ClientProfile | null;
  barbershopId: string | null;
  onClose: () => void;
  onEdit: (client: Client) => void;
};

export function ClientProfileDialog({
  client,
  barbershopId,
  onClose,
  onEdit,
}: ClientProfileDialogProps) {
  const { t, locale } = useLanguage();
  const [history, setHistory] = useState<ClientHistoryEntry[]>([]);
  const [notes, setNotes] = useState<ClientNoteEntry[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const dateLocale = locale === 'en' ? 'en-GB' : 'pt-PT';
  const completedVisits = useMemo(
    () => history.filter((appointment) => appointment.status === 'completed'),
    [history],
  );
  const lastVisit = completedVisits[0] ?? null;

  useEffect(() => {
    if (!client || !barbershopId) {
      setHistory([]);
      setNotes([]);
      setNoteDraft('');
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void Promise.all([
      appointmentService.getClientHistory(barbershopId, client.id),
      clientsService.getClientNotes(barbershopId, client.id),
    ])
      .then(([historyResult, notesResult]) => {
        if (historyResult.error) throw historyResult.error;
        if (notesResult.error) throw notesResult.error;
        if (cancelled) return;
        setHistory((historyResult.data ?? []) as ClientHistoryEntry[]);
        setNotes((notesResult.data ?? []) as ClientNoteEntry[]);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('[CLIENT_PROFILE_LOAD_ERROR]', error);
        setLoadError(t('clientsPage.detailLoadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [barbershopId, client?.id, t]);

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !barbershopId || !noteDraft.trim()) return;

    setSavingNote(true);
    try {
      const { data, error } = await clientsService.addClientNote(
        barbershopId,
        client.id,
        noteDraft.trim(),
      );
      if (error) throw error;
      if (data) {
        setNotes((current) => [data as ClientNoteEntry, ...current]);
        setNoteDraft('');
      }
    } catch (error) {
      console.error('[CLIENT_PROFILE_NOTE_ERROR]', error);
      setLoadError(t('clientsPage.noteSaveError'));
    } finally {
      setSavingNote(false);
    }
  }

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(dateLocale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString(dateLocale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const statusLabel = (status: string) => {
    if (status === 'completed') return t('clientsPage.statusCompleted');
    if (status === 'scheduled') return t('clientsPage.statusScheduled');
    if (status === 'pending') return t('clientsPage.statusPending');
    if (status === 'cancelled') return t('clientsPage.statusCancelled');
    return status;
  };

  return (
    <Dialog open={!!client} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-5xl overflow-y-auto rounded-2xl border-white/10 bg-zinc-950 p-4 text-zinc-100 sm:w-[calc(100%-2rem)] sm:p-6">
        {client ? (
          <>
            <DialogHeader className="pr-12">
              <div className="flex items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-400/10 text-lg font-semibold text-blue-200">
                  {client.name_complete.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <DialogTitle className="truncate text-xl sm:text-2xl">
                    {client.name_complete}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {t('clientsPage.detailDescription')}
                  </DialogDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onEdit(client)}
                  className="ml-auto min-h-11 shrink-0 gap-2 border-white/10 bg-white/[0.035] px-3 text-xs text-zinc-200 hover:bg-white/[0.08]"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  {t('clientsPage.editTitle')}
                </Button>
              </div>
            </DialogHeader>

            {loadError ? (
              <p
                role="alert"
                className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200"
              >
                {loadError}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {t('clientsPage.totalBookings')}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
                  {history.length}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {t('clientsPage.completedVisits')}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
                  {completedVisits.length}
                </p>
              </div>
              <div className="col-span-2 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 sm:col-span-1 sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {t('clientsPage.lastVisit')}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {lastVisit ? formatDate(lastVisit.date_hour) : '—'}
                </p>
              </div>
            </div>

            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
              <div className="min-w-0 space-y-4">
                <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-4 text-blue-300" aria-hidden="true" />
                    <h3 className="font-semibold text-white">
                      {t('clientsPage.appointmentHistory')}
                    </h3>
                  </div>

                  {loading ? (
                    <div className="flex min-h-28 items-center justify-center">
                      <Spinner className="size-5" />
                    </div>
                  ) : history.length === 0 ? (
                    <p className="py-8 text-center text-sm text-zinc-500">
                      {t('clientsPage.noAppointmentHistory')}
                    </p>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {history.map((appointment) => {
                        const price = Number(appointment.services?.price);
                        const hasPrice = Number.isFinite(price) && price >= 0;
                        return (
                          <article
                            key={appointment.id}
                            className="rounded-xl border border-white/[0.07] bg-black/15 p-3 sm:p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium text-zinc-100">
                                  {appointment.services?.name || t('clientsPage.unknownService')}
                                </p>
                                <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                                  <Clock3 className="size-3.5" aria-hidden="true" />
                                  {formatDateTime(appointment.date_hour)}
                                </p>
                              </div>
                              <span
                                className={
                                  appointment.status === 'completed'
                                    ? 'rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-2.5 py-1 text-[10px] font-semibold text-emerald-200'
                                    : appointment.status === 'cancelled'
                                      ? 'rounded-full border border-red-300/20 bg-red-300/[0.08] px-2.5 py-1 text-[10px] font-semibold text-red-200'
                                      : 'rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-zinc-300'
                                }
                              >
                                {statusLabel(appointment.status)}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-xs text-zinc-500">
                              <span className="inline-flex min-w-0 items-center gap-1.5">
                                <Scissors className="size-3.5 shrink-0" aria-hidden="true" />
                                <span className="truncate">
                                  {appointment.professionals?.name || t('clientsPage.noProfessional')}
                                </span>
                              </span>
                              <span className="flex items-center gap-3">
                                {appointment.payment_method ? (
                                  <span className="uppercase tracking-wide">
                                    {appointment.payment_method}
                                  </span>
                                ) : null}
                                {hasPrice ? (
                                  <span className="font-semibold text-zinc-200">
                                    {new Intl.NumberFormat(dateLocale, {
                                      style: 'currency',
                                      currency: 'EUR',
                                    }).format(price)}
                                  </span>
                                ) : null}
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="size-4 text-blue-300" aria-hidden="true" />
                    <h3 className="font-semibold text-white">
                      {t('clientsPage.internalNotes')}
                    </h3>
                  </div>
                  <form onSubmit={(event) => void addNote(event)} className="mt-4 space-y-3">
                    <Textarea
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      maxLength={5000}
                      rows={3}
                      placeholder={t('clientsPage.notePlaceholder')}
                      aria-label={t('clientsPage.internalNotes')}
                      className="min-h-24 resize-y border-white/10 bg-black/20 text-sm"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[11px] text-zinc-600">
                        {noteDraft.length}/5000
                      </span>
                      <Button type="submit" disabled={savingNote || !noteDraft.trim()} className="min-h-11 gap-2">
                        {savingNote ? <Spinner className="size-4" /> : <MessageSquareText className="size-4" />}
                        {t('clientsPage.addNote')}
                      </Button>
                    </div>
                  </form>

                  {loading ? null : notes.length === 0 ? (
                    <p className="mt-5 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">
                      {t('clientsPage.noNotes')}
                    </p>
                  ) : (
                    <div className="mt-5 space-y-2">
                      {notes.map((item) => (
                        <article key={item.id} className="rounded-xl border border-white/[0.07] bg-black/15 p-3 sm:p-4">
                          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">
                            {item.content}
                          </p>
                          <p className="mt-2 text-[10px] text-zinc-600">
                            {formatDateTime(item.created_at)}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <aside className="min-w-0 space-y-4">
                <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <UserRound className="size-4 text-blue-300" aria-hidden="true" />
                    <h3 className="font-semibold text-white">
                      {t('clientsPage.clientDetails')}
                    </h3>
                  </div>
                  <dl className="mt-4 space-y-4 text-sm">
                    <div>
                      <dt className="text-xs text-zinc-500">{t('clientsPage.name')}</dt>
                      <dd className="mt-1 break-words text-zinc-100">{client.name_complete}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500">{t('clientsPage.phone')}</dt>
                      <dd className="mt-1 flex items-center gap-2 text-zinc-100">
                        <Phone className="size-3.5 text-zinc-500" aria-hidden="true" />
                        {client.num_phone || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500">{t('clientsPage.email')}</dt>
                      <dd className="mt-1 flex min-w-0 items-center gap-2 text-zinc-100">
                        <Mail className="size-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                        <span className="break-all">{client.email || '—'}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500">{t('clientsPage.birthDate')}</dt>
                      <dd className="mt-1 text-zinc-100">
                        {client.birth_date
                          ? formatDate(`${client.birth_date}T12:00:00`)
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500">{t('clientsPage.clientSince')}</dt>
                      <dd className="mt-1 text-zinc-100">
                        {client.created_at ? formatDate(client.created_at) : '—'}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
                  <h3 className="font-semibold text-white">
                    {t('clientsPage.preferences')}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t('clientsPage.preferencesDescription')}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-black/20 p-3 text-sm leading-6 text-zinc-300">
                    {client.style_notes?.trim() || t('clientsPage.noPreferences')}
                  </p>
                </section>
              </aside>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
