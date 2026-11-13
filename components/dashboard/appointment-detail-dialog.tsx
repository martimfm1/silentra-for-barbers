'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  CalendarClock,
  CalendarDays,
  CalendarX2,
  Check,
  Clock3,
  Loader2,
  Mail,
  Phone,
  UserRound,
  Wallet,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/app/state/_components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { AppointmentCompletionDialog } from './appointment-completion-dialog';
import type { Appointment } from '@/types';

type Props = {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReschedule: (
    appointmentId: string,
    date: string,
    time: string,
  ) => Promise<boolean>;
  onCancel: (appointmentId: string) => Promise<boolean>;
  onCancelSeries?: (
    appointmentId: string,
    scope: 'future' | 'all',
  ) => Promise<boolean>;
  valueProducts: string;
  setValueProducts: (value: string) => void;
  descriptionProducts: string;
  setDescriptionProducts: (value: string) => void;
  finalizeBooking: (appointmentId: string, paymentMethod: string) => Promise<boolean>;
  addCompletedAppointmentClient: (appointmentId: string) => void | Promise<void>;
  addingClientAppointmentId: string | null;
  locale?: string;
};

function DetailItem({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/8 bg-white/[0.025] p-4 transition-colors hover:border-white/12 hover:bg-white/[0.04]">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        <span className="shrink-0 text-zinc-400" aria-hidden="true">
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <div className="mt-2 min-w-0 break-words text-sm leading-6 text-zinc-100">
        {children}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `appointment-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function PaymentSummary({
  appointment,
  servicePrice,
  extra,
  total,
}: {
  appointment: Appointment;
  servicePrice: number;
  extra: number;
  total: number;
}) {
  const paymentLabel =
    appointment.payment_method === 'cash'
      ? 'Dinheiro'
      : appointment.payment_method === 'mbway'
        ? 'MB WAY'
        : appointment.payment_method === 'card'
          ? 'Cartão'
          : appointment.payment_method || 'Ainda não registado';
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
        <Wallet className="size-4 text-emerald-300" aria-hidden="true" />
        Resumo financeiro
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-white/8 bg-black/15">
        <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <span className="text-zinc-500">Serviço</span>
          <span className="font-medium tabular-nums text-zinc-200">
            {servicePrice.toFixed(2)} €
          </span>
        </div>
        <div className="border-t border-white/8 px-4 py-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-zinc-500">Produtos</span>
            <span className="font-medium tabular-nums text-zinc-200">
              {extra.toFixed(2)} €
            </span>
          </div>
        </div>
        <div className="border-t border-white/8 bg-white/[0.02] px-4 py-4">
          <div className="flex items-end justify-between gap-4">
            <span className="text-sm font-semibold text-zinc-300">Total</span>
            <span className="text-xl font-semibold tabular-nums text-white">
              {total.toFixed(2)} €
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-white/8 bg-black/15 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Pagamento
        </p>
        <p className="mt-1.5 text-sm font-medium text-zinc-200">
          {paymentLabel}
        </p>
        {appointment.payment_status && (
          <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/[.04] p-3">
            <p className="text-xs font-semibold text-amber-200">
              {appointment.payment_status === 'awaiting_review'
                ? 'Pré-pagamento MB WAY por validar'
                : appointment.payment_status === 'confirmed'
                  ? 'Pré-pagamento MB WAY confirmado'
                  : appointment.payment_status === 'expired'
                    ? 'Pré-pagamento expirado'
                    : 'Pré-pagamento rejeitado'}
            </p>
            {appointment.payment_amount !== null &&
              appointment.payment_amount !== undefined && (
                <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-100">
                  {Number(appointment.payment_amount).toFixed(2)} €
                </p>
              )}
            {appointment.payment_status === 'awaiting_review' && (
              <p className="mt-2 text-xs leading-5 text-zinc-400">
                Confirma a marcação apenas depois de verificares a entrada do
                pagamento na tua conta MB WAY. O horário é libertado quando
                termina o prazo de 15 minutos.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function toLocalDateInputValue(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLocalTimeInputValue(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function AppointmentDetailDialog({
  appointment,
  open,
  onOpenChange,
  onReschedule,
  onCancel,
  onCancelSeries,
  valueProducts,
  setValueProducts,
  descriptionProducts,
  setDescriptionProducts,
  finalizeBooking,
  addCompletedAppointmentClient,
  addingClientAppointmentId,
  locale = 'pt',
}: Props) {
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isCancelConfirmationOpen, setIsCancelConfirmationOpen] =
    useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCompletionOpen, setIsCompletionOpen] = useState(false);
  const [seriesCancelScope, setSeriesCancelScope] = useState<
    'future' | 'all' | null
  >(null);

  useEffect(() => {
    if (!appointment) return;
    setEditDate(toLocalDateInputValue(appointment.date_hour));
    setEditTime(toLocalTimeInputValue(appointment.date_hour));
    setIsEditingSchedule(false);
    setIsCompletionOpen(false);
  }, [appointment?.id, appointment?.date_hour, open]);

  if (!appointment) return null;
  const date = new Date(appointment.date_hour);
  const clientName =
    appointment.users?.name_complete || appointment.manual_name || 'Cliente';
  const phone = appointment.users?.num_phone || appointment.manual_phone;
  const email = appointment.users?.email || appointment.manual_email || '';
  const birthDate =
    appointment.users?.birth_date || appointment.manual_birth_date;
  const serviceName = appointment.services?.name || 'Serviço';
  const professionalName = appointment.professionals?.name || 'Sem barbeiro';
  const extra = Number(appointment.value_products ?? 0);
  const servicePrice = Number(appointment.services?.price ?? 0);
  const total = servicePrice + extra;
  const isEnglish = locale === 'en';
  const canReschedule =
    appointment.status === 'pending' || appointment.status === 'scheduled';
  const canCancel = canReschedule;
  const canCancelSeries =
    canCancel && Boolean(appointment.recurrence_series_id) && Boolean(onCancelSeries);
  const originalDate = toLocalDateInputValue(appointment.date_hour);
  const originalTime = toLocalTimeInputValue(appointment.date_hour);
  const today = toLocalDateInputValue(new Date());
  const scheduleStatusHint =
    appointment.status === 'scheduled'
      ? isEnglish
        ? 'This booking will stay confirmed. The customer will receive an email with the updated time.'
        : 'A marcação continuará confirmada. O cliente receberá um email com o novo horário.'
      : isEnglish
        ? 'This booking will remain pending confirmation. The customer will receive the updated time without an automatic confirmation.'
        : 'A marcação continuará pendente de confirmação. O cliente receberá o novo horário, sem confirmação automática.';
  const dateLabel = date.toLocaleDateString('pt-PT', { dateStyle: 'full' });
  const timeLabel = date.toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleScheduleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canReschedule || !editDate || !editTime) return;
    setIsSavingSchedule(true);
    try {
      const completed = await onReschedule(appointment.id, editDate, editTime);
      if (completed) setIsEditingSchedule(false);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleSeriesCancellation = async () => {
    if (!seriesCancelScope || !canCancelSeries || isCancelling) return;
    setIsCancelling(true);
    try {
      const cancelled = await onCancelSeries?.(
        appointment.id,
        seriesCancelScope,
      );
      if (cancelled) {
        setSeriesCancelScope(null);
        onOpenChange(false);
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCancellation = async () => {
    if (!canCancel || isCancelling) return;
    setIsCancelling(true);
    try {
      const cancelled = await onCancel(appointment.id);
      if (cancelled) {
        setIsCancelConfirmationOpen(false);
        onOpenChange(false);
      }
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="appointment-detail-description"
        className="ph-no-capture !max-w-6xl flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-2xl border-white/10 bg-zinc-950 p-0 text-white shadow-[0_30px_120px_rgba(0,0,0,0.55)] sm:max-h-[calc(100dvh-2rem)] sm:w-[min(94vw,72rem)] sm:rounded-3xl"
      >
        <DialogHeader className="shrink-0 border-b border-white/10 px-4 py-4 backdrop-blur-xl sm:px-6 sm:py-5">
          <div className="pr-9">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <DialogTitle className="break-words text-lg font-semibold tracking-[-0.02em] text-white sm:text-2xl">
                  {clientName}
                </DialogTitle>
                <DialogDescription
                  id="appointment-detail-description"
                  className="mt-1 max-w-2xl text-xs leading-5 text-zinc-400 sm:text-sm sm:leading-6"
                >
                  Detalhes da marcação, cliente, profissional e pagamento.
                </DialogDescription>
              </div>
              <div className="shrink-0 self-start">
                <StatusBadge status={appointment.status} />
              </div>
            </div>
            <div
              className="mt-3 flex flex-wrap gap-2"
              aria-label="Resumo da marcação"
            >
              <span className="max-w-full truncate rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-zinc-300">
                {dateLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-zinc-300">
                {timeLabel}
              </span>
              <span className="max-w-full truncate rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-300">
                {serviceName}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6">
          <div className="space-y-6 md:grid md:grid-cols-[minmax(0,1fr)_22rem] md:items-start md:gap-8 md:space-y-0">
            <div className="min-w-0 space-y-6">
              <Section title="Marcação">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <DetailItem
                    icon={<CalendarDays className="size-3.5" />}
                    label="Data"
                  >
                    {dateLabel}
                  </DetailItem>
                  <DetailItem
                    icon={<Clock3 className="size-3.5" />}
                    label="Hora"
                  >
                    {timeLabel}
                  </DetailItem>
                  <DetailItem
                    icon={<UserRound className="size-3.5" />}
                    label="Profissional"
                  >
                    {professionalName}
                  </DetailItem>
                  <DetailItem
                    icon={<Clock3 className="size-3.5" />}
                    label="Serviço"
                  >
                    {serviceName}
                  </DetailItem>
                </div>
              </Section>
              {appointment.status === 'scheduled' ? (
                <Section
                  title={isEnglish ? 'Complete appointment' : 'Concluir marcação'}
                >
                  <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.035] p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-100">
                          {isEnglish
                            ? 'Has the service been completed?'
                            : 'O atendimento já foi realizado?'}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-400">
                          {isEnglish
                            ? 'Mark it as completed, record the payment method and any extra products.'
                            : 'Marca o atendimento como concluído e regista o método de pagamento e eventuais produtos adicionais.'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => setIsCompletionOpen(true)}
                        className="min-h-11 shrink-0 bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                      >
                        <Check className="mr-2 size-4" aria-hidden="true" />
                        {isEnglish ? 'Complete booking' : 'Concluir marcação'}
                      </Button>
                    </div>
                  </div>
                </Section>
              ) : null}
              {canReschedule ? (
                <Section
                  title={isEnglish ? 'Change booking' : 'Alterar marcação'}
                >
                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                    {!isEditingSchedule ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-100">
                            {isEnglish
                              ? 'Need to change this time?'
                              : 'Precisas de alterar este horário?'}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-zinc-400">
                            {scheduleStatusHint}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsEditingSchedule(true)}
                          className="min-h-11 shrink-0 border-white/10 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]"
                        >
                          <CalendarClock
                            className="mr-2 size-4"
                            aria-hidden="true"
                          />
                          {isEnglish
                            ? 'Change date and time'
                            : 'Alterar data e hora'}
                        </Button>
                      </div>
                    ) : (
                      <form
                        onSubmit={handleScheduleSubmit}
                        className="space-y-4"
                      >
                        <p className="text-xs leading-5 text-zinc-400">
                          {isEnglish
                            ? 'Choose a new date and time. Availability is checked before the change is saved.'
                            : 'Escolhe uma nova data e hora. A disponibilidade é validada antes de guardar a alteração.'}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="min-w-0 space-y-1.5">
                            <label
                              htmlFor={`reschedule-date-${appointment.id}`}
                              className="text-xs font-medium text-zinc-300"
                            >
                              {isEnglish ? 'New date' : 'Nova data'}
                            </label>
                            <input
                              id={`reschedule-date-${appointment.id}`}
                              type="date"
                              required
                              min={today}
                              value={editDate}
                              onChange={(event) =>
                                setEditDate(event.target.value)
                              }
                              className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none transition focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10"
                            />
                          </div>
                          <div className="min-w-0 space-y-1.5">
                            <label
                              htmlFor={`reschedule-time-${appointment.id}`}
                              className="text-xs font-medium text-zinc-300"
                            >
                              {isEnglish ? 'New time' : 'Nova hora'}
                            </label>
                            <input
                              id={`reschedule-time-${appointment.id}`}
                              type="time"
                              required
                              step={300}
                              value={editTime}
                              onChange={(event) =>
                                setEditTime(event.target.value)
                              }
                              className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none transition focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isSavingSchedule}
                            onClick={() => {
                              setEditDate(originalDate);
                              setEditTime(originalTime);
                              setIsEditingSchedule(false);
                            }}
                            className="min-h-11 border-white/10 bg-transparent text-zinc-300 hover:bg-white/[0.05]"
                          >
                            {isEnglish ? 'Cancel' : 'Cancelar'}
                          </Button>
                          <Button
                            type="submit"
                            disabled={
                              isSavingSchedule ||
                              !editDate ||
                              !editTime ||
                              (editDate === originalDate &&
                                editTime === originalTime)
                            }
                            className="min-h-11 bg-emerald-300 text-zinc-950 hover:bg-emerald-200 disabled:opacity-50"
                          >
                            {isSavingSchedule ? (
                              <Loader2
                                className="mr-2 size-4 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <CalendarClock
                                className="mr-2 size-4"
                                aria-hidden="true"
                              />
                            )}
                            {isSavingSchedule
                              ? isEnglish
                                ? 'Saving…'
                                : 'A guardar…'
                              : isEnglish
                                ? 'Save new time'
                                : 'Guardar novo horário'}
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                </Section>
              ) : null}
              <Section title="Cliente">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <DetailItem
                    icon={<Phone className="size-3.5" />}
                    label="Telefone"
                  >
                    {phone ? (
                      <span className="inline-flex min-h-9 max-w-full items-center text-zinc-100">
                        {phone}
                      </span>
                    ) : (
                      <span className="text-zinc-500">Não indicado</span>
                    )}
                  </DetailItem>
                  <DetailItem
                    icon={<Mail className="size-3.5" />}
                    label="Email"
                  >
                    {email ? (
                      <span className="inline-flex min-h-9 max-w-full break-all items-center text-zinc-100">
                        {email}
                      </span>
                    ) : (
                      <span className="text-zinc-500">Não indicado</span>
                    )}
                  </DetailItem>
                  <DetailItem
                    icon={<CalendarDays className="size-3.5" />}
                    label="Nascimento"
                  >
                    {birthDate ? (
                      new Date(birthDate).toLocaleDateString('pt-PT')
                    ) : (
                      <span className="text-zinc-500">Não indicado</span>
                    )}
                  </DetailItem>
                  <DetailItem
                    icon={<UserRound className="size-3.5" />}
                    label="Cliente registado"
                  >
                    {appointment.client_id ? 'Sim' : 'Não'}
                  </DetailItem>
                </div>
              </Section>
              {canCancel ? (
                <Section
                  title={isEnglish ? 'Cancel booking' : 'Cancelar marcação'}
                >
                  <div className="rounded-2xl border border-rose-400/15 bg-rose-400/[0.035] p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-100">
                          {isEnglish
                            ? 'Need to cancel this booking?'
                            : 'Precisas de cancelar esta marcação?'}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-400">
                          {appointment.payment_status === 'awaiting_review'
                            ? isEnglish
                              ? 'The MB WAY prepayment will be rejected and the customer will be notified by email.'
                              : 'O pré-pagamento MB WAY será rejeitado e o cliente será notificado por email.'
                            : isEnglish
                              ? 'The booking will be cancelled and the customer will be notified by email.'
                              : 'A marcação será cancelada e o cliente será notificado por email.'}
                        </p>
                      </div>
                      <AlertDialog
                        open={isCancelConfirmationOpen}
                        onOpenChange={(nextOpen) => {
                          if (!isCancelling) {
                            setIsCancelConfirmationOpen(nextOpen);
                          }
                        }}
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="min-h-11 shrink-0 border border-rose-400/20 bg-rose-400/[0.08] text-rose-200 hover:bg-rose-400/[0.14]"
                          >
                            <CalendarX2
                              className="mr-2 size-4"
                              aria-hidden="true"
                            />
                            {isEnglish
                              ? 'Cancel booking'
                              : 'Cancelar marcação'}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md border-white/10 bg-zinc-950 text-white">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {appointment.payment_status === 'awaiting_review'
                                ? isEnglish
                                  ? 'Reject the prepayment and cancel?'
                                  : 'Rejeitar o pré-pagamento e cancelar?'
                                : isEnglish
                                  ? 'Cancel this booking?'
                                  : 'Cancelar esta marcação?'}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-sm leading-6 text-zinc-400">
                              {appointment.payment_status === 'awaiting_review'
                                ? isEnglish
                                  ? 'This action rejects the MB WAY prepayment, cancels the booking and sends a cancellation email to the customer.'
                                  : 'Esta ação rejeita o pré-pagamento MB WAY, cancela a marcação e envia um email de cancelamento ao cliente.'
                                : isEnglish
                                  ? 'This action cannot be undone. The booking will be cancelled and the customer will receive an email.'
                                  : 'Esta ação não pode ser anulada. A marcação será cancelada e o cliente receberá um email.'}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col-reverse sm:flex-row">
                            <AlertDialogCancel
                              disabled={isCancelling}
                              className="min-h-11 border-white/10 bg-transparent text-zinc-200 hover:bg-white/[0.06]"
                            >
                              {isEnglish ? 'Keep booking' : 'Manter marcação'}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              disabled={isCancelling}
                              onClick={(event) => {
                                event.preventDefault();
                                void handleCancellation();
                              }}
                              className="min-h-11 bg-rose-600 text-white hover:bg-rose-500"
                            >
                              {isCancelling ? (
                                <Loader2
                                  className="mr-2 size-4 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <CalendarX2
                                  className="mr-2 size-4"
                                  aria-hidden="true"
                                />
                              )}
                              {isCancelling
                                ? isEnglish
                                  ? 'Cancelling…'
                                  : 'A cancelar…'
                                : appointment.payment_status === 'awaiting_review'
                                  ? isEnglish
                                    ? 'Reject and cancel'
                                    : 'Rejeitar e cancelar'
                                  : isEnglish
                                    ? 'Confirm cancellation'
                                    : 'Confirmar cancelamento'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    {canCancelSeries ? (
                      <div className="mt-4 flex flex-col gap-2 border-t border-rose-400/10 pt-4 sm:flex-row">
                        <AlertDialog
                          open={seriesCancelScope !== null}
                          onOpenChange={(nextOpen) => {
                            if (!isCancelling && !nextOpen) setSeriesCancelScope(null);
                          }}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={isCancelling}
                              className="min-h-11 border-white/10 bg-white/[0.03] text-zinc-200"
                              onClick={() => setSeriesCancelScope('future')}
                            >
                              {isEnglish ? 'This and following' : 'Esta e as seguintes'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={isCancelling}
                              className="min-h-11 border-rose-400/20 bg-rose-400/[0.06] text-rose-200"
                              onClick={() => setSeriesCancelScope('all')}
                            >
                              {isEnglish ? 'Cancel entire series' : 'Cancelar série completa'}
                            </Button>
                          </div>
                          <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md border-white/10 bg-zinc-950 text-white">
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {seriesCancelScope === 'all'
                                  ? isEnglish ? 'Cancel the entire series?' : 'Cancelar a série completa?'
                                  : isEnglish ? 'Cancel this and all following bookings?' : 'Cancelar esta e todas as seguintes?'}
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-sm leading-6 text-zinc-400">
                                {seriesCancelScope === 'all'
                                  ? isEnglish
                                    ? 'All active bookings in this recurring series, including earlier dates, will be cancelled.'
                                    : 'Todas as marcações ativas desta série, incluindo datas anteriores, serão canceladas.'
                                  : isEnglish
                                    ? 'This booking and every later active booking in this recurring series will be cancelled.'
                                    : 'Esta marcação e todas as marcações futuras ativas desta série serão canceladas.'}
                                {' '}{isEnglish ? 'No cancellation emails will be sent for series cancellations.' : 'Não serão enviados emails de cancelamento quando cancelares uma série.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col-reverse sm:flex-row">
                              <AlertDialogCancel disabled={isCancelling} className="min-h-11 border-white/10 bg-transparent">
                                {isEnglish ? 'Keep bookings' : 'Manter marcações'}
                              </AlertDialogCancel>
                              <AlertDialogAction
                                disabled={isCancelling}
                                onClick={(event) => {
                                  event.preventDefault();
                                  void handleSeriesCancellation();
                                }}
                                className="min-h-11 bg-rose-600 text-white hover:bg-rose-500"
                              >
                                {isCancelling ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CalendarX2 className="mr-2 size-4" />}
                                {isEnglish ? 'Confirm series cancellation' : 'Confirmar cancelamento da série'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ) : null}
                  </div>
                </Section>
              ) : null}
              {appointment.status === 'cancelled' ? (
                <Section
                  title={
                    isEnglish
                      ? 'Cancellation history'
                      : 'Histórico de cancelamento'
                  }
                >
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <DetailItem
                      icon={<Clock3 className="size-3.5" />}
                      label={isEnglish ? 'Cancelled at' : 'Cancelada em'}
                    >
                      {appointment.cancelled_at
                        ? new Date(appointment.cancelled_at).toLocaleString(
                            isEnglish ? 'en-GB' : 'pt-PT',
                            { dateStyle: 'medium', timeStyle: 'short' },
                          )
                        : isEnglish
                          ? 'Date not recorded'
                          : 'Data não registada'}
                    </DetailItem>
                    <DetailItem
                      icon={<UserRound className="size-3.5" />}
                      label={isEnglish ? 'Cancelled by' : 'Cancelada por'}
                    >
                      {appointment.cancellation_actor_name ||
                        (appointment.cancellation_actor === 'customer'
                          ? isEnglish
                            ? 'Customer'
                            : 'Cliente'
                          : appointment.cancellation_actor === 'staff'
                            ? isEnglish
                              ? 'Barbershop team'
                              : 'Equipa da barbearia'
                            : isEnglish
                              ? 'Not recorded'
                              : 'Não registado')}
                    </DetailItem>
                    <div className="sm:col-span-2">
                      <DetailItem
                        icon={<CalendarClock className="size-3.5" />}
                        label={
                          isEnglish
                            ? 'Cancellation reason'
                            : 'Motivo do cancelamento'
                        }
                      >
                        {appointment.cancellation_reason ||
                          (isEnglish
                            ? 'No reason provided.'
                            : 'Não foi indicado um motivo.')}
                      </DetailItem>
                    </div>
                  </div>
                </Section>
              ) : null}
              {appointment.users?.style_notes ||
              appointment.description_products ? (
                <Section title="Notas">
                  <div className="space-y-2.5">
                    {appointment.users?.style_notes ? (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          Preferências / notas do cliente
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                          {appointment.users.style_notes}
                        </p>
                      </div>
                    ) : null}
                    {appointment.description_products ? (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          Produtos adicionais
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                          {appointment.description_products}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </Section>
              ) : null}
            </div>
            <div className="min-w-0 md:sticky md:top-0">
              <PaymentSummary
                appointment={appointment}
                servicePrice={servicePrice}
                extra={extra}
                total={total}
              />
            </div>
          </div>
        </div>
      </DialogContent>
      <AppointmentCompletionDialog
        appointment={appointment}
        open={isCompletionOpen}
        onOpenChange={setIsCompletionOpen}
        valueProducts={valueProducts}
        setValueProducts={setValueProducts}
        descriptionProducts={descriptionProducts}
        setDescriptionProducts={setDescriptionProducts}
        finalizeBooking={finalizeBooking}
        addCompletedAppointmentClient={addCompletedAppointmentClient}
        addingClientAppointmentId={addingClientAppointmentId}
        locale={locale}
        onCompleted={() => onOpenChange(false)}
      />
    </Dialog>
  );
}
