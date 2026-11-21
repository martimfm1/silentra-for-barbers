export const ENTERPRISE_LANDING_PAGE_THEMES = [
  'midnight',
  'forest',
  'sand',
  'espresso',
] as const;

export type EnterpriseLandingPageTheme =
  (typeof ENTERPRISE_LANDING_PAGE_THEMES)[number];

export type EnterpriseLandingPageConfig = {
  theme: EnterpriseLandingPageTheme;
  accentColor: string;
  description: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  showTeam: boolean;
  showReviews: boolean;
  showAmenities: boolean;
  heroAlignment: 'left' | 'center';
};

export type EnterpriseLandingPalette = {
  background: string;
  surface: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
};

export const ENTERPRISE_LANDING_PAGE_PALETTES: Record<
  EnterpriseLandingPageTheme,
  EnterpriseLandingPalette
> = {
  midnight: {
    background: '#090d12',
    surface: '#111922',
    card: '#151f29',
    border: '#2a3946',
    text: '#f5f8fa',
    muted: '#a4b0ba',
    accent: '#55d6a3',
    accentText: '#07150f',
  },
  forest: {
    background: '#09140f',
    surface: '#11221a',
    card: '#172b21',
    border: '#2c4938',
    text: '#f1f7f2',
    muted: '#a8baad',
    accent: '#b4d7a3',
    accentText: '#152215',
  },
  sand: {
    background: '#f4efe7',
    surface: '#fffaf3',
    card: '#fffdf9',
    border: '#e3d8c9',
    text: '#2b241e',
    muted: '#786d62',
    accent: '#96613d',
    accentText: '#fffaf5',
  },
  espresso: {
    background: '#120e0c',
    surface: '#1d1714',
    card: '#29201b',
    border: '#49372c',
    text: '#f7eee7',
    muted: '#c0aca0',
    accent: '#d4a16c',
    accentText: '#26180f',
  },
};

export const DEFAULT_ENTERPRISE_LANDING_PAGE_CONFIG: EnterpriseLandingPageConfig =
  {
    theme: 'midnight',
    accentColor: '',
    description: '',
    instagramUrl: '',
    facebookUrl: '',
    tiktokUrl: '',
    showTeam: true,
    showReviews: true,
    showAmenities: true,
    heroAlignment: 'left',
  };

const SOCIAL_DOMAINS = {
  instagramUrl: 'instagram.com',
  facebookUrl: 'facebook.com',
  tiktokUrl: 'tiktok.com',
} as const;

const isRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, maxLength)
    : '';
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function safeSocialUrl(
  value: unknown,
  field: keyof typeof SOCIAL_DOMAINS,
): string {
  const raw = cleanText(value, 300);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (
      parsed.protocol !== 'https:' ||
      hostname !== SOCIAL_DOMAINS[field] ||
      parsed.username ||
      parsed.password
    ) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

export function normalizeEnterpriseLandingPageConfig(
  value: unknown,
): EnterpriseLandingPageConfig {
  const raw = isRecord(value) ? value : {};
  const theme = ENTERPRISE_LANDING_PAGE_THEMES.includes(
    raw.theme as EnterpriseLandingPageTheme,
  )
    ? (raw.theme as EnterpriseLandingPageTheme)
    : DEFAULT_ENTERPRISE_LANDING_PAGE_CONFIG.theme;
  const accentColor = cleanText(raw.accentColor, 7);

  return {
    theme,
    accentColor: isHexColor(accentColor) ? accentColor.toLowerCase() : '',
    description: cleanText(raw.description, 600),
    instagramUrl: safeSocialUrl(raw.instagramUrl, 'instagramUrl'),
    facebookUrl: safeSocialUrl(raw.facebookUrl, 'facebookUrl'),
    tiktokUrl: safeSocialUrl(raw.tiktokUrl, 'tiktokUrl'),
    showTeam:
      typeof raw.showTeam === 'boolean'
        ? raw.showTeam
        : DEFAULT_ENTERPRISE_LANDING_PAGE_CONFIG.showTeam,
    showReviews:
      typeof raw.showReviews === 'boolean'
        ? raw.showReviews
        : DEFAULT_ENTERPRISE_LANDING_PAGE_CONFIG.showReviews,
    showAmenities:
      typeof raw.showAmenities === 'boolean'
        ? raw.showAmenities
        : DEFAULT_ENTERPRISE_LANDING_PAGE_CONFIG.showAmenities,
    heroAlignment:
      raw.heroAlignment === 'center' || raw.heroAlignment === 'left'
        ? raw.heroAlignment
        : DEFAULT_ENTERPRISE_LANDING_PAGE_CONFIG.heroAlignment,
  };
}

export function validateEnterpriseLandingPageConfig(
  value: unknown,
):
  | { ok: true; config: EnterpriseLandingPageConfig }
  | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: 'Configuração do site inválida.' };
  }

  if (
    !ENTERPRISE_LANDING_PAGE_THEMES.includes(
      value.theme as EnterpriseLandingPageTheme,
    )
  ) {
    return { ok: false, error: 'Escolhe um tema de cores válido.' };
  }

  if (
    typeof value.description !== 'string' ||
    value.description.trim().length > 600
  ) {
    return {
      ok: false,
      error: 'A descrição do site não pode ultrapassar 600 caracteres.',
    };
  }

  if (typeof value.accentColor !== 'string') {
    return { ok: false, error: 'A cor de destaque é inválida.' };
  }
  const accentColor = value.accentColor.trim();
  if (accentColor && !isHexColor(accentColor)) {
    return {
      ok: false,
      error: 'A cor de destaque tem de estar no formato hexadecimal.',
    };
  }

  for (const field of [
    'instagramUrl',
    'facebookUrl',
    'tiktokUrl',
  ] as const) {
    const raw = value[field];
    if (typeof raw !== 'string' || raw.trim().length > 300) {
      return {
        ok: false,
        error: 'Os endereços das redes sociais são inválidos.',
      };
    }
    if (raw.trim() && !safeSocialUrl(raw, field)) {
      const network = field.replace('Url', '');
      return {
        ok: false,
        error: `Indica um endereço HTTPS válido de ${network}.`,
      };
    }
  }

  for (const field of ['showTeam', 'showReviews', 'showAmenities'] as const) {
    if (typeof value[field] !== 'boolean') {
      return { ok: false, error: 'As opções de apresentação são inválidas.' };
    }
  }

  if (value.heroAlignment !== 'left' && value.heroAlignment !== 'center') {
    return { ok: false, error: 'O alinhamento do destaque é inválido.' };
  }

  return {
    ok: true,
    config: normalizeEnterpriseLandingPageConfig(value),
  };
}

export function resolveEnterpriseLandingPalette(
  config: EnterpriseLandingPageConfig,
): EnterpriseLandingPalette {
  const palette = ENTERPRISE_LANDING_PAGE_PALETTES[config.theme];
  if (!config.accentColor) return palette;

  const hex = config.accentColor.slice(1);
  const red = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const green = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(hex.slice(4, 6), 16) / 255;
  const toLinear = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  const luminance =
    0.2126 * toLinear(red) +
    0.7152 * toLinear(green) +
    0.0722 * toLinear(blue);

  return {
    ...palette,
    accent: config.accentColor,
    accentText: luminance > 0.42 ? '#101010' : '#ffffff',
  };
}
