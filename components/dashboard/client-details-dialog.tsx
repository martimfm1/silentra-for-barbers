'use client';

import { useEffect, useState } from 'react';
import {
  CalendarClock,
  CalendarDays,
  Mail,
  Phone,
  Scissors,
  StickyNote,
  UserRound,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ClientPlansManager } from '@/components/dashboard/client-plans-manager';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Relation<T> = T | T[] | null | undefined;

type ClientProfile = {
  id: string;
  name_complete: string;
  email?: string | null;
  num_phone?: string | null;
  birth_date?: string | null;
  style_notes?: string | null;
  created_at: string;
};

type Appointment = {
  id: string;
  date_hour: string;
  status: string;
  service_price?: number | string | null;
  value_products?: number | string | null;
  payment_method?: string | null;
  services?: Relation<{ name?: string | null; price?: number | string | null }>;
  professionals?: Relation<{ name?: string | null }>;
};

type ClientNote = {
  id: string;
  content: string;
  author_id?: string | null;
  created_at: string;
  updated_at?: string | null;
};

type ClientDetails = {
  client: ClientProfile;
  appointments: Appointment[];
  upcomingAppointments: Appointment[];
  totalSpent: number;
  notes: ClientNote[];
};

interface ClientDetailsDialogProps {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function authHeaders(
  contentType = false,
  sessionExpiredMessage: string,
): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error(sessionExpiredMessage);
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
  };
}

