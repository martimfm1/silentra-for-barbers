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

export async function requireModuleContext(
  feature: FeatureKey,
  permission?: string,
  request?: Request,
) {
  const acceptedPermissions = permission
    ? (PERMISSION_ALIASES[permission] ?? [permission])
    : [];
  const access = await getAccessPlanForRequest(request, acceptedPermissions);
  if (!access.ok) throw new ModuleAuthorizationError('UNAUTHORIZED');

  try {
    assertFeature(access.plan, feature);
  } catch {
    throw new ModuleAuthorizationError('FEATURE_NOT_INCLUDED');
  }

  if (!access.barbershopId)
    throw new ModuleAuthorizationError('FORBIDDEN');

  const role = String(access.role ?? 'barber').toLowerCase();

  // Owner is the tenant administrator. Other team members must have an
  // explicit canonical permission, falling back to legacy grants only when
  // no canonical permissions row exists.
  if (permission && role !== 'owner' && !access.permissionGranted)
    throw new ModuleAuthorizationError('PERMISSION_DENIED');

  return {
    userId: access.userId,
    barbershopId: access.barbershopId,
    role,
    plan: access.plan,
    admin: createAdminClient(),
  };
}
export function moduleErrorResponse(error: unknown) {
  if (!(error instanceof ModuleAuthorizationError)) return null;
  const status = error.code === 'UNAUTHORIZED' ? 401 : 403;
  return Response.json({ error: error.code }, { status });
}
