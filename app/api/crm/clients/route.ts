import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import {
  requireModuleContext,
  moduleErrorResponse,
} from '@/services/modules/authorization';

export const dynamic = 'force-dynamic';

async function GET__unobserved(req: Request) {
  try {
    const tenant = await requireModuleContext('clients', 'clients', req);
    const url = new URL(req.url);
    const search = url.searchParams.get('search')?.trim().slice(0, 80) ?? '';
    const parsedLimit = Number(url.searchParams.get('limit') ?? 50);
    const parsedOffset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 50;
    const offset = Number.isFinite(parsedOffset)
      ? Math.min(Math.max(Math.trunc(parsedOffset), 0), 100_000)
      : 0;

    const sort = ['name', 'visits', 'spent'].includes(url.searchParams.get('sort') ?? '')
      ? url.searchParams.get('sort')!
      : 'recent';
    let countQuery = tenant.admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('barbershop_id', tenant.barbershopId)
      .eq('role', 'client');

    if (search) {
      const escaped = search.replace(/[,%()]/g, ' ').trim();
      if (escaped)
        countQuery = countQuery.or(
          `name_complete.ilike.%${escaped}%,name.ilike.%${escaped}%,email.ilike.%${escaped}%,num_phone.ilike.%${escaped}%`,
        );
    }

    const [{ count, error: countError }, { data, error }] = await Promise.all([
      countQuery,
      tenant.admin.rpc('get_crm_clients_page', {
        p_barbershop_id: tenant.barbershopId,
        p_search: search,
        p_sort: sort,
        p_limit: limit,
        p_offset: offset,
      }),
    ]);
    if (countError || error) {
      console.error('[CRM_CLIENTS_LIST_ERROR]', countError?.code ?? error?.code ?? 'UNKNOWN');
      return NextResponse.json(
        { error: 'Não foi possível carregar os clientes.' },
        { status: 503 },
      );
    }
    const clients = (data ?? []).map((client) => ({
      id: client.client_id,
      name_complete: client.name_complete,
      name: client.name,
      email: client.email,
      num_phone: client.num_phone,
      birth_date: client.birth_date,
      style_notes: client.style_notes,
      created_at: client.created_at,
      appointment_count: Number(client.appointment_count ?? 0),
      total_spent: Number(client.total_spent ?? 0),
      last_visit: client.last_visit ?? null,
    }));
    return NextResponse.json(
      { clients, total: count ?? 0, limit, offset, sort },
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

export const GET = withApiObservability('/api/crm/clients', GET__unobserved);
