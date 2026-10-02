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

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin')?.trim();
  if (!origin) {
    throw new BillingError(
      'A origem do pedido não pôde ser validada.',
      'CSRF_VALIDATION_FAILED',
    );
  }

  let receivedOrigin: string;
  try {
    receivedOrigin = new URL(origin).origin;
  } catch {
    throw new BillingError(
      'A origem do pedido não pôde ser validada.',
      'CSRF_VALIDATION_FAILED',
    );
  }

  const allowedOrigins = new Set<string>();

  // The request target is authoritative for same-origin browser requests.
  // This keeps custom domains and local development working even when the
  // deployment's VERCEL_URL points at an internal/preview hostname.
  try {
    allowedOrigins.add(new URL(request.url).origin);
  } catch {
    // Invalid request URLs are rejected below if no trusted origin can be built.
  }

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host')?.trim();

  if (host) {
    const protocol =
      forwardedProto === 'http' || forwardedProto === 'https'
        ? forwardedProto
        : new URL(request.url).protocol.replace(':', '');

    try {
      allowedOrigins.add(new URL(`${protocol}://${host}`).origin);
    } catch {
      // Ignore malformed proxy headers; explicit configured origins may still validate.
    }
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

    try {
      allowedOrigins.add(
        new URL(
          value.startsWith('http://') || value.startsWith('https://')
            ? value
            : `https://${value}`,
        ).origin,
      );
    } catch {
      console.warn('[CSRF_CONFIGURED_ORIGIN_INVALID]');
    }
  }

  if (!allowedOrigins.has(receivedOrigin)) {
    throw new BillingError(
      'O pedido não foi iniciado a partir da aplicação autorizada.',
      'CSRF_VALIDATION_FAILED',
    );
  }
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
