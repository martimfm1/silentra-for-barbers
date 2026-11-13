import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
const agenda = read('app/dashboard/agenda/page.tsx');
const agendaLayout = read('app/dashboard/agenda/layout.tsx');
const hook = read('app/state/_hooks/dashboard/useAppointments.ts');

const bookingForm = read('app/dashboard/_components/cards/BookingFormCard.tsx');
const appointmentsService = read(
  'app/dashboard/_services/appointments.service.ts',
);
const blockForm = read('app/dashboard/_components/cards/BlockFormCard.tsx');
const popover = read('components/ui/popover.tsx');
const alertDialog = read('components/ui/alert-dialog.tsx');
const baseDialog = read('components/ui/dialog.tsx');
const select = read('components/ui/select.tsx');
const combobox = read('components/ui/combobox.tsx');
const pt = read('app/locales/pt.ts');
const en = read('app/locales/en.ts');
const ptCopy = read('app/locales/pt-copy.ts');
const enCopy = read('app/locales/en-copy.ts');
const bookingTypes = read('types/dashboard/forms.ts');
const calendarSync = read('components/dashboard/calendar-sync-card.tsx');
const settings = read('app/dashboard/settings/settings-page.tsx');
const selectComponent = read('components/ui/select.tsx');
const appointmentDetail = read(
  'components/dashboard/appointment-detail-dialog.tsx',
);
const appointmentActions = read('components/dashboard/appointment-actions.tsx');
const appointmentCompletion = read(
  'components/dashboard/appointment-completion-dialog.tsx',
);
const appointmentCompletionRoute = read(
  'app/api/appointments/[appointmentId]/complete/route.ts',
);

const agendaCalendar = read('app/dashboard/agenda/agenda-calendar-view.tsx');
assert.ok(agenda.includes('useAgendaViewPreference'));
assert.ok(agenda.includes('isCalendarView'));
assert.ok(agenda.includes('onAppointmentClick={setSelectedAppointment}'));
assert.ok(agenda.includes('<AppointmentDetailDialog'));
assert.ok(agendaLayout.includes('{children}'));
assert.ok(
  !agendaLayout.includes('<AgendaCalendarView'),
  'The layout must not mount a detached calendar without the page detail handler.',
);
assert.ok(agendaCalendar.includes('onAppointmentClick?.(appointment)'));
assert.ok(agenda.includes('appointments={appointments}'));
assert.ok(agenda.includes('appointmentsLoading={loadingInitial}'));
assert.ok(agendaCalendar.includes('appointmentsLoading: boolean'));
assert.ok(agenda.includes('professionals={professionals}'));
assert.ok(agendaCalendar.includes('appointments: Appointment[]'));
assert.ok(!agendaCalendar.includes('appointmentService.getAll'));
assert.ok(agenda.includes('blocksRefreshKey={calendarBlocksRefreshKey}'));
assert.ok(agenda.includes('setCalendarBlocksRefreshKey((current) => current + 1)'));
assert.ok(agendaCalendar.includes('blocksRefreshKey: number'));
assert.ok(agendaCalendar.includes('[load, blocksRefreshKey]'));
assert.ok(agendaCalendar.includes('const blockPreview = dayBlocks.slice(0, 1)'));
assert.ok(agendaCalendar.includes('formatTime(block.start_time)'));
assert.ok(agendaCalendar.includes('selectedBlocks.map((block) =>'));
assert.ok(appointmentDetail.includes('onCancel: (appointmentId: string) => Promise<boolean>'));
assert.ok(appointmentDetail.includes('onCancelSeries?:'));
assert.ok(appointmentDetail.includes('Esta e as seguintes'));
assert.ok(appointmentDetail.includes('Cancelar série completa'));
assert.ok(hook.includes('recurrence_series_id: recurrenceSeriesId'));
assert.ok(agenda.includes('/cancel-series'));
assert.ok(agenda.includes('onCancelSeries={handleCancelAppointmentSeries}'));
const seriesCancelRoute = read('app/api/appointments/[appointmentId]/cancel-series/route.ts');
const seriesMigration = read('supabase/migrations/20261111190000_appointment_recurrence_series.sql');
assert.match(seriesCancelRoute, /requireTenantAuthorization/);
assert.match(seriesCancelRoute, /recurrence_series_id/);
assert.match(seriesCancelRoute, /scope === 'future'/);
assert.match(seriesCancelRoute, /scope !== 'all'/);
assert.match(seriesCancelRoute, /status: 'cancelled'/);
assert.doesNotMatch(seriesCancelRoute, /sendAppointmentCancellationEmail/);
assert.doesNotMatch(seriesCancelRoute, /dispatchAppointmentAutomations/);
assert.match(seriesCancelRoute, /emailSent: false/);
assert.match(appointmentDetail, /Não serão enviados emails de cancelamento quando cancelares uma série/);
assert.match(seriesMigration, /add column if not exists recurrence_series_id uuid/);
assert.match(seriesMigration, /having count\(\*\) > 1/);
assert.match(appointmentsService, /recurrence_series_id\?: string \| null/);
assert.ok(appointmentDetail.includes('<AlertDialog'));
assert.ok(appointmentDetail.includes('<AppointmentCompletionDialog'));
assert.match(appointmentDetail, /appointment\.status === 'scheduled'/);
assert.ok(agenda.includes('finalizeBooking={finalizeBooking}'));
assert.ok(appointmentActions.includes('<AppointmentCompletionDialog'));
assert.match(appointmentCompletion, /complete\('cash'\)/);
assert.match(appointmentCompletion, /complete\('mbway'\)/);
assert.match(appointmentCompletion, /complete\('card'\)/);
assert.match(appointmentCompletion, /if \(completed\)/);
assert.match(appointmentCompletionRoute, /status: 'completed'/);
assert.match(appointmentCompletionRoute, /\.eq\('status', 'scheduled'\)/);
assert.ok(appointmentDetail.includes('void handleCancellation()'));
assert.ok(appointmentDetail.includes('onOpenChange(false)'));
assert.ok(appointmentActions.includes('handleCancelBooking: (id: string) => void | Promise<unknown>'));
assert.ok(hook.includes('const handleCancelBooking = useCallback'));
assert.ok(hook.includes('await onRefreshData();\n        return true;'));
assert.ok(hook.includes('return false;'));

