import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const agenda = read('app/dashboard/agenda/page.tsx');
const hook = read('app/state/_hooks/dashboard/useAppointments.ts');

const bookingForm = read('app/dashboard/_components/cards/BookingFormCard.tsx');
const appointmentsService = read('app/dashboard/_services/appointments.service.ts');
const blockForm = read('app/dashboard/_components/cards/BlockFormCard.tsx');
const popover = read('components/ui/popover.tsx');
const select = read('components/ui/select.tsx');
const combobox = read('components/ui/combobox.tsx');
const pt = read('app/locales/pt.ts');
const en = read('app/locales/en.ts');

assert.match(
  agenda,
  /<Dialog open=\{bookingDialogOpen\} onOpenChange=\{setBookingDialogOpen\}>/,
);
assert.match(
  agenda,
  /<Dialog open=\{blockDialogOpen\} onOpenChange=\{setBlockDialogOpen\}>/,
);
assert.match(agenda, /onClick=\{\(\) => setBookingDialogOpen\(true\)\}/);
assert.match(agenda, /onClick=\{\(\) => setBlockDialogOpen\(true\)\}/);
assert.match(agenda, /h-\\[100dvh\\] max-h-\\[100dvh\\] w-screen/);
assert.match(agenda, /showCloseButton=\\{false\\}/);
assert.match(bookingForm, /overflow-y-auto overscroll-contain/);
assert.match(bookingForm, /pb-\\[calc\\(0\\.875rem\\+env\\(safe-area-inset-bottom\\)\\)\\]/);
assert.match(bookingForm, /type="search"/);
assert.match(bookingForm, /role="combobox"/);
assert.match(bookingForm, /matchingClients/);
assert.match(bookingForm, /singleProfessional/);
assert.match(bookingForm, /services.length === 1/);
assert.match(bookingForm, /type="date"/);
assert.match(bookingForm, /type="time"/);
assert.match(bookingForm, /Hoje/);
assert.match(bookingForm, /Amanhã/);
assert.match(agenda, /birth_date: client.birth_date \\?\\? ''/);
assert.match(agenda, /birthDate: formData.birth_date \\?\\? ''/);
assert.match(agenda, /setSelectedDate\\(getLocalDateInputValue\\(\\)\\)/);
assert.match(hook, /!manualName\\?\\.trim\\(\\) \\|\\| !manualPhone\\?\\.trim\\(\\)/);
assert.match(appointmentsService, /manual_birth_date: payload.manual_birth_date/);
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
  /const created = await handleCreateBooking\(event\);\s*if \(!created\) return;/,
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

console.log(
  '[AGENDA_DIALOGS_QA] Booking and block dialogs, submit lifecycle, translations and overlay stacking passed.',
);
