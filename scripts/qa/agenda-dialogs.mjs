import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
const agenda = read('app/dashboard/agenda/page.tsx');
const agendaLayout = read('app/dashboard/agenda/layout.tsx');
const hook = read('app/state/_hooks/dashboard/useAppointments.ts');

const bookingForm = read('app/dashboard/_components/cards/BookingFormCard.tsx');
const manualBookingAvailability = read(
  'app/api/barbershops/[barbershopId]/booking-availability/route.ts',
);
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
const weeklySettings = read('components/dashboard/weekly-schedule-settings.tsx');
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
const appointmentConfirmRoute = read(
  'app/api/appointments/[appointmentId]/confirm/route.ts',
);
const appointmentEmailRoute = read(
  'app/api/appointments/[appointmentId]/email/route.ts',
);
const bookingEmail = read('lib/brevo/brevo.ts');

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
assert.ok(agendaCalendar.includes('<details className="group mt-4'));
assert.ok(agendaCalendar.includes('calendarSyncSlot?: ReactNode'));
assert.ok(agendaCalendar.includes('{calendarSyncSlot}'));
assert.ok(agendaCalendar.includes("t('agendaCalendar.calendarOptions')"));
assert.ok(agendaCalendar.includes('group-open:rotate-180'));
assert.ok(agenda.includes('calendarSyncSlot={<CalendarSyncCard compact />}'));
assert.ok(agenda.includes("!isCalendarView ? <CalendarSyncCard /> : null"));
assert.ok(calendarSync.includes('compact = false'));
assert.ok(calendarSync.includes("compact ? '' : 'mt-5'"));
assert.ok(ptCopy.includes("calendarOptions: 'Opções do calendário'"));
assert.ok(enCopy.includes("calendarOptions: 'Calendar options'"));
assert.ok(agendaCalendar.includes('function parseCalendarFilters'));
assert.ok(agendaCalendar.includes('silentra:agenda-calendar-filters:'));
assert.ok(agendaCalendar.includes('window.localStorage.getItem'));
assert.ok(agendaCalendar.includes('window.localStorage.setItem'));
assert.ok(agendaCalendar.includes('calendarFilters[appointment.status]'));
assert.ok(agendaCalendar.includes('calendarFilters.blocks'));
assert.ok(agendaCalendar.includes('calendarFilters.breaks'));
assert.ok(agendaCalendar.includes('calendarFilters.daysOff'));
for (const key of [
  'filters', 'filtersTitle', 'filtersDescription', 'filtersSaved',
  'resetFilters', 'otherItems', 'filterPending', 'filterScheduled',
  'filterCompleted', 'filterCancelled', 'filterBlocks', 'filterBreaks',
  'filterDaysOff',
]) {
  assert.ok(ptCopy.includes(key + ':'), 'pt-PT calendar filters are missing ' + key + '.');
  assert.ok(enCopy.includes(key + ':'), 'en-GB calendar filters are missing ' + key + '.');
}
assert.ok(
  agendaCalendar.includes('<div\n                  key={key}'),
  'Calendar day cells must be non-interactive containers, not buttons.',
);
assert.ok(
  agendaCalendar.includes('className="absolute inset-0 z-0 rounded-[inherit]'),
  'Day selection must use a dedicated button separate from appointment actions.',
);
assert.ok(agendaCalendar.includes('className="pointer-events-none relative z-10"'));
assert.ok(
  agendaCalendar.includes('pointer-events-auto flex w-full min-w-0 cursor-pointer'),
  'Appointment actions must remain independently clickable above the day-selection button.',
);
assert.match(
  agendaCalendar,
  /<button\s+key=\{appointment\.id\}\s+type="button"[\s\S]*?aria-label=\{t\('agendaCalendar\.appointmentAriaLabel'/,
);
assert.doesNotMatch(
  agendaCalendar,
  /role="button"|tabIndex=\{0\}/,
  'Calendar cells and appointments must use native buttons rather than simulated button roles.',
);
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
assert.ok(agendaCalendar.includes('onDeleteBlock?: (blockId: string) => Promise<boolean>'));
assert.ok(agendaCalendar.includes("t('agenda.confirmRemoveBlock')"));
assert.ok(agendaCalendar.includes("t('agenda.removeBlock')"));
assert.ok(agenda.includes('onDeleteBlock={handleDeleteScheduleBlock}'));
assert.ok(hook.includes("toast.success(t('agenda.blockRemoved'))"));
assert.ok(pt.includes("removeBlock: 'Remover bloqueio'"));
assert.ok(en.includes("removeBlock: 'Remove block'"));
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
assert.ok(appointmentDetail.includes('confirmBooking: (appointmentId: string) => Promise<boolean>'));
assert.ok(appointmentDetail.includes('canConfirmBooking'));
assert.ok(appointmentDetail.includes("appointment.payment_method === 'mbway'"));
assert.ok(appointmentDetail.includes('Confirmar pré-pagamento MB WAY'));
assert.ok(appointmentDetail.includes('Confirmar agendamento'));
assert.ok(appointmentDetail.includes('na conta MB WAY da barbearia'));
assert.ok(agenda.includes('confirmBooking={confirmBooking}'));
assert.ok(appointmentConfirmRoute.includes("payment_status: 'confirmed'"));
assert.ok(appointmentConfirmRoute.includes('prepaymentConfirmed: isPrepaymentReview'));
assert.ok(hook.includes("t('agenda.bookingConfirmedMbway')"));
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

const outcomeCopyKeys = [
  'bookingCreatedFor',
  'recurringBookingsCreatedFor',
  'bookingCreatedWithEmail',
  'bookingCreatedEmailFailed',
  'bookingConfirmedMbway',
  'bookingConfirmedEmailSent',
  'bookingConfirmedEmailFailed',
  'bookingConfirmedNoEmail',
  'bookingCompleted',
  'bookingCompletedReviewEmailSent',
  'addToClients',
  'bookingCancelledEmailSent',
  'bookingCancelledEmailSkipped',
  'bookingCancelledEmailFailed',
  'bookingRescheduledEmailSent',
  'bookingRescheduledEmailSkipped',
  'bookingRescheduledEmailFailed',
  'bookingSeriesCancelled',
];
for (const key of outcomeCopyKeys) {
  assert.ok(pt.includes(`    ${key}:`), `Missing pt-PT agenda outcome copy: ${key}`);
  assert.ok(en.includes(`    ${key}:`), `Missing en-GB agenda outcome copy: ${key}`);
}
for (const key of [
  'bookingCreatedFor',
  'recurringBookingsCreatedFor',
  'bookingCreatedWithEmail',
  'bookingCreatedEmailFailed',
  'bookingConfirmedMbway',
  'bookingConfirmedEmailSent',
  'bookingConfirmedEmailFailed',
  'bookingConfirmedNoEmail',
  'bookingCompleted',
  'bookingCompletedReviewEmailSent',
  'addToClients',
  'bookingCancelledEmailSent',
  'bookingCancelledEmailSkipped',
  'bookingCancelledEmailFailed',
]) {
  assert.ok(hook.includes(`t('agenda.${key}'`) || hook.includes(`t("agenda.${key}"`), `Hook is missing localized outcome ${key}`);
}
assert.ok(agenda.includes("t('agenda.bookingRescheduledEmailSent'"));
assert.ok(agenda.includes("t('agenda.bookingRescheduledEmailSkipped'"));
assert.ok(agenda.includes("t('agenda.bookingRescheduledEmailFailed'"));
assert.ok(agenda.includes("t('agenda.bookingSeriesCancelled'"));
assert.ok(agenda.includes('newDateLabel'));

for (const key of [
  'daySummary',
  'cancelledTooltip',
  'appointmentAriaLabel',
  'cancelledStatus',
  'more',
  'moreBlockedTimes',
  'eventSingular',
  'eventPlural',
  'viewDetails',
  'activeProfessional',
  'activeProfessionals',
]) {
  assert.ok(
    agendaCalendar.includes(`t('agendaCalendar.${key}'`),
    `Calendar must use the localized ${key} copy.`,
  );
  assert.ok(ptCopy.includes(`${key}:`), `pt-PT copy is missing ${key}.`);
  assert.ok(enCopy.includes(`${key}:`), `en-GB copy is missing ${key}.`);
}


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
assert.match(bookingForm, /id="booking-email"[\s\S]*?type="email"/);
const bookingEmailInput = bookingForm.match(/<input\s+id="booking-email"[\s\S]*?\/>/)?.[0] ?? '';
assert.ok(bookingEmailInput, 'Customer email input must exist.');
assert.doesNotMatch(bookingEmailInput, /\brequired\b/);
assert.match(hook, /manualEmail\.trim\(\) && !CUSTOMER_EMAIL_PATTERN\.test\(manualEmail\.trim\(\)\)/);
assert.match(hook, /manual_email: manualEmail\.trim\(\)\.toLowerCase\(\) \|\| null/);
assert.match(appointmentsService, /const clientEmail = payload\.manual_email\?\.trim\(\)\.toLowerCase\(\) \|\| null/);
assert.doesNotMatch(appointmentsService, /clientEmail = client\.email/);
assert.match(hook, /firstCreatedAppointment\?\.id && manualEmail\.trim\(\)/);
assert.match(hook, /payload\.emailSkipped === true/);
assert.match(appointmentEmailRoute, /requireTenantAuthorization/);
assert.match(appointmentEmailRoute, /sendBookingConfirmationEmail/);
assert.match(appointmentEmailRoute, /emailSent: true/);
assert.match(bookingEmail, /payload\.status === 'pending'/);
assert.ok(bookingForm.includes('role="combobox"'));
assert.ok(bookingForm.includes('matchingClients'));
assert.ok(bookingForm.includes('replace(/\\D/g'));
assert.ok(bookingForm.includes("addEventListener('pointerdown'"));
assert.ok(bookingForm.includes('singleProfessional'));
assert.ok(bookingForm.includes('selectableServices.length === 1'));
assert.ok(bookingForm.includes('buildManualBookingDays'));
assert.ok(bookingForm.includes('booking-availability'));
assert.ok(bookingForm.includes('Folga'));
assert.ok(bookingForm.includes('Marcado'));
assert.ok(bookingForm.includes('Bloqueado'));
assert.ok(bookingForm.includes('Pausas'));
assert.ok(bookingForm.includes('selectedSlotIsAvailable'));
assert.doesNotMatch(bookingForm, /id="booking-date"/);
assert.doesNotMatch(bookingForm, /id="booking-time"/);
assert.ok(manualBookingAvailability.includes('requireTenantAuthorization'));
assert.ok(manualBookingAvailability.includes('barbershop_member_permissions'));
assert.ok(manualBookingAvailability.includes('appointmentsShareProfessionalCapacity'));
assert.ok(manualBookingAvailability.includes("status: 'booked'"));
assert.ok(manualBookingAvailability.includes("status: 'blocked'"));
assert.ok(manualBookingAvailability.includes("status: 'break'"));
assert.ok(manualBookingAvailability.includes("status: 'past'"));
assert.ok(manualBookingAvailability.includes('manual_name'));
assert.ok(manualBookingAvailability.includes('workingIntervals'));
assert.ok(manualBookingAvailability.includes('availabilityCount') || manualBookingAvailability.includes('availableCount'));
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
assert.ok(weeklySettings.includes('color-scheme-dark'));
assert.ok(weeklySettings.includes('checked={day.day_off}'));
assert.ok(weeklySettings.includes('work_intervals'));
assert.ok(weeklySettings.includes('break_intervals'));
assert.ok(weeklySettings.includes('Adicionar'));
assert.ok(weeklySettings.includes('Horário semanal'));

assert.ok(bookingForm.includes('min-w-0'));
assert.ok(bookingForm.includes('setRecurrenceEndDate'));
assert.ok(agenda.includes('frequency: bookingRecurrence'));
assert.ok(agenda.includes('endDate: recurrenceEndDate'));
assert.ok(agenda.includes('addMonthsToDateValue(selectedDate, 6)'));
assert.ok(bookingTypes.includes("'everyThreeWeeks'"));
assert.match(ptCopy, /email: 'Email do cliente \(opcional\)'/);
assert.match(ptCopy, /emailHelp: 'Opcional\. Sem email, não serão enviados avisos por email ao cliente\.'/);
assert.match(enCopy, /email: 'Customer email \(optional\)'/);
assert.match(enCopy, /emailHelp: 'Optional\. No email notifications are sent to the customer when this is left blank\.'/);
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
assert.match(appointmentDetail, /const \[activityRetryKey, setActivityRetryKey\] = useState\(0\)/);
assert.match(
  appointmentDetail,
  /setActivityRetryKey\(\(current\) => current \+ 1\)/,
  'Activity history retry must refetch without closing the appointment dialog.',
);
assert.match(
  appointmentDetail,
  /\}, \[appointment\?\.id, open, activityRetryKey\]\);/,
  'The activity request must be tied to the retry key and the currently open appointment.',
);
assert.match(
  appointmentDetail,
  /activityError \? \([\s\S]*?role="alert"[\s\S]*?Activity history could not be loaded\.[\s\S]*?Try again[\s\S]*?Tentar novamente/,
  'The activity error state must provide a visible retry action in both locales.',
);
assert.doesNotMatch(
  appointmentDetail,
  /Close and reopen the details to try again|Fecha e volta a abrir os detalhes para tentar novamente/,
  'The activity history must not require closing and reopening the dialog to recover.',
);

const initialAgendaLoad = agenda.slice(
  agenda.indexOf('const fetchInitialData'),
  agenda.indexOf('useEffect', agenda.indexOf('const fetchInitialData')),
);
assert.match(
  agenda,
  /const \[hasLoadedInitialData, setHasLoadedInitialData\] = useState\(false\)/,
  'A genuinely empty agenda must be distinguished from an agenda that never loaded.',
);
assert.match(
  agenda,
  /const \[agendaLoadError, setAgendaLoadError\] = useState<string \| null>\(null\)/,
);
assert.match(
  initialAgendaLoad,
  /setHasLoadedInitialData\(true\)/,
  'A successful read must mark the agenda as loaded, even when the returned lists are empty.',
);
assert.match(
  initialAgendaLoad,
  /setAgendaLoadError\(null\)/,
  'A successful retry must clear the persistent load error.',
);
assert.match(
  initialAgendaLoad,
  /catch \(error\)[\s\S]*setAgendaLoadError\(t\('agenda\.loadingError'\)\)/,
  'A failed read must persist an explicit error instead of silently becoming an empty agenda.',
);
assert.match(
  initialAgendaLoad,
  /finally \{\s*setLoadingInitial\(false\)/,
);
assert.doesNotMatch(
  initialAgendaLoad.slice(initialAgendaLoad.indexOf('catch (error)')),
  /setAppointments\(\[\]\)|setServices\(\[\]\)|setProfessionals\(\[\]\)|setClients\(\[\]\)/,
  'A failed refresh must not erase previously loaded data.',
);
assert.match(
  agenda,
  /\{agendaLoadError \? \([\s\S]*?role="alert"[\s\S]*?\{agendaLoadError\}[\s\S]*?onClick=\{\(\) => void fetchInitialData\(\)\}/,
  'The agenda load error must remain visible with an explicit retry action.',
);
assert.match(agenda, /'Try again'/);
assert.match(agenda, /'Tentar novamente'/);
assert.match(
  agenda,
  /isCalendarView && \(loadingInitial \|\| hasLoadedInitialData\) \?/,
  'The calendar must not show a false empty state before the first successful read.',
);
assert.match(
  agenda,
  /\{loadingInitial \? \([\s\S]*?\) : hasLoadedInitialData \? \(/,
  'The appointment list and its true empty state must only render after a successful read.',
);
assert.match(
  agenda,
  /Previously loaded data is still visible[\s\S]*Os dados carregados anteriormente continuam visíveis/,
  'The recovery message must make clear that stale data is still visible after a failed refresh.',
);

console.log(
  '[AGENDA_DIALOGS_QA] Booking and block dialogs, submit lifecycle, translations and overlay stacking passed.',
);
