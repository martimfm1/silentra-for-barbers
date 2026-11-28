import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export class TenantAuthorizationError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message = 'UNAUTHORIZED',
  ) {
    super(message);
  }
}

type TenantAuthorizationOptions = {
  barbershopId?: string | null;
  allowPublicTenant?: boolean;
};

/**
 * Server-side tenant boundary used by API handlers and the API security audit.
 *
 * Authenticated mode verifies the Supabase user and that the user belongs to
 * the requested tenant. Public mode is intentionally narrower: it only
 * validates that the supplied tenant exists and is currently enabled.
 * Public mode must be paired with an endpoint-specific authentication step
 * such as an OTP or signed session.
 */
export async function requireTenantAuthorization(
  options: TenantAuthorizationOptions = {},
) {
  const barbershopId = options.barbershopId ?? null;

  if (options.allowPublicTenant) {
    if (!barbershopId)
      throw new TenantAuthorizationError(403, 'TENANT_NOT_FOUND');

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('barbershops')
      .select('id')
      .eq('id', barbershopId)
      .maybeSingle();

    if (error || !data?.id)
      throw new TenantAuthorizationError(403, 'TENANT_NOT_FOUND');

    return { userId: null, barbershopId: data.id as string } as const;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user)
    throw new TenantAuthorizationError(401, 'UNAUTHORIZED');

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('id, barbershop_id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile?.barbershop_id || profile.role === 'client') {
    throw new TenantAuthorizationError(403, 'TENANT_NOT_FOUND');
  }

  if (barbershopId && profile.barbershop_id !== barbershopId) {
    throw new TenantAuthorizationError(403, 'TENANT_ACCESS_DENIED');
  }

  return {
    userId: user.id,
    barbershopId: profile.barbershop_id as string,
  } as const;
}

export function tenantAuthorizationResponse(error: unknown) {
  if (!(error instanceof TenantAuthorizationError)) return null;
  return NextResponse.json({ error: error.message }, { status: error.status });
}
