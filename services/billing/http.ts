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
      DB_READ_FAILED: 503,
      DB_WRITE_FAILED: 503,
      WEBHOOK_VERIFICATION_FAILED: 400,
      WEBHOOK_PROCESSING_FAILED: 500,
      CSRF_VALIDATION_FAILED: 403,
      CHECKOUT_INTENT_INVALID: 400,
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

  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  const expectedOrigin = configuredOrigin
    ? new URL(
        configuredOrigin.startsWith('http')
          ? configuredOrigin
          : `https://${configuredOrigin}`,
      ).origin
    : new URL(request.url).origin;

  let receivedOrigin: string;
  try {
    receivedOrigin = new URL(origin).origin;
  } catch {
    throw new BillingError(
      'A origem do pedido não pôde ser validada.',
      'CSRF_VALIDATION_FAILED',
    );
  }

  if (receivedOrigin !== expectedOrigin) {
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
