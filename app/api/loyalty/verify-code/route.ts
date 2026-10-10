import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getLoyaltySession,
  generateLoyaltyToken,
  hashLoyaltyToken,
  hashLoyaltyValue,
  loyaltySessionExpiry,
  normalizeLoyaltyEmail,
  setLoyaltyCookie,
} from '@/lib/loyalty/session';
import { requireTenantAuthorization } from '@/lib/security/tenant-guard';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';
import { getLoyaltyTenantBySlug } from '@/lib/loyalty/public-tenant';

export const runtime = 'nodejs';
const VERIFY_RATE_LIMIT = 12;
const VERIFY_RATE_WINDOW_SECONDS = 15 * 60;

async function POSTHandler(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      slug?: unknown;
      email?: unknown;
      code?: unknown;
      name?: unknown;
    };
    const slug =
      typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const email = normalizeLoyaltyEmail(body.email);
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const name =
      typeof body.name === 'string' ? body.name.trim().slice(0, 120) : null;
    if (!slug || !email || !/^\d{6}$/.test(code))
      return NextResponse.json(
        { error: 'Email ou código inválido.' },
        { status: 400 },
      );

    const tenant = await getLoyaltyTenantBySlug(slug);
    if (!tenant)
      return NextResponse.json(
        { error: 'A fidelização não está disponível.' },
        { status: 404 },
      );

    await requireTenantAuthorization({
      barbershopId: tenant.barbershopId,
      allowPublicTenant: true,
    });

    const allowed = await consumePublicRateLimit(
      request,
      'loyalty-otp-verify',
      `${tenant.barbershopId}:${email}`,
      VERIFY_RATE_LIMIT,
      VERIFY_RATE_WINDOW_SECONDS,
    );
    if (!allowed)
      return NextResponse.json(
        { error: 'Demasiadas tentativas. Pede um novo código mais tarde.' },
        { status: 429 },
      );

    const admin = createAdminClient();
    const { data: verification } = await admin
      .from('loyalty_verifications')
      .select('id')
      .eq('barbershop_id', tenant.barbershopId)
      .eq('email', email)
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!verification)
      return NextResponse.json(
        { error: 'Código inválido ou expirado.' },
        { status: 401 },
      );

    const verificationResult = await admin.rpc('consume_loyalty_verification', {
      p_verification_id: verification.id,
      p_code_hash: hashLoyaltyValue(code),
    });
    if (verificationResult.error)
      return NextResponse.json(
        { error: 'Não foi possível validar o código.' },
        { status: 503 },
      );
    if (verificationResult.data === 'LOYALTY_VERIFICATION_LOCKED')
      return NextResponse.json(
        { error: 'Demasiadas tentativas. Pede um novo código.' },
        { status: 429 },
      );
    if (verificationResult.data !== 'LOYALTY_VERIFICATION_OK')
      return NextResponse.json(
        { error: 'Código inválido ou expirado.' },
        { status: 401 },
      );

    const { error: joinError } = await admin.rpc('join_loyalty_program', {
      p_barbershop_id: tenant.barbershopId,
      p_email: email,
      p_name: name,
    });
    if (joinError) {
      const codeMap: Record<string, { message: string; status: number }> = {
        LOYALTY_ALREADY_ENROLLED: {
          message:
            'Já tens uma adesão ativa noutra barbearia. Só podes participar num programa de cada vez.',
          status: 409,
        },
        LOYALTY_PROGRAM_UNAVAILABLE: {
          message:
            'O programa de fidelização está temporariamente indisponível.',
          status: 409,
        },
      };
      const mapped = codeMap[joinError.message];
      return mapped
        ? NextResponse.json(
            { error: mapped.message },
            { status: mapped.status },
          )
        : NextResponse.json(
            { error: 'Não foi possível concluir a adesão ao programa.' },
            { status: 503 },
          );
    }

    await admin
      .from('loyalty_sessions')
      .delete()
      .eq('email', email)
      .neq('barbershop_id', tenant.barbershopId);

    const token = generateLoyaltyToken();
    const expiresAt = loyaltySessionExpiry();
    const { error: sessionError } = await admin
      .from('loyalty_sessions')
      .insert({
        barbershop_id: tenant.barbershopId,
        email,
        token_hash: hashLoyaltyToken(token),
        expires_at: expiresAt,
      });
    if (sessionError)
      return NextResponse.json(
        { error: 'Não foi possível iniciar a sessão.' },
        { status: 503 },
      );

    await setLoyaltyCookie(token, expiresAt);
    const session = await getLoyaltySession(tenant.barbershopId);
    return NextResponse.json(
      { success: true, email: session?.email ?? email },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível verificar o código.' },
      { status: 503 },
    );
  }
}


export const POST = withApiLogging('/api/loyalty/verify-code', POSTHandler);