assert.match(
  agenda,
  /<Dialog open=\{bookingDialogOpen\} onOpenChange=\{setBookingDialogOpen\}>/,
);
assert.match(
  agenda,
  /<Dialog open=\{blockDialogOpen\} onOpenChange=\{setBlockDialogOpen\}>/,
);
assert.match(agenda, /window\.dispatchEvent\(new Event\('silentra:open-create-booking'\)\)/);
assert.match(agenda, /onClick=\{\(\) => setBlockDialogOpen\(true\)\}/);
assert.ok(agenda.includes('h-[100dvh] max-h-[100dvh] w-screen'));
assert.ok(agenda.includes('showCloseButton={false}'));
assert.ok(bookingForm.includes('overflow-y-auto overscroll-contain'));
assert.ok(
  bookingForm.includes('pb-[calc(0.875rem+env(safe-area-inset-bottom))]'),
);
assert.ok(bookingForm.includes('type="search"'));
assert.ok(bookingForm.includes('role="combobox"'));
assert.ok(bookingForm.includes('matchingClients'));
assert.ok(bookingForm.includes('replace(/\\D/g'));
assert.ok(bookingForm.includes("addEventListener('pointerdown'"));
assert.ok(bookingForm.includes('singleProfessional'));
assert.ok(bookingForm.includes('services.length === 1'));
assert.ok(bookingForm.includes('type="date"'));
assert.ok(bookingForm.includes('type="time"'));
assert.ok(bookingForm.includes('booking-recurrence'));
assert.ok(bookingForm.includes('booking-recurrence-end'));
assert.ok(bookingForm.includes('max-w-full'));
assert.ok(bookingForm.includes('box-border'));
assert.match(calendarSync, /onClick=\{\(\) => setDialogOpen\(true\)\}/);
assert.match(
  calendarSync,
  /<Dialog open=\{dialogOpen\} onOpenChange=\{setDialogOpen\}>/,
);
assert.ok(!calendarSync.includes('showInstructions'));
assert.ok(calendarSync.includes('max-h-[min(90dvh,54rem)]'));
assert.ok(selectComponent.includes('w-fit min-w-0 max-w-full'));
assert.ok(selectComponent.includes('max-w-[calc(100vw-2rem)]'));
assert.ok(
  bookingForm.includes(
    'min-w-0 max-w-full rounded-xl border-white/10 bg-zinc-900',
  ),
);
assert.ok(
  settings.includes('box-border block min-h-11 w-full min-w-0 max-w-full'),
);
assert.ok(settings.includes("cn(INPUT_CLASS, 'color-scheme-dark')"));
assert.ok(settings.includes('<Switch'));
assert.ok(settings.includes('checked={active}'));
assert.ok(settings.includes('Definir ${label} como dia de encerramento'));

