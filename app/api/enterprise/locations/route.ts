import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';
import { assertWithinLimit } from '@/lib/billing/entitlements';

export const runtime = 'nodejs';

async function GETHandler() {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'multi_location',
      'team',
    );
    const { data, error } = await admin
      .from('locations')
      .select('*')
      .eq('parent_barbershop_id', barbershopId)
      .order('name');
    if (error) throw error;
    return NextResponse.json({ locations: data ?? [] });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Unable to load locations' },
      { status: 500 },
    );
  }
}

async function POSTHandler(request: Request) {
  try {
    const { admin, barbershopId, plan } = await requireModuleContext(
      'multi_location',
      'team',
    );
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const slug =
      typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    if (name.length < 1 || name.length > 120 || !/^[a-z0-9-]+$/.test(slug))
      return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
    const { count, error: countError } = await admin
      .from('locations')
      .select('id', { count: 'exact', head: true })
      .eq('parent_barbershop_id', barbershopId);
    if (countError) throw countError;
    try {
      assertWithinLimit(plan, 'locations', count ?? 0);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : 'Location limit reached',
          code: 'LIMIT_REACHED',
        },
        { status: 403 },
      );
    }
    const { data, error } = await admin
      .from('locations')
      .insert({
        parent_barbershop_id: barbershopId,
        name,
        slug,
        phone: typeof body?.phone === 'string' ? body.phone.slice(0, 40) : null,
        address:
          typeof body?.address === 'string' ? body.address.slice(0, 500) : null,
      })
      .select('*')
      .single();
    if (error?.code === '23505')
      return NextResponse.json(
        { error: 'Location slug already exists' },
        { status: 409 },
      );
    if (error) throw error;
    return NextResponse.json({ location: data }, { status: 201 });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Unable to create location' },
      { status: 500 },
    );
  }
}

export const GET = withApiLogging('/api/enterprise/locations', GETHandler);
export const POST = withApiLogging('/api/enterprise/locations', POSTHandler);
