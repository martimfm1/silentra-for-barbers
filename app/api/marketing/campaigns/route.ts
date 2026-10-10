import { withApiObservability } from '@/lib/observability/api';
import { NextRequest, NextResponse } from 'next/server';
import {
  MARKETING_CHANNELS,
  isMarketingChannel,
} from '@/lib/marketing/campaigns';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

const MAX_RECIPIENTS = 5000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;
const CAMPAIGN_SELECT =
  'id,name,channel,subject,body,segment,status,scheduled_at,started_at,completed_at,created_at,updated_at,trigger_type,interval_value,interval_unit,next_run_at,event_name,birthday_offset_days,birthday_reward_type,birthday_reward_service_id,active,total_recipients,sent_count,failed_count';

async function GET__unobserved() {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'marketing_campaigns',
      'marketing',
    );
    const { data, error } = await admin
      .from('marketing_campaigns')
      .select(CAMPAIGN_SELECT)
      .eq('barbershop_id', barbershopId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(
      {
        ok: true,
        campaigns: data ?? [],
        meta: {
          total: data?.length ?? 0,
          generatedAt: new Date().toISOString(),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[MARKETING_CAMPAIGNS_GET]', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Unable to load campaigns',
        code:
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code: unknown }).code)
            : 'CAMPAIGN_LOAD_FAILED',
      },
      { status: 500 },
    );
  }
}

async function POST__unobserved(request: NextRequest) {
  try {
    const { admin, userId, barbershopId } = await requireModuleContext(
      'marketing_campaigns',
      'marketing',
    );
    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      channel?: unknown;
      subject?: unknown;
      body?: unknown;
      segment?: unknown;
      scheduledAt?: unknown;
    } | null;

    if (
      typeof body?.name !== 'string' ||
      body.name.trim().length < 1 ||
      body.name.trim().length > 120
    ) {
      return NextResponse.json(
        { error: 'Invalid campaign name' },
        { status: 400 },
      );
    }
    if (!isMarketingChannel(body.channel)) {
      return NextResponse.json(
        { error: `Channel must be one of: ${MARKETING_CHANNELS.join(', ')}` },
        { status: 400 },
      );
    }
    if (
      typeof body.body !== 'string' ||
      body.body.trim().length < 1 ||
      body.body.length > 10000
    ) {
      return NextResponse.json(
        { error: 'Invalid campaign body' },
        { status: 400 },
      );
    }
    if (
      body.channel === 'email' &&
      (typeof body.subject !== 'string' ||
        body.subject.trim().length < 1 ||
        body.subject.length > 200)
    ) {
      return NextResponse.json(
        { error: 'Email subject is required' },
        { status: 400 },
      );
    }

    const scheduledAt =
      typeof body.scheduledAt === 'string' && ISO_DATE.test(body.scheduledAt)
        ? new Date(body.scheduledAt)
        : null;
    if (
      body.scheduledAt &&
      (!scheduledAt ||
        Number.isNaN(scheduledAt.getTime()) ||
        scheduledAt.getTime() <= Date.now())
    ) {
      return NextResponse.json(
        { error: 'scheduledAt must be a valid future timestamp' },
        { status: 400 },
      );
    }

    const recipientField = body.channel === 'email' ? 'email' : 'num_phone';
    const { count, error: countError } = await admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('barbershop_id', barbershopId)
      .eq('role', 'client')
      .not(recipientField, 'is', null);
    if (countError) throw countError;
    if ((count ?? 0) > MAX_RECIPIENTS) {
      return NextResponse.json(
        { error: `Audience exceeds the ${MAX_RECIPIENTS} recipient limit.` },
        { status: 400 },
      );
    }

    const { data, error } = await admin
      .from('marketing_campaigns')
      .insert({
        barbershop_id: barbershopId,
        created_by: userId,
        name: body.name.trim(),
        channel: body.channel,
        subject: body.channel === 'email' ? body.subject : null,
        body: body.body.trim(),
        segment:
          body.segment &&
          typeof body.segment === 'object' &&
          !Array.isArray(body.segment)
            ? body.segment
            : {},
        status: scheduledAt ? 'scheduled' : 'draft',
        scheduled_at: scheduledAt?.toISOString() ?? null,
      })
      .select(CAMPAIGN_SELECT)
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, campaign: data }, { status: 201 });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[MARKETING_CAMPAIGNS_POST]', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Unable to create campaign',
        code: 'CAMPAIGN_CREATE_FAILED',
      },
      { status: 500 },
    );
  }
}