assert.ok(bookingForm.includes('min-w-0'));
assert.ok(bookingForm.includes('setRecurrenceEndDate'));
assert.ok(agenda.includes('frequency: bookingRecurrence'));
assert.ok(agenda.includes('endDate: recurrenceEndDate'));
assert.ok(agenda.includes('addMonthsToDateValue(selectedDate, 6)'));
assert.ok(bookingTypes.includes("'everyThreeWeeks'"));
assert.ok(hook.includes('MAX_RECURRING_APPOINTMENTS = 52'));
assert.ok(hook.includes('generateRecurringBookingDates'));
assert.ok(hook.includes("frequency === 'biweekly' ? 14 : 21"));
assert.ok(hook.includes("frequency === 'monthly'"));
assert.ok(hook.includes('appointmentService.createMany(createPayloads)'));
assert.ok(appointmentsService.includes('async createMany('));
assert.ok(appointmentsService.includes('.insert(primaryVariant as never[])'));
assert.ok(
  appointmentsService.includes(
    'A single INSERT keeps the whole recurring series atomic',
  ),
);
for (const key of [
  'recurrence',
  'noRecurrence',
  'everyWeek',
  'everyTwoWeeks',
  'everyThreeWeeks',
  'everyMonth',
  'repeatUntil',
  'recurrenceHint',
  'recurringConflict',
  'recurringCreated',
]) {
  assert.match(ptCopy, new RegExp(key + ':'));
  assert.match(enCopy, new RegExp(key + ':'));
}
assert.ok(bookingForm.includes("'Hoje'") || bookingForm.includes('Hoje'));
assert.ok(bookingForm.includes('Amanhã'));
assert.ok(agenda.includes('birth_date: client.birth_date ??'));
assert.ok(agenda.includes('birthDate: formData.birth_date ??'));
assert.ok(agenda.includes('setSelectedDate(getLocalDateInputValue())'));
assert.ok(
  hook.includes('!manualName?.trim()') && hook.includes('!manualPhone?.trim()'),
);
assert.ok(
  appointmentsService.includes('manual_birth_date: payload.manual_birth_date'),
);
assert.doesNotMatch(
  agenda,
  /\{bookingDialogOpen && \(/,
  'Booking form must not render inline in the page.',
);
assert.doesNotMatch(
  agenda,
  /\{blockDialogOpen && \(/,
  'Block form must not render inline in the page.',
);
assert.match(
  agenda,
  /const created = await handleCreateBooking\(event, \{\s*frequency: bookingRecurrence,\s*endDate: recurrenceEndDate,\s*\}\);\s*if \(!created\) return;/,
);
assert.match(
  agenda,
  /const created = await handleCreateBlock\(event\);\s*if \(created\) setBlockDialogOpen\(false\);/,
);

for (const handler of ['handleCreateBooking', 'handleCreateBlock']) {
  const start = hook.indexOf('const ' + handler);
  assert.ok(start >= 0, 'Missing hook handler ' + handler);
  const end = hook.indexOf('\n  const ', start + 10);
  const body = hook.slice(start, end);
  assert.match(
    body,
    /return true;/,
    handler + ' should report success so the dialog can close.',
  );
  assert.match(
    body,
    /return false;/,
    handler +
      ' should keep the dialog open after validation or request errors.',
  );
}

assert.match(blockForm, /useLanguage\(\)/);
for (const key of [
  'blockTimeDescription',
  'blockProfessional',
  'selectProfessional',
  'blockDate',
  'chooseDate',
  'startTime',
  'endTime',
  'blockReason',
  'blockReasonPlaceholder',
  'saveBlock',
  'savingBlock',
]) {
  assert.match(pt, new RegExp(key + ':'));
  assert.match(en, new RegExp(key + ':'));
}
assert.match(
  popover,
  /z-\[10003\]/,
  'Calendar popovers must sit above the dialog overlay.',
);
assert.match(
  select,
  /z-\[10003\]/,
  'Select options must sit above the dialog overlay.',
);
assert.match(
  combobox,
  /z-\[10003\]/,
  'Customer suggestions must sit above the dialog overlay.',
);
assert.match(
  baseDialog,
  /fixed inset-0 isolate z-\[10000\]/,
  'The base dialog overlay must keep its shared stacking layer.',
);
assert.match(
  baseDialog,
  /fixed top-1\/2 left-1\/2 z-\[10001\]/,
  'The base dialog content must stay below nested confirmations.',
);
assert.match(
  alertDialog,
  /fixed inset-0 z-\[10002\]/,
  'Alert dialog overlays must cover the base dialog content.',
);
assert.match(
  alertDialog,
  /fixed top-1\/2 left-1\/2 z-\[10003\]/,
  'Alert dialog content must render above appointment and client detail dialogs.',
);
assert.match(appointmentDetail, /seriesCancelScope !== null/);
assert.match(appointmentDetail, /<AlertDialogContent className=/);

console.log(
  '[AGENDA_DIALOGS_QA] Booking and block dialogs, submit lifecycle, translations and overlay stacking passed.',
);
