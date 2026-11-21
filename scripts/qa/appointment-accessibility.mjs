import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

const [bookingForm, dialog, sheet] = await Promise.all([
  read('app/dashboard/_components/cards/BookingFormCard.tsx'),
  read('components/ui/dialog.tsx'),
  read('components/ui/sheet.tsx'),
]);

assert.match(bookingForm, /htmlFor="booking-client-search"/);
assert.match(bookingForm, /id="booking-client-search"[\s\S]*?role="combobox"/);
assert.match(bookingForm, /aria-autocomplete="list"/);
assert.match(bookingForm, /aria-expanded=\{[\s\S]*?matchingClients\.length > 0/);
assert.match(bookingForm, /aria-controls=\{[\s\S]*?'booking-client-results'/);
assert.match(bookingForm, /aria-activedescendant=\{[\s\S]*?booking-client-option-/);
assert.match(bookingForm, /aria-describedby=\{[\s\S]*?booking-client-results-status/);
assert.match(bookingForm, /role="listbox"/);
assert.match(bookingForm, /role="option"/);
assert.match(bookingForm, /aria-selected=\{activeClientIndex === index\}/);
assert.match(bookingForm, /tabIndex=\{-1\}/);
assert.match(bookingForm, /onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/);
assert.match(bookingForm, /onClick=\{\(\) => chooseClient\(client\.id\)\}/);
assert.match(bookingForm, /event\.key === 'ArrowDown'/);
assert.match(bookingForm, /event\.key === 'ArrowUp'/);
assert.match(bookingForm, /event\.key === 'Home'/);
assert.match(bookingForm, /event\.key === 'End'/);
assert.match(bookingForm, /event\.key === 'Enter'/);
assert.match(bookingForm, /event\.key === 'Escape'/);
assert.match(bookingForm, /role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-atomic="true"/);
assert.match(bookingForm, /setActiveClientIndex\(\(current\)/);
assert.ok(
  bookingForm.includes('tabIndex={-1}'),
  'Combobox options must remain outside the normal Tab order.',
);

assert.match(dialog, /DialogPrimitive\.Content/);
assert.match(dialog, /DialogPrimitive\.Title/);
assert.match(sheet, /SheetPrimitive\.Content/);
assert.match(sheet, /SheetPrimitive\.Title/);

console.log(
  'Appointment accessibility QA passed: labelled combobox, arrow/Home/End navigation, active descendant, live result count, and semantic dialog/sheet primitives.',
);
