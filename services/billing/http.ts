import { NextResponse } from 'next/server';
import { BillingError } from '@/types/stripe';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : undefined);

export function billingErrorResponse(error: unknown): NextResponse {
  if (error instanceof BillingError) {
    const status = {
      BILLING_NOT_CONFIGURED: 503,
      INVALID_PRICE: 400,
      CUSTOMER_NOT_FOUND: 404,
      SUBSCRIPTION_NOT_FOUND: 404,
      SUBSCRIPTION_NOT_ACTIVE: 409,
      PAYMENT_MODE_STRIPE_DISABLED: 403,
      PAYMENT_MODE_MANUAL_DISABLED: 403,
      MANUAL_REQUEST_NOT_FOUND: 404,
      MANUAL_REQUEST_INVALID: 400,
      DB_READ_FAILED: 503,
      DB_WRITE_FAILED: 503,
      WEBHOOK_VERIFICATION_FAILED: 400,
      WEBHOOK_PROCESSING_FAILED: 500,
      CSRF_VALIDATION_FAILED: 403,
      CHECKOUT_INTENT_INVALID: 400,
      PROMOTION_NOT_ELIGIBLE: 409,
      CHECKOUT_RESOURCE_MISSING: 409,
      CHECKOUT_FAILED: 502,
    }[error.code];
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status },
    );
  }

  console.error('billing.unexpected_error', {
    error: error instanceof Error ? error.name : 'unknown',
  });
  return NextResponse.json(
    { error: 'Unable to process billing request.' },
    { status: 500 },
  );
}

export function appUrl(pathname: string): string {
  if (!APP_URL)
    throw new BillingError(
      'Application URL is not configured.',
      'BILLING_NOT_CONFIGURED',
    );
  return new URL(pathname, APP_URL).toString();
}

/** Only permit same-origin URLs. This prevents open redirects from Checkout and Portal. */
export function safeReturnUrl(value: unknown, fallbackPath: string): string {
  const fallback = appUrl(fallbackPath);
  if (typeof value !== 'string') return fallback;

  try {
    const candidate = new URL(value);
    if (candidate.origin === new URL(fallback).origin)
      return candidate.toString();
  } catch {
    // Use the safe fallback for malformed URLs.
  }
  return fallback;
}

function normalizeOrigin(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins(request: Request): Set<string> {
  const allowedOrigins = new Set<string>();

  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
    allowedOrigins.add(requestUrl.origin);
  } catch {
    return allowedOrigins;
  }

  const forwardedHost = request.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim();
  const forwardedProto = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
    .toLowerCase();
  const host = forwardedHost || request.headers.get('host')?.trim();

  if (host) {
    const protocol =
      forwardedProto === 'http' || forwardedProto === 'https'
        ? forwardedProto
        : requestUrl.protocol.replace(':', '');

    const proxyOrigin = normalizeOrigin(`${protocol}://${host}`);
    if (proxyOrigin) allowedOrigins.add(proxyOrigin);
  }

  const configuredOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ];

  for (const configuredOrigin of configuredOrigins) {
    const value = configuredOrigin?.trim();
    if (!value) continue;

    const normalized = normalizeOrigin(
      value.startsWith('http://') || value.startsWith('https://')
        ? value
        : `https://${value}`,
    );

    if (normalized) {
      allowedOrigins.add(normalized);
    } else {
      console.warn('[CSRF_CONFIGURED_ORIGIN_INVALID]');
    }
  }

  // Local development often alternates between localhost, 127.0.0.1 and [::1].
  // Keep these aliases development-only and preserve the same port.
  if (
    process.env.NODE_ENV === 'development' &&
    requestUrl.protocol === 'http:'
  ) {
    const loopbackPort = requestUrl.port ? `:${requestUrl.port}` : '';
    for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
      const loopbackOrigin = normalizeOrigin(
        `http://${hostname}${loopbackPort}`,
      );
      if (loopbackOrigin) allowedOrigins.add(loopbackOrigin);
    }
  }

  return allowedOrigins;
}

export function assertSameOrigin(request: Request): void {
  const allowedOrigins = getAllowedOrigins(request);
  const originHeader = request.headers.get('origin');
  const receivedOrigin = normalizeOrigin(originHeader);

  // Prefer the browser Origin header. If it is present but unexpected, never
  // fall back to Referer or Fetch Metadata because that would weaken CSRF.
  if (originHeader?.trim()) {
    if (receivedOrigin && allowedOrigins.has(receivedOrigin)) return;

    console.warn('[CSRF_ORIGIN_REJECTED]', {
      receivedOrigin: receivedOrigin ?? 'invalid',
      requestOrigin: normalizeOrigin(request.url) ?? 'invalid',
    });

    throw new BillingError(
      'O pedido não foi iniciado a partir da aplicação autorizada.',
      'CSRF_VALIDATION_FAILED',
    );
  }

  // Some same-origin clients legitimately omit Origin. Referer is accepted
  // only when its origin matches one of the trusted application origins.
  const refererOrigin = normalizeOrigin(request.headers.get('referer'));
  if (refererOrigin && allowedOrigins.has(refererOrigin)) return;

  // Fetch Metadata is browser-controlled and cannot be set by page JavaScript.
  // Accepting only "same-origin" preserves a strict boundary when Origin is absent.
  if (request.headers.get('sec-fetch-site')?.trim().toLowerCase() === 'same-origin')
    return;

  throw new BillingError(
    'A origem do pedido não pôde ser validada.',
    'CSRF_VALIDATION_FAILED',
  );
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    if (value && typeof value === 'object' && !Array.isArray(value))
      return value as Record<string, unknown>;
  } catch {
    // Route callers receive the same validation response for invalid JSON and invalid shape.
  }
  throw new BillingError(
    'Request body must be a JSON object.',
    'INVALID_PRICE',
  );
}
