import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  appointmentsShareProfessionalCapacity,
  createDefaultWeeklySchedule,
  createWeeklyScheduleFromLegacy,
  getDailySchedule,
  isSlotWithinDailySchedule,
  validateWeeklySchedule,
  type WeeklySchedule,
} from '../../lib/scheduling/weekly-schedule';

// Unassigned appointments reserve capacity across the entire barbershop.
assert.equal(
  appointmentsShareProfessionalCapacity(null, 'barber-a'),
  true,
  'An unassigned appointment must block a specific barber',
);
assert.equal(
  appointmentsShareProfessionalCapacity('barber-a', null),
  true,
  'A specific appointment must respect an existing unassigned booking',
);
assert.equal(
  appointmentsShareProfessionalCapacity('barber-a', 'barber-a'),
  true,
  'Appointments assigned to the same barber must conflict',
);
assert.equal(
  appointmentsShareProfessionalCapacity('barber-a', 'barber-b'),
  false,
  'Appointments assigned to different barbers may use the same time',
);

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
  'supabase/migrations/20261114002250_weekly_barber_schedules.sql',
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

const authorizationMigration = readFileSync(
  'supabase/migrations/20261114002436_harden_weekly_schedule_rpc_authorization.sql',
  'utf8',
);
assert.equal(
  authorizationMigration.split("u.role in ('owner', 'admin')").length - 1,
  2,
  'Both schedule RPCs must authorize owners/admins, not every user linked to the tenant',
);
assert.equal(
  (authorizationMigration.match(/set search_path = ''/g) ?? []).length,
  2,
  'SECURITY DEFINER schedule RPCs must pin an empty search_path',
);
assert.ok(authorizationMigration.includes('u.barbershop_id = p_barbershop_id'));
assert.ok(authorizationMigration.includes('u.barbershop_id = v_barbershop_id'));

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


// Duration-aware public availability must match the atomic booking RPC.
// A booking without an assigned barber reserves the interval for every barber.
const bookingAvailability = readFileSync(
  'app/api/shops/[id]/booking-data/route.ts',
  'utf8',
);
assert.ok(
  bookingAvailability.includes('appointmentsShareProfessionalCapacity('),
  'Unassigned bookings must block availability for every professional',
);
assert.ok(
  bookingAvailability.includes('appointment.start, appointment.end'),
  'Availability must compare the full appointment interval, not only its start',
);
assert.ok(
  bookingAvailability.includes('Number(appointment.duration_minutes ?? 30)'),
  'Existing bookings must reserve their persisted duration',
);
assert.ok(
  bookingAvailability.includes('slotStart + serviceDuration <= periodEnd'),
  'A new service must fit completely inside a working interval',
);
assert.ok(
  bookingAvailability.includes('slotStart += 30'),
  'Candidate start times must retain the existing 30-minute booking grid',
);

const atomicBookingMigration = readFileSync(
  'supabase/migrations/20261114002250_weekly_barber_schedules.sql',
  'utf8',
);
assert.ok(
  atomicBookingMigration.includes(
    'a.date_hour < p_date_hour + make_interval(mins => v_duration)',
  ),
  'Atomic booking creation must reserve the exact requested service duration',
);
assert.ok(
  atomicBookingMigration.includes(
    'a.date_hour + make_interval(\n        mins => greatest(1, least(coalesce(a.duration_minutes, 30), 1440))\n      ) > p_date_hour',
  ),
  'Atomic booking conflict checks must use the existing appointment duration',
);

// Boundary examples: intervals touching at the exact end are valid, while
// any real overlap (including a 45-minute service) is rejected.
const intervalOverlaps = (start: number, end: number, otherStart: number, otherEnd: number) =>
  start < otherEnd && end > otherStart;
assert.equal(intervalOverlaps(9 * 60, 9 * 60 + 45, 9 * 60 + 30, 10 * 60), true);
assert.equal(intervalOverlaps(9 * 60, 9 * 60 + 45, 9 * 60 + 45, 10 * 60), false);
assert.equal(intervalOverlaps(9 * 60, 10 * 60, 9 * 60 + 30, 10 * 60 + 30), true);

const teamRescheduleSource = readFileSync(
  'app/api/appointments/[appointmentId]/reschedule/route.ts',
  'utf8',
);
const customerPortalSource = readFileSync(
  'app/api/customer-portal/appointments/[appointmentId]/route.ts',
  'utf8',
);
assert.ok(
  teamRescheduleSource.includes('appointmentsShareProfessionalCapacity('),
  'Team rescheduling must respect unassigned bookings across the barbershop',
);
assert.ok(
  customerPortalSource.includes('appointmentsShareProfessionalCapacity('),
  'Customer portal rescheduling must respect unassigned bookings across the barbershop',
);

const crossLaneCapacityMigration = readFileSync(
  'supabase/migrations/20261119231000_enforce_cross_lane_appointment_capacity.sql',
  'utf8',
);
assert.match(
  crossLaneCapacityMigration,
  /create or replace function public\.enforce_appointment_capacity_overlap\(\)/i,
);
assert.match(
  crossLaneCapacityMigration,
  /returns trigger[\s\S]*language plpgsql[\s\S]*volatile[\s\S]*security definer[\s\S]*set search_path = ''/i,
  'The trigger must use a fresh snapshot and a pinned search_path while seeing all tenant bookings',
);
assert.match(
  crossLaneCapacityMigration,
  /pg_catalog\.pg_advisory_xact_lock\([\s\S]*pg_catalog\.hashtextextended\(new\.barbershop_id::text, 0\)/i,
  'All appointment writes must share the same barbershop transaction lock',
);
assert.match(
  crossLaneCapacityMigration,
  /after insert or update of[\s\S]*professional_id[\s\S]*date_hour[\s\S]*duration_minutes[\s\S]*status[\s\S]*on public\.appointments/i,
  'The final-row guard must cover creation, rescheduling and capacity changes',
);
assert.match(
  crossLaneCapacityMigration,
  /a\.id is distinct from new\.id[\s\S]*a\.date_hour < new\.date_hour[\s\S]*a\.professional_id is null[\s\S]*a\.professional_id = new\.professional_id/i,
  'The conflict check must exclude the row being updated and apply unassigned capacity globally',
);
assert.match(
  crossLaneCapacityMigration,
  /errcode = '23P01'[\s\S]*message = 'BOOKING_CONFLICT'/i,
  'Database overlap failures must use the existing API conflict contract',
);
assert.match(
  crossLaneCapacityMigration,
  /revoke all on function public\.enforce_appointment_capacity_overlap\(\)[\s\S]*from public, anon, authenticated, service_role/i,
  'The SECURITY DEFINER trigger function must not be directly callable by API roles',
);
assert.match(
  crossLaneCapacityMigration,
  /create trigger zz_enforce_appointment_capacity_overlap/i,
  'The cross-lane guard must be attached to appointments',
);
assert.match(
  crossLaneCapacityMigration,
  /rollback[\\s\\S]*drop trigger if exists zz_enforce_appointment_capacity_overlap[\\s\\S]*drop function if exists public\\.enforce_appointment_capacity_overlap/i,
  'The database guard migration must document its rollback path',
);