function firstRelation<T>(value: Relation<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(locale === 'pt' ? 'pt-PT' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(value.includes('T') ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

function formatCurrency(value: number | string | null | undefined, locale: string) {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';

  return new Intl.NumberFormat(locale === 'pt' ? 'pt-PT' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function statusLabel(status: string, t: (key: string) => string) {
  const statusKeys: Record<string, string> = {
    pending: 'common.pending',
    scheduled: 'common.confirmed',
    completed: 'common.completed',
    cancelled: 'common.cancelled',
  };
  const key = statusKeys[status];
  return key ? t(key) : status;
}

export function ClientDetailsDialog({
  clientId,
  open,
  onOpenChange,
}: ClientDetailsDialogProps) {
  const { t, locale } = useLanguage();
  const [details, setDetails] = useState<ClientDetails | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !clientId) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDetails(null);
    setNoteDraft('');

    void (async () => {
      try {
        const response = await fetch(`/api/crm/clients/${clientId}`, {
          headers: await authHeaders(false, t('crm.sessionExpired')),
          cache: 'no-store',
          signal: controller.signal,
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error ?? t('crmDetail.loadFailed'));
        }

        if (!controller.signal.aborted) {
          setDetails({
            client: json.client,
            appointments: Array.isArray(json.appointments)
              ? json.appointments
              : [],
            upcomingAppointments: Array.isArray(json.upcomingAppointments)
              ? json.upcomingAppointments
              : [],
            totalSpent: Number(json.totalSpent) || 0,
            notes: Array.isArray(json.notes) ? json.notes : [],
          });
        }
      } catch (requestError) {
        if (controller.signal.aborted) return;
        const message =
          requestError instanceof Error
            ? requestError.message
            : t('crmDetail.loadError');
        setError(message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [clientId, open, t]);

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = noteDraft.trim();
    if (!clientId || !content || savingNote) return;

    setSavingNote(true);
    try {
      const response = await fetch(
        `/api/crm/clients/${clientId}/notes`,
        {
          method: 'POST',
          headers: await authHeaders(true, t('crm.sessionExpired')),
          body: JSON.stringify({ content }),
        },
      );
      const json = await response.json();

      if (!response.ok || !json.note) {
        throw new Error(json.error ?? t('crmDetail.saveNoteFailed'));
      }

      setDetails((current) =>
        current
          ? { ...current, notes: [json.note as ClientNote, ...current.notes] }
          : current,
      );
      setNoteDraft('');
      toast.success(t('crmDetail.noteSaved'));
    } catch (saveError) {
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : t('crmDetail.saveNoteError'),
      );
    } finally {
      setSavingNote(false);
    }
  }

  const client = details?.client;
  const appointments = details?.appointments ?? [];
  const upcomingAppointments = details?.upcomingAppointments ?? [];
  const notes = details?.notes ?? [];
  const completedAppointments = appointments.filter(
    (appointment) => appointment.status === 'completed',
  );
  const appointmentTotal = (appointment: Appointment) => {
    const service = firstRelation(appointment.services);
    const servicePrice =
      Number(appointment.service_price ?? service?.price) || 0;
    const productsPrice = Number(appointment.value_products) || 0;
    return servicePrice + productsPrice;
  };
  const totalSpent = details?.totalSpent ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] gap-5 overflow-y-auto border-white/10 bg-zinc-950 text-zinc-100 sm:max-w-5xl">
        <DialogHeader className="pr-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">
            {t('crmDetail.profile')}
          </p>
          <DialogTitle className="text-xl sm:text-2xl">
            {client?.name_complete ?? t('crmDetail.loadingClient')}
          </DialogTitle>
          <DialogDescription>
            {client?.email || client?.num_phone || t('crmDetail.customerData')}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div
            className="flex min-h-56 items-center justify-center"
            role="status"
            aria-label={t('crmDetail.loadingClient')}
          >
            <Spinner className="size-6" />
          </div>
        ) : error ? (
          <div
            className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-200"
            role="alert"
          >
            {error}
          </div>
        ) : client ? (
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.72fr)]">
            <section className="min-w-0 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border-white/10 bg-white/[0.03]">
                  <CardContent className="p-4">
                    <p className="text-xs text-zinc-500">
                      {t('crmDetail.appointmentHistory')}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {appointments.length + upcomingAppointments.length}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-white/[0.03]">
                  <CardContent className="p-4">
                    <p className="text-xs text-zinc-500">
                      {t('crmDetail.completedBookings')}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {completedAppointments.length}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-white/[0.03]">
                  <CardContent className="p-4">
                    <p className="text-xs text-zinc-500">
                      {t('crmDetail.totalSpent')}
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {formatCurrency(totalSpent, locale)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="min-w-0 border-white/10 bg-white/[0.03]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarClock className="size-5 text-blue-400" />
                    {t('clientsPage.upcomingAppointments')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {upcomingAppointments.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      {t('clientsPage.noUpcomingAppointments')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {upcomingAppointments.map((appointment) => {
                        const service = firstRelation(appointment.services);
                        const professional = firstRelation(appointment.professionals);
                        return (
                          <article
                            key={appointment.id}
                            className="flex min-w-0 flex-col gap-2 rounded-xl border border-blue-500/15 bg-blue-500/[0.04] p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-zinc-100">
                                {formatDate(appointment.date_hour, locale)}
                              </p>
                              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                                <span>{service?.name || t('clientsPage.unknownService')}</span>
                                {professional?.name ? (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>{professional.name}</span>
                                  </>
                                ) : null}
                                <span aria-hidden="true">·</span>
                                <span>{statusLabel(appointment.status, t)}</span>
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-medium tabular-nums text-zinc-200">
                              {formatCurrency(
                                appointmentTotal(appointment),
                                locale,
                              )}
                            </p>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="min-w-0 border-white/10 bg-white/[0.03]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarDays className="size-5 text-blue-400" />
                    {t('crmDetail.appointmentHistory')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {appointments.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      {t('crmDetail.noAppointments')}
                    </p>
                  ) : (
                    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                      {appointments.map((appointment) => {
                        const service = firstRelation(appointment.services);
                        const professional = firstRelation(
                          appointment.professionals,
                        );

                        return (
                          <article
                            key={appointment.id}
                            className="flex min-w-0 flex-col gap-2 rounded-xl border border-white/10 bg-black/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-zinc-100">
                                {formatDate(appointment.date_hour, locale)}
                              </p>
                              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                                <span>{service?.name || '—'}</span>
                                {professional?.name ? (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>{professional.name}</span>
                                  </>
                                ) : null}
                                <span aria-hidden="true">·</span>
                                <span>{statusLabel(appointment.status, t)}</span>
                              </p>
                              {appointment.payment_method ? (
                                <p className="mt-1 text-xs text-zinc-600">
                                  {appointment.payment_method}
                                </p>
                              ) : null}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-medium tabular-nums text-zinc-200">
                                {formatCurrency(
                                  appointment.status === 'completed'
                                    ? appointmentTotal(appointment)
                                    : null,
                                  locale,
                                )}
                              </p>
                              {appointment.status === 'completed' ? (
                                <p className="mt-1 text-[11px] text-zinc-500">
                                  {t('clientsPage.serviceAndProducts', {
                                    service: formatCurrency(
                                      Number(appointment.service_price ?? service?.price) || 0,
                                      locale,
                                    ),
                                    products: formatCurrency(
                                      Number(appointment.value_products) || 0,
                                      locale,
                                    ),
                                  })}
                                </p>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <aside className="min-w-0 space-y-4">
              <Card className="border-white/10 bg-white/[0.03]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserRound className="size-5 text-blue-400" />
                    {t('crmDetail.customerData')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Mail className="mt-0.5 size-4 shrink-0 text-zinc-500" />
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-500">{t('crmDetail.email')}</p>
                      <p className="break-all">{client.email || t('crmDetail.noEmail')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Phone className="mt-0.5 size-4 shrink-0 text-zinc-500" />
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-500">{t('crmDetail.phone')}</p>
                      <p>{client.num_phone || t('crmDetail.noPhone')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CalendarDays className="mt-0.5 size-4 shrink-0 text-zinc-500" />
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-500">{t('crmDetail.customerSince')}</p>
                      <p>{formatDate(client.created_at, locale)}</p>
                    </div>
                  </div>
                  {client.birth_date ? (
                    <div className="flex items-start gap-2.5">
                      <CalendarDays className="mt-0.5 size-4 shrink-0 text-zinc-500" />
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-500">{t('crmDetail.birthDate')}</p>
                        <p>{formatDate(client.birth_date, locale)}</p>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <ClientPlansManager clientId={client.id} />

              {client.style_notes?.trim() ? (
                <Card className="border-white/10 bg-white/[0.03]">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Scissors className="size-5 text-blue-400" />
                      {t('crmDetail.styleNotes')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap break-words text-sm text-zinc-300">
                      {client.style_notes}
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              <Card className="border-white/10 bg-white/[0.03]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <StickyNote className="size-5 text-blue-400" />
                    {t('crmDetail.internalNotes')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={addNote} className="space-y-2.5">
                    <Textarea
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      maxLength={5000}
                      rows={3}
                      placeholder={t('crmDetail.notePlaceholder')}
                      disabled={savingNote}
                    />
                    <Button
                      type="submit"
                      disabled={savingNote || !noteDraft.trim()}
                      className="min-h-10 w-full"
                    >
                      {savingNote ? (
                        <Spinner className="mr-2 size-4" />
                      ) : null}
                      {t('crmDetail.saveNote')}
                    </Button>
                  </form>

                  <div className="mt-4 space-y-2.5">
                    {notes.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                        {t('crmDetail.noNotes')}
                      </p>
                    ) : (
                      notes.map((item) => (
                        <article
                          key={item.id}
                          className="rounded-xl border border-white/10 bg-black/10 p-3"
                        >
                          <p className="whitespace-pre-wrap break-words text-sm text-zinc-200">
                            {item.content}
                          </p>
                          <p className="mt-2 text-[11px] text-zinc-500">
                            {formatDate(item.created_at, locale)}
                          </p>
                        </article>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
