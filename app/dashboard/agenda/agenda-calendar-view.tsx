'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  Users,
} from 'lucide-react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { enGB, pt } from 'date-fns/locale';
import { useBarbershop } from '@/context/BarbershopContext';
import { useLanguage } from '@/context/LanguageContext';
import { appointmentService } from '@/app/dashboard/_services/appointments.service';
import { getScheduleBlocksByShop } from '@/app/dashboard/_services/schedule-blocks.service';
import { barbershopService } from '@/app/dashboard/_services/barbershop.service';
import { professionalService } from '@/app/dashboard/_services/professionals.service';
import type { Appointment, Professional } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AgendaCalendarSkeleton } from './agenda-view-skeletons';

type ScheduleConfig = {
  opening_time?: string | null;
  closing_time?: string | null;
  lunch_start?: string | null;
  lunch_end?: string | null;
  closed_days?: string | null;
};

type CalendarBlock = {
  id: string;
  professional_id?: string | null;
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
  professionals?: { name?: string | null } | null;
};

const weekdayKeys = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

const statusTone: Record<Appointment['status'], string> = {
  pending: 'bg-amber-300',
  scheduled: 'bg-sky-300',
  completed: 'bg-emerald-300',
  cancelled: 'bg-rose-300',
};

function parseClosedDays(value?: string | null) {
  return new Set(
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function dayKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function formatTime(value?: string | null) {
  return value ? value.slice(0, 5) : '—';
}

function occupancyLevel(appointments: Appointment[]) {
  const active = appointments.filter((item) => item.status !== 'cancelled');
  if (active.length === 0) return 'empty';
  if (active.length <= 2) return 'light';
  if (active.length <= 5) return 'busy';
  return 'heavy';
}

function occupancyLabel(level: string, t: (key: string) => string) {
  switch (level) {
    case 'light':
      return t('agendaCalendar.lowOccupancy');
    case 'busy':
      return t('agendaCalendar.busy');
    case 'heavy':
      return t('agendaCalendar.veryBusy');
    default:
      return t('agendaCalendar.available');
  }
}

function weekdayKey(date: Date) {
  const mondayIndex = (date.getDay() + 6) % 7;
  return weekdayKeys[mondayIndex];
}

function appointmentName(appointment: Appointment, t: (key: string) => string) {
  return (
    appointment.manual_name ||
    appointment.users?.name_complete ||
    t('agendaCalendar.client')
  );
}

export function AgendaCalendarView() {
  const { t, locale } = useLanguage();
  const weekdayLabels =
    locale === 'pt'
      ? ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dateLocale = locale === 'pt' ? pt : enGB;
  const { barbershopId } = useBarbershop();
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [config, setConfig] = useState<ScheduleConfig>({});
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!barbershopId) return;
    setLoading(true);
    setError(null);
    try {
      const [
        appointmentsResult,
        configResult,
        blocksResult,
        professionalsResult,
      ] = await Promise.all([
        appointmentService.getAll(barbershopId),
        barbershopService.getConfig(barbershopId),
        getScheduleBlocksByShop(barbershopId),
        professionalService.getAll(barbershopId),
      ]);

      if (appointmentsResult.error) throw appointmentsResult.error;
      if (configResult.error) throw configResult.error;
      if (blocksResult.error) throw blocksResult.error;
      if (professionalsResult.error) throw professionalsResult.error;

      setAppointments(appointmentsResult.data ?? []);
      setConfig((configResult.data ?? {}) as ScheduleConfig);
      setBlocks((blocksResult.data ?? []) as CalendarBlock[]);
      setProfessionals(
        (professionalsResult.data ?? []).filter(
          (item) => item.active !== false,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t('agendaCalendar.loadError'),
      );
    } finally {
      setLoading(false);
    }
  }, [barbershopId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const calendarDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  );

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appointment of appointments) {
      const key = dayKey(new Date(appointment.date_hour));
      const current = map.get(key) ?? [];
      current.push(appointment);
      current.sort(
        (a, b) =>
          new Date(a.date_hour).getTime() - new Date(b.date_hour).getTime(),
      );
      map.set(key, current);
    }
    return map;
  }, [appointments]);

  const blocksByDay = useMemo(() => {
    const map = new Map<string, CalendarBlock[]>();
    for (const block of blocks) {
      if (!block.date) continue;
      const current = map.get(block.date) ?? [];
      current.push(block);
      map.set(block.date, current);
    }
    return map;
  }, [blocks]);

  const closedDays = useMemo(
    () => parseClosedDays(config.closed_days),
    [config.closed_days],
  );
  const selectedAppointments =
    appointmentsByDay.get(dayKey(selectedDate)) ?? [];
  const selectedBlocks = blocksByDay.get(dayKey(selectedDate)) ?? [];
  const selectedClosed = closedDays.has(weekdayKey(selectedDate));
  const selectedActive = selectedAppointments.filter(
    (item) => item.status !== 'cancelled',
  );
  const selectedLevel = occupancyLevel(selectedAppointments);
  const selectedCapacity = professionals.length * 8;
  const selectedLoad = selectedCapacity
    ? Math.min(
        100,
        Math.round((selectedActive.length / selectedCapacity) * 100),
      )
    : selectedActive.length > 0
      ? 100
      : 0;

  if (loading) return <AgendaCalendarSkeleton />;

  if (error) {
    return (
      <Card className="border-rose-400/15 bg-rose-400/[0.03]">
        <CardContent className="flex min-h-56 flex-col items-center justify-center px-5 text-center">
          <AlertCircle className="size-6 text-rose-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-zinc-100">
            {t('agendaCalendar.loadError')}
          </p>
          <p className="mt-1 max-w-md text-xs leading-5 text-zinc-500">
            {error}
          </p>
          <Button
            variant="outline"
            className="mt-4 min-h-11"
            onClick={() => void load()}
          >
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="overflow-hidden border-white/10 bg-white/[0.02] shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <CardHeader className="border-b border-white/[0.075] p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                {t('agendaCalendar.title')}
              </div>
              <CardTitle className="mt-1 text-xl capitalize text-zinc-50 sm:text-2xl">
                {format(month, 'MMMM yyyy', { locale: dateLocale })}
              </CardTitle>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
                {t('agendaCalendar.description')}
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-xl"
                onClick={() => setMonth((value) => subMonths(value, 1))}
                aria-label={t('agendaCalendar.previousMonth')}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="min-h-11 rounded-xl px-4"
                onClick={() => {
                  const value = new Date();
                  setMonth(value);
                  setSelectedDate(value);
                }}
              >
                {t('agendaCalendar.today')}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-xl"
                onClick={() => setMonth((value) => addMonths(value, 1))}
                aria-label={t('agendaCalendar.nextMonth')}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div
            className="mt-4 flex flex-wrap gap-2"
            aria-label={t('agendaCalendar.legend')}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.025] px-2.5 py-1.5 text-[11px] text-zinc-500">
              <span className="size-1.5 rounded-full bg-emerald-300" />
              Pouco ocupada
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.025] px-2.5 py-1.5 text-[11px] text-zinc-500">
              <span className="size-1.5 rounded-full bg-sky-300" />
              Ocupada
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.025] px-2.5 py-1.5 text-[11px] text-zinc-500">
              <span className="size-1.5 rounded-full bg-violet-300" />
              Muito ocupada
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.025] px-2.5 py-1.5 text-[11px] text-zinc-500">
              <span className="size-1.5 rounded-full bg-rose-300" />
              Bloqueio
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.025] px-2.5 py-1.5 text-[11px] text-zinc-500">
              <span className="size-1.5 rounded-full bg-amber-300" />
              {t('agendaCalendar.lunchDayOff')}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-1.5 sm:p-3">
          <div className="grid grid-cols-7 border-b border-white/[0.06]">
            {weekdayLabels.map((label, index) => (
              <div
                key={label}
                className="px-1 py-2 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-600 sm:px-2 sm:text-[10px]"
              >
                {label}
                {index >= 5 ? (
                  <span className="sr-only"> fim de semana</span>
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl bg-white/[0.055]">
            {calendarDays.map((date) => {
              const key = dayKey(date);
              const dayAppointments = appointmentsByDay.get(key) ?? [];
              const dayBlocks = blocksByDay.get(key) ?? [];
              const level = occupancyLevel(dayAppointments);
              const isClosed = closedDays.has(weekdayKey(date));
              const inMonth = isSameMonth(date, month);
              const selected = isSameDay(date, selectedDate);
              const activeCount = dayAppointments.filter(
                (item) => item.status !== 'cancelled',
              ).length;
              const preview = dayAppointments.slice(0, 2);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  aria-current={isToday(date) ? 'date' : undefined}
                  aria-pressed={selected}
                  aria-label={`${format(date, locale === 'pt' ? "EEEE, d 'de' MMMM" : 'EEEE, MMMM d', { locale: dateLocale })}. ${isClosed ? t('agendaCalendar.dayOff') : occupancyLabel(level, t)}. ${activeCount} marcações. ${dayBlocks.length} bloqueios.`}
                  className={cn(
                    'group relative min-h-24 bg-zinc-950/95 p-1.5 text-left transition-[background,box-shadow,transform] duration-200 hover:bg-white/[0.035] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/70 active:scale-[0.995] sm:min-h-36 sm:p-3',
                    !inMonth && 'opacity-35',
                    selected &&
                      'bg-white/[0.06] ring-1 ring-inset ring-emerald-400/30',
                    isClosed && 'bg-amber-400/[0.025]',
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        'flex size-7 items-center justify-center rounded-lg text-xs font-semibold tabular-nums',
                        isToday(date)
                          ? 'bg-emerald-300 text-zinc-950 shadow-[0_0_18px_rgba(110,231,183,0.18)]'
                          : selected
                            ? 'bg-white/10 text-white'
                            : 'text-zinc-300',
                      )}
                    >
                      {format(date, 'd')}
                    </span>
                    {activeCount > 0 ? (
                      <span className="text-[9px] font-semibold tabular-nums text-zinc-600 sm:text-[10px]">
                        {activeCount}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.05] sm:mt-3 sm:h-1.5">
                    <div
                      className={cn(
                        'h-full rounded-full transition-[width]',
                        level === 'empty' && 'w-0',
                        level === 'light' && 'w-1/3 bg-emerald-300/80',
                        level === 'busy' && 'w-2/3 bg-sky-300/80',
                        level === 'heavy' && 'w-full bg-violet-300/80',
                      )}
                    />
                  </div>
                  <p className="mt-1 truncate text-[8px] font-medium text-zinc-600 sm:mt-2 sm:text-[10px]">
                    {isClosed
                      ? t('agendaCalendar.dayOffShort')
                      : occupancyLabel(level, t)}
                  </p>

                  <div className="mt-1.5 space-y-1 sm:mt-2">
                    {preview.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="flex min-w-0 items-center gap-1 rounded-md border border-white/[0.04] bg-white/[0.02] px-1 py-1 sm:gap-1.5 sm:px-1.5"
                      >
                        <span
                          className={cn(
                            'size-1.5 shrink-0 rounded-full sm:size-1.5',
                            statusTone[appointment.status],
                          )}
                          aria-hidden="true"
                        />
                        <span className="hidden truncate text-[9px] text-zinc-500 sm:block">
                          {format(new Date(appointment.date_hour), 'HH:mm')} ·{' '}
                          {appointmentName(appointment, t)}
                        </span>
                        <span className="block truncate text-[8px] text-zinc-600 sm:hidden">
                          {format(new Date(appointment.date_hour), 'HH:mm')}
                        </span>
                      </div>
                    ))}
                    {dayAppointments.length > 2 ? (
                      <span className="hidden px-1 text-[9px] font-medium text-zinc-600 sm:block">
                        +{dayAppointments.length - 2} mais
                      </span>
                    ) : null}
                    {dayBlocks.length > 0 ? (
                      <div className="flex items-center gap-1 text-[8px] text-rose-300/80 sm:text-[9px]">
                        <CalendarOff
                          className="size-2.5 sm:size-3"
                          aria-hidden="true"
                        />
                        <span>
                          {dayBlocks.length} bloqueio
                          {dayBlocks.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    ) : null}
                    {config.lunch_start && config.lunch_end && !isClosed ? (
                      <div className="hidden items-center gap-1 text-[9px] text-amber-300/70 sm:flex">
                        <Coffee className="size-3" aria-hidden="true" />
                        Pausa {formatTime(config.lunch_start)}–
                        {formatTime(config.lunch_end)}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-3 px-1 text-[11px] text-zinc-600 sm:hidden">
            {t('agendaCalendar.tapDayHint')}
          </p>
        </CardContent>
      </Card>

      <Card className="h-fit border-white/10 bg-white/[0.02] backdrop-blur-xl xl:sticky xl:top-24">
        <CardHeader className="border-b border-white/[0.075] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                {t('agendaCalendar.selectedDay')}
              </p>
              <CardTitle className="mt-1 text-lg capitalize sm:text-xl">
                {format(selectedDate, "EEEE, d 'de' MMMM", {
                  locale: dateLocale,
                })}
              </CardTitle>
              <p
                className={cn(
                  'mt-1 text-xs',
                  selectedClosed ? 'text-amber-200' : 'text-zinc-500',
                )}
              >
                {selectedClosed
                  ? t('agendaCalendar.dayOff')
                  : occupancyLabel(selectedLevel, t)}
              </p>
            </div>
            <span
              className={cn(
                'size-2.5 shrink-0 rounded-full mt-1.5',
                selectedClosed
                  ? 'bg-amber-300'
                  : selectedLevel === 'heavy'
                    ? 'bg-violet-300'
                    : selectedLevel === 'busy'
                      ? 'bg-sky-300'
                      : selectedLevel === 'light'
                        ? 'bg-emerald-300'
                        : 'bg-zinc-700',
              )}
              aria-hidden="true"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">
                {t('agendaCalendar.appointments')}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">
                {selectedActive.length}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">
                Bloqueios
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">
                {selectedBlocks.length}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">
                Carga
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">
                {selectedLoad}%
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-zinc-500">Funcionamento</span>
              <span className="font-medium tabular-nums text-zinc-200">
                {config.opening_time ?? '—'}–{config.closing_time ?? '—'}
              </span>
            </div>
            {config.lunch_start && config.lunch_end && !selectedClosed ? (
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-xs">
                <span className="flex items-center gap-1.5 text-zinc-500">
                  <Coffee className="size-3.5" aria-hidden="true" />
                  Pausa
                </span>
                <span className="font-medium tabular-nums text-amber-200">
                  {formatTime(config.lunch_start)}–
                  {formatTime(config.lunch_end)}
                </span>
              </div>
            ) : null}
            {selectedClosed ? (
              <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs leading-5 text-amber-200/80">
                {t('agendaCalendar.closedWeekday')}
              </p>
            ) : null}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                Agenda do dia
              </p>
              {selectedAppointments.length > 0 ? (
                <span className="text-[10px] font-medium text-zinc-600">
                  {selectedAppointments.length} evento
                  {selectedAppointments.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
            <div className="space-y-2">
              {selectedAppointments.length === 0 &&
              selectedBlocks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015] p-5 text-center">
                  <CalendarDays
                    className="mx-auto size-5 text-zinc-700"
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    {t('agendaCalendar.noEvents')}
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-zinc-700">
                    {t('agendaCalendar.freeDay')}
                  </p>
                </div>
              ) : (
                <>
                  {selectedAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="rounded-xl border border-white/10 bg-white/[0.025] p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'size-2 shrink-0 rounded-full',
                            statusTone[appointment.status],
                          )}
                          aria-hidden="true"
                        />
                        <Clock3
                          className="size-3.5 text-zinc-500"
                          aria-hidden="true"
                        />
                        <span className="text-xs font-semibold tabular-nums text-zinc-200">
                          {format(new Date(appointment.date_hour), 'HH:mm')}
                        </span>
                        <span className="min-w-0 truncate text-[10px] text-zinc-600">
                          {appointment.services?.name ??
                            t('agendaCalendar.service')}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-300">
                        {appointmentName(appointment, t)}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-zinc-600">
                        {appointment.professionals?.name ??
                          t('agendaCalendar.team')}
                      </p>
                    </div>
                  ))}
                  {selectedBlocks.map((block) => (
                    <div
                      key={block.id}
                      className="rounded-xl border border-rose-400/15 bg-rose-400/[0.04] p-3"
                    >
                      <div className="flex items-center gap-2">
                        <CalendarOff
                          className="size-3.5 text-rose-300"
                          aria-hidden="true"
                        />
                        <span className="text-xs font-semibold tabular-nums text-rose-100">
                          {formatTime(block.start_time)}–
                          {formatTime(block.end_time)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">
                        {block.reason || t('agendaCalendar.scheduleBlock')}
                      </p>
                      <p className="mt-1 text-[10px] text-zinc-600">
                        {block.professionals?.name || t('agendaCalendar.team')}
                      </p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
              <Users className="size-3.5" aria-hidden="true" />
              {t('agendaCalendar.availableTeam')}
            </p>
            <p className="mt-2 text-xs leading-5 text-zinc-600">
              {professionals.length
                ? `${professionals.length} profissional${professionals.length === 1 ? '' : 'is'} ativo${professionals.length === 1 ? '' : 's'}.`
                : t('agendaCalendar.noActiveProfessionals')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
