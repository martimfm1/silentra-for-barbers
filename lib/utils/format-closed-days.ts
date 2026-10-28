const DAY_INDEX: Record<string, number> = {
  '0': 0,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  sun: 0,
  sunday: 0,
  domingo: 0,
  mon: 1,
  monday: 1,
  segunda: 1,
  'segunda-feira': 1,
  tue: 2,
  tuesday: 2,
  tues: 2,
  terca: 2,
  'terca-feira': 2,
  wed: 3,
  wednesday: 3,
  quarta: 3,
  'quarta-feira': 3,
  thu: 4,
  thursday: 4,
  thurs: 4,
  quinta: 4,
  'quinta-feira': 4,
  fri: 5,
  friday: 5,
  sexta: 5,
  'sexta-feira': 5,
  sat: 6,
  saturday: 6,
  sabado: 6,
  'sabado-feira': 6,
};

const DAY_LABELS = {
  pt: [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ],
  en: [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ],
} as const;

type Locale = 'pt' | 'en';

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('pt-PT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\s_]+/g, '-');
}

export function formatClosedDays(
  rawDays?: string | null,
  locale: Locale = 'pt',
): string {
  if (!rawDays || typeof rawDays !== 'string') return '';

  const tokens = rawDays
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const dayIndexes: number[] = [];
  const unknownTokens: string[] = [];

  for (const token of tokens) {
    const normalized = normalizeToken(token);
    if (['none', 'nenhum', 'nenhuma', 'no-days', ''].includes(normalized)) {
      continue;
    }

    const dayIndex = DAY_INDEX[normalized];
    if (dayIndex === undefined) {
      unknownTokens.push(token);
      continue;
    }

    if (!dayIndexes.includes(dayIndex)) dayIndexes.push(dayIndex);
  }

  const labels: string[] = dayIndexes.map((index) => DAY_LABELS[locale][index]);
  labels.push(...unknownTokens);
  return labels.join(', ');
}
