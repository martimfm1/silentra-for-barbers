import * as Sentry from '@sentry/nextjs';
import {
  COOKIE_CONSENT_COOKIE,
  parseCookieConsent,
} from '@/lib/privacy/cookie-consent';
import { initializePostHog } from '@/lib/observability/posthog';
import { initializeSentry, isSentryEnabled } from '@/lib/observability/sentry';

function hasAnalyticsConsent() {
  if (typeof document === 'undefined') return false;

  const storedCookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_CONSENT_COOKIE}=`));

  if (!storedCookie) return false;

  return (
    parseCookieConsent(storedCookie.slice(COOKIE_CONSENT_COOKIE.length + 1))
      ?.analytics === true
  );
}

// instrumentation-client.ts is evaluated by Next.js before the app renders.
// Product analytics stays production-only; local Sentry requires explicit opt-in.
if (process.env.NODE_ENV === 'production' && hasAnalyticsConsent()) {
  initializePostHog();
}

if (isSentryEnabled() && hasAnalyticsConsent()) {
  initializeSentry(process.env.NEXT_PUBLIC_SENTRY_DSN);
}

export function onRouterTransitionStart(
  ...args: Parameters<typeof Sentry.captureRouterTransitionStart>
) {
  if (
    isSentryEnabled() &&
    hasAnalyticsConsent() &&
    process.env.NEXT_PUBLIC_SENTRY_DSN
  ) {
    Sentry.captureRouterTransitionStart(...args);
  }
}
