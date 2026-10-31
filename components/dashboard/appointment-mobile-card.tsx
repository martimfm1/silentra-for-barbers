'use client';

import type { ComponentProps } from 'react';
import { CalendarDays, Clock3, User } from 'lucide-react';
import type { Appointment } from '@/types';
import { StatusBadge } from '@/app/state/_components/shared/StatusBadge';
import { AppointmentActions } from './appointment-actions';

type Props = ComponentProps<typeof AppointmentActions>;

const statusRail: Record<Appointment['status'], string> = {
  pending: 'bg-amber-400',
  scheduled: 'bg-sky-400',
  completed: 'bg-emerald-400',
  cancelled: 'bg-rose-400',
};

export function AppointmentMobileCard({
  appointment,
  onDetails,
  ...actionProps
}: Props) {
  const date = new Date(appointment.date_hour);
  const phone = appointment.users?.num_phone || appointment.manual_phone;
  const name =
    appointment.users?.name_complete || appointment.manual_name || 'Cliente';
  const service = appointment.services?.name || 'Serviço';
  const professional = appointment.professionals?.name || 'Sem barbeiro';
  const time = date.toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <article
      className="relative cursor-pointer rounded-2xl border border-white/[0.07] bg-white/[0.018] p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-[transform,background,border-color] duration-200 active:scale-[0.99] hover:border-white/[0.12] hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
      onClick={onDetails}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && onDetails) {
          event.preventDefault();
          onDetails();
        }
      }}
      tabIndex={onDetails ? 0 : undefined}
      role={onDetails ? 'button' : undefined}
      aria-label={onDetails ? `Ver detalhes da marcação de ${name}` : undefined}
    >
      <span
        className={`absolute inset-y-4 left-0 w-0.5 rounded-full ${statusRail[appointment.status]}`}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-zinc-100">
              {name}
            </h3>
            <StatusBadge status={appointment.status} />
            {appointment.payment_status === 'awaiting_review' && (
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-200">MB WAY por validar</span>
            )}
          </div>
          {phone ? (
            <a
              href={`tel:${phone}`}
              onClick={(event) => event.stopPropagation()}
              className="mt-1 block w-fit text-xs text-zinc-500 underline-offset-4 hover:text-emerald-300 hover:underline"
              aria-label={`Ligar a ${name}`}
            >
              {phone}
            </a>
          ) : (
            <span className="mt-1 block text-xs text-zinc-600">
              Sem telefone
            </span>
          )}
        </div>
        <div className="shrink-0 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.035] px-2.5 py-2 text-right">
          <p className="text-sm font-semibold tabular-nums text-zinc-100">
            {time}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-600">
            {date.toLocaleDateString('pt-PT')}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/[0.055] bg-black/10 p-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
            Serviço
          </span>
          <p className="mt-1 truncate text-sm font-medium text-zinc-200">
            {service}
          </p>
          <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-zinc-500">
            <User className="size-3 shrink-0" aria-hidden="true" />
            {professional}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.055] bg-black/10 p-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
            Quando
          </span>
          <p className="mt-1 flex items-center gap-1 text-sm font-medium tabular-nums text-zinc-200">
            <Clock3 className="size-3.5 text-zinc-500" aria-hidden="true" />
            {time}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-500">
            <CalendarDays className="size-3" aria-hidden="true" />
            {date.toLocaleDateString('pt-PT')}
          </p>
        </div>
      </div>

      <div className="mt-3 border-t border-white/[0.055] pt-3">
        <AppointmentActions
          appointment={appointment}
          onDetails={onDetails}
          {...actionProps}
        />
      </div>
    </article>
  );
}
