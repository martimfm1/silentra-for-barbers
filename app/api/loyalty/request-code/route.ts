import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  LoyaltyEmailDeliveryError,
  sendLoyaltyCodeEmail,
} from '@/lib/brevo/loyalty';
import { requireTenantAuthorization } from '@/lib/security/tenant-guard';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';
import { getLoyaltyTenantBySlug } from '@/lib/loyalty/public-tenant';
import {
  generateLoyaltyCode,
  hashLoyaltyValue,
  loyaltyCodeExpiry,
  normalizeLoyaltyEmail,
} from '@/lib/loyalty/session';

export const runtime = 'nodejs';
const EMAIL_RATE_LIMIT = 3;
const EMAIL_RATE_WINDOW_SECONDS = 15 * 60;

function logOtpError(
  event: string,
  details?: Record<string, string | number | boolean>,
) {
  console.error('[LOYALTY_OTP_ERROR]', { event, ...details });
}

async function POSTHandler(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      slug?: unknown;
      email?: unknown;
    };
    const slug =
      typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const email = normalizeLoyaltyEmail(body.email);

    if (!slug || !email) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
    }

    const tenant = await getLoyaltyTenantBySlug(slug);
    if (!tenant) {
      return NextResponse.json(
        { error: 'A fidelização não está disponível para esta barbearia.' },
        { status: 404 },
      );
    }

    try {
      await requireTenantAuthorization({
        barbershopId: tenant.barbershopId,
        allowPublicTenant: true,
      });
    } catch {
      return NextResponse.json(
        { error: 'A fidelização não está disponível para esta barbearia.' },
        { status: 404 },
      );
    }

    if (!process.env.BREVO_API_KEY || !process.env.SENDER_EMAIL) {
      logOtpError('email_configuration_missing', {
        hasBrevoApiKey: Boolean(process.env.BREVO_API_KEY),
        hasSenderEmail: Boolean(process.env.SENDER_EMAIL),
      });
      return NextResponse.json(
        {
          error:
            'O envio de emails da fidelização não está configurado. Tenta novamente mais tarde.',
        },
        { status: 503 },
      );
    }

    const allowed = await consumePublicRateLimit(
      request,
      'loyalty-otp-request',
      `${tenant.barbershopId}:${email}`,
      EMAIL_RATE_LIMIT,
      EMAIL_RATE_WINDOW_SECONDS,
    );

    if (!allowed) {
      return NextResponse.json(
        { success: true },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const admin = createAdminClient();
    const code = generateLoyaltyCode();
    const expiresAt = loyaltyCodeExpiry();
    const codeHash = hashLoyaltyValue(code);

    const { data: barbershop, error: barbershopError } = await admin
      .from('barbershops')
      .select('name')
      .eq('id', tenant.barbershopId)
      .maybeSingle();

    if (barbershopError) {
      logOtpError('barbershop_lookup_failed', {
        code: barbershopError.code ?? 'UNKNOWN',
      });
      return NextResponse.json(
        { error: 'Não foi possível preparar o envio.' },
        { status: 503 },
      );
    }

    const { error: cleanupError } = await admin
      .from('loyalty_verifications')
      .delete()
      .eq('barbershop_id', tenant.barbershopId)
      .eq('email', email)
      .is('consumed_at', null);

    if (cleanupError) {
      logOtpError('verification_cleanup_failed', {
        code: cleanupError.code ?? 'UNKNOWN',
      });
      throw cleanupError;
    }

    const { error: insertError } = await admin
      .from('loyalty_verifications')
      .insert({
        barbershop_id: tenant.barbershopId,
        email,
        code_hash: codeHash,
        expires_at: expiresAt,
      });

    if (insertError) {
      logOtpError('verification_insert_failed', {
        code: insertError.code ?? 'UNKNOWN',
      });
      throw insertError;
    }

    try {
      await sendLoyaltyCodeEmail(
        email,
        code,
        barbershop?.name ?? 'esta barbearia',
      );
    } catch (emailError) {
      await admin
        .from('loyalty_verifications')
        .delete()
        .eq('barbershop_id', tenant.barbershopId)
        .eq('email', email)
        .eq('code_hash', codeHash)
        .is('consumed_at', null);

      if (emailError instanceof LoyaltyEmailDeliveryError) {
        logOtpError('email_delivery_failed', {
          status: emailError.status ?? 0,
        });
      } else {
        logOtpError('email_delivery_failed', { status: 0 });
      }

      return NextResponse.json(
        { error: 'Não foi possível enviar o código.' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    logOtpError('request_failed', {
      unexpected: error instanceof Error ? 1 : 0,
    });
    return NextResponse.json(
      { error: 'Não foi possível enviar o código.' },
      { status: 503 },
    );
  }
}


export const POST = withApiLogging('/api/loyalty/request-code', POSTHandler);
