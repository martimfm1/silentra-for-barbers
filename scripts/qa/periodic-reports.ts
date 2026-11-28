import assert from 'node:assert/strict';
import {
  createDefaultWeeklySchedule,
  getClosedReportPeriods,
} from '../../lib/analytics/periodic-reports';

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

// Daily and weekly reports only become available after the final scheduled
// closing time. The previous fully closed periods remain available.
assert.equal(
  hasPeriod('2026-11-27T18:59:00Z', 'day', '2026-11-27'),
  false,
  'The daily report must not open before the scheduled 19:00 close',
);
assert.equal(
  hasPeriod('2026-11-27T18:59:00Z', 'week', '2026-11-23'),
  false,
  'The weekly report must wait for the final working day of the week',
);
assert.equal(
  hasPeriod('2026-11-27T19:01:00Z', 'day', '2026-11-27'),
  true,
  'The daily report should open immediately after closing',
);
assert.equal(
  hasPeriod('2026-11-27T19:01:00Z', 'week', '2026-11-23'),
  true,
  'The weekly report should open after Friday closing',
);
assert.equal(
  hasPeriod('2026-11-27T19:01:00Z', 'month', '2026-11-01'),
  false,
  'The monthly report must wait for the final scheduled day of the month',
);

// The final Monday of November closes the month. When the barber opens the
// dashboard the next morning, the month report must still be discoverable.
assert.equal(
  hasPeriod('2026-11-30T19:01:00Z', 'month', '2026-11-01'),
  true,
  'The monthly report should open after the last scheduled shift of the month',
);
assert.equal(
  hasPeriod('2026-12-01T08:00:00Z', 'day', '2026-11-30'),
  true,
  'A report missed after closing must be available on the next dashboard visit',
);
assert.equal(
  hasPeriod('2026-12-01T08:00:00Z', 'week', '2026-11-23'),
  true,
  'A weekly report missed after closing must remain available',
);

// Daylight-saving changes in Lisbon must not shift the configured local close.
// On 29 March 2026 Lisbon is UTC+1, so a 19:00 close is 18:00 UTC.
const sundaySchedule = createDefaultWeeklySchedule();
for (const day of Object.keys(sundaySchedule) as Array<keyof typeof sundaySchedule>) {
  sundaySchedule[day] = {
    day_off: true,
    work_intervals: [],
    break_intervals: [],
  };
}
sundaySchedule.sunday = {
  day_off: false,
  work_intervals: [{ start: '10:00', end: '19:00' }],
  break_intervals: [],
};
assert.equal(
  hasPeriod('2026-03-29T17:59:00Z', 'day', '2026-03-29', sundaySchedule),
  false,
  'DST must not close a 19:00 shift one hour early',
);
assert.equal(
  hasPeriod('2026-03-29T18:01:00Z', 'day', '2026-03-29', sundaySchedule),
  true,
  'DST-aware conversion should close the shift at 19:00 Lisbon time',
);

console.log('Periodic reports QA passed: daily, weekly, monthly close boundaries and Europe/Lisbon DST.');
