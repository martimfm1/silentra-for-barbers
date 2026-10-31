'use client';

import type { ReactNode } from 'react';
import {
  CalendarDays,
  Clock3,
  Mail,
  Phone,
  UserRound,
  Wallet,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/app/state/_components/shared/StatusBadge';
import type { Appointment } from '@/types';

type Props = {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
            {appointment.payment_amount !== null && appointment.payment_amount !== undefined && (
              <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-100">{Number(appointment.payment_amount).toFixed(2)} €</p>
            )}
            {appointment.payment_status === 'awaiting_review' && (
              <p className="mt-2 text-xs leading-5 text-zinc-400">Confirma a marcação apenas depois de verificares a entrada do pagamento na tua conta MB WAY. O horário é libertado quando termina o prazo de 15 minutos.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AppointmentDetailDialog({
  appointment,
  open,
  onOpenChange,
}: Props) {
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
  const dateLabel = date.toLocaleDateString('pt-PT', { dateStyle: 'full' });
  const timeLabel = date.toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="appointment-detail-description"
        className="!max-w-6xl flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-2xl border-white/10 bg-zinc-950 p-0 text-white shadow-[0_30px_120px_rgba(0,0,0,0.55)] sm:max-h-[calc(100dvh-2rem)] sm:w-[min(94vw,72rem)] sm:rounded-3xl"
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
              <Section title="Cliente">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <DetailItem
                    icon={<Phone className="size-3.5" />}
                    label="Telefone"
                  >
                    {phone ? (
                      <a
                        href={`tel:${phone}`}
                        className="inline-flex min-h-9 max-w-full items-center rounded-lg text-zinc-100 underline decoration-white/20 underline-offset-4 transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                      >
                        {phone}
                      </a>
                    ) : (
                      <span className="text-zinc-500">Não indicado</span>
                    )}
                  </DetailItem>
                  <DetailItem
                    icon={<Mail className="size-3.5" />}
                    label="Email"
                  >
                    {email ? (
                      <a
                        href={`mailto:${email}`}
                        className="inline-flex min-h-9 max-w-full break-all rounded-lg text-zinc-100 underline decoration-white/20 underline-offset-4 transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                      >
                        {email}
                      </a>
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
    </Dialog>
  );
}
