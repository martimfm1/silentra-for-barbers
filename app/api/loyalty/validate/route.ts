import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { hashLoyaltyToken } from '@/lib/loyalty/session';
import {
  requireModuleContext,
  moduleErrorResponse,
} from '@/services/modules/authorization';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';

export const runtime = 'nodejs';

const VALIDATION_RATE_LIMIT = 40;
const VALIDATION_RATE_WINDOW_SECONDS = 60;

async function POSTHandler(request: Request) {
  try {
    const context = await requireModuleContext('loyalty', 'loyalty');
    const body = (await request.json().catch(() => ({}))) as {
      identifier?: unknown;
    };
    const identifier =
      typeof body.identifier === 'string' ? body.identifier.trim() : '';
    if (!identifier || identifier.length > 256) {
      return NextResponse.json({ error: 'Código inválido.' }, { status: 400 });
    }

    const allowed = await consumePublicRateLimit(
      request,
      'loyalty-redemption-validation',
      context.barbershopId,
      VALIDATION_RATE_LIMIT,
      VALIDATION_RATE_WINDOW_SECONDS,
    );
    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Demasiadas tentativas. Tenta novamente dentro de um minuto.',
        },
        { status: 429 },
      );
    }

    const hash = hashLoyaltyToken(identifier);
    const { data, error } = await context.admin.rpc(
      'validate_loyalty_redemption',
      {
        p_barbershop_id: context.barbershopId,
        p_identifier_hash: hash,
        p_staff_user_id: context.userId,
      },
    );

    if (error) {
      const map: Record<string, [string, number]> = {
        LOYALTY_STAFF_UNAUTHORIZED: [
          'Não tens permissão para validar recompensas nesta barbearia.',
          403,
        ],
        LOYALTY_REDEMPTION_INVALID: [
          'Código inválido, já utilizado ou inexistente.',
          409,
        ],
        LOYALTY_REDEMPTION_EXPIRED: [
          'Este resgate expirou. Os pontos foram devolvidos ao cliente.',
          409,
        ],
      };
      const mapped = map[error.message];
      return NextResponse.json(
        { error: mapped?.[0] ?? 'Não foi possível validar o resgate.' },
        { status: mapped?.[1] ?? 503 },
      );
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.redemption_id) {
      return NextResponse.json({ error: 'Resgate inválido.' }, { status: 409 });
    }

    await context.admin.from('audit_logs').insert({
      action: 'loyalty_redemption_validated',
      entity_type: 'loyalty_redemption',
      entity_id: result.redemption_id,
      metadata: { barbershop_id: context.barbershopId },
    });

    return NextResponse.json(
      {
        success: true,
        redemption: {
          id: result.redemption_id,
          rewardName: result.reward_name,
          pointsCost: result.points_cost,
          memberEmail: result.member_email,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Não foi possível validar o resgate.' },
      { status: 503 },
    );
  }
}


export const POST = withApiLogging('/api/loyalty/validate', POSTHandler);
