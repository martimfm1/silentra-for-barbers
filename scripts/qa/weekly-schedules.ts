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
const scheduleBlockCapacityMigration = readFileSync(
  'supabase/migrations/20261120173000_enforce_schedule_block_capacity.sql',
  'utf8',
);
assert.ok(scheduleBlockCapacityMigration.includes('create trigger b_enforce_appointment_schedule_block_capacity'));
assert.ok(scheduleBlockCapacityMigration.includes('create trigger b_enforce_schedule_block_no_appointment_overlap'));
assert.ok(scheduleBlockCapacityMigration.includes('before insert or update'));
assert.ok(scheduleBlockCapacityMigration.includes('on public.appointments'));
assert.ok(scheduleBlockCapacityMigration.includes('on public.schedule_blocks'));
assert.ok(scheduleBlockCapacityMigration.includes('pg_advisory_xact_lock'));
assert.ok(scheduleBlockCapacityMigration.includes('hashtextextended(new.barbershop_id::text, 0)'));
assert.ok(scheduleBlockCapacityMigration.includes('SCHEDULE_BLOCK_OVERLAPS_APPOINTMENT'));
assert.ok(scheduleBlockCapacityMigration.includes('BOOKING_CONFLICT'));
assert.ok(scheduleBlockCapacityMigration.includes('Rollback: drop the two triggers'));

const publicBookingData = readFileSync(
  'app/api/shops/[id]/booking-data/route.ts',
  'utf8',
);
const publicBookingApi = readFileSync('app/api/bookings/route.ts', 'utf8');
const teamRescheduleApi = readFileSync(
  'app/api/appointments/[appointmentId]/reschedule/route.ts',
  'utf8',
);
const customerPortalAppointmentApi = readFileSync(
  'app/api/customer-portal/appointments/[appointmentId]/route.ts',
  'utf8',
);
assert.ok(publicBookingData.includes('professionals.every('));
assert.ok(publicBookingData.includes('professionalAvailability[professionals[0].id]'));
assert.ok(publicBookingApi.includes('normalizedProfessionalId &&'));
assert.ok(teamRescheduleApi.includes('!appointment.professional_id ||'));
assert.ok(customerPortalAppointmentApi.includes('!appointment.professional_id ||'));
const appointmentDashboardHook = readFileSync(
  'app/state/_hooks/dashboard/useAppointments.ts',
  'utf8',
);
assert.ok(appointmentDashboardHook.includes('SCHEDULE_BLOCK_OVERLAPS_APPOINTMENT'));
assert.ok(appointmentDashboardHook.includes('Não podes bloquear um horário que já tem uma marcação ativa.'));

console.log('Weekly schedule QA passed: split shifts, breaks, duration, day off, shop-wide unassigned capacity and database-enforced schedule blocks.');


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
  bookingAvailability.includes('slotStart + reservedDuration <= periodEnd'),
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
  'supabase/migrations/20261119232316_enforce_cross_lane_appointment_capacity.sql',
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
  /rollback[\s\S]*drop trigger if exists zz_enforce_appointment_capacity_overlap[\s\S]*drop function if exists public\.enforce_appointment_capacity_overlap/i,
  'The database guard migration must document its rollback path',
);


const expiredMbwayCapacityMigration = readFileSync(
  'supabase/migrations/20261119233600_ignore_expired_mbway_holds_in_capacity_guard.sql',
  'utf8',
);
assert.match(
  expiredMbwayCapacityMigration,
  /new\.payment_status = 'awaiting_review'[\s\S]*new\.payment_expires_at is not null[\s\S]*new\.payment_expires_at <= (?:pg_catalog\.)?now\(\)/i,
  'An expired MB WAY booking being inserted or updated must no longer reserve capacity',
);
assert.match(
  expiredMbwayCapacityMigration,
  /a\.payment_status = 'awaiting_review'[\s\S]*a\.payment_expires_at is not null[\s\S]*a\.payment_expires_at <= (?:pg_catalog\.)?now\(\)/i,
  'Existing expired MB WAY holds must be ignored by the overlap check',
);
assert.match(
  expiredMbwayCapacityMigration,
  /restore the previous enforce_appointment_capacity_overlap\(\) definition[\s\S]*20261119232316_enforce_cross_lane_appointment_capacity\.sql/i,
  'The expiry-rule migration must document how to restore the prior trigger function',
);
assert.match(
  expiredMbwayCapacityMigration,
  /create trigger a_release_expired_mbway_holds_before_capacity_check[\s\S]*before insert or update[\s\S]*execute function public\.release_expired_mbway_holds_before_capacity_check/i,
  'Expired holds must be released before the appointments exclusion constraint is evaluated',
);
assert.match(
  expiredMbwayCapacityMigration,
  /pg_catalog\.pg_trigger_depth\(\) > 1[\s\S]*return new/i,
  'The expiry cleanup trigger must guard against recursive updates',
);
assert.match(
  expiredMbwayCapacityMigration,
  /status = 'cancelled'[\s\S]*payment_status = 'expired'[\s\S]*cancelled_at = pg_catalog\.now\(\)[\s\S]*cancellation_reason/i,
  'Automatic expiry must preserve the existing cancellation transition and waitlist side effects',
);
assert.match(
  expiredMbwayCapacityMigration,
  /message = 'MBWAY_PREPAYMENT_EXPIRED'/i,
  'An expired MB WAY hold must not be revived by an appointment update',
);
assert.match(
  expiredMbwayCapacityMigration,
  /pg_advisory_xact_lock[\s\S]*hashtextextended\(new\.barbershop_id::text, 0\)/i,
  'Expiry cleanup must serialize with public booking creation per barbershop',
);

