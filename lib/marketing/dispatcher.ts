import { createAdminClient } from '@/lib/supabase/admin';
import { sendMarketingEmail, sendBrevoSms } from '@/lib/marketing/brevo';
import { isReviewRequestContent } from '@/lib/reviews/is-review-request';
import { getMarketingUnsubscribeUrl } from '@/lib/marketing/consent';
import { renderMarketingEmail } from '@/lib/marketing/email-template';
import { DEFAULT_MARKETING_QUOTAS } from '@/lib/marketing/campaigns';

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
  status: string;
  active: boolean;
};

function applyTokens(
  value: string,
  vars: { nome: string; barbearia: string; bookingUrl: string },
) {
  return value
    .replaceAll('{{nome}}', vars.nome)
    .replaceAll('{{barbearia}}', vars.barbearia)
    .replaceAll('{{booking_url}}', vars.bookingUrl);
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
      'id,barbershop_id,name,channel,subject,body,trigger_type,interval_value,interval_unit,event_name,birthday_offset_days,birthday_last_run_date,next_run_at,status,active',
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

export async function queueManualCampaignRecipients(
  campaignId: string,
  barbershopId: string,
) {
  const admin = createAdminClient();
  const { data: campaign, error: campaignError } = await admin
    .from('marketing_campaigns')
    .select('id,barbershop_id,trigger_type,channel,status,active')
    .eq('id', campaignId)
    .eq('barbershop_id', barbershopId)
    .maybeSingle();
  if (campaignError) throw campaignError;
  if (!campaign || campaign.trigger_type !== 'manual' || campaign.channel !== 'email') {
    throw new Error('Campanha manual não encontrada ou canal indisponível.');
  }
  if (!campaign.active || !['draft', 'scheduled'].includes(campaign.status)) {
    throw new Error('Esta campanha já foi enviada, está em envio ou foi cancelada.');
  }

  const preferences: Array<{ email: string; client_id: string | null }> = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin
      .from('marketing_contact_preferences')
      .select('email,client_id')
      .eq('barbershop_id', barbershopId)
      .not('email_consent_at', 'is', null)
      .is('email_unsubscribed_at', null)
      .order('email', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    preferences.push(...(data ?? []));
    if (!data || data.length < pageSize || preferences.length > 5000) break;
  }

  const uniquePreferences = [
    ...new Map(
      preferences.map((item) => [item.email.trim().toLowerCase(), item]),
    ).values(),
  ];
  if (uniquePreferences.length > DEFAULT_MARKETING_QUOTAS.maxRecipientsPerCampaign) {
    throw new Error('O limite é de ' + DEFAULT_MARKETING_QUOTAS.maxRecipientsPerCampaign.toLocaleString('pt-PT') + ' destinatários autorizados por campanha.');
  }
  if (!uniquePreferences.length) {
    return { queued: 0, total: 0, runKey: null as string | null };
  }

  const emails = uniquePreferences.map((item) => item.email.trim().toLowerCase());
  const clientIds = uniquePreferences
    .map((item) => item.client_id)
    .filter((id): id is string => Boolean(id));
  const clientsByEmail = new Map<string, string>();

  if (clientIds.length) {
    for (let index = 0; index < clientIds.length; index += 500) {
      const { data, error } = await admin
        .from('users')
        .select('id,email')
        .eq('barbershop_id', barbershopId)
        .eq('role', 'client')
        .in('id', clientIds.slice(index, index + 500));
      if (error) throw error;
      for (const client of data ?? []) {
        if (client.email) clientsByEmail.set(client.email.trim().toLowerCase(), client.id);
      }
    }
  }

  // Preferences created by new public bookings can precede a CRM profile row ID.
  // Resolve by exact email inside this barbershop only.
  const unresolved = emails.filter((email) => !clientsByEmail.has(email));
  for (let index = 0; index < unresolved.length; index += 200) {
    const { data, error } = await admin
      .from('users')
      .select('id,email')
      .eq('barbershop_id', barbershopId)
      .eq('role', 'client')
      .in('email', unresolved.slice(index, index + 200));
    if (error) throw error;
    for (const client of data ?? []) {
      if (client.email) clientsByEmail.set(client.email.trim().toLowerCase(), client.id);
    }
  }

  const recipients = uniquePreferences.flatMap((preference) => {
    const email = preference.email.trim().toLowerCase();
    const clientId = clientsByEmail.get(email);
    return clientId
      ? [{
          campaign_id: campaignId,
          client_id: clientId,
          destination: email,
          run_key: 'manual:' + crypto.randomUUID(),
          status: 'queued',
          attempts: 0,
          next_attempt_at: new Date().toISOString(),
        }]
      : [];
  });

  if (!recipients.length) {
    return { queued: 0, total: uniquePreferences.length, runKey: null as string | null };
  }

  const runKey = 'manual:' + crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const { data: startedCampaign, error: campaignUpdateError } = await admin
    .from('marketing_campaigns')
    .update({
      status: 'sending',
      scheduled_at: null,
      started_at: startedAt,
      last_run_at: startedAt,
      total_recipients: recipients.length,
      sent_count: 0,
      failed_count: 0,
      completed_at: null,
      updated_at: startedAt,
    })
    .eq('id', campaignId)
    .eq('barbershop_id', barbershopId)
    .eq('trigger_type', 'manual')
    .in('status', ['draft', 'scheduled'])
    .select('id')
    .maybeSingle();
  if (campaignUpdateError || !startedCampaign) {
    throw campaignUpdateError ?? new Error('A campanha já foi iniciada ou cancelada.');
  }

  // Mark the campaign as sending before inserting queued recipients. The cron
  // worker can never observe a queued recipient while the campaign is still a
  // draft or scheduled, and competing send requests cannot start twice.
  const payload = recipients.map((recipient) => ({ ...recipient, run_key: runKey }));
  const { error: recipientError } = await admin
    .from('marketing_campaign_recipients')
    .upsert(payload, {
      onConflict: 'campaign_id,client_id,run_key',
      ignoreDuplicates: true,
    });
  if (recipientError) {
    const { error: rollbackError } = await admin
      .from('marketing_campaigns')
      .update({
        status: 'draft',
        started_at: null,
        last_run_at: null,
        total_recipients: 0,
        sent_count: 0,
        failed_count: 0,
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId)
      .eq('barbershop_id', barbershopId)
      .eq('status', 'sending');
    if (rollbackError) {
      console.error('[MARKETING_CAMPAIGN_QUEUE_ROLLBACK]', rollbackError.code);
    }
    throw recipientError;
  }

  return {
    queued: recipients.length,
    total: uniquePreferences.length,
    runKey,
  };
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
      if (
        !['manual', 'interval', 'event', 'birthday'].includes(campaign.trigger_type)
      ) {
        const { error: skipError } = await admin
          .from('marketing_campaign_recipients')
          .update({
            status: 'skipped',
            next_attempt_at: null,
            error_message: 'Manual customer messaging is temporarily disabled.',
          })
          .eq('id', recipient.id)
          .eq('status', 'sending');
        if (skipError) throw skipError;
        continue;
      }
      if (campaign.status === 'cancelled' || !campaign.active) {
        const { error: cancelError } = await admin
          .from('marketing_campaign_recipients')
          .update({
            status: 'cancelled',
            next_attempt_at: null,
            error_message: 'Campanha cancelada antes do envio.',
          })
          .eq('id', recipient.id)
          .eq('status', 'sending');
        if (cancelError) throw cancelError;
        continue;
      }

      // Also discard review requests that were queued before this safeguard
      // was deployed, so an old event cannot send a second review email later.
      if (
        campaign.trigger_type === 'event' &&
        campaign.event_name === 'booking_completed' &&
        campaign.channel === 'email' &&
        isReviewRequestContent(
          campaign.subject?.trim() || campaign.name || '',
          campaign.body || '',
        )
      ) {
        const { error: skipError } = await admin
          .from('marketing_campaign_recipients')
          .update({
            status: 'skipped',
            error_message: null,
            next_attempt_at: null,
          })
          .eq('id', recipient.id);
        if (skipError) throw skipError;
        continue;
      }

      if (campaign.channel === 'email') {
        const { data: preference, error: preferenceError } = await admin
          .from('marketing_contact_preferences')
          .select('email_consent_at,email_unsubscribed_at')
          .eq('barbershop_id', campaign.barbershop_id)
          .eq('email', recipient.destination.trim().toLowerCase())
          .not('email_consent_at', 'is', null)
          .is('email_unsubscribed_at', null)
          .maybeSingle();
        if (preferenceError) throw preferenceError;
        if (!preference) {
          const { error: skipError } = await admin
            .from('marketing_campaign_recipients')
            .update({
              status: 'skipped',
              next_attempt_at: null,
              error_message: 'O cliente não tem autorização de marketing ativa.',
            })
            .eq('id', recipient.id)
            .eq('status', 'sending');
          if (skipError) throw skipError;
          continue;
        }
      }

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
              html: renderMarketingEmail({
                body,
                shopName,
                bookingUrl,
                unsubscribeUrl: getMarketingUnsubscribeUrl(
                  campaign.barbershop_id,
                  recipient.destination,
                ),
                kind: campaign.trigger_type === 'birthday' ? 'birthday' : 'campaign',
              }),
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
