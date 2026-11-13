import posthog from 'posthog-js';

type ProductEventProperties = Record<string, string | number | boolean>;

type AuthenticatedUser = {
  id: string;
};

const URL_PROPERTIES = [
  '$current_url',
  '$initial_current_url',
  '$session_entry_url',
  '$referrer',
] as const;

let posthogInitialized = false;
const SENSITIVE_PROPERTY_KEY =
  /email|phone|password|secret|token|cookie|authorization|address|full.?name|birth|request.?body|response.?body|payload/i;

function sanitizeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;

  try {
    const url = new URL(value, window.location.origin);
    const safePath = url.pathname
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[id]')
      .replace(/\/\d+(?=\/|$)/g, '/[id]')
      .replace(/\/[a-f0-9]{24,}(?=\/|$)/gi, '/[id]')
      .replace(/\/[^/]{32,}(?=\/|$)/g, '/[redacted]');
    return `${url.origin}${safePath}`;
  } catch {
    return undefined;
  }
}

function sanitizeAnalyticsValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
      .replace(
        /(?:\+351[\s.-]?)?(?:2[1-9][0-9]|9[0-9]{2})[\s.-]?[0-9]{3}[\s.-]?[0-9]{3}/g,
        '[redacted-phone]',
      );
  }

  if (Array.isArray(value)) return value.map(sanitizeAnalyticsValue);

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) =>
        SENSITIVE_PROPERTY_KEY.test(key)
          ? []
          : [[key, sanitizeAnalyticsValue(item)]],
      ),
    );
  }

  return value;
}

/** Caller must check the analytics-consent cookie before initializing. */
export function initializePostHog() {
  if (process.env.NODE_ENV !== 'production' || posthogInitialized) return;

  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!projectToken || !host) return;

  posthog.init(projectToken, {
    api_host: host,
    defaults: '2026-08-30',
    autocapture: false,
    capture_pageview: 'history_change',
    capture_pageleave: 'if_capture_pageview',
    capture_exceptions: true,
    disable_capture_url_hashes: true,
    before_send(event) {
      event.properties = sanitizeAnalyticsValue(event.properties) as typeof event.properties;

      for (const property of URL_PROPERTIES) {
        const safeUrl = sanitizeUrl(event.properties[property]);
        if (safeUrl) {
          event.properties[property] = safeUrl;
        } else {
          delete event.properties[property];
        }
      }

      return event;
    },
    opt_out_capturing_by_default: true,
    disable_session_recording: false,
    session_recording: {
      sampleRate: 0.2,
      maskAllInputs: true,
      maskTextClass: 'ph-mask',
      maskTextSelector: '.ph-mask, [data-ph-mask], [data-sensitive]',
      blockClass: 'ph-no-capture',
      blockSelector: '.ph-no-capture, [data-ph-no-capture], [data-private-data]',
    },
  });

  // The caller gates initialization on consent; opt in only after that check.
  posthog.opt_in_capturing({ captureEventName: false });
  posthogInitialized = true;
}

/** Capture a product event without collecting customer or appointment PII. */
export function captureProductEvent(
  event: string,
  properties: ProductEventProperties = {},
) {
  if (!posthogInitialized) return;
  posthog.capture(event, properties);
}

/** Report a caught exception only after analytics consent initialized PostHog. */
export function capturePostHogException(error: unknown) {
  if (!posthogInitialized) return;
  posthog.captureException(error);
}

/** Persist only the authenticated Supabase user's stable ID for analytics. */
export function identifyProductUser({ id }: AuthenticatedUser) {
  if (!posthogInitialized) return;

  posthog.identify(id);
}

/** Clear the previous user's persisted analytics identity on sign-out. */
export function resetProductUser() {
  if (!posthogInitialized) return;
  posthog.reset();
}
