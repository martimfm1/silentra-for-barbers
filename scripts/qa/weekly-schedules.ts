import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createDefaultWeeklySchedule,
  createWeeklyScheduleFromLegacy,
  getDailySchedule,
  isSlotWithinDailySchedule,
  validateWeeklySchedule,
  type WeeklySchedule,
} from '../../lib/scheduling/weekly-schedule';

const defaultSchedule = createDefaultWeeklySchedule();
assert.equal(
  isSlotWithinDailySchedule(getDailySchedule(defaultSchedule, 6), 9 * 60, 9 * 60 + 30),
  true,
  'Saturday should be a working day by default',
);

const saturdayAfternoon = createDefaultWeeklySchedule();
saturdayAfternoon.saturday = {
  day_off: false,
  work_intervals: [{ start: '14:00', end: '19:00' }],
  break_intervals: [],
};
assert.equal(validateWeeklySchedule(saturdayAfternoon), null);
const saturday = getDailySchedule(saturdayAfternoon, 6);
assert.equal(isSlotWithinDailySchedule(saturday, 14 * 60, 14 * 60 + 30), true);
assert.equal(isSlotWithinDailySchedule(saturday, 13 * 60 + 30, 14 * 60), false);
assert.equal(isSlotWithinDailySchedule(saturday, 18 * 60 + 45, 19 * 60 + 15), false);

const splitDay: WeeklySchedule = createDefaultWeeklySchedule();
splitDay.monday = {
  day_off: false,
  work_intervals: [
    { start: '09:00', end: '12:00' },
    { start: '14:00', end: '18:00' },
  ],
  break_intervals: [{ start: '10:30', end: '10:45' }],
};
assert.equal(validateWeeklySchedule(splitDay), null);
const monday = getDailySchedule(splitDay, 1);
assert.equal(isSlotWithinDailySchedule(monday, 10 * 60, 10 * 60 + 30), true);
assert.equal(isSlotWithinDailySchedule(monday, 10 * 60 + 30, 11 * 60), false);
assert.equal(isSlotWithinDailySchedule(monday, 12 * 60, 12 * 60 + 30), false);
assert.equal(isSlotWithinDailySchedule(monday, 14 * 60, 14 * 60 + 30), true);

const dayOff = { ...saturday, day_off: true };
assert.equal(isSlotWithinDailySchedule(dayOff, 14 * 60, 14 * 60 + 30), false);

const legacy = createWeeklyScheduleFromLegacy({
  opening_time: '10:00:00',
  closing_time: '18:00:00',
  lunch_start: '13:00:00',
  lunch_end: '14:00:00',
  closed_days: 'Sunday,Tuesday',
});
assert.equal(getDailySchedule(legacy, 0).day_off, true);
assert.equal(getDailySchedule(legacy, 2).day_off, true);
assert.deepEqual(getDailySchedule(legacy, 6).work_intervals, [
  { start: '10:00', end: '18:00' },
]);
assert.equal(
  isSlotWithinDailySchedule(getDailySchedule(legacy, 6), 13 * 60 + 15, 13 * 60 + 45),
  false,
);

const migration = readFileSync(
  'supabase/migrations/20261113190000_weekly_barber_schedules.sql',
  'utf8',
);
assert.ok(migration.includes('set_barbershop_weekly_schedule'));
assert.ok(migration.includes('set_professional_weekly_schedule'));
assert.ok(migration.includes('is_valid_weekly_schedule'));
assert.ok(migration.includes('coalesce(p.weekly_schedule, b.weekly_schedule)'));
assert.ok(migration.includes('BOOKING_OUTSIDE_WORKING_HOURS'));
assert.ok(migration.includes('BOOKING_OVERLAPS_BREAK'));
assert.ok(migration.includes('v_start is null'));
assert.ok(migration.includes('v_end is null'));

const files = [
  'app/api/shops/[id]/booking-data/route.ts',
  'app/api/bookings/route.ts',
  'app/api/appointments/[appointmentId]/reschedule/route.ts',
  'app/api/customer-portal/appointments/[appointmentId]/route.ts',
  'app/api/shops/[id]/slots/route.ts',
  'app/dashboard/settings/settings-page.tsx',
  'components/dashboard/weekly-schedule-settings.tsx',
];
for (const path of files) {
  const source = readFileSync(path, 'utf8');
  assert.ok(
    source.includes('weekly_schedule') || source.includes('WeeklyScheduleSettings'),
    `Expected weekly schedule integration in ${path}`,
  );
}
console.log('Weekly schedule QA passed: Saturday afternoons, split shifts, breaks, day off and legacy migration.');
