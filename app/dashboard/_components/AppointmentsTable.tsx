'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/app/state/_components/shared/StatusBadge';
import { Appointment } from '@/types';
import { Check, Trash2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface AppointmentsTableProps {
  appointments: Appointment[];
  onFinalize: (id: string) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}

const formatDate = (value: string, locale: 'pt' | 'en') =>
  new Intl.DateTimeFormat(locale === 'pt' ? 'pt-PT' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

const customerName = (appointment: Appointment, fallback: string) =>
  appointment.users?.name_complete || appointment.manual_name || fallback;

export function AppointmentsTable({
  appointments,
  onFinalize,
  onDelete,
  isPending,
}: AppointmentsTableProps) {
  const { t, locale } = useLanguage();
  if (appointments.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-500 sm:p-10"
        role="status"
      >
        {t('appointmentsTable.empty')}
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/50 md:block">
        <Table>
          <TableHeader className="border-white/5 bg-zinc-900">
            <TableRow>
              <TableHead className="text-zinc-400">{t('appointmentsTable.customer')}</TableHead>
              <TableHead className="text-zinc-400">{t('appointmentsTable.service')}</TableHead>
              <TableHead className="text-zinc-400">{t('appointmentsTable.barber')}</TableHead>
              <TableHead className="text-zinc-400">{t('appointmentsTable.dateTime')}</TableHead>
              <TableHead className="text-zinc-400">{t('appointmentsTable.status')}</TableHead>
              <TableHead className="text-right text-zinc-400">{t('appointmentsTable.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.map((apt) => (
              <TableRow
                key={apt.id}
                className="border-white/5 hover:bg-white/[0.02]"
              >
                <TableCell className="font-medium text-white">
                  {customerName(apt, t('appointmentsTable.customer'))}
                </TableCell>
                <TableCell className="text-zinc-300">
                  {apt.services?.name || t('appointmentsTable.service')}
                </TableCell>
                <TableCell className="text-zinc-300">
                  {apt.professionals?.name || t('appointmentsTable.anyBarber')}
                </TableCell>
                <TableCell className="text-zinc-300">
                  {formatDate(apt.date_hour, locale)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={apt.status} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    {apt.status !== 'completed' && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-9 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                        disabled={isPending}
                        onClick={() => onFinalize(apt.id)}
                        aria-label={`${t('appointmentsTable.completeBooking')}: ${customerName(apt, t('appointmentsTable.customer'))}`}
                        title={t('appointmentsTable.completeBooking')}
                      >
                        <Check className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-9 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                      disabled={isPending}
                      onClick={() => onDelete(apt.id)}
                      aria-label={`${t('appointmentsTable.deleteBooking')}: ${customerName(apt, t('appointmentsTable.customer'))}`}
                      title={t('appointmentsTable.deleteBooking')}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {appointments.map((apt) => (
          <article
            key={apt.id}
            className="glassmorphism rounded-2xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-zinc-100">
                  {customerName(apt, t('appointmentsTable.customer'))}
                </h3>
                <p className="mt-1 truncate text-xs text-zinc-500">
                  {apt.services?.name || t('appointmentsTable.service')}
                </p>
              </div>
              <StatusBadge status={apt.status} />
            </div>

            <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <dt className="text-zinc-600">{t('appointmentsTable.dateTime')}</dt>
                <dd className="mt-1 text-zinc-300">
                  {formatDate(apt.date_hour)}
                </dd>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <dt className="text-zinc-600">{t('appointmentsTable.barber')}</dt>
                <dd className="mt-1 truncate text-zinc-300">
                  {apt.professionals?.name || 'Qualquer barbeiro'}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex gap-2 border-t border-white/5 pt-3">
              {apt.status !== 'completed' && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => onFinalize(apt.id)}
                  className="min-h-10 flex-1 border-emerald-500/15 bg-emerald-500/[0.04] text-xs text-emerald-300 hover:bg-emerald-500/10"
                >
                  <Check className="mr-1.5 size-4" aria-hidden="true" />
                  {t('appointmentsTable.complete')}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => onDelete(apt.id)}
                className="min-h-10 flex-1 border-rose-500/15 bg-rose-500/[0.04] text-xs text-rose-300 hover:bg-rose-500/10"
              >
                <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
                {t('appointmentsTable.delete')}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
