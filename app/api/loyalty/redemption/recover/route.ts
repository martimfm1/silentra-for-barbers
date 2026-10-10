import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLoyaltySession } from '@/lib/loyalty/session';
import { getLoyaltyTenantBySlug } from '@/lib/loyalty/public-tenant';
import { requireTenantAuthorization } from '@/lib/security/tenant-guard';
import { decryptRedemptionSecret } from '@/lib/loyalty/redemption-secret';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function GET__unobserved(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug')?.trim().toLowerCase() ?? '';
    const redemptionId = url.searchParams.get('redemptionId')?.trim() ?? '';
    if (!slug || !redemptionId)
      return response({ error: 'Resgate inválido.', requestId }, 400);

    const tenant = await getLoyaltyTenantBySlug(slug);
    if (!tenant)
      return response({ error: 'Fidelização indisponível.', requestId }, 404);
    await requireTenantAuthorization({
      barbershopId: tenant.barbershopId,
      allowPublicTenant: true,
    });

    const session = await getLoyaltySession(tenant.barbershopId);
    if (!session)
      return response(
        {
          error: 'Sessão expirada. Confirma novamente o teu email.',
          requestId,
        },
        401,
      );

    const admin = createAdminClient();
    await admin.rpc('expire_loyalty_redemptions');

    const { data: redemption, error: redemptionError } = await admin
      .from('loyalty_redemptions')
      .select(
        'id, member_id, reward_id, points_spent, status, expires_at, token_encrypted, code_encrypted',
      )
      .eq('id', redemptionId)
      .eq('barbershop_id', tenant.barbershopId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (redemptionError) {
      console.error('[LOYALTY_REDEMPTION_RECOVER_LOOKUP_ERROR]', {
        requestId,
        code: redemptionError.code,
        message: redemptionError.message,
      });
      return response(
        { error: 'Não foi possível carregar o resgate.', requestId },
        503,
      );
    }

    if (!redemption)
      return response(
        { error: 'Este resgate já expirou ou foi utilizado.', requestId },
        410,
      );

    const { data: member, error: memberError } = await admin
      .from('loyalty_members')
      .select('id, email, name, status')
      .eq('id', redemption.member_id)
      .eq('barbershop_id', tenant.barbershopId)
      .eq('status', 'active')
      .maybeSingle();

    if (
      memberError ||
      !member ||
      member.email.toLowerCase() !== session.email.toLowerCase()
    ) {
      console.warn('[LOYALTY_REDEMPTION_RECOVER_UNAUTHORIZED]', {
        requestId,
        redemptionId,
      });
      return response(
        { error: 'Não tens acesso a este resgate.', requestId },
        403,
      );
    }

    if (!redemption.token_encrypted || !redemption.code_encrypted) {
      console.error('[LOYALTY_REDEMPTION_RECOVER_SECRET_MISSING]', {
        requestId,
        redemptionId,
      });
      return response(
        {
          error:
            'Este resgate foi criado antes da recuperação segura de vouchers. Consulta o email original.',
          requestId,
        },
        410,
      );
    }

    const [{ data: reward }, { data: settings }] = await Promise.all([
      admin
        .from('loyalty_rewards')
        .select('name')
        .eq('id', redemption.reward_id)
        .eq('barbershop_id', tenant.barbershopId)
        .maybeSingle(),
      admin
        .from('loyalty_settings')
        .select('enabled')
        .eq('barbershop_id', tenant.barbershopId)
        .maybeSingle(),
    ]);

    if (settings?.enabled !== true)
      return response(
        { error: 'A fidelização está desativada nesta barbearia.', requestId },
        409,
      );

    try {
      const token = decryptRedemptionSecret(redemption.token_encrypted);
      const code = decryptRedemptionSecret(redemption.code_encrypted);
      const expiresAt = redemption.expires_at;
      return response({
        success: true,
        requestId,
        redemption: {
          id: redemption.id,
          code,
          token,
          qrPayload: token,
          pointsCost: redemption.points_spent,
          expiresAt,
          rewardName: reward?.name ?? 'Recompensa',
          customerName: member.name,
        },
      });
    } catch (error) {
      console.error('[LOYALTY_REDEMPTION_RECOVER_DECRYPT_ERROR]', {
        requestId,
        redemptionId,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      return response(
        { error: 'Não foi possível recuperar o voucher.', requestId },
        503,
      );
    }
  } catch (error) {
    console.error('[LOYALTY_REDEMPTION_RECOVER_ERROR]', {
      requestId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return response(
      { error: 'Não foi possível recuperar o voucher.', requestId },
      503,
    );
  }
}

export const GET = withApiObservability('/api/loyalty/redemption/recover', GET__unobserved);
