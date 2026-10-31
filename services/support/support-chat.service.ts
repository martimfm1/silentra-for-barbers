import { sendBrevoEmail } from '@/lib/email/brevo';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SupportPlan = 'free' | 'pro' | 'enterprise';
export type SupportSenderType = 'customer' | 'admin';
export type SupportStatus =
  'pending' | 'open' | 'waiting_customer' | 'closed' | 'closed_unresolved';

export function supportPriority(plan: SupportPlan) {
  return plan === 'enterprise' ? 3 : plan === 'pro' ? 2 : 1;
}

export function normalizeSupportPlan(value: unknown): SupportPlan {
  return value === 'enterprise' || value === 'pro' ? value : 'free';
}

export async function getEffectiveSupportPlan(
  admin: SupabaseClient,
  barbershopId: string,
): Promise<SupportPlan> {
  const now = new Date().toISOString();
  const [assignmentResult, subscriptionResult] = await Promise.all([
    admin
      .from('barbershop_plan_assignments')
      .select('plan,expires_at')
      .eq('barbershop_id', barbershopId)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .maybeSingle(),
    admin
      .from('subscriptions')
      .select('plan,plan_override,status')
      .eq('barbershop_id', barbershopId)
      .maybeSingle(),
  ]);

  if (assignmentResult.error && assignmentResult.error.code !== 'PGRST116') {
    throw new Error('SUPPORT_PLAN_LOOKUP_FAILED');
  }
  if (
    subscriptionResult.error &&
    subscriptionResult.error.code !== 'PGRST116'
  ) {
    throw new Error('SUPPORT_SUBSCRIPTION_LOOKUP_FAILED');
  }

  if (assignmentResult.data) {
    return normalizeSupportPlan(assignmentResult.data.plan);
  }

  const subscription = subscriptionResult.data;
  if (subscription?.plan_override) {
    return normalizeSupportPlan(subscription.plan_override);
  }
  if (
    (subscription?.status === 'active' ||
      subscription?.status === 'trialing') &&
    (subscription?.plan === 'pro' || subscription?.plan === 'enterprise')
  ) {
    return subscription.plan;
  }
  return 'free';
}

export function isTrustedSupportOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    const parsedOrigin = new URL(origin).origin;
    const allowed = new Set<string>([new URL(request.url).origin]);
    for (const value of [
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.NEXT_PUBLIC_SITE_URL,
    ]) {
      if (!value) continue;
      try {
        allowed.add(new URL(value).origin);
      } catch {
        // Ignore malformed optional URL configuration.
      }
    }
    return allowed.has(parsedOrigin);
  } catch {
    return false;
  }
}

export async function getPlatformSupportEmail(admin: SupabaseClient) {
  const configuredEmail = process.env.SILENTRA_PLATFORM_ADMIN_EMAIL?.trim();
  if (configuredEmail) return configuredEmail;

  const configuredUserId = process.env.SILENTRA_PLATFORM_ADMIN_USER_ID?.trim();
  if (!configuredUserId) return null;

  const { data, error } = await admin.auth.admin.getUserById(configuredUserId);
  if (error) {
    console.error('[SUPPORT_ADMIN_EMAIL_LOOKUP]', error.code ?? 'UNKNOWN');
    return null;
  }
  return data.user?.email ?? null;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  );
}

function getBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'https://barbers.silentra.me';
  try {
    const url = new URL(configured);
    if (url.protocol === 'https:' || url.protocol === 'http:')
      return url.origin;
  } catch {
    // Fall through to the canonical production URL.
  }
  return 'https://barbers.silentra.me';
}

type SupportNotification = {
  id: string;
  conversation_id: string;
  message_id: string;
  recipient_type: SupportSenderType;
  recipient_email: string;
  recipient_name: string | null;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  attempts: number;
  next_attempt_at: string;
};

