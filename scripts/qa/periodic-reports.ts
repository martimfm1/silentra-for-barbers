import assert from 'node:assert/strict';
import { createDefaultWeeklySchedule } from '../../lib/scheduling/weekly-schedule';
import { getClosedReportPeriods } from '../../lib/analytics/periodic-reports';

function weekdaySchedule() {
  const schedule = createDefaultWeeklySchedule();
  schedule.saturday = { day_off: true, work_intervals: [], break_intervals: [] };
  schedule.sunday = { day_off: true, work_intervals: [], break_intervals: [] };
  return schedule;
}

function hasPeriod(
  now: string,
  type: 'day' | 'week' | 'month',
  startDate: string,
  schedule = weekdaySchedule(),
) {
  return getClosedReportPeriods(new Date(now), schedule).some(
    (period) => period.type === type && period.startDate === startDate,
  );
}

assert.equal(hasPeriod('2026-11-27T18:59:00Z', 'day', '2026-11-27'), false);
assert.equal(hasPeriod('2026-11-27T18:59:00Z', 'week', '2026-11-23'), false);
assert.equal(hasPeriod('2026-11-27T19:01:00Z', 'day', '2026-11-27'), true);
assert.equal(hasPeriod('2026-11-27T19:01:00Z', 'week', '2026-11-23'), true);
assert.equal(hasPeriod('2026-11-27T19:01:00Z', 'month', '2026-11-01'), false);
assert.equal(hasPeriod('2026-11-30T19:01:00Z', 'month', '2026-11-01'), true);
assert.equal(hasPeriod('2026-12-01T08:00:00Z', 'day', '2026-11-30'), true);
assert.equal(hasPeriod('2026-12-01T08:00:00Z', 'week', '2026-11-23'), true);

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

console.log('Periodic reports QA passed: daily, weekly, monthly close boundaries and Europe/Lisbon DST.');
