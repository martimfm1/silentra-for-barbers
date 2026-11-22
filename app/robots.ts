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
  'Perplexity-User',
];

const AI_TRAINING_AND_GROUNDING_AGENTS = [
  // ClaudeBot and GPTBot are training crawlers.
  'ClaudeBot',
  'GPTBot',
  // Google-Extended controls both Gemini training and Gemini grounding.
  // Blocking it does not block Google Search indexing, but it does opt out of
  // Gemini grounding. This is the conservative no-training choice.
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
      {
        // Emerging AIPREF policy token: express a site-wide no-training preference
        // in addition to vendor-specific crawler rules. This is an Internet-Draft,
        // not yet a universally adopted standard.
        userAgent: '__usage_ai-training',
        disallow: '/',
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
