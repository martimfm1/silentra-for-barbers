export type MarketingEventParams = Record<string, string | number | boolean>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

/**
 * Pushes privacy-safe marketing events to the existing GTM dataLayer.
 * GTM needs a Custom Event trigger and GA4 Event tag to forward these events.
 */
export function trackMarketingEvent(
  event: string,
  params: MarketingEventParams = {},
): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...params });
}
