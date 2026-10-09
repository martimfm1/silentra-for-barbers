import { NextResponse } from 'next/server';
import { BillingError } from '@/types/stripe';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';
import {
  assertSameOrigin,
  billingErrorResponse,
} from '@/services/billing/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLANS = new Set(['free', 'pro', 'enterprise']);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, user } = await requirePlatformAdmin();
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const barbershopId =
      typeof body?.barbershopId === 'string' ? body.barbershopId.trim() : '';
    const plan =
      typeof body?.plan === 'string' ? body.plan.trim().toLowerCase() : '';
    const reason =
      typeof body?.reason === 'string'
        ? body.reason.trim().slice(0, 500)
        : null;
    const expiresAt =
      body?.expiresAt === null || body?.expiresAt === ''
        ? null
        : typeof body?.expiresAt === 'string'
          ? body.expiresAt
          : null;

    if (!UUID_RE.test(barbershopId) || !PLANS.has(plan)) {
      return json(
        { ok: false, error: 'Barbearia e plano válidos são obrigatórios.' },
        400,
      );
    }
    if (expiresAt && Number.isNaN(Date.parse(expiresAt))) {
      return json({ ok: false, error: 'A data de expiração é inválida.' }, 400);
    }
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      return json(
        { ok: false, error: 'A data de expiração tem de ser futura.' },
        400,
      );
    }

    const { data: shop, error: shopError } = await admin
      .from('barbershops')
      .select('id,name')
      .eq('id', barbershopId)
      .maybeSingle();
    if (shopError) throw shopError;
    if (!shop)
      return json({ ok: false, error: 'Barbearia não encontrada.' }, 404);

    const { data: assignment, error: assignmentError } = await admin.rpc(
      'set_barbershop_plan_assignment',
      {
        p_barbershop_id: barbershopId,
        p_plan: plan,
        p_reason: reason,
        p_assigned_by: user.id,
        p_expires_at: expiresAt,
      },
    );
    if (assignmentError) throw assignmentError;

    const { error: auditError } = await admin.from('audit_logs').insert({
      action: 'platform.plan_assignment.updated',
      entity_type: 'barbershop',
      entity_id: barbershopId,
      metadata: { plan, reason, expires_at: expiresAt, shop_name: shop.name },
      created_at: new Date().toISOString(),
    });
    if (auditError) console.error('[SILENTRA_ADMIN_PLAN_AUDIT]', auditError);

    return json({ ok: true, assignment });
  } catch (error) {
    if (error instanceof Error && error.name === 'PlatformAdminError')
      return json({ ok: false, error: 'Not found' }, 404);
    if (error instanceof BillingError) {
      const response = billingErrorResponse(error);
      return json(
        { ok: false, error: error.message, code: error.code },
        response.status,
      );
    }
    console.error('[SILENTRA_ADMIN_PLAN_PATCH]', error);
    return json(
      { ok: false, error: 'Não foi possível atribuir o plano.' },
      500,
    );
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, user } = await requirePlatformAdmin();
    const barbershopId =
      new URL(request.url).searchParams.get('barbershopId')?.trim() || '';
    if (!UUID_RE.test(barbershopId))
      return json({ ok: false, error: 'barbershopId inválido.' }, 400);

    const { data: shop, error: shopError } = await admin
      .from('barbershops')
      .select('id,name')
      .eq('id', barbershopId)
      .maybeSingle();
    if (shopError) throw shopError;
    if (!shop)
      return json({ ok: false, error: 'Barbearia não encontrada.' }, 404);

    const { error } = await admin.rpc('clear_barbershop_plan_assignment', {
      p_barbershop_id: barbershopId,
    });
    if (error) throw error;

    const { error: auditError } = await admin.from('audit_logs').insert({
      action: 'platform.plan_assignment.cleared',
      entity_type: 'barbershop',
      entity_id: barbershopId,
      metadata: { actor_user_id: user.id, shop_name: shop.name },
      created_at: new Date().toISOString(),
    });
    if (auditError) console.error('[SILENTRA_ADMIN_PLAN_AUDIT]', auditError);

    return json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.name === 'PlatformAdminError')
      return json({ ok: false, error: 'Not found' }, 404);
    if (error instanceof BillingError) {
      const response = billingErrorResponse(error);
      return json(
        { ok: false, error: error.message, code: error.code },
        response.status,
      );
    }
    console.error('[SILENTRA_ADMIN_PLAN_DELETE]', error);
    return json(
      { ok: false, error: 'Não foi possível remover a atribuição.' },
      500,
    );
  }
}
