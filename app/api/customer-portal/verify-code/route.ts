import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/security/request-validation';
import { createAdminClient } from '@/lib/supabase/admin';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';
import {
  generateSessionToken,
  getSessionExpiry,
  hashPortalToken,
  hashPortalValue,
  normalizePortalEmail,
  setPortalCookie,
} from '@/lib/customer-booking-portal';

const VERIFY_EMAIL_LIMIT = 5;
const VERIFY_IP_LIMIT = 30;
const VERIFY_WINDOW_SECONDS = 10 * 60;

async function POST__unobserved(request: Request) {
  try {
    const bodyResult = await readJsonObject(request, {
      maxBytes: 4 * 1024,
      allowedKeys: ['email', 'code', 'clientPlatform'],
    });
    if (!bodyResult.ok) return bodyResult.response;
    const email = normalizePortalEmail(bodyResult.value.email);
    const code =
      typeof bodyResult.value.code === 'string'
        ? bodyResult.value.code.trim()
        : '';
    const clientPlatform = bodyResult.value.clientPlatform ?? 'web';

    if (clientPlatform !== 'web' && clientPlatform !== 'mobile') {
      return NextResponse.json(
        { success: false, error: 'Plataforma de cliente inválida.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (!email || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: 'Código inválido ou expirado.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const [emailAllowed, ipAllowed] = await Promise.all([
      consumePublicRateLimit(
        request, 'customer-portal-verify-email', email,
        VERIFY_EMAIL_LIMIT, VERIFY_WINDOW_SECONDS, false,
      ),
      consumePublicRateLimit(
        request, 'customer-portal-verify-ip', 'all',
        VERIFY_IP_LIMIT, VERIFY_WINDOW_SECONDS, true,
      ),
    ]);

    if (!emailAllowed || !ipAllowed) {
      return NextResponse.json(
        { success: false, error: 'Código inválido ou expirado.' },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(VERIFY_WINDOW_SECONDS),
          },
        },
      );
    }

    const admin = createAdminClient();
    const { data: verification, error } = await admin.rpc(
      'verify_booking_portal_code',
      {
        p_email: email,
        p_code_hash: hashPortalValue(code),
      },
    );
    const result = Array.isArray(verification) ? verification[0] : verification;

    if (error) {
      console.error(
        '[CUSTOMER_PORTAL_VERIFY_RPC_ERROR]',
        error.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        { success: false, error: 'Não foi possível verificar o código.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (!result?.ok) {
      return NextResponse.json(
        { success: false, error: 'Código inválido ou expirado.' },
        {
          status: 401,
          headers: { 'Cache-Control': 'no-store' },
        },
      );
    }

    const token = generateSessionToken();
    const expiresAt = getSessionExpiry();
    const { error: revokeError } = await admin
      .from('booking_portal_sessions')
      .delete()
      .eq('email', email)
      .lt('expires_at', new Date().toISOString());
    if (revokeError)
      console.warn(
        '[CUSTOMER_PORTAL_SESSION_CLEANUP_ERROR]',
        revokeError.code ?? 'UNKNOWN',
      );

    const { error: sessionError } = await admin
      .from('booking_portal_sessions')
      .insert({
        email,
        token_hash: hashPortalToken(token),
        expires_at: expiresAt,
      });
    if (sessionError) {
      console.error(
        '[CUSTOMER_PORTAL_SESSION_ERROR]',
        sessionError.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        { success: false, error: 'Não foi possível iniciar a sessão.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    await setPortalCookie(token, expiresAt);
    return NextResponse.json(
      {
        success: true,
        email,
        ...(clientPlatform === 'mobile'
          ? { sessionToken: token, expiresAt }
          : {}),
      },
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
    );
  } catch (error) {
    console.error(
      '[CUSTOMER_PORTAL_VERIFY_ERROR]',
      error instanceof Error ? error.name : 'unknown',
    );
    return NextResponse.json(
      { success: false, error: 'Não foi possível verificar o código.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const POST = withApiObservability(
  '/api/customer-portal/verify-code',
  POST__unobserved,
);
