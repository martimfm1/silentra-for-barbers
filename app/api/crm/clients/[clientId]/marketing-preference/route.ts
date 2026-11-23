import { withApiObservability } from '@/lib/observability/api';
import { readJsonObject } from '@/lib/security/request-validation';
import { UUID_PATTERN } from '@/lib/validation';
import { NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ clientId: string }> };

async function GET__unobserved(request: Request, { params }: Params) {
  try {
    const context = await requireModuleContext(
      'marketing_campaigns',
      'marketing',
      request,
    );
    const { clientId } = await params;
    if (!UUID_PATTERN.test(clientId)) {
      return NextResponse.json(
        { error: 'Identificador de cliente inválido.' },
        { status: 400 },
      );
    }

    const { data: client, error: clientError } = await context.admin
      .from('users')
      .select('id,email')
      .eq('id', clientId)
      .eq('barbershop_id', context.barbershopId)
      .eq('role', 'client')
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client) {
      return NextResponse.json(
        { error: 'Cliente não encontrado.' },
        { status: 404 },
      );
    }

    const email = String(client.email ?? '').trim().toLowerCase();
    if (!email) {
      return NextResponse.json({
        ok: true,
        preference: {
          active: false,
          consentedAt: null,
          unsubscribedAt: null,
          email: null,
        },
      });
    }

    const { data: preference, error } = await context.admin
      .from('marketing_contact_preferences')
      .select('email_consent_at,email_unsubscribed_at,email')
      .eq('barbershop_id', context.barbershopId)
      .eq('email', email)
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json(
      {
        ok: true,
        preference: {
          active: Boolean(
            preference?.email_consent_at && !preference.email_unsubscribed_at,
          ),
          consentedAt: preference?.email_consent_at ?? null,
          unsubscribedAt: preference?.email_unsubscribed_at ?? null,
          email,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[CRM_CLIENT_MARKETING_PREFERENCE_GET]', error);
    return NextResponse.json(
      { ok: false, error: 'Não foi possível carregar a autorização de email.' },
      { status: 500 },
    );
  }
}

async function POST__unobserved(request: Request, { params }: Params) {
  try {
    const context = await requireModuleContext(
      'marketing_campaigns',
      'marketing',
      request,
    );
    const { clientId } = await params;
    if (!UUID_PATTERN.test(clientId)) {
      return NextResponse.json(
        { error: 'Identificador de cliente inválido.' },
        { status: 400 },
      );
    }

    const payload = await readJsonObject(request, {
      maxBytes: 4096,
      allowedKeys: ['consent', 'confirmedByCustomer'],
    });
    if (!payload.ok) return payload.response;

    const consent = payload.value.consent;
    const confirmedByCustomer = payload.value.confirmedByCustomer;
    if (typeof consent !== 'boolean') {
      return NextResponse.json(
        { error: 'Indica se a autorização deve ficar ativa ou ser revogada.' },
        { status: 400 },
      );
    }
    if (consent && confirmedByCustomer !== true) {
      return NextResponse.json(
        {
          error:
            'Só podes registar a autorização depois de o cliente a ter confirmado expressamente.',
        },
        { status: 400 },
      );
    }

    const { data: client, error: clientError } = await context.admin
      .from('users')
      .select('id,email')
      .eq('id', clientId)
      .eq('barbershop_id', context.barbershopId)
      .eq('role', 'client')
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client) {
      return NextResponse.json(
        { error: 'Cliente não encontrado.' },
        { status: 404 },
      );
    }

    const email = String(client.email ?? '').trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { error: 'Adiciona primeiro um email válido à ficha do cliente.' },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    if (consent) {
      const { error } = await context.admin
        .from('marketing_contact_preferences')
        .upsert(
          {
            barbershop_id: context.barbershopId,
            client_id: client.id,
            email,
            email_consent_at: now,
            email_consent_source: 'staff_recorded',
            email_unsubscribed_at: null,
            email_preference_updated_by: context.userId,
            updated_at: now,
          },
          { onConflict: 'barbershop_id,email' },
        );
      if (error) throw error;
    } else {
      const { data: updated, error: updateError } = await context.admin
        .from('marketing_contact_preferences')
        .update({
          email_unsubscribed_at: now,
          email_preference_updated_by: context.userId,
          updated_at: now,
        })
        .eq('barbershop_id', context.barbershopId)
        .eq('email', email)
        .select('id')
        .maybeSingle();
      if (updateError) throw updateError;

      if (!updated) {
        const { error: insertError } = await context.admin
          .from('marketing_contact_preferences')
          .insert({
            barbershop_id: context.barbershopId,
            client_id: client.id,
            email,
            email_consent_at: null,
            email_consent_source: null,
            email_unsubscribed_at: now,
            email_preference_updated_by: context.userId,
            updated_at: now,
          });
        if (insertError) throw insertError;
      }
    }

    return NextResponse.json({
      ok: true,
      preference: {
        active: consent,
        consentedAt: consent ? now : null,
        unsubscribedAt: consent ? null : now,
        email,
      },
    });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[CRM_CLIENT_MARKETING_PREFERENCE_POST]', error);
    return NextResponse.json(
      { ok: false, error: 'Não foi possível guardar a autorização de email.' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability(
  '/api/crm/clients/[clientId]/marketing-preference',
  GET__unobserved,
);
export const POST = withApiObservability(
  '/api/crm/clients/[clientId]/marketing-preference',
  POST__unobserved,
);
