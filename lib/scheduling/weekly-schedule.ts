export const WEEKDAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export type ScheduleInterval = {
  start: string;
  end: string;
};

export type DailySchedule = {
  day_off: boolean;
  work_intervals: ScheduleInterval[];
  break_intervals: ScheduleInterval[];
};

export type WeeklySchedule = Record<WeekdayKey, DailySchedule>;

export type LegacyScheduleInput = {
  opening_time?: string | null;
  closing_time?: string | null;
  lunch_start?: string | null;
  lunch_end?: string | null;
  closed_days?: string | number[] | null;
};

export const WEEKDAY_INDEX: Record<WeekdayKey, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const LEGACY_DAY_NAMES: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  domingo: 0,
  segunda: 1,
  'segunda-feira': 1,
  terca: 2,
  terça: 2,
  'terca-feira': 2,
  'terça-feira': 2,
  quarta: 3,
  'quarta-feira': 3,
  quinta: 4,
  'quinta-feira': 4,
  sexta: 5,
  'sexta-feira': 5,
  sabado: 6,
  sábado: 6,
};

const DEFAULT_WORK_INTERVAL: ScheduleInterval = {
  start: '09:00',
  end: '19:00',
};

function cleanTime(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const time = value.slice(0, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : fallback;
}

function normalizeIntervals(value: unknown): ScheduleInterval[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Record<string, unknown>;
      const start = cleanTime(candidate.start, '');
      const end = cleanTime(candidate.end, '');
      return start && end ? { start, end } : null;
    })
    .filter((item): item is ScheduleInterval => item !== null);
}

export function createDefaultWeeklySchedule(): WeeklySchedule {
  return Object.fromEntries(
    WEEKDAY_KEYS.map((key) => [
      key,
      {
        day_off: false,
        work_intervals: [{ ...DEFAULT_WORK_INTERVAL }],
        break_intervals: [],
      },
    ]),
  ) as unknown as WeeklySchedule;
}

export function createWeeklyScheduleFromLegacy(
  legacy: LegacyScheduleInput = {},
): WeeklySchedule {
  const closedDays = new Set<number>();
  const rawClosedDays = Array.isArray(legacy.closed_days)
    ? legacy.closed_days
    : typeof legacy.closed_days === 'string'
      ? legacy.closed_days.split(',')
      : [];

  for (const raw of rawClosedDays) {
    const token = String(raw).trim().toLowerCase();
    if (!token || token === 'none') continue;
    if (/^[0-6]$/.test(token)) {
      closedDays.add(Number(token));
      continue;
    }
    const index = LEGACY_DAY_NAMES[token];
    if (index !== undefined) closedDays.add(index);
  }

  const opening = cleanTime(legacy.opening_time, '09:00');
  const closing = cleanTime(legacy.closing_time, '19:00');
  const validWorkInterval = opening < closing;
  const lunchStart = cleanTime(legacy.lunch_start, '');
  const lunchEnd = cleanTime(legacy.lunch_end, '');
  const validBreak = Boolean(lunchStart && lunchEnd && lunchStart < lunchEnd);

  return Object.fromEntries(
    WEEKDAY_KEYS.map((key) => {
      const dayOff = closedDays.has(WEEKDAY_INDEX[key]);
      return [
        key,
        {
          day_off: dayOff,
          work_intervals:
            !dayOff && validWorkInterval
              ? [{ start: opening, end: closing }]
              : [],
          break_intervals:
            !dayOff && validBreak
              ? [{ start: lunchStart, end: lunchEnd }]
              : [],
        },
      ];
    }),
  ) as unknown as WeeklySchedule;
}

export function normalizeWeeklySchedule(
  value: unknown,
  legacy?: LegacyScheduleInput,
): WeeklySchedule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return legacy
      ? createWeeklyScheduleFromLegacy(legacy)
      : createDefaultWeeklySchedule();
  }

  const source = value as Record<string, unknown>;
  const fallback = legacy
    ? createWeeklyScheduleFromLegacy(legacy)
    : createDefaultWeeklySchedule();

  return Object.fromEntries(
    WEEKDAY_KEYS.map((key) => {
      const raw = source[key];
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return [key, fallback[key]];
      }
      const day = raw as Record<string, unknown>;
      return [
        key,
        {
          day_off: day.day_off === true,
          work_intervals: normalizeIntervals(day.work_intervals),
          break_intervals: normalizeIntervals(day.break_intervals),
        },
      ];
    }),
  ) as WeeklySchedule;
}

