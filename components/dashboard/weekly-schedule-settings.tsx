'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarOff, Clock3, Plus, Save, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { barbershopService } from '@/app/dashboard/_services/barbershop.service';
import { professionalService } from '@/app/dashboard/_services/professionals.service';
import {
  createDefaultWeeklySchedule,
  normalizeWeeklySchedule,
  validateWeeklySchedule,
  WEEKDAY_KEYS,
  type ScheduleInterval,
  type WeeklySchedule,
  type WeekdayKey,
} from '@/lib/scheduling/weekly-schedule';
import { cn } from '@/lib/utils';

type BarberOption = { id: string; name: string; weekly_schedule?: unknown };
type Props = { barbershopId: string; locale: 'pt' | 'en' };

const DAY_LABELS: Record<WeekdayKey, { pt: string; en: string }> = {
  monday: { pt: 'Segunda-feira', en: 'Monday' },
  tuesday: { pt: 'Terça-feira', en: 'Tuesday' },
  wednesday: { pt: 'Quarta-feira', en: 'Wednesday' },
  thursday: { pt: 'Quinta-feira', en: 'Thursday' },
  friday: { pt: 'Sexta-feira', en: 'Friday' },
  saturday: { pt: 'Sábado', en: 'Saturday' },
  sunday: { pt: 'Domingo', en: 'Sunday' },
};

function cloneSchedule(value: WeeklySchedule): WeeklySchedule {
  return JSON.parse(JSON.stringify(value)) as WeeklySchedule;
}

