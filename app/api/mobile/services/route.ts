import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { UUID_PATTERN } from '@/lib/validation';
import { hasPlanFeature } from '@/lib/billing/plan-features';
import { resolveAccessPlanForUser } from '@/services/billing/plan-access.guard';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';

const ALLOWED_ROLES = [
  'owner',
  'admin',
  'manager',
  'barber',
  'receptionist',
  'staff',
] as const;

type ServicePayload = {
  id?: unknown;
  name?: unknown;
  price?: unknown;
  duration?: unknown;
};

async function authorizeServices(request: Request) {
  const tenant = await requireTenantAuthorization(request, ALLOWED_ROLES);
  if (!tenant.ok) {
    return {
      response: NextResponse.json(
        {
          error:
            tenant.status === 401
              ? 'Inicia sessão para continuar.'
              : 'Sem permissão para aceder aos serviços.',
        },
        { status: tenant.status },
      ),
    } as const;
  }

  if (tenant.role !== 'owner') {
    const { data: grant, error: grantError } = await tenant.admin
      .from('barbershop_member_permissions')
      .select('permissions')
      .eq('barbershop_id', tenant.barbershopId)
      .eq('user_id', tenant.userId)
      .maybeSingle();

    if (grantError) {
      return {
        response: NextResponse.json(
          { error: 'Não foi possível validar as permissões dos serviços.' },
          { status: 503 },
        ),
      } as const;
    }

    let allowed = Boolean(grant?.permissions?.services);
    if (!grant) {
      const { data: legacyGrant, error: legacyError } = await tenant.admin
        .from('staff_permissions')
        .select('allowed')
        .eq('barbershop_id', tenant.barbershopId)
        .eq('user_id', tenant.userId)
        .eq('permission', 'services')
        .eq('allowed', true)
        .maybeSingle();
      if (legacyError) {
        return {
          response: NextResponse.json(
            { error: 'Não foi possível validar as permissões dos serviços.' },
            { status: 503 },
          ),
        } as const;
      }
      allowed = legacyGrant?.allowed === true;
    }

    if (!allowed) {
      return {
        response: NextResponse.json(
          { error: 'A tua conta não tem permissão para gerir serviços.' },
          { status: 403 },
        ),
      } as const;
    }
  }

  const plan = await resolveAccessPlanForUser(tenant.userId);
  if (!hasPlanFeature(plan, 'services')) {
    return {
      response: NextResponse.json(
        {
          error:
            'A gestão de serviços não está incluída no plano desta barbearia.',
        },
        { status: 403 },
      ),
    } as const;
  }

  return { tenant } as const;
}

function validateService(payload: ServicePayload) {
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const price =
    typeof payload.price === 'number' ? payload.price : Number(payload.price);
  const duration =
    typeof payload.duration === 'number'
      ? payload.duration
      : Number(payload.duration);

  if (!name || name.length > 100) {
    return {
      error: 'O nome do serviço é obrigatório e deve ter até 100 caracteres.',
    };
  }
  if (!Number.isFinite(price) || price < 0 || price > 100000) {
    return { error: 'Indica um preço válido em euros.' };
  }
  if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
    return { error: 'A duração deve ser um número de minutos entre 1 e 1440.' };
  }
  return { value: { name, price: Math.round(price * 100) / 100, duration } };
}

