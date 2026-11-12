import posthog from 'posthog-js';

type ProductEventProperties = Record<string, string | number | boolean>;

const URL_PROPERTIES = [
  '$current_url',
  '$initial_current_url',
  '$session_entry_url',
  '$referrer',
] as const;

function sanitizeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;

  try {
    const url = new URL(value, window.location.origin);
    const safePath = url.pathname
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[id]')
      .replace(/\\/\\d+(?=\\/|$)/g, '/[id]')
      .replace(/\\/[a-f0-9]{24,}(?=\\/|$)/gi, '/[id]')
      .replace(/\\/[^/]{32,}(?=\\/|$)/g, '/[redacted]');
    return `${url.origin}${safePath}`;
  } catch {
    return undefined;
  }
}

let posthogInitialized = false;

/**
 * Initializes browser analytics only in production. The caller must check the
 * site's analytics consent before calling this function.
 */
export function initializePostHog() {
  if (process.env.NODE_ENV !== 'production' || posthogInitialized) return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
    defaults: '2026-08-30',
    autocapture: false,
    capture_pageview: 'history_change',
    capture_pageleave: 'if_capture_pageview',
    disable_capture_url_hashes: true,
    before_send(event) {
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

  // Analytics are enabled only after the consent cookie has been verified.
  posthog.opt_in_capturing({ captureEventName: false });
  posthogInitialized = true;
}

/** Capture a product event without collecting customer or appointment PII. */
export function captureProductEvent(
  event: string,
  properties: ProductEventProperties = {},
) {
  if (process.env.NODE_ENV !== 'production' || !posthogInitialized) return;
  posthog.capture(event, properties);
}
