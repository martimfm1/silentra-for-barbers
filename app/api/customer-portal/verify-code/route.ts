import { withApiLogging } from '@/lib/observability/api-request';
import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  generateSessionToken,
  getSessionExpiry,
  hashPortalToken,
  hashPortalValue,
  normalizePortalEmail,
  setPortalCookie,
} from '@/lib/customer-booking-portal';

const VERIFY_LIMIT = 10;
const VERIFY_WINDOW_SECONDS = 10 * 60;

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
    .update(`customer-portal-verify:${email}:${getClientIp(request)}`)
    .digest('hex');
}

async function POSTHandler(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: unknown;
      code?: unknown;
    };
    const email = normalizePortalEmail(body.email);
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!email || !/^\d{6}$/.test(code))
      return NextResponse.json(
        { success: false, error: 'Email ou código inválido.' },
        { status: 400 },
      );

    const admin = createAdminClient();
    const { data: allowed, error: rateError } = await admin.rpc(
      'consume_public_rate_limit',
      {
        p_key: rateLimitKey(request, email),
        p_limit: VERIFY_LIMIT,
        p_window_seconds: VERIFY_WINDOW_SECONDS,
      },
    );
    if (rateError) {
      console.error('[CUSTOMER_PORTAL_VERIFY_RATE_LIMIT_ERROR]', rateError);
      return NextResponse.json(
        {
          success: false,
          error: 'Não foi possível processar o código neste momento.',
        },
        { status: 503 },
      );
    }
    if (allowed !== true)
      return NextResponse.json(
        {
          success: false,
          error: 'Demasiadas tentativas. Pede um novo código.',
        },
        { status: 429 },
      );

    const { data: verification, error } = await admin.rpc(
      'verify_booking_portal_code',
      {
        p_email: email,
        p_code_hash: hashPortalValue(code),
      },
    );
    const result = Array.isArray(verification) ? verification[0] : verification;
    if (error) {
      console.error('[CUSTOMER_PORTAL_VERIFY_RPC_ERROR]', error);
      return NextResponse.json(
        { success: false, error: 'Não foi possível verificar o código.' },
        { status: 503 },
      );
    }
    if (!result?.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            result?.error_code === 'TOO_MANY_ATTEMPTS'
              ? 'Demasiadas tentativas. Pede um novo código.'
              : 'Código inválido ou expirado.',
        },
        { status: result?.error_code === 'TOO_MANY_ATTEMPTS' ? 429 : 401 },
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
      console.warn('[CUSTOMER_PORTAL_SESSION_CLEANUP_ERROR]', revokeError);

    const { error: sessionError } = await admin
      .from('booking_portal_sessions')
      .insert({
        email,
        token_hash: hashPortalToken(token),
        expires_at: expiresAt,
      });
    if (sessionError) {
      console.error('[CUSTOMER_PORTAL_SESSION_ERROR]', sessionError);
      return NextResponse.json(
        { success: false, error: 'Não foi possível iniciar a sessão.' },
        { status: 503 },
      );
    }

    await setPortalCookie(token, expiresAt);
    return NextResponse.json({ success: true, email });
  } catch (error) {
    console.error('[CUSTOMER_PORTAL_VERIFY_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Não foi possível verificar o código.' },
      { status: 503 },
    );
  }
}


export const POST = withApiLogging('/api/customer-portal/verify-code', POSTHandler);
