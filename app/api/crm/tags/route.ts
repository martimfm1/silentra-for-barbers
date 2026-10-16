import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/security/request-validation';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

export const runtime = 'nodejs';

async function GET__unobserved() {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'advanced_crm',
      'clients',
    );
    const { data, error } = await admin
      .from('customer_tags')
      .select('id,name,color,created_at')
      .eq('barbershop_id', barbershopId)
      .order('name');
    if (error) throw error;
    return NextResponse.json({ tags: data ?? [] });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Unable to load CRM tags' },
      { status: 500 },
    );
  }
}

async function POST__unobserved(request: Request) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'advanced_crm',
      'clients',
    );
    const bodyResult = await readJsonObject(request, {
      maxBytes: 4 * 1024,
      allowedKeys: ['name', 'color'],
    });
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.value;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 1 || name.length > 80) {
      return NextResponse.json({ error: 'Invalid tag name' }, { status: 400 });
    }
    const { data, error } = await admin
      .from('customer_tags')
      .insert({
        barbershop_id: barbershopId,
        name,
        color: typeof body?.color === 'string' ? body.color.slice(0, 32) : null,
      })
      .select('id,name,color,created_at')
      .single();
    if (error?.code === '23505')
      return NextResponse.json(
        { error: 'Tag already exists' },
        { status: 409 },
      );
    if (error)
      return NextResponse.json(
        { error: 'Unable to create tag' },
        { status: 500 },
      );
    return NextResponse.json({ tag: data }, { status: 201 });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Unable to create CRM tag' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability('/api/crm/tags', GET__unobserved);
export const POST = withApiObservability('/api/crm/tags', POST__unobserved);
