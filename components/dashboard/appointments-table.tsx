'use client';

import type { ComponentProps } from 'react';
import type { Appointment } from '@/types';
import { StatusBadge } from '@/app/state/_components/shared/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CalendarDays, Clock3, User } from 'lucide-react';
import { AppointmentActions } from './appointment-actions';

type ActionProps = Omit<
  ComponentProps<typeof AppointmentActions>,
  'appointment' | 'onDetails'
>;

type Props = ActionProps & {
  appointments: Appointment[];
  onDetails: (appointment: Appointment) => void;
  locale?: string;
};

const statusAccent: Record<Appointment['status'], string> = {
  pending: 'bg-amber-400',
  scheduled: 'bg-sky-400',
  completed: 'bg-emerald-400',
  cancelled: 'bg-rose-400',
};

export function AppointmentsTable({
  appointments,
  onDetails,
  locale = 'pt',
  ...actionProps
}: Props) {
  const isEnglish = locale === 'en';
  const languageTag = isEnglish ? 'en-GB' : 'pt-PT';

  return (
    <div className="w-full overflow-x-auto">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="w-[28%] text-zinc-500">
              {isEnglish ? 'Customer' : 'Cliente'}
            </TableHead>
            <TableHead className="w-[24%] text-zinc-500">
              {isEnglish ? 'Service' : 'Serviço'}
            </TableHead>
            <TableHead className="w-[20%] text-zinc-500">
              {isEnglish ? 'When' : 'Quando'}
            </TableHead>
            <TableHead className="w-[14%] text-zinc-500">
              {isEnglish ? 'Status' : 'Estado'}
            </TableHead>
            <TableHead className="w-[14%] text-right text-zinc-500">
              {isEnglish ? 'Actions' : 'Ações'}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((appointment) => {
            const date = new Date(appointment.date_hour);
            const phone =
              appointment.users?.num_phone || appointment.manual_phone;
            const name =
              appointment.users?.name_complete ||
              appointment.manual_name ||
              (isEnglish ? 'Customer' : 'Cliente');
            const service =
              appointment.services?.name ||
              (isEnglish ? 'Service' : 'Serviço');
            const professional =
              appointment.professionals?.name ||
              (isEnglish ? 'No barber assigned' : 'Sem barbeiro');

            return (
              <TableRow
                key={appointment.id}
                tabIndex={0}
                role="button"
                className="group cursor-pointer border-white/[0.055] transition-colors hover:bg-white/[0.025] focus-visible:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/50"
                onClick={() => onDetails(appointment)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onDetails(appointment);
                  }
                }}
                aria-label={
                  isEnglish
                    ? `View booking details for ${name}`
                    : `Ver detalhes da marcação de ${name}`
                }
              >
                <TableCell className="relative py-4 pl-5">
                  <span
                    className={`absolute inset-y-2 left-0 w-0.5 rounded-full ${statusAccent[appointment.status]}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-zinc-100">
                      {name}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-zinc-500">
                      {phone || (isEnglish ? 'No phone' : 'Sem telefone')}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-200">
                      {service}
                    </p>
                    <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-zinc-500">
                      <User className="size-3 shrink-0" aria-hidden="true" />
                      {professional}
                    </p>
                    {appointment.payment_status === 'awaiting_review' && (
                      <span className="mt-1 inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                        {isEnglish ? 'MB WAY review' : 'MB WAY por validar'}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-zinc-500">
                      <CalendarDays className="size-3.5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-medium tabular-nums text-zinc-200">
                        {date.toLocaleDateString(languageTag)}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] tabular-nums text-zinc-500">
                        <Clock3 className="size-3" aria-hidden="true" />
                        {date.toLocaleTimeString(languageTag, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  <StatusBadge status={appointment.status} />
                </TableCell>
                <TableCell
                  className="py-4"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex justify-end">
                    <AppointmentActions
                      appointment={appointment}
                      onDetails={() => onDetails(appointment)}
                      locale={locale}
                      compact
                      {...actionProps}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