async function PATCH__unobserved(request: NextRequest) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'marketing_campaigns',
      'marketing',
    );
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!id)
      return NextResponse.json(
        { error: 'Campaign id is required' },
        { status: 400 },
      );

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body?.name === 'string') {
      const name = body.name.trim();
      if (!name || name.length > 120) {
        return NextResponse.json(
          { error: 'Campaign name must contain 1 to 120 characters.' },
          { status: 400 },
        );
      }
      patch.name = name;
    }
    if (typeof body?.body === 'string') {
      const message = body.body.trim();
      if (!message || message.length > 10000) {
        return NextResponse.json(
          { error: 'Campaign body must contain 1 to 10000 characters.' },
          { status: 400 },
        );
      }
      patch.body = message;
    }
    if (body?.subject === null || typeof body?.subject === 'string') {
      const subject =
        typeof body.subject === 'string' ? body.subject.trim() : null;
      if (subject !== null && subject.length > 200) {
        return NextResponse.json(
          { error: 'Email subject cannot exceed 200 characters.' },
          { status: 400 },
        );
      }
      patch.subject = subject || null;
    }
    if (
      typeof body?.segment === 'object' &&
      body.segment &&
      !Array.isArray(body.segment)
    ) {
      patch.segment = body.segment;
    }
    if (body?.status === 'cancelled') patch.status = 'cancelled';
    if (typeof body?.scheduledAt === 'string') {
      const scheduledAt = new Date(body.scheduledAt);
      if (
        Number.isNaN(scheduledAt.getTime()) ||
        scheduledAt.getTime() <= Date.now()
      ) {
        return NextResponse.json(
          { error: 'scheduledAt must be a valid future timestamp' },
          { status: 400 },
        );
      }
      patch.scheduled_at = scheduledAt.toISOString();
      patch.status = 'scheduled';
    }

    const { data, error } = await admin
      .from('marketing_campaigns')
      .update(patch)
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .in('status', ['draft', 'scheduled'])
      .select(CAMPAIGN_SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: 'Campaign not found or no longer editable' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, campaign: data });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[MARKETING_CAMPAIGNS_PATCH]', error);
    return NextResponse.json(
      { ok: false, error: 'Unable to update campaign' },
      { status: 500 },
    );
  }
}

async function DELETE__unobserved(request: NextRequest) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'marketing_campaigns',
      'marketing',
    );
    const id = new URL(request.url).searchParams.get('id') ?? '';
    if (!id)
      return NextResponse.json(
        { error: 'Campaign id is required' },
        { status: 400 },
      );

    const { data: campaign, error: lookupError } = await admin
      .from('marketing_campaigns')
      .select('id,status')
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!campaign)
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 },
      );

    if (!['draft', 'scheduled', 'cancelled'].includes(campaign.status)) {
      return NextResponse.json(
        { error: 'Campaigns cannot be deleted after delivery has started.' },
        { status: 409 },
      );
    }

    const { error } = await admin
      .from('marketing_campaigns')
      .delete()
      .eq('id', id)
      .eq('barbershop_id', barbershopId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[MARKETING_CAMPAIGNS_DELETE]', error);
    return NextResponse.json(
      { ok: false, error: 'Unable to delete campaign' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability(
  '/api/marketing/campaigns',
  GET__unobserved,
);
export const POST = withApiObservability(
  '/api/marketing/campaigns',
  POST__unobserved,
);
export const PATCH = withApiObservability(
  '/api/marketing/campaigns',
  PATCH__unobserved,
);
export const DELETE = withApiObservability(
  '/api/marketing/campaigns',
  DELETE__unobserved,
);
