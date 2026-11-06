import { createAdminClient } from '@/lib/supabase/admin';
import { sendMarketingEmail, sendBrevoSms } from '@/lib/marketing/brevo';
import { isReviewRequestContent } from '@/lib/reviews/is-review-request';

const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 3;
const TIME_ZONE = 'Europe/Lisbon';

type Campaign = {
  id: string;
  barbershop_id: string;
  name: string;
  channel: 'email' | 'sms';
  subject: string | null;
  body: string;
  trigger_type: 'manual' | 'interval' | 'event' | 'birthday';
  interval_value: number | null;
  interval_unit: 'hours' | 'days' | null;
  event_name: string | null;
  birthday_offset_days: number | null;
  birthday_last_run_date: string | null;
  next_run_at: string | null;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ] ?? char,
  );
}

function applyTokens(
  value: string,
  vars: { nome: string; barbearia: string; bookingUrl: string },
) {
  return value
    .replaceAll('{{nome}}', vars.nome)
    .replaceAll('{{barbearia}}', vars.barbearia)
    .replaceAll('{{booking_url}}', vars.bookingUrl);
}

function emailHtml(body: string, shopName: string) {
  const safeShop = escapeHtml(shopName);
  const content = body
    .split(/\n\s*\n/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;line-height:1.7;color:#d4d4d8;">${escapeHtml(paragraph).replaceAll('\n', '<br />')}</p>`,
    )
    .join('');
  return `<!doctype html><html lang="pt"><body style="margin:0;background:#09090b;font-family:Arial,Helvetica,sans-serif;color:#fafafa"><div style="max-width:600px;margin:0 auto;padding:32px 18px"><div style="border:1px solid #27272a;border-radius:20px;overflow:hidden;background:#0f0f12"><div style="padding:24px;border-bottom:1px solid #27272a;font-size:15px;font-weight:700;color:#fafafa">${safeShop}</div><div style="padding:28px 24px">${content}</div></div><p style="margin:16px 0 0;text-align:center;font-size:11px;color:#52525b">Enviado através da Silentra</p></div></body></html>`;
}

function lisbonDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const date = new Date(
    `${values.year}-${values.month}-${values.day}T12:00:00Z`,
  );
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function nextInterval(value: number, unit: 'hours' | 'days') {
  return new Date(
    Date.now() + (unit === 'days' ? value * 86400000 : value * 3600000),
  ).toISOString();
}

async function getCampaign(id: string): Promise<Campaign> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('marketing_campaigns')
    .select(
      'id,barbershop_id,name,channel,subject,body,trigger_type,interval_value,interval_unit,event_name,birthday_offset_days,birthday_last_run_date,next_run_at',
    )
    .eq('id', id)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? 'Campaign not found.');
  return data as Campaign;
}

