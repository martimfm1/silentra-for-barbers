import { createAdminClient } from '@/lib/supabase/admin';
import { getAccessPlanForRequest } from '@/services/billing/plan-access.guard';
import { assertFeature } from '@/lib/billing/entitlements';
import type { FeatureKey } from '@/lib/billing/plan-features';

export class ModuleAuthorizationError extends Error {
  constructor(
    public readonly code:
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'FEATURE_NOT_INCLUDED'
      | 'PERMISSION_DENIED',
  ) {
    super(code);
  }
}

/**
 * Module permission aliases map backend module names to the keys stored by the
 * Team & Permissions UI. `barbershop_member_permissions` is canonical; the
 * legacy `staff_permissions` table is only a fallback for members that do not
 * yet have a canonical permission record.
 */
const PERMISSION_ALIASES: Record<string, readonly string[]> = {
  appointments: ['agenda', 'appointments'],
  agenda: ['agenda', 'appointments'],
  clients: ['clients'],
  services: ['services'],
  manage_professionals: [
    'team',
    'manage_professionals',
    'team_management',
    'manage_team',
    'professionals',
  ],
  team: ['team'],
  manage_messages: ['messages', 'manage_messages', 'send_messages'],
  messages: ['messages', 'manage_messages', 'send_messages'],
  marketing: ['marketing'],
  loyalty: ['loyalty'],
  automated_followups: ['automations', 'automated_followups'],
  automations: ['automations', 'automated_followups'],
  analytics: ['analytics', 'dashboard'],
  dashboard: ['dashboard'],
  qr: ['qr'],
  settings: ['settings'],
  billing: ['billing'],
};

function jsonPermissionGranted(
  permissions: unknown,
  acceptedPermissions: readonly string[],
) {
  if (
    !permissions ||
    typeof permissions !== 'object' ||
    Array.isArray(permissions)
  )
    return false;
  const record = permissions as Record<string, unknown>;
  return acceptedPermissions.some((permission) => record[permission] === true);
}

async function hasMemberPermission(
  admin: ReturnType<typeof createAdminClient>,
  barbershopId: string,
  userId: string,
  acceptedPermissions: readonly string[],
): Promise<boolean> {
  const { data: memberGrant, error: memberPermissionError } = await admin
    .from('barbershop_member_permissions')
    .select('permissions')
    .eq('barbershop_id', barbershopId)
    .eq('user_id', userId)
    .maybeSingle();

  if (memberPermissionError) {
    console.error('[MODULE_MEMBER_PERMISSION_LOOKUP]', memberPermissionError);
  }

  // Once a canonical permission row exists, its values are authoritative.
  if (memberGrant)
    return jsonPermissionGranted(memberGrant.permissions, acceptedPermissions);

  // Compatibility fallback for legacy staff permission rows.
  const { data: staffGrant, error: staffPermissionError } = await admin
    .from('staff_permissions')
    .select('allowed')
    .eq('barbershop_id', barbershopId)
    .eq('user_id', userId)
    .in('permission', acceptedPermissions)
    .eq('allowed', true)
    .limit(1)
    .maybeSingle();

  if (staffPermissionError) {
    console.error('[MODULE_STAFF_PERMISSION_LOOKUP]', staffPermissionError);
    return false;
  }

  return Boolean(staffGrant?.allowed);
}

export async function requireModuleContext(
  feature: FeatureKey,
  permission?: string,
  request?: Request,
) {
  const access = await getAccessPlanForRequest(request);
  if (!access.ok) throw new ModuleAuthorizationError('UNAUTHORIZED');

  try {
    assertFeature(access.plan, feature);
  } catch {
    throw new ModuleAuthorizationError('FEATURE_NOT_INCLUDED');
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('users')
    .select('id, barbershop_id, role')
    .eq('id', access.userId)
    .maybeSingle();

  if (error || !profile?.barbershop_id)
    throw new ModuleAuthorizationError('FORBIDDEN');

  const role = String(profile.role ?? 'barber').toLowerCase();

  // Owner is the tenant administrator and retains full access to the modules
  // granted by the barbershop plan. Everyone else is controlled by the saved
  // Team & Permissions switches.
  if (permission && role !== 'owner') {
    const acceptedPermissions = PERMISSION_ALIASES[permission] ?? [permission];
    const granted = await hasMemberPermission(
      admin,
      profile.barbershop_id,
      access.userId,
      acceptedPermissions,
    );
    if (!granted) throw new ModuleAuthorizationError('PERMISSION_DENIED');
  }

  return {
    userId: access.userId,
    barbershopId: profile.barbershop_id as string,
    role: profile.role ?? 'barber',
    plan: access.plan,
    admin,
  };
}

export function moduleErrorResponse(error: unknown) {
  if (!(error instanceof ModuleAuthorizationError)) return null;
  const status = error.code === 'UNAUTHORIZED' ? 401 : 403;
  return Response.json({ error: error.code }, { status });
}
