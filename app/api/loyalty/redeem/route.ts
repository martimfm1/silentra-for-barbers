import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getLoyaltySession,
  hashLoyaltyToken,
  generateLoyaltyToken,
} from '@/lib/loyalty/session';
import { sendLoyaltyRedemptionEmail } from '@/lib/brevo/loyalty';
import { requireTenantAuthorization } from '@/lib/security/tenant-guard';
import { getLoyaltyTenantBySlug } from '@/lib/loyalty/public-tenant';
import { encryptRedemptionSecret } from '@/lib/loyalty/redemption-secret';
import { randomInt } from 'node:crypto';

export const runtime = 'nodejs';
const REDEMPTION_TTL_MS = 60 * 60 * 1000;

function generateHumanCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value = '';
  for (let i = 0; i < 8; i += 1) {
    value += alphabet[randomInt(alphabet.length)];
  }
  return value;
}

function errorResponse(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { error: message, ...extra },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

async function POSTHandler(request: Request) {
  const requestId = crypto.randomUUID();
  let tenantId: string | null = null;
  let rewardIdForLog: string | null = null;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      slug?: unknown;
      rewardId?: unknown;
    };
    const slug =
      typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const rewardId = typeof body.rewardId === 'string' ? body.rewardId : '';
    rewardIdForLog = rewardId || null;

    console.info('[LOYALTY_REDEEM] request', { requestId, slug, rewardId });
    if (!slug || !rewardId)
      return errorResponse('Recompensa inválida.', 400, { requestId });

    const tenant = await getLoyaltyTenantBySlug(slug);
    tenantId = tenant?.barbershopId ?? null;
    if (!tenant)
      return errorResponse('Fidelização indisponível.', 404, { requestId });
    await requireTenantAuthorization({
      barbershopId: tenant.barbershopId,
      allowPublicTenant: true,
    });

    const session = await getLoyaltySession(tenant.barbershopId);
    if (!session)
      return errorResponse(
        'Sessão expirada. Confirma novamente o teu email.',
        401,
        { requestId },
      );

    const admin = createAdminClient();
    const [
      { data: enabledSettings, error: settingsError },
      { data: barbershop, error: barbershopError },
    ] = await Promise.all([
      admin
        .from('loyalty_settings')
        .select('enabled')
        .eq('barbershop_id', tenant.barbershopId)
        .maybeSingle(),
      admin
        .from('barbershops')
        .select('name')
        .eq('id', tenant.barbershopId)
        .maybeSingle(),
    ]);
    if (settingsError || barbershopError)
      return errorResponse('Não foi possível validar a fidelização.', 503, {
        requestId,
      });
    if (enabledSettings?.enabled !== true)
      return errorResponse(
        'A fidelização está desativada nesta barbearia.',
        409,
        { requestId },
      );
    if (!barbershop?.name)
      return errorResponse('Não foi possível identificar a barbearia.', 503, {
        requestId,
      });

    await admin.rpc('expire_loyalty_redemptions');

    const { data: member, error: memberError } = await admin
      .from('loyalty_members')
      .select('id, email, name, points_balance, status')
      .eq('barbershop_id', tenant.barbershopId)
      .eq('email', session.email)
      .eq('status', 'active')
      .maybeSingle();
    if (memberError || !member)
      return errorResponse(
        memberError
          ? 'Não foi possível carregar a adesão.'
          : 'Não tens uma adesão ativa nesta barbearia.',
        memberError ? 503 : 409,
        { requestId },
      );

    const { data: reward, error: rewardLookupError } = await admin
      .from('loyalty_rewards')
      .select(
        'id, name, description, points_cost, reward_type, reward_value, active',
      )
      .eq('id', rewardId)
      .eq('barbershop_id', tenant.barbershopId)
      .eq('active', true)
      .maybeSingle();
    if (rewardLookupError)
      return errorResponse('Não foi possível carregar a recompensa.', 503, {
        requestId,
      });
    if (!reward)
      return errorResponse('Esta recompensa já não está disponível.', 404, {
        requestId,
      });
    if (member.points_balance < reward.points_cost)
      return errorResponse(
        'Ainda não tens pontos suficientes para esta recompensa.',
        409,
        { requestId },
      );

    const { data: existingRedemption, error: existingError } = await admin
      .from('loyalty_redemptions')
      .select('id')
      .eq('member_id', member.id)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();
    if (existingError)
      return errorResponse(
        'Não foi possível validar os teus resgates pendentes.',
        503,
        { requestId },
      );
    if (existingRedemption)
      return errorResponse(
        'Já tens uma recompensa reservada. Utiliza-a antes de criar outro resgate.',
        409,
        { requestId },
      );

    const token = generateLoyaltyToken();
    const code = generateHumanCode();
    const tokenHash = hashLoyaltyToken(token);
    const codeHash = hashLoyaltyToken(code);
    const tokenEncrypted = encryptRedemptionSecret(token);
    const codeEncrypted = encryptRedemptionSecret(code);
    const expiresAt = new Date(Date.now() + REDEMPTION_TTL_MS).toISOString();

    const { data: redemption, error } = await admin.rpc(
      'redeem_loyalty_reward',
      {
        p_member_id: member.id,
        p_reward_id: reward.id,
        p_token_hash: tokenHash,
        p_code_hash: codeHash,
        p_token_encrypted: tokenEncrypted,
        p_code_encrypted: codeEncrypted,
        p_expires_at: expiresAt,
      },
    );
    if (error) {
      console.error('[LOYALTY_REDEEM] rpc_failed', {
        requestId,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      const map: Record<string, [string, number]> = {
        LOYALTY_INSUFFICIENT_POINTS: [
          'Ainda não tens pontos suficientes para esta recompensa.',
          409,
        ],
        LOYALTY_REWARD_NOT_FOUND: [
          'Esta recompensa já não está disponível.',
          404,
        ],
        LOYALTY_MEMBER_NOT_FOUND: ['Adesão inválida ou expirada.', 401],
      };
      const mapped = map[error.message];
      return mapped
        ? errorResponse(mapped[0], mapped[1], { requestId })
        : errorResponse('Não foi possível resgatar a recompensa.', 503, {
            requestId,
          });
    }

    const result = Array.isArray(redemption) ? redemption[0] : redemption;
    if (!result?.redemption_id)
      return errorResponse('Não foi possível criar o resgate.', 503, {
        requestId,
      });

    let emailSent = false;
    try {
      await sendLoyaltyRedemptionEmail({
        email: member.email,
        customerName: member.name,
        barbershopName: barbershop.name,
        rewardName: reward.name,
        rewardDescription: reward.description,
        pointsCost: Number(result.points_cost),
        remainingPoints: Number(result.points_balance),
        code,
        qrPayload: token,
        expiresAt,
      });
      emailSent = true;
    } catch (emailError) {
      console.error('[LOYALTY_REDEEM] email_failed', {
        requestId,
        errorName:
          emailError instanceof Error ? emailError.name : 'UnknownError',
      });
    }

    return NextResponse.json(
      {
        success: true,
        emailSent,
        redemption: {
          id: result.redemption_id,
          pointsCost: result.points_cost,
          pointsBalance: result.points_balance,
          code,
          token,
          qrPayload: token,
          expiresAt,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[LOYALTY_REDEEM] unexpected_error', {
      requestId,
      tenantId,
      rewardId: rewardIdForLog,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return errorResponse('Não foi possível processar o resgate.', 503, {
      requestId,
    });
  }
}

export const POST = withApiLogging('/api/loyalty/redeem', POSTHandler);
