import { createAdminClient } from '@/lib/supabase/admin';
import { sendMarketingEmail, sendBrevoSms } from '@/lib/marketing/brevo';
import { getConsentedMarketingEmails, getMarketingUnsubscribeUrl } from '@/lib/marketing/consent';
import { renderMarketingEmail } from '@/lib/marketing/email-template';

const TIME_ZONE = 'Europe/Lisbon';
const MAX_CAMPAIGNS = 25;
const CLIENT_PAGE_SIZE = 1000;
const MAX_ATTEMPTS = 3;
const VOUCHER_VALIDITY_DAYS = 30;

type BirthdayCampaign = {
  id: string;
  barbershop_id: string;
  name: string;
  channel: 'email' | 'sms';
  subject: string | null;
  body: string;
  birthday_offset_days: number;
  birthday_last_run_date: string | null;
  birthday_reward_type: 'none' | 'free_service';
  birthday_reward_service_id: string | null;
};

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

function renderTokens(
  value: string,
  variables: {
    nome: string;
    barbearia: string;
    bookingUrl: string;
    voucherCode?: string;
    voucherExpiresAt?: string;
  },
) {
  return value
    .replaceAll('{{nome}}', variables.nome)
    .replaceAll('{{barbearia}}', variables.barbearia)
    .replaceAll('{{booking_url}}', variables.bookingUrl)
    .replaceAll('{{voucher_code}}', variables.voucherCode ?? '')
    .replaceAll('{{voucher_expires_at}}', variables.voucherExpiresAt ?? '');
}

function voucherCode() {
  return `SIL-${crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}

async function getBirthdayCampaigns() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('marketing_campaigns')
    .select(
      'id,barbershop_id,name,channel,subject,body,birthday_offset_days,birthday_last_run_date,birthday_reward_type,birthday_reward_service_id',
    )
    .eq('active', true)
    .eq('trigger_type', 'birthday')
    .eq('channel', 'email')
    .in('status', ['draft', 'scheduled', 'completed'])
    // Rotate older/unprocessed campaigns to the front so a 25-campaign batch
    // does not permanently starve shops when the tenant count grows.
    .order('birthday_last_run_date', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(MAX_CAMPAIGNS);
  if (error) throw error;
  return (data ?? []) as BirthdayCampaign[];
}

async function claimCampaign(
  campaign: BirthdayCampaign,
  today: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const startedAt = new Date().toISOString();
  const { data, error } = await admin.rpc('claim_birthday_marketing_campaign', {
    p_campaign_id: campaign.id,
    p_today: today,
    p_now: startedAt,
  });
  if (error) throw error;
  return data === true ? startedAt : null;
}

async function issueVoucher(input: {
  campaign: BirthdayCampaign;
  clientId: string;
  birthdayDate: string;
}) {
  const admin = createAdminClient();
  if (input.campaign.birthday_reward_type !== 'free_service') return null;
  if (!input.campaign.birthday_reward_service_id) {
    throw new Error('Birthday free-service campaign is missing a service.');
  }

  const { data: existing } = await admin
    .from('marketing_campaign_vouchers')
    .select('id,code,expires_at')
    .eq('campaign_id', input.campaign.id)
    .eq('client_id', input.clientId)
    .eq('birthday_date', input.birthdayDate)
    .maybeSingle();
  if (existing) return existing;

  const expiresAt = new Date(`${input.birthdayDate}T12:00:00Z`);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + VOUCHER_VALIDITY_DAYS);

  const { data, error } = await admin
    .from('marketing_campaign_vouchers')
    .insert({
      campaign_id: input.campaign.id,
      barbershop_id: input.campaign.barbershop_id,
      client_id: input.clientId,
      service_id: input.campaign.birthday_reward_service_id,
      code: voucherCode(),
      reward_type: 'free_service',
      birthday_date: input.birthdayDate,
      expires_at: expiresAt.toISOString(),
    })
    .select('id,code,expires_at')
    .maybeSingle();

  if (error && error.code !== '23505') throw error;
  if (data) return data;

  const { data: retry } = await admin
    .from('marketing_campaign_vouchers')
    .select('id,code,expires_at')
    .eq('campaign_id', input.campaign.id)
    .eq('client_id', input.clientId)
    .eq('birthday_date', input.birthdayDate)
    .maybeSingle();
  return retry;
}

async function sendBirthdayMessage(input: {
  campaign: BirthdayCampaign;
  destination: string;
  clientName: string;
  shopName: string;
  shopSlug: string | null;
  voucher: { code: string; expires_at: string } | null;
}) {
  const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://barbers.silentra.me'}/barbershops/${input.shopSlug ?? input.campaign.barbershop_id}`;
  const variables = {
    nome: input.clientName,
    barbearia: input.shopName,
    bookingUrl,
    voucherCode: input.voucher?.code,
    voucherExpiresAt: input.voucher
      ? new Date(input.voucher.expires_at).toLocaleDateString('pt-PT')
      : undefined,
  };

  let body = renderTokens(input.campaign.body, variables);
  if (input.voucher?.code && !body.includes(input.voucher.code)) {
    body += `\n\n🎁 Voucher de aniversário\nCódigo: ${input.voucher.code}\nVálido até ${variables.voucherExpiresAt}.`;
  }
  const subject = renderTokens(
    input.campaign.subject?.trim() ||
      `${input.campaign.name} — ${input.shopName}`,
    variables,
  );

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result =
      input.campaign.channel === 'email'
        ? await sendMarketingEmail({
            to: input.destination,
            toName: input.clientName,
            subject,
            html: renderMarketingEmail({
              body,
              shopName: input.shopName,
              bookingUrl,
              unsubscribeUrl: getMarketingUnsubscribeUrl(
                input.campaign.barbershop_id,
                input.destination,
              ),
              kind: 'birthday',
            }),
            senderName: input.shopName,
          })
        : await sendBrevoSms({
            to: input.destination,
            content: body,
            sender: process.env.BREVO_SMS_SENDER ?? input.shopName,
          });

    if (result.success) return result;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  return {
    success: false as const,
    error: 'Birthday campaign delivery failed after retries.',
  };
}

