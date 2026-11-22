import { MetadataRoute } from 'next';

const SITE_URL = 'https://barbers.silentra.me';

// Only the publicly published marketing, directory, profile and landing-page
// content is eligible for discovery. Robots rules are crawl preferences, not
// authorization; private routes remain protected by server-side auth/RLS.
const PRIVATE_PATHS = [
  '/api',
  '/dashboard',
  '/silentra-admin',
  '/_silentra-admin',
  '/login',
  '/registo',
  '/forgot-password',
  '/reset-password',
  '/confirm-email',
  '/email-confirmed',
  '/email-confirmation-error',
  '/onboarding',
  '/checkout',
  '/my-bookings',
  '/mensagens',
  '/marketplace/track',
  '/barbershops/*/review/claim',
];

const AI_SEARCH_AGENTS = [
  // Search/indexing agents
  'Claude-SearchBot',
  'OAI-SearchBot',
  'PerplexityBot',
  // User-directed fetchers used when someone asks an assistant to open a page
  'Claude-User',
  'ChatGPT-User',
];

const AI_TRAINING_AGENTS = [
  // Keep search visibility separate from permission to collect content for training.
  'ClaudeBot',
  'GPTBot',
  'Google-Extended',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: AI_SEARCH_AGENTS,
        allow: ['/', '/llms.txt', '/sitemap.xml'],
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: AI_TRAINING_AGENTS,
        disallow: '/',
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