export function getDailySchedule(
  schedule: WeeklySchedule,
  weekdayIndex: number,
): DailySchedule {
  const key =
    WEEKDAY_KEYS.find((item) => WEEKDAY_INDEX[item] === weekdayIndex) ??
    'monday';
  return schedule[key];
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function intervalsOverlap(
  start: number,
  end: number,
  otherStart: number,
  otherEnd: number,
): boolean {
  return start < otherEnd && end > otherStart;
}

export function isSlotWithinDailySchedule(
  day: DailySchedule,
  start: number,
  end: number,
): boolean {
  if (day.day_off || end <= start) return false;

  const withinWorkInterval = day.work_intervals.some(
    (interval) =>
      start >= timeToMinutes(interval.start) &&
      end <= timeToMinutes(interval.end),
  );
  if (!withinWorkInterval) return false;

  return !day.break_intervals.some((interval) =>
    intervalsOverlap(
      start,
      end,
      timeToMinutes(interval.start),
      timeToMinutes(interval.end),
    ),
  );
}

export function validateWeeklySchedule(
  schedule: WeeklySchedule,
  locale: 'pt' | 'en' = 'pt',
): string | null {
  const labels: Record<WeekdayKey, string> =
    locale === 'pt'
      ? {
          monday: 'Segunda-feira',
          tuesday: 'Terça-feira',
          wednesday: 'Quarta-feira',
          thursday: 'Quinta-feira',
          friday: 'Sexta-feira',
          saturday: 'Sábado',
          sunday: 'Domingo',
        }
      : {
          monday: 'Monday',
          tuesday: 'Tuesday',
          wednesday: 'Wednesday',
          thursday: 'Thursday',
          friday: 'Friday',
          saturday: 'Saturday',
          sunday: 'Sunday',
        };

  const invalidTime = (value: string) =>
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(value);

  for (const key of WEEKDAY_KEYS) {
    const day = schedule[key];
    if (day.day_off) continue;
    if (!day.work_intervals.length) {
      return locale === 'pt'
        ? `${labels[key]}: adiciona um período de trabalho ou marca o dia como folga.`
        : `${labels[key]}: add a work period or mark this day as off.`;
    }

    const work = [...day.work_intervals]
      .map((interval) => ({
        start: timeToMinutes(interval.start),
        end: timeToMinutes(interval.end),
      }))
      .sort((a, b) => a.start - b.start);

    if (
      day.work_intervals.some(
        (interval) =>
          invalidTime(interval.start) ||
          invalidTime(interval.end) ||
          interval.start >= interval.end,
      )
    ) {
      return locale === 'pt'
        ? `${labels[key]}: verifica os horários de trabalho.`
        : `${labels[key]}: check the working times.`;
    }

    for (let index = 1; index < work.length; index += 1) {
      if (work[index].start < work[index - 1].end) {
        return locale === 'pt'
          ? `${labels[key]}: os períodos de trabalho não podem sobrepor-se.`
          : `${labels[key]}: work periods cannot overlap.`;
      }
    }

    const breaks = [...day.break_intervals]
      .map((interval) => ({
        start: timeToMinutes(interval.start),
        end: timeToMinutes(interval.end),
      }))
      .sort((a, b) => a.start - b.start);

    if (
      day.break_intervals.some(
        (interval) =>
          invalidTime(interval.start) ||
          invalidTime(interval.end) ||
          interval.start >= interval.end,
      )
    ) {
      return locale === 'pt'
        ? `${labels[key]}: verifica os horários das pausas.`
        : `${labels[key]}: check the break times.`;
    }

    for (const pause of breaks) {
      if (
        !work.some(
          (period) => pause.start >= period.start && pause.end <= period.end,
        )
      ) {
        return locale === 'pt'
          ? `${labels[key]}: cada pausa tem de estar dentro de um período de trabalho.`
          : `${labels[key]}: each break must fit inside a working period.`;
      }
    }

    for (let index = 1; index < breaks.length; index += 1) {
      if (breaks[index].start < breaks[index - 1].end) {
        return locale === 'pt'
          ? `${labels[key]}: as pausas não podem sobrepor-se.`
          : `${labels[key]}: breaks cannot overlap.`;
      }
    }
  }

  return null;
}
