import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

export const runtime = 'nodejs';
const PERMISSIONS = [
  'appointments',
  'clients',
  'services',
  'analytics',
  'marketing',
  'loyalty',
  'inventory',
  'pos',
  'commissions',
  'billing',
  'team',
] as const;

async function GETHandler(request: Request) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'advanced_permissions',
      'team',
    );
    const userId = new URL(request.url).searchParams.get('userId');
    const query = admin
      .from('staff_permissions')
      .select('id,user_id,permission,allowed,created_at')
      .eq('barbershop_id', barbershopId);
    const { data, error } = await (userId ? query.eq('user_id', userId) : query)
      .order('user_id')
      .order('permission');
    if (error) throw error;
    return NextResponse.json({ permissions: data ?? [] });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Unable to load permissions' },
      { status: 500 },
    );
  }
}

async function PUTHandler(request: Request) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'advanced_permissions',
      'team',
    );
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const userId = typeof body?.userId === 'string' ? body.userId : '';
    const permission =
      typeof body?.permission === 'string' ? body.permission : '';
    if (
      !userId ||
      !PERMISSIONS.includes(permission as (typeof PERMISSIONS)[number]) ||
      typeof body?.allowed !== 'boolean'
    )
      return NextResponse.json(
        { error: 'Invalid permission' },
        { status: 400 },
      );
    const { data: target } = await admin
      .from('users')
      .select('id,barbershop_id')
      .eq('id', userId)
      .maybeSingle();
    if (!target || target.barbershop_id !== barbershopId)
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const { data, error } = await admin
      .from('staff_permissions')
      .upsert(
        {
          barbershop_id: barbershopId,
          user_id: userId,
          permission,
          allowed: body.allowed,
        },
        { onConflict: 'user_id,permission' },
      )
      .select('id,user_id,permission,allowed,created_at')
      .single();
    if (error) throw error;
    return NextResponse.json({ permission: data });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Unable to update permission' },
      { status: 500 },
    );
  }
}

export const GET = withApiLogging('/api/enterprise/permissions', GETHandler);
export const PUT = withApiLogging('/api/enterprise/permissions', PUTHandler);
