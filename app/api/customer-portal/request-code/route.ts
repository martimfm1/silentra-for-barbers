import { withApiObservability } from '@/lib/observability/api';
import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  generateVerificationCode,
  getVerificationExpiry,
  hashPortalValue,
  normalizePortalEmail,
} from '@/lib/customer-booking-portal';
import { sendCustomerPortalCodeEmail } from '@/lib/brevo/customer-booking-portal';

const REQUEST_LIMIT = 3;
const REQUEST_WINDOW_SECONDS = 10 * 60;

function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

function rateLimitKey(request: Request, email: string): string {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32)
    throw new Error(
      'RATE_LIMIT_SECRET is not configured with sufficient entropy.',
    );
  return createHmac('sha256', secret)
    .update(`customer-portal-request:${email}:${getClientIp(request)}`)
    .digest('hex');
}

async function POST__unobserved(request: Request) {
  const genericResponse = NextResponse.json({
    success: true,
    message:
      'Se o endereço for válido, vais receber um código de confirmação por email.',
  });

  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: unknown;
    };
    const email = normalizePortalEmail(body.email);
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Indica um email válido.' },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: allowed, error: rateError } = await admin.rpc(
      'consume_public_rate_limit',
      {
        p_key: rateLimitKey(request, email),
        p_limit: REQUEST_LIMIT,
        p_window_seconds: REQUEST_WINDOW_SECONDS,
      },
    );
    if (rateError) {
      console.error('[CUSTOMER_PORTAL_RATE_LIMIT_ERROR]', rateError);
      return NextResponse.json(
        {
          success: false,
          error: 'Não foi possível processar o pedido neste momento.',
        },
        { status: 503 },
      );
    }
    if (allowed !== true) return genericResponse;

    const recentCutoff = new Date(Date.now() - 60_000).toISOString();
    const { count, error: recentError } = await admin
      .from('booking_portal_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .gte('requested_at', recentCutoff);

    if (recentError) {
      console.error('[CUSTOMER_PORTAL_RATE_CHECK_ERROR]', recentError);
      return genericResponse;
    }
    if ((count ?? 0) >= 1) return genericResponse;

    const code = generateVerificationCode();
    const { error: cleanupError } = await admin
      .from('booking_portal_verifications')
      .delete()
      .eq('email', email)
      .is('consumed_at', null);
    if (cleanupError)
      console.warn(
        '[CUSTOMER_PORTAL_VERIFICATION_CLEANUP_ERROR]',
        cleanupError,
      );

    const { error: insertError } = await admin
      .from('booking_portal_verifications')
      .insert({
        email,
        code_hash: hashPortalValue(code),
        expires_at: getVerificationExpiry(),
      });

    if (insertError) {
      console.error('[CUSTOMER_PORTAL_CODE_INSERT_ERROR]', insertError);
      return genericResponse;
    }

    try {
      await sendCustomerPortalCodeEmail(email, code);
    } catch (error) {
      console.error('[CUSTOMER_PORTAL_EMAIL_ERROR]', error);
      await admin
        .from('booking_portal_verifications')
        .delete()
        .eq('email', email)
        .is('consumed_at', null);
      return genericResponse;
    }

    return genericResponse;
  } catch (error) {
    console.error('[CUSTOMER_PORTAL_REQUEST_CODE_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Não foi possível processar o pedido.' },
      { status: 503 },
    );
  }
}

export const POST = withApiObservability('/api/customer-portal/request-code', POST__unobserved);
