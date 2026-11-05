import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [bookingRoute, notification, packageJson, workflow, cancellationRoute, cancellationEmail, dashboardActions, appointmentsHook] = await Promise.all([
  readFile('app/api/bookings/route.ts', 'utf8'),
  readFile('lib/brevo/barber-booking-notification.ts', 'utf8'),
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('.github/workflows/ci.yml', 'utf8'),
  readFile('app/api/appointments/[appointmentId]/cancel/route.ts', 'utf8'),
  readFile('lib/brevo/appointment-cancellation.ts', 'utf8'),
  readFile('components/dashboard/appointment-actions.tsx', 'utf8'),
  readFile('app/state/_hooks/dashboard/useAppointments.ts', 'utf8'),
]);
assert.match(bookingRoute, /notifyBarbersOfNewBooking\(/);
assert.match(bookingRoute, /professionalId:\s*normalizedProfessionalId/);
assert.match(
  bookingRoute,
  /status:\s*appointment\.status === 'scheduled' \? 'confirmed' : 'pending'/,
);
assert.match(notification, /\.eq\('barbershop_id', input\.barbershopId\)/);
assert.match(notification, /\.eq\('role', 'barber'\)/);
assert.match(notification, /sendBrevoEmail\(/);
assert.match(notification, /default_language/);
assert.match(notification, /input\.customerPhone/);
assert.match(notification, /input\.customerEmail/);
assert.match(notification, /escapeHtml\(/);
assert.match(cancellationRoute, /requireTenantAuthorization\(request, ROLES\)/);
assert.match(cancellationRoute, /\.update\([\s\S]*?status: 'cancelled'/);
assert.match(cancellationRoute, /cancelled_at: cancelledAt/);
assert.match(cancellationRoute, /sendAppointmentCancellationEmail\(/);
assert.match(cancellationRoute, /emailSent: emailResult\.success/);
assert.match(cancellationEmail, /A tua marcação foi cancelada pela barbearia/);
assert.match(cancellationEmail, /Your appointment was cancelled by the barbershop/);
assert.match(cancellationEmail, /sendBrevoEmail\(/);
assert.match(dashboardActions, /Cancelar marcação/);
assert.match(dashboardActions, /customer will receive an email/);
assert.doesNotMatch(dashboardActions, /Eliminar esta marcação|Delete this booking|Trash2/);
const cancelHandler = appointmentsHook.slice(
  appointmentsHook.indexOf('const handleCancelBooking'),
  appointmentsHook.indexOf('\n\n  return {'),
);
assert.match(cancelHandler, /\/api\/appointments\//);
assert.match(cancelHandler, /payload\.emailSent/);
assert.doesNotMatch(cancelHandler, /appointmentService\.delete/);
assert.equal(
  packageJson.scripts['qa:barber-booking-email'],
  'node scripts/qa/barber-booking-email.mjs',
);
assert.match(packageJson.scripts.qa, /pnpm qa:barber-booking-email/);
assert.match(
  workflow,
  /name: Barber booking email contracts\s+run: pnpm qa:barber-booking-email/,
);
console.log('Barber booking email contracts passed.');
