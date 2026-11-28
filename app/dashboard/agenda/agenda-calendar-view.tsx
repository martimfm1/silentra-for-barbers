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
  RotateCcw,
  SlidersHorizontal,
  Trash2,
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
import { getScheduleBlocksByShop } from '@/app/dashboard/_services/schedule-blocks.service';
import { barbershopService } from '@/app/dashboard/_services/barbershop.service';
import type { Appointment, Professional } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { AgendaCalendarSkeleton } from './agenda-view-skeletons';
import { getDailySchedule, normalizeWeeklySchedule } from '@/lib/scheduling/weekly-schedule';

type ScheduleConfig = {
  opening_time?: string | null;
  closing_time?: string | null;
  lunch_start?: string | null;
  lunch_end?: string | null;
  closed_days?: string | null;
  weekly_schedule?: unknown;
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

type CalendarFilters = {
  pending: boolean;
  scheduled: boolean;
  completed: boolean;
  cancelled: boolean;
  blocks: boolean;
  breaks: boolean;
  daysOff: boolean;
};

const DEFAULT_CALENDAR_FILTERS: CalendarFilters = {
  pending: true,
  scheduled: true,
  completed: true,
  cancelled: true,
  blocks: true,
  breaks: true,
  daysOff: true,
};

function parseCalendarFilters(value: string | null): CalendarFilters {
  if (!value) return { ...DEFAULT_CALENDAR_FILTERS };

  try {
    const parsed = JSON.parse(value) as Partial<CalendarFilters>;
    return {
      pending:
        typeof parsed.pending === 'boolean'
          ? parsed.pending
          : DEFAULT_CALENDAR_FILTERS.pending,
      scheduled:
        typeof parsed.scheduled === 'boolean'
          ? parsed.scheduled
          : DEFAULT_CALENDAR_FILTERS.scheduled,
      completed:
        typeof parsed.completed === 'boolean'
          ? parsed.completed
          : DEFAULT_CALENDAR_FILTERS.completed,
      cancelled:
        typeof parsed.cancelled === 'boolean'
          ? parsed.cancelled
          : DEFAULT_CALENDAR_FILTERS.cancelled,
      blocks:
        typeof parsed.blocks === 'boolean'
          ? parsed.blocks
          : DEFAULT_CALENDAR_FILTERS.blocks,
      breaks:
        typeof parsed.breaks === 'boolean'
          ? parsed.breaks
          : DEFAULT_CALENDAR_FILTERS.breaks,
      daysOff:
        typeof parsed.daysOff === 'boolean'
          ? parsed.daysOff
          : DEFAULT_CALENDAR_FILTERS.daysOff,
    };
  } catch {
    return { ...DEFAULT_CALENDAR_FILTERS };
  }
}

function calendarFiltersStorageKey(barbershopId: string) {
  return 'silentra:agenda-calendar-filters:' + barbershopId;
}

const statusTone: Record<Appointment['status'], string> = {
  pending: 'bg-amber-300',
  scheduled: 'bg-sky-300',
  completed: 'bg-emerald-300',
  cancelled: 'bg-rose-300',
};

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

function appointmentName(appointment: Appointment, t: (key: string) => string) {
  return (
    appointment.manual_name ||
    appointment.users?.name_complete ||
    t('agendaCalendar.client')
  );
}

export function AgendaCalendarView({
  appointments,
  appointmentsLoading,
  blocksRefreshKey,
  professionals: allProfessionals,
  onAppointmentClick,
  onDeleteBlock,
}: {
  appointments: Appointment[];
  appointmentsLoading: boolean;
  blocksRefreshKey: number;
  professionals: Professional[];
  onAppointmentClick?: (appointment: Appointment) => void;
  onDeleteBlock?: (blockId: string) => Promise<boolean>;
}) {
  const { t, locale } = useLanguage();
  const weekdayLabels =
    locale === 'pt'
      ? ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dateLocale = locale === 'pt' ? pt : enGB;
  const { barbershopId } = useBarbershop();
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [config, setConfig] = useState<ScheduleConfig>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarFilters, setCalendarFilters] = useState<CalendarFilters>({
    ...DEFAULT_CALENDAR_FILTERS,
  });
  const [calendarFiltersLoadedForShop, setCalendarFiltersLoadedForShop] =
    useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const professionals = useMemo(
    () => allProfessionals.filter((item) => item.active !== false),
    [allProfessionals],
  );

  const load = useCallback(async () => {
    if (!barbershopId) return;
    setLoading(true);
    setError(null);
    try {
      const [configResult, blocksResult] = await Promise.all([
        barbershopService.getConfig(barbershopId),
        getScheduleBlocksByShop(barbershopId),
      ]);

      if (configResult.error) throw configResult.error;
      if (blocksResult.error) throw blocksResult.error;

      setConfig((configResult.data ?? {}) as ScheduleConfig);
      setBlocks((blocksResult.data ?? []) as CalendarBlock[]);
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
  }, [load, blocksRefreshKey]);

  useEffect(() => {
    if (!barbershopId) {
      setCalendarFiltersLoadedForShop(null);
      setCalendarFilters({ ...DEFAULT_CALENDAR_FILTERS });
      return;
    }

    try {
      setCalendarFilters(
        parseCalendarFilters(
          window.localStorage.getItem(calendarFiltersStorageKey(barbershopId)),
        ),
      );
    } catch {
      setCalendarFilters({ ...DEFAULT_CALENDAR_FILTERS });
    }
    setCalendarFiltersLoadedForShop(barbershopId);
  }, [barbershopId]);

  useEffect(() => {
    if (!barbershopId || calendarFiltersLoadedForShop !== barbershopId) return;
    try {
      window.localStorage.setItem(
        calendarFiltersStorageKey(barbershopId),
        JSON.stringify(calendarFilters),
      );
    } catch {
      // Calendar filters remain usable when browser storage is unavailable.
    }
  }, [barbershopId, calendarFilters, calendarFiltersLoadedForShop]);

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

  const shopSchedule = useMemo(
    () => normalizeWeeklySchedule(config.weekly_schedule, config),
    [config],
  );
  const getProfessionalSchedule = (professional: Professional) => {
    const customSchedule = (
      professional as Professional & { weekly_schedule?: unknown }
    ).weekly_schedule;
    return customSchedule
      ? normalizeWeeklySchedule(customSchedule)
      : shopSchedule;
  };
  const isTeamDayOff = (date: Date) =>
    professionals.length > 0
      ? professionals.every((professional) =>
          getDailySchedule(
            getProfessionalSchedule(professional),
            date.getDay(),
          ).day_off,
        )
      : getDailySchedule(shopSchedule, date.getDay()).day_off;
  const selectedShopDay = getDailySchedule(shopSchedule, selectedDate.getDay());
  const selectedAppointments = (
    appointmentsByDay.get(dayKey(selectedDate)) ?? []
  ).filter((appointment) => calendarFilters[appointment.status]);
  const selectedBlocks = calendarFilters.blocks
    ? blocksByDay.get(dayKey(selectedDate)) ?? []
    : [];
  const selectedClosed =
    calendarFilters.daysOff && isTeamDayOff(selectedDate);
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
  const filterOptions: Array<{ key: keyof CalendarFilters; label: string }> = [
    { key: 'pending', label: t('agendaCalendar.filterPending') },
    { key: 'scheduled', label: t('agendaCalendar.filterScheduled') },
    { key: 'completed', label: t('agendaCalendar.filterCompleted') },
    { key: 'cancelled', label: t('agendaCalendar.filterCancelled') },
    { key: 'blocks', label: t('agendaCalendar.filterBlocks') },
    { key: 'breaks', label: t('agendaCalendar.filterBreaks') },
    { key: 'daysOff', label: t('agendaCalendar.filterDaysOff') },
  ];
  const hiddenFilterCount = Object.values(calendarFilters).filter(
    (visible) => !visible,
  ).length;

  if (loading || appointmentsLoading) return <AgendaCalendarSkeleton />;

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

          <div className="mt-4 flex justify-end">
            <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10 gap-2 rounded-xl border-white/10 bg-white/[0.025] px-3 text-xs text-zinc-300 hover:bg-white/[0.06]"
                >
                  <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                  {t('agendaCalendar.filters')}
                  {hiddenFilterCount > 0 ? (
                    <span className="rounded-md bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-200">
                      {hiddenFilterCount}
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="bottom"
                className="w-[min(90vw,340px)] border border-white/10 bg-zinc-950 p-4 text-zinc-100 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-100">
                      {t('agendaCalendar.filtersTitle')}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                      {t('agendaCalendar.filtersDescription')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-9 shrink-0 gap-1.5 rounded-lg px-2 text-[10px] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
                    aria-label={t('agendaCalendar.resetFilters')}
                    onClick={() =>
                      setCalendarFilters({ ...DEFAULT_CALENDAR_FILTERS })
                    }
                  >
                    <RotateCcw className="size-3" aria-hidden="true" />
                    {t('agendaCalendar.resetFilters')}
                  </Button>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="space-y-3">
                    {filterOptions.slice(0, 4).map(({ key, label }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-xs text-zinc-300">{label}</span>
                        <Switch
                          size="sm"
                          checked={calendarFilters[key]}
                          onCheckedChange={(checked) =>
                            setCalendarFilters((current) => ({
                              ...current,
                              [key]: checked,
                            }))
                          }
                          aria-label={label}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-white/[0.08] pt-3">
                    <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                      {t('agendaCalendar.otherItems')}
                    </p>
                    <div className="space-y-3">
                      {filterOptions.slice(4).map(({ key, label }) => (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="text-xs text-zinc-300">{label}</span>
                          <Switch
                            size="sm"
                            checked={calendarFilters[key]}
                            onCheckedChange={(checked) =>
                              setCalendarFilters((current) => ({
                                ...current,
                                [key]: checked,
                              }))
                            }
                            aria-label={label}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="mt-4 border-t border-white/[0.08] pt-3 text-[10px] text-emerald-200/70">
                  {t('agendaCalendar.filtersSaved')}
                </p>
              </PopoverContent>
            </Popover>
          </div>

          <div
            className="mt-4 flex flex-wrap gap-2"
            aria-label={t('agendaCalendar.legend')}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.025] px-2.5 py-1.5 text-[11px] text-zinc-500">
              <span className="size-1.5 rounded-full bg-emerald-300" />
              {locale === 'en' ? 'Light occupancy' : 'Pouco ocupada'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.025] px-2.5 py-1.5 text-[11px] text-zinc-500">
              <span className="size-1.5 rounded-full bg-sky-300" />
              {locale === 'en' ? 'Busy' : 'Ocupada'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.025] px-2.5 py-1.5 text-[11px] text-zinc-500">
              <span className="size-1.5 rounded-full bg-violet-300" />
              {locale === 'en' ? 'Very busy' : 'Muito ocupada'}
            </span>
            {calendarFilters.blocks ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.025] px-2.5 py-1.5 text-[11px] text-zinc-500">
                <span className="size-1.5 rounded-full bg-rose-300" />
                {locale === 'en' ? 'Blocked time' : 'Bloqueio'}
              </span>
            ) : null}
            {calendarFilters.breaks || calendarFilters.daysOff ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.025] px-2.5 py-1.5 text-[11px] text-zinc-500">
                <span className="size-1.5 rounded-full bg-amber-300" />
                {t('agendaCalendar.lunchDayOff')}
              </span>
            ) : null}
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

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl bg-white/[0.055] sm:rounded-3xl">
            {calendarDays.map((date) => {
              const key = dayKey(date);
              const dayAppointments = (
                appointmentsByDay.get(key) ?? []
              ).filter((appointment) => calendarFilters[appointment.status]);
              const dayBlocks = calendarFilters.blocks
                ? blocksByDay.get(key) ?? []
                : [];
              const level = occupancyLevel(dayAppointments);
              const dayIsClosed = isTeamDayOff(date);
              const isClosed = calendarFilters.daysOff && dayIsClosed;
              const generalDay = getDailySchedule(shopSchedule, date.getDay());
              const inMonth = isSameMonth(date, month);
              const selected = isSameDay(date, selectedDate);
              const activeCount = dayAppointments.filter(
                (item) => item.status !== 'cancelled',
              ).length;
              const cancelledCount = dayAppointments.filter(
                (item) => item.status === 'cancelled',
              ).length;
              const preview = dayAppointments.slice(0, 2);
              const blockPreview = dayBlocks.slice(0, 1);

              return (
                <div
                  key={key}
                  className={cn(
                    'group relative min-h-24 bg-zinc-950/95 p-1.5 transition-colors duration-200 sm:min-h-36 sm:p-3',
                    !inMonth && 'opacity-35',
                    selected &&
                      'bg-white/[0.06] ring-1 ring-inset ring-emerald-400/30',
                    isClosed && 'bg-amber-400/[0.025]',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    aria-current={isToday(date) ? 'date' : undefined}
                    aria-pressed={selected}
                    aria-label={t('agendaCalendar.daySummary', {
                      date: format(date, locale === 'pt' ? "EEEE, d 'de' MMMM" : 'EEEE, MMMM d', { locale: dateLocale }),
                      availability: isClosed ? t('agendaCalendar.dayOff') : occupancyLabel(level, t),
                      appointments: activeCount,
                      cancelled: cancelledCount,
                      blocks: dayBlocks.length,
                    })}
                    className="absolute inset-0 z-0 rounded-[inherit] transition-colors duration-200 hover:bg-white/[0.035] focus-visible:z-20 focus-visible:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/70 active:bg-white/[0.06]"
                  />
                  <div className="pointer-events-none relative z-10">
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
                    <div className="flex items-center gap-1">
                      {activeCount > 0 ? (
                        <span className="text-[9px] font-semibold tabular-nums text-zinc-600 sm:text-[10px]">
                          {activeCount}
                        </span>
                      ) : null}
                      {cancelledCount > 0 ? (
                        <span
                          className="rounded-md bg-rose-400/10 px-1 py-0.5 text-[8px] font-semibold tabular-nums text-rose-300 sm:text-[9px]"
                          title={t('agendaCalendar.cancelledTooltip', { count: cancelledCount })}
                        >
                          −{cancelledCount}
                        </span>
                      ) : null}
                    </div>
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
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={() => {
                          setSelectedDate(date);
                          onAppointmentClick?.(appointment);
                        }}
                        aria-label={t('agendaCalendar.appointmentAriaLabel', {
                          client: appointmentName(appointment, t),
                          time: format(new Date(appointment.date_hour), 'HH:mm'),
                          status: appointment.status === 'cancelled' ? t('agendaCalendar.cancelledStatus') : '',
                        })}
                        className={cn(
                          'pointer-events-auto flex w-full min-w-0 cursor-pointer items-center gap-1 rounded-md border px-1 py-1 text-left transition hover:border-emerald-300/30 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/70 sm:gap-1.5 sm:px-1.5',
                          appointment.status === 'cancelled'
                            ? 'border-rose-400/15 bg-rose-400/[0.06]'
                            : 'border-white/[0.04] bg-white/[0.02]',
                        )}
                      >
                        <span
                          className={cn(
                            'size-1.5 shrink-0 rounded-full sm:size-1.5',
                            statusTone[appointment.status],
                          )}
                          aria-hidden="true"
                        />
                        <span
                          className={cn(
                            'hidden truncate text-[9px] sm:block',
                            appointment.status === 'cancelled'
                              ? 'text-rose-200/80 line-through'
                              : 'text-zinc-500',
                          )}
                        >
                          {format(new Date(appointment.date_hour), 'HH:mm')} ·{' '}
                          {appointmentName(appointment, t)}
                        </span>
                        <span
                          className={cn(
                            'block truncate text-[8px] sm:hidden',
                            appointment.status === 'cancelled'
                              ? 'text-rose-300/80'
                              : 'text-zinc-600',
                          )}
                        >
                          {format(new Date(appointment.date_hour), 'HH:mm')}
                        </span>
                      </button>
                    ))}
                    {dayAppointments.length > 2 ? (
                      <span className="hidden px-1 text-[9px] font-medium text-zinc-600 sm:block">
                        +{dayAppointments.length - 2} {t('agendaCalendar.more')}
                      </span>
                    ) : null}
                    {blockPreview.map((block) => (
                      <div
                        key={block.id}
                        role="note"
                        title={[
                          `${formatTime(block.start_time)}–${formatTime(block.end_time)}`,
                          block.reason,
                          block.professionals?.name,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        aria-label={locale === 'en' ? `Blocked time from ${formatTime(block.start_time)} to ${formatTime(block.end_time)}. ${block.reason || t('agendaCalendar.scheduleBlock')}. ${block.professionals?.name || t('agendaCalendar.team')}.` : `Bloqueio de horário das ${formatTime(block.start_time)} às ${formatTime(block.end_time)}. ${block.reason || t('agendaCalendar.scheduleBlock')}. ${block.professionals?.name || t('agendaCalendar.team')}.`}
                        className="flex min-w-0 items-center gap-1 rounded-md border border-rose-400/20 bg-rose-400/[0.07] px-1 py-1 text-[8px] text-rose-200/90 sm:px-1.5 sm:text-[9px]"
                      >
                        <CalendarOff
                          className="size-2.5 shrink-0 sm:size-3"
                          aria-hidden="true"
                        />
                        <span className="hidden min-w-0 truncate tabular-nums sm:block">
                          {formatTime(block.start_time)}–{formatTime(block.end_time)}
                        </span>
                        <span className="block truncate tabular-nums sm:hidden">
                          {formatTime(block.start_time)}
                        </span>
                      </div>
                    ))}
                    {dayBlocks.length > blockPreview.length ? (
                      <span className="block truncate px-1 text-[8px] font-medium text-rose-300/80 sm:text-[9px]">
                        +{dayBlocks.length - blockPreview.length}{' '}
                        {t('agendaCalendar.moreBlockedTimes')}
                      </span>
                    ) : null}
                    {calendarFilters.breaks &&
                    generalDay.break_intervals.length > 0 &&
                    !dayIsClosed ? (
                      <div className="hidden items-center gap-1 text-[9px] text-amber-300/70 sm:flex">
                        <Coffee className="size-3" aria-hidden="true" />
                        {locale === 'en' ? 'Break' : 'Pausa'} {generalDay.break_intervals.map((item) => `${item.start}–${item.end}`).join(', ')}
                      </div>
                    ) : null}
                  </div>
                  </div>
                </div>
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
                {format(
                  selectedDate,
                  locale === 'en' ? 'EEEE, d MMMM' : "EEEE, d 'de' MMMM",
                  { locale: dateLocale },
                )}
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                {locale === 'en' ? 'Blocked times' : 'Bloqueios'}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">
                {selectedBlocks.length}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">
                {locale === 'en' ? 'Cancelled' : 'Canceladas'}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-rose-300">
                {
                  selectedAppointments.filter(
                    (item) => item.status === 'cancelled',
                  ).length
                }
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">
                {locale === 'en' ? 'Occupancy' : 'Ocupação'}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">
                {selectedLoad}%
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="flex items-start justify-between gap-3 text-xs">
              <span className="shrink-0 text-zinc-500">{locale === 'en' ? 'Default hours' : 'Horário geral'}</span>
              <span className="text-right font-medium tabular-nums text-zinc-200">
                {selectedShopDay.day_off
                  ? (locale === 'en' ? 'Day off' : 'Folga')
                  : selectedShopDay.work_intervals.map((item) => `${item.start}–${item.end}`).join(' · ')}
              </span>
            </div>
            {calendarFilters.breaks &&
            selectedShopDay.break_intervals.length > 0 ? (
              <div className="mt-3 flex items-start justify-between gap-3 border-t border-white/[0.06] pt-3 text-xs">
                <span className="flex shrink-0 items-center gap-1.5 text-zinc-500">
                  <Coffee className="size-3.5" aria-hidden="true" />
                  {locale === 'en' ? 'Breaks' : 'Pausas'}
                </span>
                <span className="text-right font-medium tabular-nums text-amber-200">
                  {selectedShopDay.break_intervals.map((item) => `${item.start}–${item.end}`).join(' · ')}
                </span>
              </div>
            ) : null}
            <p className="mt-3 border-t border-white/[0.06] pt-3 text-[10px] leading-4 text-zinc-600">
              {locale === 'en'
                ? 'Barbers with a personal schedule may have different hours.'
                : 'Os barbeiros com horário próprio podem ter horários diferentes.'}
            </p>
            {selectedClosed ? (
              <p className="mt-2 text-xs leading-5 text-amber-200/80">
                {locale === 'en' ? 'All barbers are off on this day.' : 'Todos os barbeiros estão de folga neste dia.'}
              </p>
            ) : null}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                {locale === 'en' ? 'Day schedule' : 'Agenda do dia'}
              </p>
              {selectedAppointments.length > 0 ? (
                <span className="text-[10px] font-medium text-zinc-600">
                  {selectedAppointments.length}{' '}
                  {selectedAppointments.length === 1
                    ? t('agendaCalendar.eventSingular')
                    : t('agendaCalendar.eventPlural')}
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
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={() => onAppointmentClick?.(appointment)}
                      disabled={!onAppointmentClick}
                      aria-label={`${format(new Date(appointment.date_hour), 'HH:mm')} · ${appointmentName(appointment, t)} · ${appointment.services?.name ?? t('agendaCalendar.service')}`}
                      className="block w-full rounded-xl border border-white/10 bg-white/[0.025] p-3 text-left transition hover:border-emerald-300/25 hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 disabled:cursor-default"
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
                      {onAppointmentClick ? (
                        <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-300/80">
                          {t('agendaCalendar.viewDetails')}{' '}
                          <ChevronRight className="size-3" aria-hidden="true" />
                        </span>
                      ) : null}
                    </button>
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
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-[10px] text-zinc-600">
                          {block.professionals?.name || t('agendaCalendar.team')}
                        </p>
                        {onDeleteBlock ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="min-h-9 shrink-0 gap-1.5 rounded-lg px-2 text-[10px] text-rose-300 hover:bg-rose-400/10 hover:text-rose-200"
                            aria-label={t('agenda.removeBlock')}
                            onClick={() => {
                              if (
                                !window.confirm(t('agenda.confirmRemoveBlock'))
                              ) return;
                              void onDeleteBlock(block.id);
                            }}
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                            {t('agenda.removeBlock')}
                          </Button>
                        ) : null}
                      </div>
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
                ? professionals.length === 1
                  ? t('agendaCalendar.activeProfessional', { count: professionals.length })
                  : t('agendaCalendar.activeProfessionals', { count: professionals.length })
                : t('agendaCalendar.noActiveProfessionals')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
