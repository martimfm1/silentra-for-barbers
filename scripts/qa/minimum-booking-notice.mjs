import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [settings, service, booking, availability, legacySlots, portal, helper, migration, pt, en, pkg, workflow] = await Promise.all([
  readFile('app/dashboard/settings/settings-page.tsx', 'utf8'),
  readFile('app/dashboard/_services/barbershop.service.ts', 'utf8'),
  readFile('app/api/bookings/route.ts', 'utf8'),
  readFile('app/api/shops/[id]/booking-data/route.ts', 'utf8'),
  readFile('app/api/shops/[id]/slots/route.ts', 'utf8'),
  readFile('app/api/customer-portal/appointments/[appointmentId]/route.ts', 'utf8'),
  readFile('lib/bookings/minimum-notice.ts', 'utf8'),
  readFile('supabase/migrations/20261029200000_minimum_booking_notice_minutes.sql', 'utf8'),
  readFile('app/locales/pt.ts', 'utf8'),
  readFile('app/locales/en.ts', 'utf8'),
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('.github/workflows/ci.yml', 'utf8'),
]);
assert.match(settings, /htmlFor="settings-closing-time"/);
assert.match(settings, /settingsPage\.lunchBreak/);
assert.match(settings, /settingsPage\.daysOffInHours/);
assert.match(settings, /settingsPage\.minimumBookingNotice/);
assert.match(service, /minimum_booking_notice_minutes/);
assert.match(migration, /add column if not exists minimum_booking_notice_minutes integer not null default 0/i);
assert.match(migration, /minimum_booking_notice_minutes = case[\s\S]*?v_booking_notice_minutes/);
assert.match(helper, /timeZone: 'Europe\/Lisbon'/);
assert.match(booking, /isBeforeMinimumBookingNotice\(bookingDate, bookingTime, minimumNoticeMinutes\)/);
assert.match(availability, /isBeforeMinimumBookingNotice\(/);
assert.match(legacySlots, /isBeforeMinimumBookingNotice\(/);
assert.match(portal, /isBeforeMinimumBookingNotice\(/);
for (const key of ['lunchBreak:', 'daysOffInHours:', 'minimumBookingNotice:', 'minimumBookingNoticeDescription:', 'minimumBookingNoticeInvalid:', 'noticeUnit:', 'noticeMinutes:', 'noticeHours:']) {
  assert.ok(pt.includes(key), `Portuguese locale is missing ${key}`);
  assert.ok(en.includes(key), `English locale is missing ${key}`);
}
assert.equal(pkg.scripts['qa:minimum-booking-notice'], 'node scripts/qa/minimum-booking-notice.mjs');
assert.match(pkg.scripts.qa, /pnpm qa:minimum-booking-notice/);
assert.match(workflow, /name: Minimum booking notice contracts\s+run: pnpm qa:minimum-booking-notice/);
console.log('Minimum booking notice contracts passed.');
