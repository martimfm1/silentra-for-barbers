import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  detailDialog,
  agendaPage,
  rescheduleRoute,
  customerPortalRoute,
  appointmentChangeNotifications,
] = await Promise.all([
  readFile('components/dashboard/appointment-detail-dialog.tsx', 'utf8'),
  readFile('app/dashboard/agenda/page.tsx', 'utf8'),
  readFile('app/api/appointments/[appointmentId]/reschedule/route.ts', 'utf8'),
  readFile('app/api/customer-portal/appointments/[appointmentId]/route.ts', 'utf8'),
  readFile('lib/brevo/appointment-change-notifications.ts', 'utf8'),
]);

assert.match(
  detailDialog,
  /appointment\.status === 'pending' \|\|\s*appointment\.status === 'scheduled'/,
);
assert.match(detailDialog, /type="date"/);
assert.match(detailDialog, /type="time"/);
assert.match(
  detailDialog,
  /onReschedule\(appointment\.id, editDate, editTime\)/,
);
assert.match(detailDialog, /A marcação continuará pendente de confirmação/);
assert.match(detailDialog, /A marcação continuará confirmada/);

assert.match(
  agendaPage,
  /\/api\/appointments\/\$\{encodeURIComponent\(appointmentId\)\}\/reschedule/,
);
assert.match(agendaPage, /method: 'PATCH'/);
assert.match(agendaPage, /payload\.notificationSent/);
assert.match(agendaPage, /onReschedule={handleRescheduleAppointment}/);

assert.match(rescheduleRoute, /\.in\('status', \['pending', 'scheduled'\]\)/);
assert.match(rescheduleRoute, /\.update\(\{ date_hour: newDateHour \}\)/);
assert.match(rescheduleRoute, /sendCustomerAppointmentRescheduledEmail\(/);
assert.match(rescheduleRoute, /shop\?\.default_language === 'en'/);
assert.match(customerPortalRoute, /event: 'rescheduled'/);
assert.match(customerPortalRoute, /previousDateHour: appointment\.date_hour/);
assert.match(appointmentChangeNotifications, /sendCustomerAppointmentRescheduledEmail/);
assert.match(appointmentChangeNotifications, /Your appointment was rescheduled/);
assert.match(appointmentChangeNotifications, /A tua marcação foi alterada/);
assert.match(appointmentChangeNotifications, /PREVIOUS TIME/);
assert.match(appointmentChangeNotifications, /HORÁRIO ANTERIOR/);
assert.match(rescheduleRoute, /updated\.status === 'scheduled'/);
assert.match(rescheduleRoute, /notificationSent/);

console.log('Appointment rescheduling contracts passed.');


const customerPortalPage = await readFile(
  'components/customer-portal/my-bookings-page.tsx',
  'utf8',
);
assert.match(customerPortalPage, /À espera de confirmação/);
assert.match(customerPortalPage, /horário só fica confirmado/);
assert.match(customerPortalPage, /statusDescription\(item\.status\)/);
assert.match(customerPortalPage, /statusTone\(details\.status\)/);
assert.match(customerPortalPage, /load\(options: \{ showLoading\?: boolean; silent\?: boolean \}/);
assert.match(customerPortalPage, /Os últimos dados carregados continuam visíveis/);
assert.match(customerPortalPage, /Tentar novamente/);
assert.match(customerPortalPage, /setUpcoming\(\(items\) =>/);
assert.match(customerPortalPage, /status: 'cancelled'/);
assert.match(customerPortalPage, /data\.dateHour/);
assert.match(customerPortalPage, /void load\(\{ showLoading: false, silent: true \}\)/);
assert.match(customerPortalPage, /availabilityError/);
assert.match(customerPortalPage, /Motivo do cancelamento/);

console.log('Customer portal booking state and recovery contracts passed.');