export async function processBirthdayCampaignDelivery(limit = MAX_CAMPAIGNS) {
  const admin = createAdminClient();
  const today = lisbonDate();
  const campaigns = (await getBirthdayCampaigns()).slice(0, limit);
  let campaignsProcessed = 0;
  let recipientsProcessed = 0;
  let sent = 0;
  let failed = 0;
  let vouchersIssued = 0;

  for (const campaign of campaigns) {
    if (campaign.birthday_last_run_date === today) continue;
    const campaignProcessingStartedAt = await claimCampaign(campaign, today);
    if (!campaignProcessingStartedAt) continue;

    campaignsProcessed++;
    try {
    const birthdayDate = lisbonDate(-(campaign.birthday_offset_days ?? 0));
    const monthDay = birthdayDate.slice(5);
    const destinationField =
      campaign.channel === 'email' ? 'email' : 'num_phone';
    let campaignSent = 0;
    let campaignFailed = 0;

    const clients: Array<{
      id: string;
      name_complete: string | null;
      birth_date: string | null;
      email: string | null;
      num_phone: string | null;
    }> = [];
    for (let offset = 0; ; offset += CLIENT_PAGE_SIZE) {
      const { data: page, error: clientsError } = await admin
        .from('users')
        .select('id,name_complete,birth_date,email,num_phone')
        .eq('barbershop_id', campaign.barbershop_id)
        .eq('role', 'client')
        .not('birth_date', 'is', null)
        .not(destinationField, 'is', null)
        .order('id', { ascending: true })
        .range(offset, offset + CLIENT_PAGE_SIZE - 1);
      if (clientsError) throw clientsError;
      clients.push(...(page ?? []));
      if (!page || page.length < CLIENT_PAGE_SIZE) break;
    }

    const birthdayMatches = clients.filter(
      (client) => String(client.birth_date ?? '').slice(5) === monthDay,
    );
    const consentedEmails = await getConsentedMarketingEmails(
      admin,
      campaign.barbershop_id,
      birthdayMatches
        .map((client) => client.email)
        .filter((email): email is string => Boolean(email)),
    );
    const matching = birthdayMatches.filter((client) =>
      consentedEmails.has(String(client.email ?? '').trim().toLowerCase()),
    );

    const { data: shop, error: shopError } = await admin
      .from('barbershops')
      .select('name,slug')
      .eq('id', campaign.barbershop_id)
      .maybeSingle();
    if (shopError || !shop)
      throw shopError ?? new Error('Barbershop not found.');

    for (const client of matching) {
      const destination =
        campaign.channel === 'email' ? client.email : client.num_phone;
      if (typeof destination !== 'string' || !destination.trim()) continue;

      // Check the preference again immediately before delivery so an
      // unsubscribe made after audience collection is still respected.
      const { data: currentPreference, error: currentPreferenceError } =
        await admin
          .from('marketing_contact_preferences')
          .select('id')
          .eq('barbershop_id', campaign.barbershop_id)
          .eq('email', destination.trim().toLowerCase())
          .not('email_consent_at', 'is', null)
          .is('email_unsubscribed_at', null)
          .maybeSingle();
      if (currentPreferenceError) throw currentPreferenceError;
      if (!currentPreference) continue;

      const voucher = await issueVoucher({
        campaign,
        clientId: client.id,
        birthdayDate,
      });
      if (voucher) vouchersIssued++;

      const runKey = `birthday:${birthdayDate}`;
      const { data: existingRecipient } = await admin
        .from('marketing_campaign_recipients')
        .select('id,status,provider_message_id,voucher_id')
        .eq('campaign_id', campaign.id)
        .eq('client_id', client.id)
        .eq('run_key', runKey)
        .maybeSingle();

      if (
        existingRecipient?.status === 'sent' ||
        existingRecipient?.status === 'delivered'
      ) {
        continue;
      }

      let recipientId = existingRecipient?.id ?? null;
      if (!recipientId) {
        const { data: createdRecipient, error: recipientError } = await admin
          .from('marketing_campaign_recipients')
          .insert({
            campaign_id: campaign.id,
            client_id: client.id,
            destination,
            run_key: runKey,
            voucher_id: voucher?.id ?? null,
            status: 'sending',
            attempts: 1,
            next_attempt_at: null,
          })
          .select('id')
          .maybeSingle();
        if (recipientError) throw recipientError;
        recipientId = createdRecipient?.id ?? null;
      } else {
        const currentRecipient = existingRecipient;
        if (!currentRecipient)
          throw new Error('Unable to resolve existing birthday recipient.');
        await admin
          .from('marketing_campaign_recipients')
          .update({
            destination,
            voucher_id: voucher?.id ?? currentRecipient.voucher_id ?? null,
            status: 'sending',
            attempts: 1,
            next_attempt_at: null,
            error_message: null,
          })
          .eq('id', recipientId);
      }

      if (!recipientId) throw new Error('Unable to create birthday recipient.');
      recipientsProcessed++;

      const result = await sendBirthdayMessage({
        campaign,
        destination,
        clientName: String(client.name_complete ?? '').trim() || 'Cliente',
        shopName: String(shop.name ?? '').trim() || 'A tua barbearia',
        shopSlug: shop.slug,
        voucher,
      });

      if (result.success) {
        sent++;
        campaignSent++;
        await admin
          .from('marketing_campaign_recipients')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: result.messageId ?? null,
            error_message: null,
          })
          .eq('id', recipientId);
      } else {
        failed++;
        campaignFailed++;
        await admin
          .from('marketing_campaign_recipients')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            error_message: result.error,
          })
          .eq('id', recipientId);
      }
    }

    const finishedAt = new Date().toISOString();
    const { error: finishError } = await admin
      .from('marketing_campaigns')
      .update({
        status: campaignFailed > 0 ? 'scheduled' : 'completed',
        birthday_last_run_date: campaignFailed > 0 ? null : today,
        birthday_processing_started_at: null,
        total_recipients: matching.length,
        sent_count: campaignSent,
        failed_count: campaignFailed,
        completed_at: campaignFailed > 0 ? null : finishedAt,
        updated_at: finishedAt,
      })
      .eq('id', campaign.id)
      .eq('birthday_processing_started_at', campaignProcessingStartedAt);
    if (finishError) throw finishError;
    } catch (error) {
      const { error: releaseError } = await admin
        .from('marketing_campaigns')
        .update({
          birthday_processing_started_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaign.id)
        .eq('birthday_processing_started_at', campaignProcessingStartedAt);
      if (releaseError) {
        console.error('[BIRTHDAY_CAMPAIGN_LEASE_RELEASE_ERROR]', releaseError.code);
      }
      console.error(
        '[BIRTHDAY_CAMPAIGN_PROCESSING_ERROR]',
        error instanceof Error ? error.message : String(error),
      );
      failed++;
    }
  }

  return {
    campaignsProcessed,
    recipientsProcessed,
    sent,
    failed,
    vouchersIssued,
  };
}
