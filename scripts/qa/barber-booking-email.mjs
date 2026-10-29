import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [bookingRoute, notification, packageJson, workflow] = await Promise.all([
  readFile('app/api/bookings/route.ts', 'utf8'),
  readFile('lib/brevo/barber-booking-notification.ts', 'utf8'),
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('.github/workflows/ci.yml', 'utf8'),
]);
assert.match(bookingRoute, /notifyBarbersOfNewBooking\(/);
assert.match(bookingRoute, /professionalId:\s*normalizedProfessionalId/);
assert.match(bookingRoute, /status:\s*appointment\.status === 'scheduled' \? 'confirmed' : 'pending'/);
assert.match(notification, /\.eq\('barbershop_id', input\.barbershopId\)/);
assert.match(notification, /\.eq\('role', 'barber'\)/);
assert.match(notification, /sendBrevoEmail\(/);
assert.match(notification, /default_language/);
assert.match(notification, /input\.customerPhone/);
assert.match(notification, /input\.customerEmail/);
assert.match(notification, /escapeHtml\(/);
assert.equal(packageJson.scripts['qa:barber-booking-email'], 'node scripts/qa/barber-booking-email.mjs');
assert.match(packageJson.scripts.qa, /pnpm qa:barber-booking-email/);
assert.match(workflow, /name: Barber booking email contracts\s+run: pnpm qa:barber-booking-email/);
console.log('Barber booking email contracts passed.');
