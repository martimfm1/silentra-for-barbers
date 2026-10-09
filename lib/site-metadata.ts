import type { Metadata } from 'next';

const SITE_URL = 'https://barbers.silentra.me';
const SITE_NAME = 'Silentra for Barbers';
const OG_IMAGE = `/og-image.png`;

// ── Shared base ──────────────────────────────────────────────────────────────

const base = {
  siteName: SITE_NAME,
  url: SITE_URL,
  locale: 'pt_PT',
  type: 'website',
  ogImage: {
    url: OG_IMAGE,
    width: 1200,
    height: 630,
    alt: 'Silentra for Barbers — Gestão e agendamento online para barbearias',
  },
} as const;

// ── Public / guest ────────────────────────────────────────────────────────────

export const guestMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default:
      'Silentra for Barbers — Gestão e Agendamento Online para Barbearias',
    template: '%s | Silentra for Barbers',
  },

  description:
    'A plataforma de gestão para barbearias. Os teus clientes agendam em segundos pelo browser — sem app, sem conta, sem fricção.',

  keywords: [
    'gestão barbearia',
    'agendamento online barbearia',
    'sistema marcações barbearia',
    'software barbeiro',
    'silentra barbers',
    'agendamento sem registo',
    'barber saas portugal',
    'plataforma barbeiro online',
  ],

  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,

  alternates: {
    canonical: SITE_URL,
    languages: { 'pt-PT': SITE_URL },
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },

  openGraph: {
    title: 'Silentra for Barbers — Gestão e Agendamento Online para Barbearias',
    description:
      'Gestão completa, faturação e agendamentos sem fricção. O cliente agenda pelo browser em segundos, sem registo nem app.',
    url: base.url,
    siteName: base.siteName,
    locale: base.locale,
    type: 'website',
    images: [base.ogImage],
  },

  twitter: {
    card: 'summary_large_image',
    site: '@silentra',
    creator: '@silentra',
    title: 'Silentra for Barbers — Agendamento Online para Barbearias',
    description:
      'O teu cliente agenda sem criar conta. Gestão completa da barbearia num único painel.',
    images: [OG_IMAGE],
  },

  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-2.png', sizes: '500x500', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    other: [
      { rel: 'mask-icon', url: '/safari-pinned-tab.svg', color: '#09090b' },
    ],
  },

  manifest: '/site.webmanifest',

  category: 'business',
};

// ── Authenticated dashboard ───────────────────────────────────────────────────
// Indexing blocked — dashboard pages are private and should never appear in SERPs.

export const authenticatedMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: 'Dashboard — Silentra',
    template: '%s | Silentra',
  },

  description:
    'Gere agendamentos, clientes, serviços e estatísticas da tua barbearia.',

  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },

  openGraph: {
    title: 'Silentra — Dashboard de Gestão para Barbearias',
    description:
      'Acede ao teu painel para gerir marcações, equipa e receita da barbearia.',
    url: `${SITE_URL}/dashboard`,
    siteName: base.siteName,
    locale: base.locale,
    type: 'website',
    images: [base.ogImage],
  },

  twitter: {
    card: 'summary_large_image',
    site: '@silentra',
    title: 'Silentra — Dashboard de Gestão',
    description: 'Gere agendamentos, clientes e serviços da tua barbearia.',
    images: [OG_IMAGE],
  },

  icons: guestMetadata.icons,
  manifest: '/site.webmanifest',
};

// ── Helper ────────────────────────────────────────────────────────────────────

export function metadataForAuth(isAuthenticated: boolean): Metadata {
  return isAuthenticated ? authenticatedMetadata : guestMetadata;
}

// ── Per-page factory (for dynamic routes) ────────────────────────────────────

export function buildPageMetadata(override: {
  title: string;
  description: string;
  path?: string;
  ogImageUrl?: string;
}): Metadata {
  const url = override.path ? `${SITE_URL}${override.path}` : SITE_URL;
  const image = override.ogImageUrl ?? OG_IMAGE;

  return {
    title: override.title,
    description: override.description,
    alternates: { canonical: url },
    openGraph: {
      title: override.title,
      description: override.description,
      url,
      siteName: base.siteName,
      locale: base.locale,
      type: 'website',
      images: [{ url: image, width: 1200, height: 630, alt: override.title }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@silentra',
      title: override.title,
      description: override.description,
      images: [image],
    },
  };
}