async function GET__unobserved(request: Request) {
  const auth = await authorizeServices(request);
  if ('response' in auth) return auth.response;

  const { data, error } = await auth.tenant.admin
    .from('services')
    .select('id, name, price, duration, barbershop_id')
    .eq('barbershop_id', auth.tenant.barbershopId)
    .order('name', { ascending: true });

  if (error) {
    console.error('[MOBILE_SERVICES_LIST_FAIL]', error.code ?? 'UNKNOWN');
    return NextResponse.json(
      { error: 'Não foi possível carregar os serviços.' },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { services: data ?? [] },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

async function POST__unobserved(request: Request) {
  const auth = await authorizeServices(request);
  if ('response' in auth) return auth.response;

  if (Number(request.headers.get('content-length') ?? 0) > 24 * 1024) {
    return NextResponse.json(
      { error: 'O pedido é demasiado grande.' },
      { status: 413 },
    );
  }
  const body = (await request
    .json()
    .catch(() => null)) as ServicePayload | null;
  if (!body)
    return NextResponse.json(
      { error: 'Corpo JSON inválido.' },
      { status: 400 },
    );
  const validated = validateService(body);
  if ('error' in validated)
    return NextResponse.json({ error: validated.error }, { status: 400 });

  const { data, error } = await auth.tenant.admin
    .from('services')
    .insert({ ...validated.value, barbershop_id: auth.tenant.barbershopId })
    .select('id, name, price, duration, barbershop_id')
    .single();

  if (error) {
    console.error('[MOBILE_SERVICES_CREATE_FAIL]', error.code ?? 'UNKNOWN');
    return NextResponse.json(
      { error: 'Não foi possível criar o serviço.' },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { success: true, service: data },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  );
}

async function PATCH__unobserved(request: Request) {
  const auth = await authorizeServices(request);
  if ('response' in auth) return auth.response;

  if (Number(request.headers.get('content-length') ?? 0) > 24 * 1024) {
    return NextResponse.json(
      { error: 'O pedido é demasiado grande.' },
      { status: 413 },
    );
  }
  const body = (await request
    .json()
    .catch(() => null)) as ServicePayload | null;
  if (!body || typeof body.id !== 'string' || !UUID_PATTERN.test(body.id)) {
    return NextResponse.json(
      { error: 'Identificador de serviço inválido.' },
      { status: 400 },
    );
  }
  const validated = validateService(body);
  if ('error' in validated)
    return NextResponse.json({ error: validated.error }, { status: 400 });

  const { data, error } = await auth.tenant.admin
    .from('services')
    .update(validated.value)
    .eq('id', body.id)
    .eq('barbershop_id', auth.tenant.barbershopId)
    .select('id, name, price, duration, barbershop_id')
    .maybeSingle();

  if (error) {
    console.error('[MOBILE_SERVICES_UPDATE_FAIL]', error.code ?? 'UNKNOWN');
    return NextResponse.json(
      { error: 'Não foi possível atualizar o serviço.' },
      { status: 409 },
    );
  }
  if (!data)
    return NextResponse.json(
      { error: 'Serviço não encontrado nesta barbearia.' },
      { status: 404 },
    );

  return NextResponse.json(
    { success: true, service: data },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

async function DELETE__unobserved(request: Request) {
  const auth = await authorizeServices(request);
  if ('response' in auth) return auth.response;

  if (Number(request.headers.get('content-length') ?? 0) > 24 * 1024) {
    return NextResponse.json(
      { error: 'O pedido é demasiado grande.' },
      { status: 413 },
    );
  }
  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
  } | null;
  if (!body || typeof body.id !== 'string' || !UUID_PATTERN.test(body.id)) {
    return NextResponse.json(
      { error: 'Identificador de serviço inválido.' },
      { status: 400 },
    );
  }

  const { data: linkedAppointments, error: lookupError } =
    await auth.tenant.admin
      .from('appointments')
      .select('id')
      .eq('barbershop_id', auth.tenant.barbershopId)
      .eq('service_id', body.id)
      .limit(1);

  if (lookupError) {
    console.error(
      '[MOBILE_SERVICES_DELETE_CHECK_FAIL]',
      lookupError.code ?? 'UNKNOWN',
    );
    return NextResponse.json(
      {
        error:
          'Não foi possível validar se o serviço está associado a marcações.',
      },
      { status: 503 },
    );
  }
  if (linkedAppointments?.length) {
    return NextResponse.json(
      {
        error: 'Este serviço tem marcações associadas e não pode ser removido.',
      },
      { status: 409 },
    );
  }

  const { data, error } = await auth.tenant.admin
    .from('services')
    .delete()
    .eq('id', body.id)
    .eq('barbershop_id', auth.tenant.barbershopId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[MOBILE_SERVICES_DELETE_FAIL]', error.code ?? 'UNKNOWN');
    return NextResponse.json(
      { error: 'Não foi possível remover o serviço.' },
      { status: 409 },
    );
  }
  if (!data)
    return NextResponse.json(
      { error: 'Serviço não encontrado nesta barbearia.' },
      { status: 404 },
    );

  return NextResponse.json(
    { success: true },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export const GET = withApiObservability(
  '/api/mobile/services',
  GET__unobserved,
);
export const POST = withApiObservability(
  '/api/mobile/services',
  POST__unobserved,
);
export const PATCH = withApiObservability(
  '/api/mobile/services',
  PATCH__unobserved,
);
export const DELETE = withApiObservability(
  '/api/mobile/services',
  DELETE__unobserved,
);
