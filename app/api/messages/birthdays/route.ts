import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

export const runtime = 'nodejs';

type AdminClient = ReturnType<typeof createAdminClient>;

const DEFAULT_NAME = 'Campanha de aniversário';
const DEFAULT_SUBJECT = 'Feliz aniversário, {{nome}}! 🎉';
const DEFAULT_BODY = `Olá {{nome}},\n\nToda a equipa da {{barbearia}} deseja-te um excelente aniversário! 🎉\n\nEsperamos voltar a ver-te em breve.\n\nUm abraço,\n{{barbearia}}`;

function cleanTemplate(value: unknown, fallback: string, max: number) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.slice(0, max) || fallback;
}

function getAvatarUrl(barbershopId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!supabaseUrl) return null;
  return `${supabaseUrl}/storage/v1/object/public/avatar/${barbershopId}/avatar.webp`;
}

async function getBirthdayCampaign(admin: AdminClient, barbershopId: string) {
  const { data, error } = await admin
    .from('marketing_campaigns')
    .select(
      'id,name,active,subject,body,trigger_type,birthday_offset_days,status,created_at,updated_at',
    )
    .eq('barbershop_id', barbershopId)
    .eq('trigger_type', 'birthday')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function GETHandler() {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'marketing_campaigns',
      'marketing',
    );
    const [{ data: campaign }, { data: shop, error: shopError }] =
      await Promise.all([
        getBirthdayCampaign(admin, barbershopId).then((data) => ({ data })),
        admin
          .from('barbershops')
          .select('name')
          .eq('id', barbershopId)
          .maybeSingle(),
      ]);

    if (shopError) throw shopError;

    return NextResponse.json({
      automation: campaign
        ? {
            id: campaign.id,
            enabled: campaign.active === true,
            subject: campaign.subject || DEFAULT_SUBJECT,
            body: campaign.body || DEFAULT_BODY,
            triggerType: campaign.trigger_type,
            birthdayOffsetDays: campaign.birthday_offset_days ?? 0,
          }
        : {
            enabled: false,
            subject: DEFAULT_SUBJECT,
            body: DEFAULT_BODY,
            triggerType: 'birthday',
            birthdayOffsetDays: 0,
          },
      branding: {
        name: shop?.name?.trim() || 'A tua barbearia',
        avatarUrl: getAvatarUrl(barbershopId),
      },
      preview: {
        nome: 'João Silva',
        barbearia: shop?.name?.trim() || 'A tua barbearia',
      },
    });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[Birthday Campaign GET]', error);
    return NextResponse.json(
      { error: 'Não foi possível carregar a campanha de aniversários.' },
      { status: 500 },
    );
  }
}

async function PATCHHandler(request: Request) {
  try {
    const { admin, userId, barbershopId } = await requireModuleContext(
      'marketing_campaigns',
      'marketing',
    );
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const subject = cleanTemplate(body?.subject, DEFAULT_SUBJECT, 200);
    const message = cleanTemplate(body?.body, DEFAULT_BODY, 10000);
    const enabled = body?.enabled === true;
    const birthdayOffsetDays = Number(body?.birthdayOffsetDays ?? 0);

    if (
      !Number.isInteger(birthdayOffsetDays) ||
      birthdayOffsetDays < -365 ||
      birthdayOffsetDays > 365
    ) {
      return NextResponse.json(
        { error: 'A data relativa ao aniversário é inválida.' },
        { status: 400 },
      );
    }

    const existing = await getBirthdayCampaign(admin, barbershopId);

    if (!existing) {
      const { data, error } = await admin
        .from('marketing_campaigns')
        .insert({
          barbershop_id: barbershopId,
          created_by: userId,
          name: DEFAULT_NAME,
          channel: 'email',
          subject,
          body: message,
          segment: {},
          trigger_type: 'birthday',
          birthday_offset_days: birthdayOffsetDays,
          active: enabled,
          status: enabled ? 'scheduled' : 'draft',
        })
        .select(
          'id,name,active,subject,body,trigger_type,birthday_offset_days,status,created_at,updated_at',
        )
        .single();
      if (error) throw error;
      return NextResponse.json({
        automation: {
          id: data.id,
          enabled: data.active,
          subject: data.subject,
          body: data.body,
          triggerType: data.trigger_type,
          birthdayOffsetDays: data.birthday_offset_days,
        },
      });
    }

    const { data, error } = await admin
      .from('marketing_campaigns')
      .update({
        subject,
        body: message,
        birthday_offset_days: birthdayOffsetDays,
        active: enabled,
        status: enabled ? 'scheduled' : 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('barbershop_id', barbershopId)
      .select(
        'id,name,active,subject,body,trigger_type,birthday_offset_days,status,created_at,updated_at',
      )
      .single();
    if (error) throw error;
    return NextResponse.json({
      automation: {
        id: data.id,
        enabled: data.active,
        subject: data.subject,
        body: data.body,
        triggerType: data.trigger_type,
        birthdayOffsetDays: data.birthday_offset_days,
      },
    });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[Birthday Campaign PATCH]', error);
    return NextResponse.json(
      { error: 'Não foi possível guardar a campanha de aniversários.' },
      { status: 500 },
    );
  }
}

export const GET = withApiLogging('/api/messages/birthdays', GETHandler);
export const PATCH = withApiLogging('/api/messages/birthdays', PATCHHandler);