function IntervalRows({
  title,
  intervals,
  kind,
  locale,
  onChange,
}: {
  title: string;
  intervals: ScheduleInterval[];
  kind: 'work_intervals' | 'break_intervals';
  locale: 'pt' | 'en';
  onChange: (next: ScheduleInterval[]) => void;
}) {
  const update = (index: number, patch: Partial<ScheduleInterval>) =>
    onChange(
      intervals.map((interval, itemIndex) =>
        itemIndex === index ? { ...interval, ...patch } : interval,
      ),
    );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
          {title}
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 px-2 text-xs text-emerald-300 hover:bg-emerald-300/10 hover:text-emerald-200"
          onClick={() =>
            onChange([
              ...intervals,
              kind === 'work_intervals'
                ? { start: '14:00', end: '19:00' }
                : { start: '13:00', end: '14:00' },
            ])
          }
        >
          <Plus className="size-3.5" />
          {locale === 'pt' ? 'Adicionar' : 'Add'}
        </Button>
      </div>

      {intervals.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs text-zinc-600">
          {locale === 'pt' ? 'Sem períodos definidos.' : 'No periods defined.'}
        </p>
      ) : (
        <div className="space-y-2">
          {intervals.map((interval, index) => (
            <div
              key={index}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_2rem] items-center gap-2"
            >
              <Input
                type="time"
                aria-label={`${title} ${index + 1} ${locale === 'pt' ? 'início' : 'start'}`}
                value={interval.start}
                onChange={(event) => update(index, { start: event.target.value })}
                className="h-10 min-w-0 color-scheme-dark"
              />
              <span className="text-xs text-zinc-600">—</span>
              <Input
                type="time"
                aria-label={`${title} ${index + 1} ${locale === 'pt' ? 'fim' : 'end'}`}
                value={interval.end}
                onChange={(event) => update(index, { end: event.target.value })}
                className="h-10 min-w-0 color-scheme-dark"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={locale === 'pt' ? 'Remover período' : 'Remove period'}
                className="size-8 text-zinc-500 hover:bg-rose-400/10 hover:text-rose-300"
                onClick={() => onChange(intervals.filter((_, itemIndex) => itemIndex !== index))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WeeklyScheduleSettings({ barbershopId, locale }: Props) {
  const isPt = locale === 'pt';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('shop');
  const [shopSchedule, setShopSchedule] = useState<WeeklySchedule>(() => createDefaultWeeklySchedule());
  const [initialShopSchedule, setInitialShopSchedule] = useState<WeeklySchedule>(() => createDefaultWeeklySchedule());
  const [professionalSchedules, setProfessionalSchedules] = useState<Record<string, WeeklySchedule | null>>({});
  const [draft, setDraft] = useState<WeeklySchedule>(() => createDefaultWeeklySchedule());
  const [initialDraft, setInitialDraft] = useState<WeeklySchedule>(() => createDefaultWeeklySchedule());
  const [hasCustomSchedule, setHasCustomSchedule] = useState(false);
  const [initialHasCustomSchedule, setInitialHasCustomSchedule] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [configResult, professionalsResult] = await Promise.all([
        barbershopService.getConfig(barbershopId),
        professionalService.getAll(barbershopId),
      ]);
      if (configResult.error) throw configResult.error;
      if (professionalsResult.error) throw professionalsResult.error;

      const config = configResult.data;
      const nextShopSchedule = normalizeWeeklySchedule(
        (config as { weekly_schedule?: unknown } | null)?.weekly_schedule,
        config ?? undefined,
      );
      const nextBarbers = (professionalsResult.data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        weekly_schedule: (item as unknown as BarberOption).weekly_schedule ?? null,
      }));
      const nextProfessionalSchedules = Object.fromEntries(
        nextBarbers.map((item) => [
          item.id,
          item.weekly_schedule
            ? normalizeWeeklySchedule(item.weekly_schedule)
            : null,
        ]),
      ) as Record<string, WeeklySchedule | null>;

      setShopSchedule(nextShopSchedule);
      setInitialShopSchedule(cloneSchedule(nextShopSchedule));
      setBarbers(nextBarbers);
      setProfessionalSchedules(nextProfessionalSchedules);
      setSelectedProfessionalId('shop');
      setDraft(cloneSchedule(nextShopSchedule));
      setInitialDraft(cloneSchedule(nextShopSchedule));
      setHasCustomSchedule(false);
      setInitialHasCustomSchedule(false);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : isPt
            ? 'Não foi possível carregar os horários.'
            : 'Could not load schedules.',
      );
    } finally {
      setLoading(false);
    }
  }, [barbershopId, isPt]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selectedProfessionalId === 'shop') {
      setDraft(cloneSchedule(shopSchedule));
      setInitialDraft(cloneSchedule(shopSchedule));
      setHasCustomSchedule(false);
      setInitialHasCustomSchedule(false);
      return;
    }
    const customSchedule = professionalSchedules[selectedProfessionalId] ?? null;
    const nextDraft = cloneSchedule(customSchedule ?? shopSchedule);
    setDraft(nextDraft);
    setInitialDraft(cloneSchedule(nextDraft));
    setHasCustomSchedule(customSchedule !== null);
    setInitialHasCustomSchedule(customSchedule !== null);
  }, [selectedProfessionalId, shopSchedule, professionalSchedules]);

  const dirty = useMemo(
    () =>
      selectedProfessionalId === 'shop'
        ? JSON.stringify(draft) !== JSON.stringify(initialShopSchedule)
        : hasCustomSchedule !== initialHasCustomSchedule ||
          (hasCustomSchedule && JSON.stringify(draft) !== JSON.stringify(initialDraft)),
    [draft, hasCustomSchedule, initialDraft, initialHasCustomSchedule, initialShopSchedule, selectedProfessionalId],
  );

  const updateDay = (day: WeekdayKey, patch: Partial<WeeklySchedule[WeekdayKey]>) =>
    setDraft((current) => ({
      ...current,
      [day]: { ...current[day], ...patch },
    }));

  async function save() {
    if (!dirty || saving) return;
    const scheduleToSave = cloneSchedule(draft);
    for (const day of WEEKDAY_KEYS) {
      scheduleToSave[day].work_intervals.sort((a, b) => a.start.localeCompare(b.start));
      scheduleToSave[day].break_intervals.sort((a, b) => a.start.localeCompare(b.start));
    }
    const validation = validateWeeklySchedule(scheduleToSave, locale);
    if (validation) {
      toast.error(validation);
      return;
    }

    setSaving(true);
    try {
      if (selectedProfessionalId === 'shop') {
        const result = await barbershopService.updateConfig(barbershopId, {
          weekly_schedule: scheduleToSave,
        });
        if (result.error) throw result.error;
        setShopSchedule(cloneSchedule(scheduleToSave));
        setInitialShopSchedule(cloneSchedule(scheduleToSave));
        setDraft(cloneSchedule(scheduleToSave));
        setInitialDraft(cloneSchedule(scheduleToSave));
      } else {
        const result = await professionalService.updateWeeklySchedule(
          selectedProfessionalId,
          hasCustomSchedule ? scheduleToSave : null,
        );
        if (result.error) throw result.error;
        setProfessionalSchedules((current) => ({
          ...current,
          [selectedProfessionalId]: hasCustomSchedule ? cloneSchedule(scheduleToSave) : null,
        }));
        if (hasCustomSchedule) {
          setDraft(cloneSchedule(scheduleToSave));
          setInitialDraft(cloneSchedule(scheduleToSave));
        }
        else {
          setDraft(cloneSchedule(shopSchedule));
          setInitialDraft(cloneSchedule(shopSchedule));
        }
        setInitialHasCustomSchedule(hasCustomSchedule);
      }
      toast.success(isPt ? 'Horário guardado com sucesso.' : 'Schedule saved successfully.');
    } catch (error) {
      console.error('[WEEKLY_SCHEDULE_SAVE_FAILED]', error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : isPt
            ? 'Não foi possível guardar o horário.'
            : 'Could not save the schedule.',
      );
    } finally {
      setSaving(false);
    }
  }

  const activeBarber = barbers.find((item) => item.id === selectedProfessionalId);
  const usingShopSchedule = selectedProfessionalId !== 'shop' && !hasCustomSchedule;

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-10 animate-pulse rounded-xl bg-white/[.05]" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-2xl bg-white/[.035]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-100">
            {isPt ? 'Horário semanal' : 'Weekly schedule'}
          </p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
            {isPt
              ? 'Define os períodos em que estás disponível e adiciona todas as pausas necessárias. Cada dia é configurado de forma independente.'
              : 'Set when you are available and add as many breaks as needed. Every day is configured independently.'}
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-2 sm:w-[min(100%,20rem)]">
          <UserRound className="size-4 shrink-0 text-zinc-500" />
          <Select value={selectedProfessionalId} onValueChange={setSelectedProfessionalId}>
            <SelectTrigger className="h-10 min-w-0 flex-1 border-white/10 bg-white/[.04] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="shop">{isPt ? 'Horário geral da barbearia' : 'Barbershop default schedule'}</SelectItem>
              {barbers.map((barber) => (
                <SelectItem key={barber.id} value={barber.id}>{barber.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {activeBarber ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[.025] p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-200">
              {isPt ? `Horário de ${activeBarber.name}` : `${activeBarber.name}'s schedule`}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {usingShopSchedule
                ? (isPt ? 'Este barbeiro segue o horário geral da barbearia.' : 'This barber follows the barbershop schedule.')
                : (isPt ? 'Este barbeiro tem um horário próprio.' : 'This barber has a personal schedule.')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-[11px] text-zinc-400 sm:inline">
              {isPt ? 'Horário próprio' : 'Personal schedule'}
            </span>
            <Switch
              checked={hasCustomSchedule}
              onCheckedChange={(checked) => {
                setHasCustomSchedule(checked);
                if (checked && !hasCustomSchedule) setDraft(cloneSchedule(shopSchedule));
              }}
              aria-label={isPt ? 'Ativar horário próprio' : 'Enable personal schedule'}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[.025] p-3 text-xs leading-5 text-zinc-500">
          {isPt
            ? 'Este é o horário de referência. Os barbeiros sem horário próprio seguem automaticamente estas definições.'
            : 'This is the default schedule. Barbers without a personal schedule automatically follow these settings.'}
        </div>
      )}

      {usingShopSchedule ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[.015] p-4 text-sm text-zinc-500">
          {isPt
            ? 'Ativa o horário próprio para definires dias, períodos de trabalho e pausas diferentes para este barbeiro.'
            : 'Enable a personal schedule to configure different work days, periods and breaks for this barber.'}
        </div>
      ) : (
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
          {WEEKDAY_KEYS.map((dayKey) => {
            const day = draft[dayKey];
            const label = DAY_LABELS[dayKey][locale];
            return (
              <Card key={dayKey} className={cn(
                'min-w-0 overflow-hidden border-white/10 bg-white/[.018] shadow-none',
                day.day_off && 'border-amber-300/15 bg-amber-300/[.025]',
              )}>
                <CardContent className="space-y-4 p-3.5 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {day.day_off ? (
                        <CalendarOff className="size-4 shrink-0 text-amber-300" />
                      ) : (
                        <Clock3 className="size-4 shrink-0 text-emerald-300" />
                      )}
                      <p className="truncate text-sm font-semibold text-zinc-100">{label}</p>
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        day.day_off
                          ? 'bg-amber-300/10 text-amber-200'
                          : 'bg-emerald-300/10 text-emerald-200',
                      )}>
                        {day.day_off ? (isPt ? 'Folga' : 'Day off') : (isPt ? 'Trabalho' : 'Working')}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="hidden text-[10px] text-zinc-500 sm:inline">
                        {isPt ? 'Dia de folga' : 'Day off'}
                      </span>
                      <Switch
                        checked={day.day_off}
                        onCheckedChange={(checked) => updateDay(dayKey, { day_off: checked })}
                        aria-label={isPt ? `${label}: dia de folga` : `${label}: day off`}
                      />
                    </div>
                  </div>

                  {!day.day_off ? (
                    <div className="space-y-4">
                      <IntervalRows
                        title={isPt ? 'Períodos de trabalho' : 'Working periods'}
                        intervals={day.work_intervals}
                        kind="work_intervals"
                        locale={locale}
                        onChange={(next) => updateDay(dayKey, { work_intervals: next })}
                      />
                      <div className="border-t border-white/[.07]" />
                      <IntervalRows
                        title={isPt ? 'Pausas' : 'Breaks'}
                        intervals={day.break_intervals}
                        kind="break_intervals"
                        locale={locale}
                        onChange={(next) => updateDay(dayKey, { break_intervals: next })}
                      />
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-amber-300/15 bg-amber-300/[.025] px-3 py-3 text-xs text-amber-200/70">
                      {isPt ? 'Sem marcações neste dia.' : 'No appointments on this day.'}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-white/[.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] leading-5 text-zinc-600">
          {isPt
            ? 'Uma marcação só é aceite quando cabe num período de trabalho e não coincide com uma pausa.'
            : 'A booking is only accepted when it fits inside a working period and does not overlap a break.'}
        </p>
        <Button
          type="button"
          onClick={save}
          disabled={!dirty || saving || usingShopSchedule}
          className="h-10 gap-2 bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
        >
          <Save className="size-4" />
          {saving
            ? (isPt ? 'A guardar…' : 'Saving…')
            : (isPt ? 'Guardar horário' : 'Save schedule')}
        </Button>
      </div>
    </div>
  );
}
