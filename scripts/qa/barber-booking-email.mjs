import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  bookingRoute,
  notification,
  packageJson,
  workflow,
  cancellationRoute,
  cancellationEmail,
  dashboardActions,
  appointmentsHook,
  customerPortalAppointments,
  appointmentChangeNotifications,
  emailTransport,
  rescheduleRoute,
  confirmationRoute,
  appointmentEmailRoute,
  appointmentReminderRoute,
  appointmentAutomations,
] = await Promise.all([
  readFile('app/api/bookings/route.ts', 'utf8'),
  readFile('lib/brevo/barber-booking-notification.ts', 'utf8'),
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('.github/workflows/ci.yml', 'utf8'),
  readFile('app/api/appointments/[appointmentId]/cancel/route.ts', 'utf8'),
  readFile('lib/brevo/appointment-cancellation.ts', 'utf8'),
  readFile('components/dashboard/appointment-actions.tsx', 'utf8'),
  readFile('app/state/_hooks/dashboard/useAppointments.ts', 'utf8'),
  readFile('app/api/customer-portal/appointments/[appointmentId]/route.ts', 'utf8'),
  readFile('lib/brevo/appointment-change-notifications.ts', 'utf8'),
  readFile('lib/email/brevo.ts', 'utf8'),
  readFile('app/api/appointments/[appointmentId]/reschedule/route.ts', 'utf8'),
  readFile('app/api/appointments/[appointmentId]/confirm/route.ts', 'utf8'),
  readFile('app/api/appointments/[appointmentId]/email/route.ts', 'utf8'),
  readFile('app/api/cron/appointment-reminders/route.ts', 'utf8'),
  readFile('lib/automations/dispatch-appointment.ts', 'utf8'),
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
assert.match(customerPortalAppointments, /event: 'cancelled'/);
assert.match(customerPortalAppointments, /event: 'rescheduled'/);
assert.match(customerPortalAppointments, /barberEmailsSent/);
assert.match(appointmentChangeNotifications, /sendBrevoEmail\(/);
assert.match(appointmentChangeNotifications, /sendWebPushToUsers\(/);
assert.match(appointmentChangeNotifications, /Customer cancelled a booking/);
assert.match(appointmentChangeNotifications, /Cliente cancelou uma marcação/);
assert.match(appointmentChangeNotifications, /Customer changed a booking/);
assert.match(appointmentChangeNotifications, /Cliente reagendou uma marcação/);
assert.match(cancellationRoute, /requireTenantAuthorization\(request, ROLES\)/);
assert.match(cancellationRoute, /\.update\([\s\S]*?status: 'cancelled'/);
assert.match(cancellationRoute, /cancelled_at: cancelledAt/);
assert.match(cancellationRoute, /sendAppointmentCancellationEmail\(/);
assert.match(cancellationRoute, /emailSent: emailResult\?\.success \?\? false/);
assert.match(cancellationRoute, /emailSkipped: !customerEmail/);
assert.doesNotMatch(cancellationRoute, /clientResult\.data\?\.email/);
assert.match(rescheduleRoute, /const recipientEmail = appointment\.manual_email\?\.trim\(\)\.toLowerCase\(\) \|\| ''/);
assert.match(rescheduleRoute, /notificationSkipped: !recipientEmail/);
assert.doesNotMatch(rescheduleRoute, /client\?\.email/);
assert.match(confirmationRoute, /const recipientEmail = appointment\.manual_email\?\.trim\(\)\.toLowerCase\(\) \|\| null/);
assert.doesNotMatch(confirmationRoute, /clientRelation\?\.email/);
assert.match(appointmentEmailRoute, /const email = appointment\.manual_email\?\.trim\(\)\.toLowerCase\(\) \|\| ''/);
assert.doesNotMatch(appointmentEmailRoute, /clientResult\.data\?\.email/);
assert.match(appointmentEmailRoute, /emailSkipped: true/);
assert.match(appointmentReminderRoute, /const recipient = appointment\.manual_email\?\.trim\(\)\.toLowerCase\(\) \|\| ''/);
assert.doesNotMatch(appointmentReminderRoute, /client\?\.email/);
assert.doesNotMatch(appointmentAutomations, /client\?\.email/);
assert.match(cancellationEmail, /A tua marcação foi cancelada pela barbearia/);
assert.match(
  cancellationEmail,
  /Your appointment was cancelled by the barbershop/,
);
assert.match(cancellationEmail, /sendBrevoEmail\(/);
assert.match(cancellationRoute, /reasonCode:[\s\S]*emailResult\.errorCode/);
assert.match(emailTransport, /BREVO_CONFIGURATION_MISSING/);
assert.match(emailTransport, /EMAIL_INPUT_INVALID/);
assert.match(emailTransport, /BREVO_HTTP_\$\{response\.status\}/);
assert.match(emailTransport, /BREVO_NETWORK_ERROR/);
assert.doesNotMatch(
  cancellationRoute.slice(
    cancellationRoute.indexOf('[APPOINTMENT_CANCELLATION_EMAIL_FAILED]'),
    cancellationRoute.indexOf('// Keep optional marketing automations'),
  ),
  /(?:email|to):\\s*customerEmail/,
  'Cancellation email failure logs must not expose recipient addresses.',
);
assert.match(dashboardActions, /Cancelar marcação/);
assert.match(dashboardActions, /customer will receive an email/);
assert.doesNotMatch(
  dashboardActions,
  /Eliminar esta marcação|Delete this booking|Trash2/,
);
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
