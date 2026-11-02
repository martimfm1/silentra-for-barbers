import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { UUID_PATTERN } from '@/lib/validation';
import { readJsonObject } from '@/lib/security/request-validation';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

export const runtime = 'nodejs';

type Params = { params: Promise<{ clientId: string }> };

async function POST__unobserved(req: Request, { params }: Params) {
  try {
    const tenant = await requireModuleContext('advanced_crm', 'clients', req);
    const { clientId } = await params;
    if (!UUID_PATTERN.test(clientId)) {
      return NextResponse.json({ error: 'Identificador de cliente inválido.' }, { status: 400 });
    }
    const body = await readJsonObject(req, {
      maxBytes: 4 * 1024,
      allowedKeys: ['tagId'],
    });
    if (!body.ok) return body.response;
    const tagId = typeof body.value.tagId === 'string' ? body.value.tagId : '';
    if (!UUID_PATTERN.test(tagId)) {
      return NextResponse.json({ error: 'Identificador de etiqueta inválido.' }, { status: 400 });
    }
    const [{ data: client }, { data: tag }] = await Promise.all([
      tenant.admin.from('users').select('id').eq('id', clientId)
        .eq('barbershop_id', tenant.barbershopId).eq('role', 'client').maybeSingle(),
      tenant.admin.from('customer_tags').select('id').eq('id', tagId)
        .eq('barbershop_id', tenant.barbershopId).maybeSingle(),
    ]);
    if (!client || !tag) {
      return NextResponse.json({ error: 'Cliente ou etiqueta não encontrados.' }, { status: 404 });
    }
    const { error } = await tenant.admin.from('customer_tag_assignments').insert({
      client_id: clientId,
      tag_id: tagId,
      barbershop_id: tenant.barbershopId,
    });
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Esta etiqueta já está associada ao cliente.' }, { status: 409 });
    }
    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    const authorization = moduleErrorResponse(error);
    if (authorization) return authorization;
    console.error('[CRM_CLIENT_TAG_ASSIGN_ERROR]', error instanceof Error ? error.name : 'UNKNOWN');
    return NextResponse.json({ error: 'Não foi possível associar a etiqueta.' }, { status: 500 });
  }
}

async function DELETE__unobserved(req: Request, { params }: Params) {
  try {
    const tenant = await requireModuleContext('advanced_crm', 'clients', req);
    const { clientId } = await params;
    const tagId = new URL(req.url).searchParams.get('tagId') ?? '';
    if (!UUID_PATTERN.test(clientId) || !UUID_PATTERN.test(tagId)) {
      return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });
    }
    const { error } = await tenant.admin.from('customer_tag_assignments').delete()
      .eq('client_id', clientId)
      .eq('tag_id', tagId)
      .eq('barbershop_id', tenant.barbershopId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const authorization = moduleErrorResponse(error);
    if (authorization) return authorization;
    console.error('[CRM_CLIENT_TAG_REMOVE_ERROR]', error instanceof Error ? error.name : 'UNKNOWN');
    return NextResponse.json({ error: 'Não foi possível remover a etiqueta.' }, { status: 500 });
  }
}

export const POST = withApiObservability('/api/crm/clients/[clientId]/tags', POST__unobserved);
export const DELETE = withApiObservability('/api/crm/clients/[clientId]/tags', DELETE__unobserved);
