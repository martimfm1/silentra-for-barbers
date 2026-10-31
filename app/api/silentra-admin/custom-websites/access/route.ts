import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

async function GET__unobserved() {
  try {
    const { admin } = await requirePlatformAdmin();
    const { data: grants, error } = await admin
      .from('custom_website_access_grants')
      .select(
        'barbershop_id, granted_by_user_id, plan_at_grant, setup_fee_eur, monthly_fee_eur, reason, active, created_at, updated_at',
      )
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;

    const ids = [
      ...new Set((grants ?? []).map((grant) => grant.barbershop_id)),
    ];
    const { data: shops, error: shopsError } = ids.length
      ? await admin.from('barbershops').select('id, name, slug').in('id', ids)
      : { data: [], error: null };
    if (shopsError) throw shopsError;
    const shopById = new Map((shops ?? []).map((shop) => [shop.id, shop]));
    return NextResponse.json(
      {
        data: (grants ?? []).map((grant) => ({
          ...grant,
          shop: shopById.get(grant.barbershop_id) ?? null,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const status =
      error instanceof Error && error.name === 'PlatformAdminError' ? 403 : 503;
    if (status !== 403)
      console.error('[ADMIN_CUSTOM_WEBSITE_ACCESS_LIST_FAILED]', {
        name: error instanceof Error ? error.name : 'UnknownError',
      });
    return fail(
      status === 403
        ? 'Acesso reservado à administração.'
        : 'Não foi possível carregar as permissões de sites.',
      status,
    );
  }
}

async function POST__unobserved(request: Request) {
  try {
    try {
      const { assertSameOrigin } = await import('@/services/billing/http');
      assertSameOrigin(request);
    } catch {
      return fail('A origem do pedido não pôde ser validada.', 403);
    }
    if (
      !request.headers
        .get('content-type')
        ?.toLowerCase()
        .startsWith('application/json')
    ) {
      return fail('O pedido tem de usar application/json.', 415);
    }
    const { user, admin } = await requirePlatformAdmin();
    const length = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(length) && length > 6000)
      return fail('Pedido demasiado grande.', 413);
    const raw = await request.text();
    if (raw.length > 6000) return fail('Pedido demasiado grande.', 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return fail('JSON inválido.', 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return fail('Formato inválido.', 400);
    const input = body as Record<string, unknown>;
    const allowed = new Set([
      'barbershopId',
      'enabled',
      'plan',
      'monthlyFee',
      'reason',
    ]);
    if (Object.keys(input).some((key) => !allowed.has(key)))
      return fail('O pedido contém campos não permitidos.', 400);
    const barbershopId =
      typeof input.barbershopId === 'string' ? input.barbershopId.trim() : '';
    if (!UUID_RE.test(barbershopId))
      return fail('ID da barbearia inválido.', 400);
    if (typeof input.enabled !== 'boolean')
      return fail('Indica se a permissão deve ficar ativa.', 400);

    if (!input.enabled) {
      const { error } = await admin
        .from('custom_website_access_grants')
        .update({ active: false })
        .eq('barbershop_id', barbershopId);
      if (error) throw error;
      return NextResponse.json(
        { ok: true, active: false },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (input.plan !== 'free' && input.plan !== 'pro')
      return fail(
        'Só podes atribuir esta permissão aos planos Free ou Pro.',
        400,
      );
    const monthlyFee =
      typeof input.monthlyFee === 'number'
        ? input.monthlyFee
        : Number(input.monthlyFee);
    const expectedFee = input.plan === 'pro' ? 4.99 : 6.99;
    if (!Number.isFinite(monthlyFee) || monthlyFee !== expectedFee) {
      return fail(
        `A mensalidade definida para o plano ${input.plan === 'pro' ? 'Pro' : 'Free'} é ${expectedFee.toFixed(2)} €.`,
        400,
      );
    }
    const reason =
      typeof input.reason === 'string'
        ? input.reason.trim().slice(0, 1000)
        : '';
    if (reason.length < 3)
      return fail('Regista o motivo da concessão (mínimo 3 caracteres).', 400);

    const { data: shop, error: shopError } = await admin
      .from('barbershops')
      .select('id')
      .eq('id', barbershopId)
      .maybeSingle();
    if (shopError) throw shopError;
    if (!shop) return fail('Barbearia não encontrada.', 404);

    const { data: owners, error: ownersError } = await admin
      .from('users')
      .select('id')
      .eq('barbershop_id', barbershopId)
      .eq('role', 'owner')
      .limit(5);
    if (ownersError) throw ownersError;
    if (!owners?.length)
      return fail(
        'Não foi possível identificar o proprietário da barbearia.',
        409,
      );
    const { BarbershopStripeService } =
      await import('@/services/billing/barbershop-stripe.service');
    const ownerPlans = await Promise.all(
      owners.map(async (owner) => ({
        id: owner.id,
        plan: await BarbershopStripeService.getEffectivePlan(owner.id),
      })),
    );
    if (!ownerPlans.some((owner) => owner.plan === input.plan)) {
      return fail(
        'O plano selecionado não corresponde ao plano atual da barbearia. Atualiza a página e tenta novamente.',
        409,
      );
    }

    const { error } = await admin.from('custom_website_access_grants').upsert(
      {
        barbershop_id: barbershopId,
        granted_by_user_id: user.id,
        plan_at_grant: input.plan,
        setup_fee_eur: 150,
        monthly_fee_eur: monthlyFee,
        reason,
        active: true,
      },
      { onConflict: 'barbershop_id' },
    );
    if (error) throw error;
    return NextResponse.json(
      { ok: true, active: true, monthlyFee, expectedFee },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const status =
      error instanceof Error && error.name === 'PlatformAdminError' ? 403 : 503;
    if (status !== 403)
      console.error('[ADMIN_CUSTOM_WEBSITE_ACCESS_UPDATE_FAILED]', {
        name: error instanceof Error ? error.name : 'UnknownError',
      });
    return fail(
      status === 403
        ? 'Acesso reservado à administração.'
        : 'Não foi possível guardar a permissão.',
      status,
    );
  }
}

export const GET = withApiObservability(
  '/api/silentra-admin/custom-websites/access',
  GET__unobserved,
);
export const POST = withApiObservability(
  '/api/silentra-admin/custom-websites/access',
  POST__unobserved,
);
