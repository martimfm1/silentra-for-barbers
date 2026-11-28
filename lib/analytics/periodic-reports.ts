import { getDailySchedule, type WeeklySchedule } from '@/lib/scheduling/weekly-schedule';

export type PeriodReportType = 'day' | 'week' | 'month';
export type PeriodReportWindow = {
  type: PeriodReportType;
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  startAt: string;
  endAt: string;
  previousStartAt: string;
  previousEndAt: string;
};

const ZONE = 'Europe/Lisbon';

function dateKey(value: Date): string {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return values.year + '-' + values.month + '-' + values.day;
}

function offsetMinutes(value: Date): number {
  const name = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE, timeZoneName: 'shortOffset', hour: '2-digit',
    minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(value).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(name);
  if (!match) return 0;
  return (match[1] === '-' ? -1 : 1) *
    (Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0));
}

function localToUtc(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const local = Date.UTC(year, month - 1, day, hour, minute);
  let instant = new Date(local);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    instant = new Date(local - offsetMinutes(instant) * 60_000);
  }
  return instant;
}

function addDays(date: string, amount: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + amount));
  return value.getUTCFullYear() + '-' +
    String(value.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(value.getUTCDate()).padStart(2, '0');
}

function weekday(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function weekStart(date: string): string {
  return addDays(date, -((weekday(date) + 6) % 7));
}

function monthStart(date: string): string {
  return date.slice(0, 7) + '-01';
}

function monthEnd(date: string): string {
  const [year, month] = date.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0));
  return year + '-' + String(month).padStart(2, '0') + '-' +
    String(last.getUTCDate()).padStart(2, '0');
}

function previousMonth(date: string): { start: string; end: string } {
  const end = addDays(monthStart(date), -1);
  return { start: monthStart(end), end };
}

function closingInstant(schedule: WeeklySchedule, date: string): Date | null {
  const day = getDailySchedule(schedule, weekday(date));
  if (day.day_off || day.work_intervals.length === 0) return null;
  const times = day.work_intervals.map((item) => item.end.slice(0, 5))
    .filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)).sort();
  const last = times[times.length - 1];
  return last ? localToUtc(date, last) : null;
}

function periodHasClosed(
  schedule: WeeklySchedule, start: string, end: string, now: Date,
): boolean {
  for (let date = end; date >= start; date = addDays(date, -1)) {
    const closing = closingInstant(schedule, date);
    if (closing) return closing.getTime() <= now.getTime();
  }
  return localToUtc(end, '23:59').getTime() <= now.getTime();
}

function makeWindow(
  type: PeriodReportType, startDate: string, endDate: string,
  previousStartDate: string, previousEndDate: string,
): PeriodReportWindow {
  return {
    type, startDate, endDate, previousStartDate, previousEndDate,
    startAt: localToUtc(startDate, '00:00').toISOString(),
    endAt: localToUtc(addDays(endDate, 1), '00:00').toISOString(),
    previousStartAt: localToUtc(previousStartDate, '00:00').toISOString(),
    previousEndAt: localToUtc(addDays(previousEndDate, 1), '00:00').toISOString(),
  };
}

export function getClosedReportPeriods(
  now: Date, schedule: WeeklySchedule,
): PeriodReportWindow[] {
  const today = dateKey(now);
  const periods: PeriodReportWindow[] = [];

  for (let offset = 0; offset < 14; offset += 1) {
    const date = addDays(today, -offset);
    const closing = closingInstant(schedule, date);
    if (!closing || closing.getTime() > now.getTime()) continue;
    const previous = addDays(date, -1);
    periods.push(makeWindow('day', date, date, previous, previous));
  }

  const thisWeek = weekStart(today);
  for (let offset = 0; offset < 4; offset += 1) {
    const start = addDays(thisWeek, -7 * offset);
    const end = addDays(start, 6);
    if (!periodHasClosed(schedule, start, end, now)) continue;
    const previousStart = addDays(start, -7);
    periods.push(makeWindow('week', start, end, previousStart, addDays(previousStart, 6)));
  }

  const [year, month] = today.split('-').map(Number);
  for (let offset = 0; offset < 3; offset += 1) {
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    const start = date.getUTCFullYear() + '-' +
      String(date.getUTCMonth() + 1).padStart(2, '0') + '-01';
    const end = monthEnd(start);
    if (!periodHasClosed(schedule, start, end, now)) continue;
    const previous = previousMonth(start);
    periods.push(makeWindow('month', start, end, previous.start, previous.end));
  }

  return periods;
}
