import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { hasPlanFeature } from '@/lib/billing/plan-features';
import { resolveAccessPlanForUser } from '@/services/billing/plan-access.guard';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';

const ROLES = ['owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'] as const;

function hasAgendaGrant(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const permissions = value as Record<string, unknown>;
  return permissions.agenda === true || permissions.appointments === true;
}

async function GET__unobserved(request: Request) {
  const tenant = await requireTenantAuthorization(request, ROLES);
  if (!tenant.ok) {
    return NextResponse.json(
      { error: tenant.status === 401 ? 'Inicia sessão para continuar.' : 'Sem permissão para criar marcações.' },
      { status: tenant.status },
    );
  }

  if (tenant.role !== 'owner') {
    const { data: grant, error: grantError } = await tenant.admin
      .from('barbershop_member_permissions')
      .select('permissions')
      .eq('barbershop_id', tenant.barbershopId)
      .eq('user_id', tenant.userId)
      .maybeSingle();

    if (grantError) {
      return NextResponse.json({ error: 'Não foi possível validar as permissões da agenda.' }, { status: 503 });
    }

    let allowed = grant ? hasAgendaGrant(grant.permissions) : false;
    if (!grant) {
      const { data: legacyGrant, error: legacyError } = await tenant.admin
        .from('staff_permissions')
        .select('allowed')
        .eq('barbershop_id', tenant.barbershopId)
        .eq('user_id', tenant.userId)
        .in('permission', ['agenda', 'appointments'])
        .eq('allowed', true)
        .limit(1)
        .maybeSingle();
      if (legacyError) return NextResponse.json({ error: 'Não foi possível validar as permissões da agenda.' }, { status: 503 });
      allowed = legacyGrant?.allowed === true;
    }

    if (!allowed) return NextResponse.json({ error: 'Sem permissão para criar marcações.' }, { status: 403 });
  }

  const plan = await resolveAccessPlanForUser(tenant.userId);
  if (!hasPlanFeature(plan, 'appointments')) {
    return NextResponse.json({ error: 'A agenda não está incluída no plano desta barbearia.' }, { status: 403 });
  }

  const [{ data: shop, error: shopError }, { data: services, error: servicesError }] = await Promise.all([
    tenant.admin.from('shops').select('id').eq('barbershop_id', tenant.barbershopId).limit(1).maybeSingle(),
    tenant.admin.from('services').select('id,name,price,duration').eq('barbershop_id', tenant.barbershopId).order('name', { ascending: true }),
  ]);

  if (shopError || servicesError) {
    console.error('[MOBILE_BOOKING_OPTIONS_FAIL]', shopError?.code ?? servicesError?.code ?? 'UNKNOWN');
    return NextResponse.json({ error: 'Não foi possível carregar as opções de marcação.' }, { status: 503 });
  }
  if (!shop) return NextResponse.json({ error: 'Não foi encontrada uma agenda associada a esta barbearia.' }, { status: 404 });

  return NextResponse.json(
    { shopId: shop.id, services: services ?? [] },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export const GET = withApiObservability('/api/mobile/booking-options', GET__unobserved);
