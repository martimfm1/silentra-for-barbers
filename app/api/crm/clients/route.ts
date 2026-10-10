import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import {
  requireModuleContext,
  moduleErrorResponse,
} from '@/services/modules/authorization';

export const dynamic = 'force-dynamic';

async function GETHandler(req: Request) {
  try {
    const tenant = await requireModuleContext('clients', 'clients');
    const url = new URL(req.url);
    const search = url.searchParams.get('search')?.trim() ?? '';
    const parsedLimit = Number(url.searchParams.get('limit') ?? 50);
    const parsedOffset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 50;
    const offset = Number.isFinite(parsedOffset)
      ? Math.max(parsedOffset, 0)
      : 0;

    let query = tenant.admin
      .from('users')
      .select('id,name_complete,name,email,num_phone,style_notes,created_at', {
        count: 'exact',
      })
      .eq('barbershop_id', tenant.barbershopId)
      .eq('role', 'client')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      const escaped = search.replace(/[,%()]/g, ' ').trim();
      if (escaped)
        query = query.or(
          `name_complete.ilike.%${escaped}%,name.ilike.%${escaped}%,email.ilike.%${escaped}%,num_phone.ilike.%${escaped}%`,
        );
    }

    const { data, count, error } = await query;
    if (error) {
      console.error('[CRM_CLIENTS_LIST_ERROR]', error);
      return NextResponse.json(
        { error: 'Não foi possível carregar os clientes.' },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { clients: data ?? [], total: count ?? 0, limit, offset },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const authorization = moduleErrorResponse(error);
    if (authorization) return authorization;
    console.error('[CRM_CLIENTS_INTERNAL_ERROR]', error);
    return NextResponse.json(
      { error: 'Não foi possível carregar os clientes.' },
      { status: 500 },
    );
  }
}


export const GET = withApiLogging('/api/crm/clients', GETHandler);
