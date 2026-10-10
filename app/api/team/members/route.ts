import { withApiObservability } from '@/lib/observability/api';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';

const TEAM_VIEW_ROLES = ['owner', 'admin', 'manager'] as const;
const TEAM_MEMBER_ROLES = [
  'owner',
  'admin',
  'manager',
  'barber',
  'receptionist',
  'staff',
] as const;
const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  dashboard: true,
  agenda: true,
  clients: true,
  services: false,
  team: false,
  messages: false,
  marketing: false,
  loyalty: false,
  automations: false,
  analytics: false,
  qr: false,
  settings: false,
  billing: false,
};

function defaultPermissionsForRole(role: string) {
  if (role === 'barber') {
    return {
      ...DEFAULT_PERMISSIONS,
      agenda: true,
      clients: true,
      services: true,
    };
  }
  return { ...DEFAULT_PERMISSIONS };
}

async function GET__unobserved(request: Request) {
  const tenant = await requireTenantAuthorization(request, TEAM_VIEW_ROLES);
  if (!tenant.ok) {
    return NextResponse.json(
      {
        error:
          tenant.status === 401
            ? 'Nao autorizado'
            : 'Sem permissao para ver a equipa.',
      },
      { status: tenant.status },
    );
  }

  if (tenant.role !== 'owner') {
    const { data: grant } = await tenant.admin
      .from('barbershop_member_permissions')
      .select('permissions')
      .eq('barbershop_id', tenant.barbershopId)
      .eq('user_id', tenant.userId)
      .maybeSingle();
    if (!Boolean(grant?.permissions?.team)) {
      return NextResponse.json(
        { error: 'Sem permissao para ver a equipa.' },
        { status: 403 },
      );
    }
  }

  const [
    { data: members, error: membersError },
    { data: permissionRows, error: permissionsError },
    { data: inviteRows, error: invitesError },
    { data: professionals, error: professionalsError },
    { data: teamCount, error: teamCountError },
    { data: teamLimit, error: teamLimitError },
  ] = await Promise.all([
    tenant.admin
      .from('users')
      .select('id, name_complete, email, num_phone, role')
      .eq('barbershop_id', tenant.barbershopId)
      .in('role', [...TEAM_MEMBER_ROLES]),
    tenant.admin
      .from('barbershop_member_permissions')
      .select('user_id, permissions')
      .eq('barbershop_id', tenant.barbershopId),
    tenant.admin
      .from('barbershop_invite_codes')
      .select('used_by, used_at')
      .eq('barbershop_id', tenant.barbershopId)
      .not('used_by', 'is', null),
    tenant.admin
      .from('professionals')
      .select('id, user_id, name, commission_percentage, active')
      .eq('barbershop_id', tenant.barbershopId),
    tenant.admin.rpc('get_effective_team_member_count', {
      p_barbershop_id: tenant.barbershopId,
    }),
    tenant.admin.rpc('get_effective_team_limit', {
      p_barbershop_id: tenant.barbershopId,
    }),
  ]);

  if (
    membersError ||
    permissionsError ||
    invitesError ||
    professionalsError ||
    teamCountError ||
    teamLimitError
  ) {
    console.error('[TEAM_MEMBERS_LIST_FAIL]', {
      members: membersError?.message,
      permissions: permissionsError?.message,
      invites: invitesError?.message,
      professionals: professionalsError?.message,
      teamCount: teamCountError?.message,
      teamLimit: teamLimitError?.message,
    });
    return NextResponse.json(
      { error: 'Nao foi possivel carregar os membros.' },
      { status: 500 },
    );
  }

  const permissionsByUser = new Map(
    (permissionRows ?? []).map((row) => [row.user_id, row.permissions ?? {}]),
  );
  const inviteByUser = new Map<string, string>();
  for (const invite of inviteRows ?? []) {
    if (
      invite.used_by &&
      (!inviteByUser.has(invite.used_by) ||
        invite.used_at < inviteByUser.get(invite.used_by)!)
    ) {
      inviteByUser.set(invite.used_by, invite.used_at);
    }
  }

  const professionalByUser = new Map(
    (professionals ?? [])
      .filter((professional) => professional.user_id)
      .map((professional) => [professional.user_id!, professional]),
  );

  const orderedMembers = [...(members ?? [])].sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1;
    if (a.role !== 'owner' && b.role === 'owner') return 1;
    return (a.name_complete || a.email || '').localeCompare(
      b.name_complete || b.email || '',
    );
  });

  const professionalCount = (professionals ?? []).length;
  const professionalActiveCount = (professionals ?? []).filter(
    (professional) => professional.active !== false,
  ).length;
  const professionalLimit = Number(teamLimit ?? 1);
  const unlimited = professionalLimit >= 2147483647;

  return NextResponse.json(
    {
      members: orderedMembers.map((member) => ({
        user_id: member.id,
        name_complete: member.name_complete,
        email: member.email,
        num_phone: member.num_phone,
        role: member.role,
        joined_via_code: inviteByUser.has(member.id),
        joined_at: inviteByUser.get(member.id) ?? null,
        professional: professionalByUser.get(member.id) ?? null,
        permissions: {
          ...defaultPermissionsForRole(member.role),
          ...(permissionsByUser.get(member.id) ?? {}),
        },
      })),
      // `seats` is intentionally the barber/professional quota consumed by the
      // dashboard's team management UI. This is the same pool enforced when a
      // professional profile is created.
      seats: {
        used: professionalCount,
        limit: professionalLimit,
        unlimited,
      },
      // Keep the actual membership count available for permission/member views.
      teamSeats: {
        used: Number(teamCount ?? 0),
        limit: Number(teamLimit ?? 1),
        unlimited: Number(teamLimit ?? 1) >= 2147483647,
      },
      barberSeats: {
        used: professionalCount,
        active: professionalActiveCount,
        limit: professionalLimit,
        unlimited,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

async function PATCH__unobserved(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (typeof body?.userId !== 'string' || typeof body?.role !== 'string')
    return NextResponse.json({ error: 'Dados invalidos.' }, { status: 400 });
  const allowedRoles = new Set([
    'admin',
    'manager',
    'barber',
    'receptionist',
    'staff',
  ]);
  if (!allowedRoles.has(body.role))
    return NextResponse.json({ error: 'Funcao invalida.' }, { status: 400 });
  const permissions =
    body.permissions &&
    typeof body.permissions === 'object' &&
    !Array.isArray(body.permissions)
      ? body.permissions
      : {};
  const { error } = await supabase.rpc('update_barbershop_member', {
    p_user_id: body.userId,
    p_role: body.role,
    p_permissions: permissions,
  });
  if (error) {
    console.error('[TEAM_MEMBER_UPDATE_FAIL]', error);
    if (error.code === '42501')
      return NextResponse.json(
        { error: 'So o proprietario pode alterar funcoes e permissoes.' },
        { status: 403 },
      );
    if (error.message === 'TEAM_MEMBER_LIMIT_REACHED')
      return NextResponse.json(
        {
          error:
            'O plano da barbearia não tem lugares disponíveis para esta equipa.',
        },
        { status: 409 },
      );
    if (error.message === 'PROFESSIONAL_LIMIT_REACHED')
      return NextResponse.json(
        { error: 'Não existem lugares de barbeiro disponíveis neste plano.' },
        { status: 409 },
      );
    return NextResponse.json(
      {
        error:
          error.message === 'owner_role_is_immutable'
            ? 'A funcao do proprietario nao pode ser alterada.'
            : 'Nao foi possivel atualizar o membro.',
      },
      { status: 400 },
    );
  }
  return NextResponse.json({ success: true });
}

async function DELETE__unobserved(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (typeof body?.userId !== 'string')
    return NextResponse.json({ error: 'Dados invalidos.' }, { status: 400 });
  const { error } = await supabase.rpc('remove_barbershop_member', {
    p_user_id: body.userId,
  });
  if (error) {
    console.error('[TEAM_MEMBER_REMOVE_FAIL]', error);
    if (error.code === '42501')
      return NextResponse.json(
        { error: 'So o proprietario pode remover membros.' },
        { status: 403 },
      );
    return NextResponse.json(
      {
        error:
          error.message === 'owner_role_is_immutable'
            ? 'O proprietario nao pode ser removido.'
            : 'Nao foi possivel remover o membro.',
      },
      { status: 400 },
    );
  }
  return NextResponse.json({ success: true });
}

export const GET = withApiObservability('/api/team/members', GET__unobserved);
export const PATCH = withApiObservability(
  '/api/team/members',
  PATCH__unobserved,
);
export const DELETE = withApiObservability(
  '/api/team/members',
  DELETE__unobserved,
);
