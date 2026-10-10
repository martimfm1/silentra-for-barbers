import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_PATTERN } from '@/lib/validation';
import { getAccessPlanForRequest } from '@/services/billing/plan-access.guard';
import { getPlanLimit } from '@/lib/billing/plan-features';

export const runtime = 'nodejs';

const PROFESSIONAL_PERMISSION_ALIASES = [
  'team',
  'manage_professionals',
  'team_management',
  'manage_team',
  'professionals',
] as const;

async function canManageProfessionals(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  barbershopId: string,
) {
  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('id, barbershop_id, role')
    .eq('id', userId)
    .maybeSingle();
  if (
    profileError ||
    !profile?.barbershop_id ||
    profile.barbershop_id !== barbershopId
  )
    return {
      allowed: false as const,
      reason: 'BARBERSHOP_ACCESS_DENIED' as const,
    };
  const role = String(profile.role ?? '').toLowerCase();
  if (['admin', 'owner'].includes(role))
    return { allowed: true as const, role };

  const { data: grant, error: permissionError } = await admin
    .from('staff_permissions')
    .select('permission, allowed')
    .eq('barbershop_id', barbershopId)
    .eq('user_id', userId)
    .in('permission', [...PROFESSIONAL_PERMISSION_ALIASES])
    .eq('allowed', true)
    .limit(1)
    .maybeSingle();
  if (permissionError) {
    console.error(
      '[PROFESSIONAL_PERMISSION_LOOKUP]',
      permissionError.code ?? 'UNKNOWN',
    );
    return {
      allowed: false as const,
      reason: 'PROFESSIONAL_MANAGEMENT_DENIED' as const,
    };
  }
  return grant?.allowed
    ? { allowed: true as const, role, permission: grant.permission }
    : {
        allowed: false as const,
        reason: 'PROFESSIONAL_MANAGEMENT_DENIED' as const,
      };
}

async function POST__unobserved(
  request: Request,
  { params }: { params: Promise<{ barbershopId: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json(
        { error: 'Não autenticado.', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    const { barbershopId } = await params;
    if (!UUID_PATTERN.test(barbershopId))
      return NextResponse.json(
        { error: 'Identificador inválido.', code: 'INVALID_BARBERSHOP_ID' },
        { status: 400 },
      );
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object')
      return NextResponse.json(
        { error: 'Payload inválido.', code: 'INVALID_PAYLOAD' },
        { status: 400 },
      );
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 120)
      return NextResponse.json(
        {
          error:
            'O nome do barbeiro é obrigatório e deve ter no máximo 120 caracteres.',
          code: 'INVALID_NAME',
        },
        { status: 400 },
      );
    const commission = body.commission_percentage;
    if (
      commission !== undefined &&
      commission !== null &&
      (typeof commission !== 'number' ||
        !Number.isInteger(commission) ||
        commission < 0 ||
        commission > 100)
    )
      return NextResponse.json(
        {
          error: 'A comissão deve ser um número inteiro entre 0 e 100.',
          code: 'INVALID_COMMISSION',
        },
        { status: 400 },
      );
    if (body.active !== undefined && typeof body.active !== 'boolean')
      return NextResponse.json(
        { error: 'O campo active é inválido.', code: 'INVALID_ACTIVE' },
        { status: 400 },
      );

    const admin = createAdminClient();
    const authorization = await canManageProfessionals(
      admin,
      user.id,
      barbershopId,
    );
    if (!authorization.allowed)
      return NextResponse.json(
        {
          error:
            authorization.reason === 'BARBERSHOP_ACCESS_DENIED'
              ? 'Acesso negado a esta barbearia.'
              : 'Não tens permissão para gerir profissionais.',
          code: authorization.reason,
        },
        { status: 403 },
      );

    const { data, error } = await admin.rpc(
      'create_professional_with_plan_quota',
      {
        p_actor_user_id: user.id,
        p_barbershop_id: barbershopId,
        p_name: name,
        p_commission_percentage: commission ?? null,
        p_active: body.active ?? true,
      },
    );
    if (!error) return NextResponse.json({ data }, { status: 201 });

    switch (error.message) {
      case 'BARBERSHOP_ACCESS_DENIED':
        return NextResponse.json(
          {
            error: 'Acesso negado a esta barbearia.',
            code: 'BARBERSHOP_ACCESS_DENIED',
          },
          { status: 403 },
        );
      case 'PROFESSIONAL_MANAGEMENT_DENIED':
        console.warn(
          '[PROFESSIONAL_RPC_PERMISSION_STALE]',
          'compatibility path',
        );
        break;
      case 'PROFESSIONAL_LIMIT_REACHED':
        return NextResponse.json(
          {
            error: 'Atingiste o limite de profissionais do teu plano.',
            code: 'LIMIT_REACHED',
          },
          { status: 409 },
        );
      case 'INVALID_NAME':
      case 'INVALID_COMMISSION':
        return NextResponse.json(
          {
            error: 'Os dados do profissional são inválidos.',
            code: 'INVALID_INPUT',
          },
          { status: 400 },
        );
      default:
        console.error('[PROFESSIONAL_CREATE_ERROR]', error.code ?? 'UNKNOWN');
        return NextResponse.json(
          {
            error: 'Não foi possível criar o barbeiro.',
            code: 'CREATE_PROFESSIONAL_FAILED',
          },
          { status: 500 },
        );
    }

    const access = await getAccessPlanForRequest();
    if (!access.ok || access.userId !== user.id)
      return NextResponse.json(
        { error: 'Não autenticado.', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    const limit = getPlanLimit(access.plan, 'barbers');
    const { count, error: countError } = await admin
      .from('professionals')
      .select('id', { count: 'exact', head: true })
      .eq('barbershop_id', barbershopId);
    if (countError) {
      console.error(
        '[PROFESSIONAL_QUOTA_LOOKUP]',
        countError.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        {
          error: 'Não foi possível verificar o limite da equipa.',
          code: 'QUOTA_CHECK_FAILED',
        },
        { status: 500 },
      );
    }
    if (Number(count ?? 0) >= limit)
      return NextResponse.json(
        {
          error: 'Atingiste o limite de profissionais do teu plano.',
          code: 'LIMIT_REACHED',
        },
        { status: 409 },
      );

    const commissionForPlan =
      access.plan === 'free' ? 100 : (commission ?? 100);
    const { data: professional, error: insertError } = await admin
      .from('professionals')
      .insert({
        barbershop_id: barbershopId,
        name,
        commission_percentage: commissionForPlan,
        active: body.active ?? true,
      })
      .select()
      .single();
    if (insertError || !professional) {
      console.error(
        '[PROFESSIONAL_COMPAT_INSERT]',
        insertError?.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        {
          error: 'Não foi possível criar o barbeiro.',
          code: 'CREATE_PROFESSIONAL_FAILED',
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ data: professional }, { status: 201 });
  } catch (error) {
    console.error(
      '[PROFESSIONAL_CREATE_INTERNAL]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { error: 'Erro interno.', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

export const POST = withApiObservability('/api/barbershops/[barbershopId]/professionals', POST__unobserved);
