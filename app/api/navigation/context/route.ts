import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const TEAM_ROLES = [
  'owner',
  'admin',
  'manager',
  'barber',
  'receptionist',
  'staff',
] as const;
type TeamRole = (typeof TEAM_ROLES)[number];
type NavigationRole = TeamRole | 'client';

function normalizeRole(value: unknown): TeamRole | 'client' {
  const role = String(value ?? '').toLowerCase();
  return (TEAM_ROLES as readonly string[]).includes(role)
    ? (role as TeamRole)
    : 'client';
}

const ROLE_PERMISSIONS: Record<TeamRole, string[]> = {
  owner: [
    'dashboard',
    'agenda',
    'clients',
    'services',
    'team',
    'messages',
    'marketing',
    'loyalty',
    'automations',
    'analytics',
    'qr',
    'settings',
    'billing',
  ],
  admin: [
    'dashboard',
    'agenda',
    'clients',
    'services',
    'team',
    'messages',
    'marketing',
    'loyalty',
    'automations',
    'analytics',
    'qr',
    'settings',
  ],
  manager: [
    'dashboard',
    'agenda',
    'clients',
    'services',
    'messages',
    'loyalty',
    'analytics',
    'qr',
  ],
  barber: ['dashboard', 'agenda', 'clients', 'services', 'loyalty'],
  receptionist: ['dashboard', 'agenda', 'clients', 'services', 'messages'],
  staff: ['dashboard', 'agenda', 'clients'],
};

async function GET__unobserved() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('id, barbershop_id, role, name_complete, email')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[NAVIGATION_CONTEXT_LOOKUP]', profileError);
    return NextResponse.json({
      authenticated: true,
      role: 'client',
      permissions: [],
    });
  }

  const role = normalizeRole(profile?.role);
  const barbershopId = profile?.barbershop_id ?? null;

  if (role === 'client' || !barbershopId) {
    return NextResponse.json(
      {
        authenticated: true,
        userId: user.id,
        role: 'client',
        barbershopId: null,
        permissions: [],
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
          Vary: 'Cookie',
        },
      },
    );
  }

  let permissions = [...ROLE_PERMISSIONS[role]];

  if (role !== 'owner') {
    const { data: memberGrant, error: permissionError } = await admin
      .from('barbershop_member_permissions')
      .select('permissions')
      .eq('barbershop_id', barbershopId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (permissionError) {
      console.error('[NAVIGATION_MEMBER_PERMISSION_LOOKUP]', permissionError);
    }

    if (
      memberGrant?.permissions &&
      typeof memberGrant.permissions === 'object' &&
      !Array.isArray(memberGrant.permissions)
    ) {
      const stored = memberGrant.permissions as Record<string, unknown>;
      permissions = permissions.filter(
        (permission) => stored[permission] !== false,
      );
      for (const [permission, enabled] of Object.entries(stored)) {
        if (enabled === true && !permissions.includes(permission))
          permissions.push(permission);
      }
    }
  }

  return NextResponse.json(
    {
      authenticated: true,
      userId: user.id,
      role,
      barbershopId,
      permissions,
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        Vary: 'Cookie',
      },
    },
  );
}

export const GET = withApiObservability('/api/navigation/context', GET__unobserved);
