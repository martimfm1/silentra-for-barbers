import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { requireModuleFeature } from '@/services/billing/module-guard';
import { getModuleFeature } from '@/services/modules/module-config';
import {
  requireTenantAuthorization,
  tenantAuthorizationResponse,
} from '@/lib/security/tenant-guard';

const MODULES = [
  'crm',
  'analytics',
  'reminders',
  'followups',
  'marketing',
  'segments',
  'loyalty',
  'reports',
  'team',
  'notifications',
  'locations',
  'global',
  'permissions',
  'commissions',
  'inventory',
  'pos',
  'enterpriseReports',
] as const;

async function GET__unobserved(request: Request) {
  try {
    await requireTenantAuthorization();
  } catch (error) {
    const response = tenantAuthorizationResponse(error);
    if (response) return response;
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const url = new URL(request.url);
  const requested = url.searchParams.get('module');

  if (requested) {
    if (!MODULES.includes(requested as (typeof MODULES)[number])) {
      return NextResponse.json({ error: 'MODULE_NOT_FOUND' }, { status: 404 });
    }

    const feature = getModuleFeature(requested);
    if (!feature)
      return NextResponse.json({ error: 'MODULE_NOT_FOUND' }, { status: 404 });

    const access = await requireModuleFeature(feature);
    if (!access.ok) {
      const error =
        access.status === 403 && 'error' in access
          ? access.error
          : 'UNAUTHORIZED';
      const plan = 'plan' in access && access.plan ? access.plan : undefined;
      return NextResponse.json(
        { error, feature, plan },
        { status: access.status },
      );
    }

    return NextResponse.json({
      module: requested,
      feature,
      enabled: true,
      plan: access.plan,
    });
  }

  let plan: string | null = null;
  const result: Record<string, boolean> = {};

  for (const moduleName of MODULES) {
    const feature = getModuleFeature(moduleName);
    if (!feature) continue;
    const access = await requireModuleFeature(feature);
    result[moduleName] = access.ok;
    if (access.ok) plan = access.plan;
    else if ('plan' in access && access.plan) plan = access.plan;
  }

  return NextResponse.json(
    { plan, modules: result },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export const GET = withApiObservability('/api/modules/access', GET__unobserved);
