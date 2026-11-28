import assert from 'node:assert/strict';
import {
  filterEligibleReportPeriods,
  getClosedReportPeriods,
  type PeriodReportPreference,
  type PeriodReportType,
} from '../../lib/analytics/periodic-reports';
import { createDefaultWeeklySchedule } from '../../lib/scheduling/weekly-schedule';

function weekdaySchedule() {
  const schedule = createDefaultWeeklySchedule();
  schedule.saturday = { day_off: true, work_intervals: [], break_intervals: [] };
  schedule.sunday = { day_off: true, work_intervals: [], break_intervals: [] };
  return schedule;
}

function hasPeriod(
  now: string,
  type: PeriodReportType,
  startDate: string,
  schedule = weekdaySchedule(),
) {
  return getClosedReportPeriods(new Date(now), schedule).some(
    (period) => period.type === type && period.startDate === startDate,
  );
}

// Daily reports close at the end of the last configured shift.
assert.equal(hasPeriod('2026-11-27T18:59:00Z', 'day', '2026-11-27'), false);
assert.equal(hasPeriod('2026-11-27T19:01:00Z', 'day', '2026-11-27'), true);

// A weekly report must wait until Sunday at 23:59, not Friday's closing time.
assert.equal(hasPeriod('2026-11-27T19:01:00Z', 'week', '2026-11-23'), false);
assert.equal(hasPeriod('2026-11-29T23:58:00Z', 'week', '2026-11-23'), false);
assert.equal(hasPeriod('2026-11-29T23:59:00Z', 'week', '2026-11-23'), true);

// Monthly reports must wait until the very last calendar day has ended.
assert.equal(hasPeriod('2026-11-30T19:01:00Z', 'month', '2026-11-01'), false);
assert.equal(hasPeriod('2026-11-30T23:58:00Z', 'month', '2026-11-01'), false);
assert.equal(hasPeriod('2026-11-30T23:59:00Z', 'month', '2026-11-01'), true);

// Day-off daily summaries still close at 23:59 local time.
assert.equal(hasPeriod('2026-11-29T23:58:00Z', 'day', '2026-11-29'), false);
assert.equal(hasPeriod('2026-11-29T23:59:00Z', 'day', '2026-11-29'), true);

const sundaySchedule = createDefaultWeeklySchedule();
for (const day of Object.keys(sundaySchedule) as Array<keyof typeof sundaySchedule>) {
  sundaySchedule[day] = { day_off: true, work_intervals: [], break_intervals: [] };
}
sundaySchedule.sunday = {
  day_off: false,
  work_intervals: [{ start: '10:00', end: '19:00' }],
  break_intervals: [],
};
assert.equal(hasPeriod('2026-03-29T17:59:00Z', 'day', '2026-03-29', sundaySchedule), false);
assert.equal(hasPeriod('2026-03-29T18:01:00Z', 'day', '2026-03-29', sundaySchedule), true);
assert.equal(hasPeriod('2026-03-29T22:58:00Z', 'week', '2026-03-23', sundaySchedule), false);
assert.equal(hasPeriod('2026-03-29T22:59:00Z', 'week', '2026-03-23', sundaySchedule), true);

// Catch-up creates only the latest closed window of each type.
const catchUp = getClosedReportPeriods(
  new Date('2026-12-01T08:00:00Z'),
  weekdaySchedule(),
);
assert.equal(catchUp.filter((period) => period.type === 'day').length, 1);
assert.equal(catchUp.filter((period) => period.type === 'week').length, 1);
assert.equal(catchUp.filter((period) => period.type === 'month').length, 1);
assert.equal(catchUp.find((period) => period.type === 'day')?.startDate, '2026-11-30');
assert.equal(catchUp.find((period) => period.type === 'week')?.startDate, '2026-11-23');
assert.equal(catchUp.find((period) => period.type === 'month')?.startDate, '2026-11-01');

// Each setting is independent. Re-enabling a type does not surface a period
// that had already closed while that type was disabled.
const preferences: Record<PeriodReportType, PeriodReportPreference> = {
  day: { enabled: true, enabledAt: '2026-11-30T19:00:00.000Z' },
  week: { enabled: true, enabledAt: '2026-11-29T23:58:00.000Z' },
  month: { enabled: false, enabledAt: null },
};
const eligible = filterEligibleReportPeriods(catchUp, preferences);
assert.deepEqual(eligible.map((period) => period.type), ['week']);

console.log('Periodic reports QA passed: daily shift close, Sunday and month-end boundaries, Lisbon DST, catch-up and independent preferences.');