export async function deliverSupportEmailNotification(
  admin: SupabaseClient,
  notificationId: string,
) {
  const { data: notification, error: notificationError } = await admin
    .from('support_email_notifications')
    .select(
      'id,conversation_id,message_id,recipient_type,recipient_email,recipient_name,status,attempts,next_attempt_at',
    )
    .eq('id', notificationId)
    .maybeSingle();

  if (notificationError || !notification) {
    console.error(
      '[SUPPORT_EMAIL_OUTBOX_LOOKUP_FAILED]',
      notificationError?.code ?? 'NOT_FOUND',
    );
    return { sent: false, error: 'OUTBOX_ENTRY_NOT_FOUND' } as const;
  }

  const row = notification as SupportNotification;
  if (row.status === 'sent') return { sent: true } as const;
  if (row.attempts >= 5)
    return { sent: false, error: 'RETRY_LIMIT_REACHED' } as const;
  const now = new Date();
  if (Date.parse(row.next_attempt_at) > now.getTime()) {
    return { sent: false, error: 'RETRY_NOT_DUE' } as const;
  }

  // Claim the outbox row before calling the provider so an immediate send and
  // the scheduled worker cannot deliver the same email concurrently. The
  // 10-minute lease lets the cron recover from a worker that crashed mid-send.
  const { data: claim, error: claimError } = await admin
    .from('support_email_notifications')
    .update({
      status: 'processing',
      attempts: row.attempts + 1,
      next_attempt_at: new Date(now.getTime() + 10 * 60_000).toISOString(),
    })
    .eq('id', row.id)
    .eq('status', row.status)
    .eq('attempts', row.attempts)
    .lte('next_attempt_at', now.toISOString())
    .select('id')
    .maybeSingle();

  if (claimError) {
    console.error(
      '[SUPPORT_EMAIL_OUTBOX_CLAIM_FAILED]',
      claimError.code ?? 'UNKNOWN',
    );
    return { sent: false, error: 'OUTBOX_CLAIM_FAILED' } as const;
  }
  if (!claim) return { sent: false, error: 'OUTBOX_ALREADY_CLAIMED' } as const;

  const [conversationResult, messageResult] = await Promise.all([
    admin
      .from('support_conversations')
      .select('id,barbershop_id,customer_user_id,plan')
      .eq('id', row.conversation_id)
      .maybeSingle(),
    admin
      .from('support_messages')
      .select('id,body,sender_type,read_at')
      .eq('id', row.message_id)
      .maybeSingle(),
  ]);

  if (
    conversationResult.error ||
    !conversationResult.data ||
    messageResult.error ||
    !messageResult.data
  ) {
    const errorCode = 'SUPPORT_EMAIL_CONTEXT_LOOKUP_FAILED';
    await admin
      .from('support_email_notifications')
      .update({
        status: 'failed',
        attempts: row.attempts + 1,
        last_error: errorCode,
        next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
      })
      .eq('id', row.id);
    return { sent: false, error: errorCode } as const;
  }

  // Deliver one transactional email for every accepted message, even if the
  // recipient opened the chat before the outbox worker started.

  const { data: shop, error: shopError } = await admin
    .from('barbershops')
    .select('name,default_language')
    .eq('id', conversationResult.data.barbershop_id)
    .maybeSingle();
  if (shopError) {
    console.error(
      '[SUPPORT_EMAIL_SHOP_LOOKUP_FAILED]',
      shopError.code ?? 'UNKNOWN',
    );
  }

  const plan = normalizeSupportPlan(conversationResult.data.plan);
  const english = shop?.default_language === 'en';
  const shopName =
    shop?.name || (english ? 'your barbershop' : 'a tua barbearia');
  const isAdminRecipient = row.recipient_type === 'admin';
  const target = isAdminRecipient
    ? `/silentra-admin?tab=support&conversationId=${encodeURIComponent(row.conversation_id)}`
    : `/dashboard/suporte?ticketId=${encodeURIComponent(row.conversation_id)}`;
  const title = isAdminRecipient
    ? english
      ? 'New support message'
      : 'Nova mensagem de suporte'
    : english
      ? 'Silentra has replied to your support conversation'
      : 'Tens uma nova mensagem da equipa Silentra';
  const description = isAdminRecipient
    ? english
      ? `${shopName} (${plan.toUpperCase()}) sent a message in the support chat.`
      : `A barbearia ${shopName} (${plan.toUpperCase()}) enviou uma mensagem no chat de suporte.`
    : english
      ? 'The Silentra team has replied to your support conversation.'
      : 'A equipa Silentra respondeu à tua conversa de suporte.';
  const excerpt = String(messageResult.data.body).slice(0, 600);
  const htmlContent = `
    <div style="background:#f4f4f5;padding:32px 12px;font-family:Arial,Helvetica,sans-serif;color:#18181b">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:16px;padding:28px">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#71717a;font-weight:700">Silentra · ${english ? 'Support' : 'Suporte'}</p>
        <h1 style="font-size:22px;line-height:1.3;margin:14px 0;color:#18181b">${escapeHtml(title)}</h1>
        <p style="font-size:14px;line-height:1.7;color:#52525b">${escapeHtml(description)}</p>
        <div style="margin:22px 0;padding:16px;border-radius:10px;background:#f4f4f5;font-size:14px;line-height:1.7;color:#3f3f46;white-space:pre-wrap">${escapeHtml(excerpt)}${String(messageResult.data.body).length > 600 ? '…' : ''}</div>
        <a href="${getBaseUrl()}${target}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#18181b;color:#fff;text-decoration:none;font-size:14px;font-weight:700">${isAdminRecipient ? (english ? 'Open Silentra Admin' : 'Abrir Silentra Admin') : english ? 'Open conversation' : 'Abrir conversa'}</a>
        <p style="margin-top:24px;font-size:11px;line-height:1.6;color:#a1a1aa">${english ? 'You received this email because a new message was sent in your Silentra support conversation. Reply directly in the platform.' : 'Recebeste este email porque foi enviada uma nova mensagem na tua conversa de suporte Silentra. Responde diretamente na plataforma.'}</p>
      </div>
    </div>`;

  const delivery = await sendBrevoEmail({
    to: row.recipient_email,
    toName: row.recipient_name || undefined,
    subject: `[Silentra Support] ${title}`,
    htmlContent,
    senderName: 'Silentra Support',
  });

  if (delivery.success) {
    const { error } = await admin
      .from('support_email_notifications')
      .update({
        status: 'sent',
        attempts: row.attempts + 1,
        sent_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', row.id);
    if (error)
      console.error(
        '[SUPPORT_EMAIL_OUTBOX_MARK_SENT_FAILED]',
        error.code ?? 'UNKNOWN',
      );
    return { sent: true } as const;
  }

  const nextAttemptNumber = row.attempts + 1;
  const backoffMinutes = [1, 5, 15, 60, 360][Math.min(row.attempts, 4)];
  const safeError = delivery.error.slice(0, 500);
  const { error } = await admin
    .from('support_email_notifications')
    .update({
      status: 'failed',
      attempts: nextAttemptNumber,
      last_error: safeError,
      next_attempt_at: new Date(
        Date.now() + backoffMinutes * 60_000,
      ).toISOString(),
    })
    .eq('id', row.id);
  if (error)
    console.error(
      '[SUPPORT_EMAIL_OUTBOX_MARK_FAILED]',
      error.code ?? 'UNKNOWN',
    );
  console.error('[SUPPORT_EMAIL_DELIVERY_FAILED]', {
    notificationId: row.id,
    attempts: nextAttemptNumber,
    reason: delivery.error,
  });
  return { sent: false, error: 'EMAIL_DELIVERY_FAILED' } as const;
}

export async function retryDueSupportEmailNotifications(admin: SupabaseClient) {
  const { data, error } = await admin
    .from('support_email_notifications')
    .select('id')
    .in('status', ['pending', 'processing', 'failed'])
    .lt('attempts', 5)
    .lte('next_attempt_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) throw new Error('SUPPORT_EMAIL_OUTBOX_LIST_FAILED');

  let sent = 0;
  let failed = 0;
  for (const row of data ?? []) {
    const result = await deliverSupportEmailNotification(admin, row.id);
    if (result.sent) sent += 1;
    else failed += 1;
  }
  return { processed: (data ?? []).length, sent, failed };
}
