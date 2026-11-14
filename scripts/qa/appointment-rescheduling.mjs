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
assert.match(rescheduleRoute, /sendCustomerAppointmentRescheduledEmail\\(/);
assert.match(rescheduleRoute, /shop\\?\\.default_language === 'en'/);
assert.match(customerPortalRoute, /event: 'rescheduled'/);
assert.match(customerPortalRoute, /previousDateHour: appointment\\.date_hour/);
assert.match(appointmentChangeNotifications, /sendCustomerAppointmentRescheduledEmail/);
assert.match(appointmentChangeNotifications, /Your appointment was rescheduled/);
assert.match(appointmentChangeNotifications, /A tua marcação foi alterada/);
assert.match(appointmentChangeNotifications, /PREVIOUS TIME/);
assert.match(appointmentChangeNotifications, /HORÁRIO ANTERIOR/);
assert.match(rescheduleRoute, /updated\.status === 'scheduled'/);
assert.match(rescheduleRoute, /notificationSent/);

console.log('Appointment rescheduling contracts passed.');
