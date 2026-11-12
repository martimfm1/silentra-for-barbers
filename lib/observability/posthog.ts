import posthog from 'posthog-js';

type ProductEventProperties = Record<string, string | number | boolean>;

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
