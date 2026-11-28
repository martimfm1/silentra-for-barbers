import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/security/request-validation';
import { createAdminClient } from '@/lib/supabase/admin';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';
import {
  generateVerificationCode,
  getVerificationExpiry,
  hashPortalValue,
  normalizePortalEmail,
} from '@/lib/customer-booking-portal';
import { sendCustomerPortalCodeEmail } from '@/lib/brevo/customer-booking-portal';

const REQUEST_LIMIT = 3;
const REQUEST_WINDOW_SECONDS = 10 * 60;
const IP_REQUEST_LIMIT = 10;
const EMAIL_COOLDOWN_SECONDS = 60;

async function POST__unobserved(request: Request) {
  const genericResponse = NextResponse.json(
    {
      success: true,
      message:
        'Se o endereço for válido, vais receber um código de confirmação por email.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );

  try {
    const bodyResult = await readJsonObject(request, {
      maxBytes: 4 * 1024,
      allowedKeys: ['email'],
    });
    if (!bodyResult.ok) return bodyResult.response;
    const email = normalizePortalEmail(bodyResult.value.email);
    if (!email) return genericResponse;

    const [emailAllowed, ipAllowed, cooldownAllowed] = await Promise.all([
      consumePublicRateLimit(
        request, 'customer-portal-request-email', email,
        REQUEST_LIMIT, REQUEST_WINDOW_SECONDS, false,
      ),
      consumePublicRateLimit(
        request, 'customer-portal-request-ip', 'all',
        IP_REQUEST_LIMIT, REQUEST_WINDOW_SECONDS, true,
      ),
      consumePublicRateLimit(
        request, 'customer-portal-request-cooldown', email,
        1, EMAIL_COOLDOWN_SECONDS, false,
      ),
    ]);

    // Keep responses indistinguishable for eligible and ineligible addresses.
    if (!emailAllowed || !ipAllowed || !cooldownAllowed) return genericResponse;

    const admin = createAdminClient();
    const code = generateVerificationCode();

    const { error: cleanupError } = await admin
      .from('booking_portal_verifications')
      .delete()
      .eq('email', email)
      .is('consumed_at', null);
    if (cleanupError) {
      console.error(
        '[CUSTOMER_PORTAL_VERIFICATION_CLEANUP_ERROR]',
        cleanupError.code ?? 'UNKNOWN',
      );
      return genericResponse;
    }

    const { error: insertError } = await admin
      .from('booking_portal_verifications')
      .insert({
        email,
        code_hash: hashPortalValue(code),
        expires_at: getVerificationExpiry(),
      });

    if (insertError) {
      console.error(
        '[CUSTOMER_PORTAL_CODE_INSERT_ERROR]',
        insertError.code ?? 'UNKNOWN',
      );
      return genericResponse;
    }

    try {
      await sendCustomerPortalCodeEmail(email, code);
    } catch (error) {
      console.error(
        '[CUSTOMER_PORTAL_EMAIL_ERROR]',
        error instanceof Error ? error.name : 'unknown',
      );
      await admin
        .from('booking_portal_verifications')
        .delete()
        .eq('email', email)
        .is('consumed_at', null);
      return genericResponse;
    }

    return genericResponse;
  } catch (error) {
    console.error(
      '[CUSTOMER_PORTAL_REQUEST_CODE_ERROR]',
      error instanceof Error ? error.name : 'unknown',
    );
    return NextResponse.json(
      { success: false, error: 'Não foi possível processar o pedido.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const POST = withApiObservability(
  '/api/customer-portal/request-code',
  POST__unobserved,
);
