import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/security/request-validation';
import { UUID_PATTERN } from '@/lib/validation';
import { hasPlanFeature } from '@/lib/billing/plan-features';
import { resolveAccessPlanForUser } from '@/services/billing/plan-access.guard';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';

const ROLES = ['owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'] as const;

async function canManageAgenda(tenant: Extract<Awaited<ReturnType<typeof requireTenantAuthorization>>, { ok: true }>) {
  if (tenant.role === 'owner' || tenant.role === 'admin') return true;
  const { data: grant, error } = await tenant.admin
    .from('barbershop_member_permissions')
    .select('permissions')
    .eq('barbershop_id', tenant.barbershopId)
    .eq('user_id', tenant.userId)
    .maybeSingle();
  if (error) return false;
  const permissions =
    grant?.permissions && typeof grant.permissions === 'object'
      ? (grant.permissions as Record<string, unknown>)
      : {};
  let allowed = permissions.agenda === true || permissions.appointments === true;
  if (!grant) {
    const legacy = await tenant.admin
      .from('staff_permissions')
      .select('allowed')
      .eq('barbershop_id', tenant.barbershopId)
      .eq('user_id', tenant.userId)
      .in('permission', ['agenda', 'appointments'])
      .eq('allowed', true)
      .limit(1)
      .maybeSingle();
    if (legacy.error) return false;
    allowed = legacy.data?.allowed === true;
  }
  return allowed;
}

async function authorize(request: Request) {
  const tenant = await requireTenantAuthorization(request, ROLES);
  if (!tenant.ok) return { response: NextResponse.json({ success: false, error: 'Sem autorização.' }, { status: tenant.status }) };
  if (!(await canManageAgenda(tenant)))
    return { response: NextResponse.json({ success: false, error: 'Sem permissão para gerir a lista de espera.' }, { status: 403 }) };
  const plan = await resolveAccessPlanForUser(tenant.userId);
  if (!hasPlanFeature(plan, 'waitlist'))
    return { response: NextResponse.json({ success: false, error: 'A lista de espera está disponível apenas no plano Enterprise.' }, { status: 403 }) };
  return { tenant };
}

async function GET__unobserved(request: Request) {
  try {
    const access = await authorize(request);
    if ('response' in access) return access.response;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const allowedStatuses = ['waiting', 'offered', 'booked', 'cancelled', 'expired'];
    if (status && !allowedStatuses.includes(status))
      return NextResponse.json({ success: false, error: 'Estado inválido.' }, { status: 400 });
    let query = access.tenant.admin
      .from('booking_waitlist')
      .select('id,customer_name,customer_email,customer_phone,preferred_date,preferred_time_start,preferred_time_end,offered_date,offered_time,status,created_at,last_contacted_at,offer_expires_at,services(name),professionals(name)')
      .eq('barbershop_id', access.tenant.barbershopId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new Error('WAITLIST_LIST_FAILED');
    return NextResponse.json({ success: true, entries: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[DASHBOARD_WAITLIST_LIST_ERROR]', error instanceof Error ? error.message : 'UNKNOWN');
    return NextResponse.json({ success: false, error: 'Não foi possível carregar a lista de espera.' }, { status: 503 });
  }
}

async function PATCH__unobserved(request: Request) {
  try {
    const access = await authorize(request);
    if ('response' in access) return access.response;
    const payload = await readJsonObject(request, { maxBytes: 4 * 1024, allowedKeys: ['id', 'status'] });
    if (!payload.ok) return payload.response;
    const id = typeof payload.value.id === 'string' ? payload.value.id : '';
    const status = typeof payload.value.status === 'string' ? payload.value.status : '';
    if (!UUID_PATTERN.test(id) || !['booked', 'cancelled', 'expired'].includes(status))
      return NextResponse.json({ success: false, error: 'Dados inválidos.' }, { status: 400 });
    const { data, error } = await access.tenant.admin
      .from('booking_waitlist')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('barbershop_id', access.tenant.barbershopId)
      .in('status', ['waiting', 'offered'])
      .select('id,status')
      .maybeSingle();
    if (error) throw new Error('WAITLIST_UPDATE_FAILED');
    if (!data)
      return NextResponse.json({ success: false, error: 'Este pedido já foi atualizado ou não existe.' }, { status: 409 });
    return NextResponse.json({ success: true, entry: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[DASHBOARD_WAITLIST_UPDATE_ERROR]', error instanceof Error ? error.message : 'UNKNOWN');
    return NextResponse.json({ success: false, error: 'Não foi possível atualizar o pedido.' }, { status: 503 });
  }
}


export const GET = withApiObservability(
  '/api/dashboard/waitlist',
  GET__unobserved,
);

export const PATCH = withApiObservability(
  '/api/dashboard/waitlist',
  PATCH__unobserved,
);
