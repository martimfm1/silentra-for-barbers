import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { UUID_PATTERN } from '@/lib/validation';
import { assertWithinLimit } from '@/lib/billing/entitlements';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

export const runtime = 'nodejs';

async function contextFor(barbershopId: string) {
  if (!UUID_PATTERN.test(barbershopId))
    return {
      response: NextResponse.json(
        { error: 'Identificador inválido.' },
        { status: 400 },
      ),
    };
  try {
    const context = await requireModuleContext('multi_location', 'team');
    if (context.barbershopId !== barbershopId)
      return {
        response: NextResponse.json(
          { error: 'Acesso negado.' },
          { status: 403 },
        ),
      };
    return context;
  } catch (error) {
    const response = moduleErrorResponse(error);
    return {
      response:
        response ??
        NextResponse.json({ error: 'Erro interno.' }, { status: 500 }),
    };
  }
}

async function GET__unobserved(
  _request: Request,
  { params }: { params: Promise<{ barbershopId: string }> },
) {
  const { barbershopId } = await params;
  const context = await contextFor(barbershopId);
  if ('response' in context) return context.response;
  const { data, error } = await context.admin
    .from('locations')
    .select('*')
    .eq('parent_barbershop_id', barbershopId)
    .order('created_at', { ascending: true });
  if (error)
    return NextResponse.json(
      { error: 'Não foi possível carregar as localizações.' },
      { status: 500 },
    );
  return NextResponse.json({ data: data ?? [] });
}

async function POST__unobserved(
  request: Request,
  { params }: { params: Promise<{ barbershopId: string }> },
) {
  const { barbershopId } = await params;
  const context = await contextFor(barbershopId);
  if ('response' in context) return context.response;
  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const slug =
    typeof body?.slug === 'string'
      ? body.slug.trim().toLowerCase()
      : name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
  if (!name || name.length > 120 || !slug || !/^[a-z0-9-]+$/.test(slug))
    return NextResponse.json(
      { error: 'Nome ou slug inválido.' },
      { status: 400 },
    );

  const { count, error: countError } = await context.admin
    .from('locations')
    .select('id', { count: 'exact', head: true })
    .eq('parent_barbershop_id', barbershopId);
  if (countError)
    return NextResponse.json(
      { error: 'Não foi possível validar o limite.' },
      { status: 500 },
    );
  try {
    assertWithinLimit(context.plan, 'locations', count ?? 0);
  } catch (error) {
    return NextResponse.json(
      {
        code: 'PLAN_LIMIT_REACHED',
        error:
          error instanceof Error
            ? error.message
            : 'Limite de localizações atingido.',
      },
      { status: 409 },
    );
  }

  const { data, error } = await context.admin
    .from('locations')
    .insert({
      parent_barbershop_id: barbershopId,
      name,
      slug,
      phone: typeof body?.phone === 'string' ? body.phone.trim() || null : null,
      address:
        typeof body?.address === 'string' ? body.address.trim() || null : null,
      opening_time:
        typeof body?.opening_time === 'string' ? body.opening_time : null,
      closing_time:
        typeof body?.closing_time === 'string' ? body.closing_time : null,
    })
    .select('*')
    .single();
  if (error?.code === '23505')
    return NextResponse.json({ error: 'Slug já existe.' }, { status: 409 });
  if (error)
    return NextResponse.json(
      { error: 'Não foi possível criar a localização.' },
      { status: 500 },
    );
  return NextResponse.json({ data }, { status: 201 });
}

async function PATCH__unobserved(
  request: Request,
  { params }: { params: Promise<{ barbershopId: string }> },
) {
  const { barbershopId } = await params;
  const context = await contextFor(barbershopId);
  if ('response' in context) return context.response;
  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!UUID_PATTERN.test(id))
    return NextResponse.json(
      { error: 'Localização inválida.' },
      { status: 400 },
    );
  const updates: Record<string, unknown> = {};
  for (const key of [
    'name',
    'phone',
    'address',
    'opening_time',
    'closing_time',
  ])
    if (body?.[key] !== undefined) updates[key] = body[key];
  if (body?.active !== undefined) updates.active = Boolean(body.active);
  updates.updated_at = new Date().toISOString();
  const { data, error } = await context.admin
    .from('locations')
    .update(updates)
    .eq('id', id)
    .eq('parent_barbershop_id', barbershopId)
    .select('*')
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { error: 'Não foi possível atualizar a localização.' },
      { status: 500 },
    );
  if (!data)
    return NextResponse.json(
      { error: 'Localização não encontrada.' },
      { status: 404 },
    );
  return NextResponse.json({ data });
}

async function DELETE__unobserved(
  request: Request,
  { params }: { params: Promise<{ barbershopId: string }> },
) {
  const { barbershopId } = await params;
  const context = await contextFor(barbershopId);
  if ('response' in context) return context.response;
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!UUID_PATTERN.test(id))
    return NextResponse.json(
      { error: 'Localização inválida.' },
      { status: 400 },
    );
  const { data, error } = await context.admin
    .from('locations')
    .delete()
    .eq('id', id)
    .eq('parent_barbershop_id', barbershopId)
    .select('id')
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { error: 'Não foi possível remover a localização.' },
      { status: 500 },
    );
  if (!data)
    return NextResponse.json(
      { error: 'Localização não encontrada.' },
      { status: 404 },
    );
  return NextResponse.json({ success: true });
}

export const GET = withApiObservability('/api/barbershops/[barbershopId]/locations', GET__unobserved);
export const POST = withApiObservability('/api/barbershops/[barbershopId]/locations', POST__unobserved);
export const PATCH = withApiObservability('/api/barbershops/[barbershopId]/locations', PATCH__unobserved);
export const DELETE = withApiObservability('/api/barbershops/[barbershopId]/locations', DELETE__unobserved);