assert.match(
  expiredMbwayCapacityMigration,
  /old\.payment_method = 'mbway'[\s\S]*old\.payment_status in \('awaiting_review', 'expired'\)/i,
  'Expired MB WAY holds must not be revived after the cleanup has marked them expired',
);


// Service buffers are configured per service and snapshotted on each booking.
// Every availability and database capacity path must reserve duration + buffer.
const serviceBufferMigration = readFileSync(
  'supabase/migrations/20261121183504_service_buffer_capacity.sql',
  'utf8',
);
assert.ok(serviceBufferMigration.includes('add column if not exists buffer_minutes smallint not null default 0'));
assert.ok(serviceBufferMigration.includes('v_requested_end := v_requested_start + v_duration + v_buffer'));
assert.ok(serviceBufferMigration.includes('p_date_hour + make_interval(mins => v_duration + v_buffer)'));
assert.ok(serviceBufferMigration.includes('coalesce(a.buffer_minutes, 0)'));
assert.ok(serviceBufferMigration.includes('coalesce(new.buffer_minutes, 0)'));
assert.ok(serviceBufferMigration.includes('new.buffer_minutes := v_buffer'));
assert.ok(serviceBufferMigration.includes('greatest(0, least(coalesce(service.buffer_minutes, 0), 120))'));
assert.ok(serviceBufferMigration.includes('update public.booking_waitlist_vacancies as vacancy'));
assert.ok(serviceBufferMigration.includes('before insert or update of service_id, barbershop_id, buffer_minutes on public.appointments'));
assert.ok(serviceBufferMigration.includes('duration_minutes, buffer_minutes, status'));
assert.ok(serviceBufferMigration.includes('appointment.duration_minutes, 30), 1440)) + greatest(0, coalesce(appointment.buffer_minutes, 0))'));
assert.ok(serviceBufferMigration.includes('duration_minutes = excluded.duration_minutes'));

assert.ok(serviceBufferMigration.includes('a_serialize_service_buffer_update'));
assert.ok(serviceBufferMigration.includes('appointment.duration_minutes, 30), 1440)) + greatest(0, coalesce(appointment.buffer_minutes, 0))'));
assert.ok(serviceBufferMigration.includes('v_vacancy.duration_minutes'));
assert.ok(serviceBufferMigration.includes('coalesce(new.buffer_minutes, 0))'));
assert.ok(serviceBufferMigration.includes('Rollback: drop the two new triggers'));
assert.ok(serviceBufferMigration.includes('public.enqueue_booking_waitlist_vacancy()'));
assert.ok(serviceBufferMigration.includes('public.sync_booking_waitlist_vacancies()'));
assert.ok(serviceBufferMigration.includes('public.claim_booking_waitlist_vacancies(integer)'));

const serviceEditor = readFileSync(
  'app/dashboard/_components/cards/ServicesListCard.tsx',
  'utf8',
);
const serviceEditPage = readFileSync('app/dashboard/servicos/page.tsx', 'utf8');
const servicesHook = readFileSync('app/state/_hooks/dashboard/useServices.ts', 'utf8');
assert.ok(serviceEditor.includes('new-service-buffer'));
assert.ok(serviceEditor.includes('service.buffer_minutes'));
assert.ok(serviceEditPage.includes('edit-service-buffer'));
assert.ok(servicesHook.includes('buffer_minutes: bufferMinutes'));
assert.ok(publicBookingData.includes('serviceBuffer'));
assert.ok(publicBookingData.includes('reservedDuration'));
assert.ok(publicBookingApi.includes('selectedService.buffer_minutes'));
assert.ok(teamRescheduleApi.includes('appointment.buffer_minutes'));
assert.ok(customerPortalAppointmentApi.includes('appointment.buffer_minutes'));
assert.ok(customerPortalAppointmentApi.includes('item.buffer_minutes'));
assert.ok(appointmentDashboardHook.includes('SCHEDULE_BLOCK_OVERLAPS_APPOINTMENT'));

// A 60-minute service with a 30-minute buffer reserves 90 minutes.
// A start at minute 60 still overlaps; the exact minute-90 boundary is free.
const reservedInterval = (start: number, duration: number, buffer: number) => ({
  start,
  end: start + duration + buffer,
});
const bufferedAppointment = reservedInterval(9 * 60, 60, 30);
assert.equal(intervalOverlaps(10 * 60, 10 * 60 + 30, bufferedAppointment.start, bufferedAppointment.end), true);
assert.equal(intervalOverlaps(10 * 60 + 30, 11 * 60, bufferedAppointment.start, bufferedAppointment.end), false);
