import assert from 'node:assert/strict';
import { formatClosedDays } from '@/lib/utils/format-closed-days';

const testCases: Array<{
  value: string | null | undefined;
  locale: 'pt' | 'en';
  expected: string;
}> = [
  {
    value: 'Monday,Friday',
    locale: 'pt',
    expected: 'Segunda-feira, Sexta-feira',
  },
  { value: 'Monday,Friday', locale: 'en', expected: 'Monday, Friday' },
  { value: 'segunda-feira,sábado', locale: 'en', expected: 'Monday, Saturday' },
  {
    value: 'terça-feira,Sunday',
    locale: 'pt',
    expected: 'Terça-feira, Domingo',
  },
  { value: '1,6', locale: 'en', expected: 'Monday, Saturday' },
  { value: '0,2,2', locale: 'pt', expected: 'Domingo, Terça-feira' },
  { value: 'None', locale: 'pt', expected: '' },
  { value: 'Nenhum', locale: 'en', expected: '' },
  { value: '', locale: 'en', expected: '' },
];

for (const testCase of testCases) {
  assert.equal(
    formatClosedDays(testCase.value, testCase.locale),
    testCase.expected,
    'closed-day labels should match the selected locale for ' +
      String(testCase.value),
  );
}

console.log(
  '[CLOSED_DAYS_I18N_QA] Portuguese and English closed-day labels passed',
);
