import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { requireModuleContext } from '@/services/modules/authorization';

function uuid(value: unknown): string | null {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}

async function GETHandler() {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'loyalty',
      'loyalty',
    );
    const [
      { data: rules, error: rulesError },
      { data: services, error: servicesError },
    ] = await Promise.all([
      admin
        .from('loyalty_earning_rules')
        .select('id,name,service_id,points,active,created_at,updated_at')
        .eq('barbershop_id', barbershopId)
        .order('created_at', { ascending: false }),
      admin
        .from('services')
        .select('id,name,price,duration')
        .eq('barbershop_id', barbershopId)
        .order('name', { ascending: true }),
    ]);
    if (rulesError) throw rulesError;
    if (servicesError) throw servicesError;
    return NextResponse.json(
      { rules: rules ?? [], services: services ?? [] },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível carregar as regras de pontos.' },
      { status: 500 },
    );
  }
}

async function POSTHandler(request: Request) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'loyalty',
      'loyalty',
    );
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const name =
      typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const serviceId = uuid(body.serviceId);
    const points = Math.floor(Number(body.points));
    const active = body.active !== false;
    if (
      !name ||
      !serviceId ||
      !Number.isInteger(points) ||
      points <= 0 ||
      points > 100000
    )
      return NextResponse.json({ error: 'Regra inválida.' }, { status: 400 });

    const { data: service } = await admin
      .from('services')
      .select('id,name')
      .eq('id', serviceId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();
    if (!service)
      return NextResponse.json({ error: 'Serviço inválido.' }, { status: 400 });

    const { data, error } = await admin
      .from('loyalty_earning_rules')
      .insert({
        barbershop_id: barbershopId,
        name,
        service_id: serviceId,
        points,
        active,
      })
      .select('id,name,service_id,points,active,created_at,updated_at')
      .single();
    if (error) throw error;
    return NextResponse.json({ rule: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível criar a regra.' },
      { status: 500 },
    );
  }
}

async function PATCHHandler(request: Request) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'loyalty',
      'loyalty',
    );
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const id = uuid(body.id);
    if (!id)
      return NextResponse.json({ error: 'Regra inválida.' }, { status: 400 });
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.name !== undefined)
      patch.name =
        typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
    if (body.points !== undefined)
      patch.points = Math.floor(Number(body.points));
    if (body.active !== undefined) patch.active = body.active === true;
    if (body.serviceId !== undefined) patch.service_id = uuid(body.serviceId);
    if (
      typeof patch.points === 'number' &&
      (!Number.isInteger(patch.points) ||
        patch.points <= 0 ||
        patch.points > 100000)
    )
      return NextResponse.json({ error: 'Pontos inválidos.' }, { status: 400 });

    if (patch.service_id) {
      const { data: service } = await admin
        .from('services')
        .select('id')
        .eq('id', patch.service_id)
        .eq('barbershop_id', barbershopId)
        .maybeSingle();
      if (!service)
        return NextResponse.json(
          { error: 'Serviço inválido.' },
          { status: 400 },
        );
    }

    const { data, error } = await admin
      .from('loyalty_earning_rules')
      .update(patch)
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .select('id,name,service_id,points,active,created_at,updated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return NextResponse.json(
        { error: 'Regra não encontrada.' },
        { status: 404 },
      );
    return NextResponse.json({ rule: data });
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível atualizar a regra.' },
      { status: 500 },
    );
  }
}

async function DELETEHandler(request: Request) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'loyalty',
      'loyalty',
    );
    const id = uuid(new URL(request.url).searchParams.get('id'));
    if (!id)
      return NextResponse.json({ error: 'Regra inválida.' }, { status: 400 });
    const { error } = await admin
      .from('loyalty_earning_rules')
      .delete()
      .eq('id', id)
      .eq('barbershop_id', barbershopId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível eliminar a regra.' },
      { status: 500 },
    );
  }
}

export const GET = withApiLogging('/api/loyalty/earning-rules', GETHandler);
export const POST = withApiLogging('/api/loyalty/earning-rules', POSTHandler);
export const PATCH = withApiLogging('/api/loyalty/earning-rules', PATCHHandler);
export const DELETE = withApiLogging(
  '/api/loyalty/earning-rules',
  DELETEHandler,
);