async function queueRecipients(
  campaignId: string,
  runKey: string,
  targetClientId?: string | null,
) {
  const admin = createAdminClient();
  const campaign = await getCampaign(campaignId);
  const destinationField = campaign.channel === 'email' ? 'email' : 'num_phone';

  let query = admin
    .from('users')
    .select('id,name_complete,email,num_phone', { count: 'exact' })
    .eq('barbershop_id', campaign.barbershop_id)
    .eq('role', 'client')
    .not(destinationField, 'is', null);

  if (targetClientId) query = query.eq('id', targetClientId);
  const {
    data: clients,
    error,
    count,
  } = await query.limit(targetClientId ? 1 : 5000);
  if (error) throw error;

  if (!clients?.length) {
    const next =
      campaign.trigger_type === 'interval' &&
      campaign.interval_value &&
      campaign.interval_unit
        ? nextInterval(campaign.interval_value, campaign.interval_unit)
        : null;
    await admin
      .from('marketing_campaigns')
      .update({
        status: next ? 'scheduled' : 'completed',
        next_run_at: next,
        completed_at: next ? null : new Date().toISOString(),
        total_recipients: 0,
        sent_count: 0,
        failed_count: 0,
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaign.id);
    return { queued: 0, total: count ?? 0 };
  }

  const { error: recipientError } = await admin
    .from('marketing_campaign_recipients')
    .upsert(
      clients.map((client) => ({
        campaign_id: campaign.id,
        client_id: client.id,
        destination:
          campaign.channel === 'email' ? client.email! : client.num_phone!,
        run_key: runKey,
        status: 'queued',
        attempts: 0,
        next_attempt_at: new Date().toISOString(),
      })),
      { onConflict: 'campaign_id,client_id,run_key', ignoreDuplicates: true },
    );
  if (recipientError) throw recipientError;

  await admin
    .from('marketing_campaigns')
    .update({
      status: 'sending',
      next_run_at: null,
      completed_at: null,
      last_run_at: new Date().toISOString(),
      total_recipients: clients.length,
      sent_count: 0,
      failed_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaign.id);

  return { queued: clients.length, total: count ?? clients.length };
}

export async function queueCampaign(
  campaignId: string,
  runKey = crypto.randomUUID(),
  targetClientId?: string | null,
) {
  return queueRecipients(campaignId, runKey, targetClientId);
}

export async function processQueuedCampaignRecipients(limit = BATCH_SIZE) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: recipients, error } = await admin
    .from('marketing_campaign_recipients')
    .select('id,campaign_id,client_id,destination,attempts')
    .eq('status', 'queued')
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  if (!recipients?.length) return { processed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const attempts = Number(recipient.attempts ?? 0) + 1;
    const { data: claim } = await admin
      .from('marketing_campaign_recipients')
      .update({ status: 'sending', attempts, error_message: null })
      .eq('id', recipient.id)
      .eq('status', 'queued')
      .select('id')
      .maybeSingle();
    if (!claim) continue;

    try {
      const campaign = await getCampaign(recipient.campaign_id);
      const [{ data: client }, { data: shop }] = await Promise.all([
        admin
          .from('users')
          .select('name_complete')
          .eq('id', recipient.client_id)
          .eq('barbershop_id', campaign.barbershop_id)
          .maybeSingle(),
        admin
          .from('barbershops')
          .select('name,slug')
          .eq('id', campaign.barbershop_id)
          .maybeSingle(),
      ]);

      if (!client) {
        await admin
          .from('marketing_campaign_recipients')
          .update({ status: 'skipped', error_message: 'Client not found.' })
          .eq('id', recipient.id);
        continue;
      }

      const name = client.name_complete?.trim() || 'Cliente';
      const shopName = shop?.name?.trim() || 'A tua barbearia';
      const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://barbers.silentra.me'}/barbershops/${shop?.slug ?? campaign.barbershop_id}`;
      const vars = { nome: name, barbearia: shopName, bookingUrl };
      const body = applyTokens(campaign.body, vars);
      const subject = applyTokens(
        campaign.subject?.trim() || `${campaign.name} — ${shopName}`,
        vars,
      );

      const result =
        campaign.channel === 'email'
          ? await sendMarketingEmail({
              to: recipient.destination,
              toName: name,
              subject,
              html: emailHtml(body, shopName),
              senderName: shopName,
            })
          : await sendBrevoSms({
              to: recipient.destination,
              content: body,
              sender: process.env.BREVO_SMS_SENDER ?? shopName,
            });

      if (result.success) {
        sent++;
        await admin
          .from('marketing_campaign_recipients')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            delivered_at: null,
            provider_message_id: result.messageId ?? null,
            error_message: null,
            next_attempt_at: null,
          })
          .eq('id', recipient.id);
      } else {
        failed++;
        await admin
          .from('marketing_campaign_recipients')
          .update({
            status: attempts >= MAX_ATTEMPTS ? 'failed' : 'queued',
            failed_at:
              attempts >= MAX_ATTEMPTS ? new Date().toISOString() : null,
            next_attempt_at:
              attempts >= MAX_ATTEMPTS
                ? null
                : new Date(Date.now() + attempts * 60000).toISOString(),
            error_message: result.error,
          })
          .eq('id', recipient.id);
      }
    } catch (error) {
      failed++;
      await admin
        .from('marketing_campaign_recipients')
        .update({
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'queued',
          failed_at: attempts >= MAX_ATTEMPTS ? new Date().toISOString() : null,
          next_attempt_at:
            attempts >= MAX_ATTEMPTS
              ? null
              : new Date(Date.now() + attempts * 60000).toISOString(),
          error_message: error instanceof Error ? error.message : String(error),
        })
        .eq('id', recipient.id);
    }
  }

  const campaignIds = [...new Set(recipients.map((row) => row.campaign_id))];
  for (const campaignId of campaignIds) {
    const [
      { count: queued },
      { count: sending },
      { count: sentCount },
      { count: failedCount },
    ] = await Promise.all([
      admin
        .from('marketing_campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('status', 'queued'),
      admin
        .from('marketing_campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('status', 'sending'),
      admin
        .from('marketing_campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .in('status', ['sent', 'delivered']),
      admin
        .from('marketing_campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('status', 'failed'),
    ]);
    const complete = (queued ?? 0) === 0 && (sending ?? 0) === 0;
    const campaign = await getCampaign(campaignId);
    const update: Record<string, unknown> = {
      sent_count: sentCount ?? 0,
      failed_count: failedCount ?? 0,
      updated_at: new Date().toISOString(),
    };
    if (complete) {
      update.completed_at = new Date().toISOString();
      update.status =
        campaign.trigger_type === 'interval' ? 'scheduled' : 'completed';
      if (
        campaign.trigger_type === 'interval' &&
        campaign.interval_value &&
        campaign.interval_unit
      ) {
        update.next_run_at = nextInterval(
          campaign.interval_value,
          campaign.interval_unit,
        );
      }
    } else {
      update.status = 'sending';
    }
    await admin.from('marketing_campaigns').update(update).eq('id', campaignId);
  }

  return { processed: recipients.length, sent, failed };
}

export async function dispatchMarketingEvent(input: {
  barbershopId: string;
  eventName: string;
  clientId?: string | null;
}) {
  if (!input.clientId) return { triggered: 0 };
  const admin = createAdminClient();
  const { data: campaigns, error } = await admin
    .from('marketing_campaigns')
    .select('id,channel,subject,body,name')
    .eq('barbershop_id', input.barbershopId)
    .eq('active', true)
    .eq('trigger_type', 'event')
    .eq('event_name', input.eventName)
    .limit(50);
  if (error) throw error;
  let triggered = 0;
  for (const campaign of campaigns ?? []) {
    // The dedicated review email is the only review request sent on completion.
    if (
      input.eventName === 'booking_completed' &&
      campaign.channel === 'email' &&
      isReviewRequestContent(
        campaign.subject?.trim() || campaign.name || '',
        campaign.body || '',
      )
    ) {
      continue;
    }
    await queueCampaign(
      campaign.id,
      `event:${input.eventName}:${input.clientId}:${crypto.randomUUID()}`,
      input.clientId,
    );
    triggered++;
  }
  return { triggered };
}

export async function processScheduledCampaigns(limit = 25) {
  const admin = createAdminClient();
  const { data: campaigns, error } = await admin
    .from('marketing_campaigns')
    .select('id')
    .eq('active', true)
    .eq('trigger_type', 'interval')
    .eq('status', 'scheduled')
    .lte('next_run_at', new Date().toISOString())
    .limit(limit);
  if (error) throw error;
  let processed = 0;
  for (const campaign of campaigns ?? []) {
    await queueCampaign(
      campaign.id,
      `scheduled:${campaign.id}:${crypto.randomUUID()}`,
    );
    processed++;
  }
  return { processed };
}

export async function processBirthdayCampaigns(limit = 25) {
  const admin = createAdminClient();
  const today = lisbonDate();
  const { data: campaigns, error } = await admin
    .from('marketing_campaigns')
    .select(
      'id,barbershop_id,channel,birthday_offset_days,birthday_last_run_date',
    )
    .eq('active', true)
    .eq('trigger_type', 'birthday')
    .in('status', ['draft', 'scheduled', 'completed'])
    .limit(limit);
  if (error) throw error;

  let processed = 0;
  for (const campaign of campaigns ?? []) {
    if (campaign.birthday_last_run_date === today) continue;

    const destinationField =
      campaign.channel === 'email' ? 'email' : 'num_phone';
    const { data: clients, error: clientsError } = await admin
      .from('users')
      .select(`id,birth_date,${destinationField}`)
      .eq('barbershop_id', campaign.barbershop_id)
      .eq('role', 'client')
      .not('birth_date', 'is', null)
      .not(destinationField, 'is', null)
      .limit(5000);
    if (clientsError) throw clientsError;

    const targetDate = lisbonDate(-(campaign.birthday_offset_days ?? 0));
    const monthDay = targetDate.slice(5);
    const matching = (clients ?? []).filter(
      (client) => String(client.birth_date ?? '').slice(5) === monthDay,
    );

    const { data: claimed } = await admin
      .from('marketing_campaigns')
      .update({
        birthday_last_run_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaign.id)
      .eq('active', true)
      .eq('trigger_type', 'birthday')
      .or(`birthday_last_run_date.is.null,birthday_last_run_date.neq.${today}`)
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    for (const client of matching) {
      await queueCampaign(
        campaign.id,
        `birthday:${campaign.id}:${today}:${client.id}`,
        client.id,
      );
    }
    processed++;
  }

  return { processed, date: today };
}
