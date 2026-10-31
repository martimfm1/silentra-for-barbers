import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { UUID_PATTERN } from '@/lib/validation';
import { readJsonObject } from '@/lib/security/request-validation';
import {
  requireModuleContext,
  moduleErrorResponse,
} from '@/services/modules/authorization';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ clientId: string }> };

async function POST__unobserved(req: Request, { params }: Params) {
  try {
    const tenant = await requireModuleContext('clients', 'clients', req);
    const { clientId } = await params;
    if (!UUID_PATTERN.test(clientId)) {
      return NextResponse.json(
        { error: 'Identificador de cliente inválido.' },
        { status: 400 },
      );
    }

    const payload = await readJsonObject(req, {
      maxBytes: 24 * 1024,
      allowedKeys: ['content'],
    });
    if (!payload.ok) return payload.response;
    const content =
      typeof payload.value.content === 'string'
        ? payload.value.content.trim()
        : '';
    if (content.length < 1 || content.length > 5000) {
      return NextResponse.json(
        { error: 'A nota tem de conter entre 1 e 5000 caracteres.' },
        { status: 400 },
      );
    }

    const { data: client, error: clientError } = await tenant.admin
      .from('users')
      .select('id')
      .eq('id', clientId)
      .eq('barbershop_id', tenant.barbershopId)
      .eq('role', 'client')
      .maybeSingle();

    if (clientError) {
      console.error(
        '[CRM_CLIENT_NOTE_CLIENT_LOOKUP_ERROR]',
        clientError.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        { error: 'Não foi possível validar o cliente.' },
        { status: 503 },
      );
    }
    if (!client) {
      return NextResponse.json(
        { error: 'Cliente não encontrado.' },
        { status: 404 },
      );
    }

    const { data: note, error } = await tenant.admin
      .from('client_notes')
      .insert({
        client_id: clientId,
        barbershop_id: tenant.barbershopId,
        author_id: tenant.userId,
        content,
      })
      .select('id, content, author_id, created_at, updated_at')
      .single();

    if (error || !note) {
      console.error('[CRM_CLIENT_NOTE_CREATE_ERROR]', error?.code ?? 'UNKNOWN');
      return NextResponse.json(
        { error: 'Não foi possível guardar a nota.' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { note },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    const authorization = moduleErrorResponse(error);
    if (authorization) return authorization;
    console.error(
      '[CRM_CLIENT_NOTE_INTERNAL_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { error: 'Não foi possível guardar a nota.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const POST = withApiObservability(
  '/api/crm/clients/[clientId]/notes',
  POST__unobserved,
);
