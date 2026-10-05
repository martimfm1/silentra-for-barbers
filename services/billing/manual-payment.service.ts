import { createAdminClient } from '@/lib/supabase/admin';
import {
  formatManualPrice,
  getManualPrice,
  type ManualBillingInterval,
} from '@/lib/billing/manual-pricing';
import { PLANS, type BillingPlan } from '@/lib/stripe/constants';
import { sendEmail } from '@/lib/notifications';
import { BillingError } from '@/types/stripe';

export type ManualRequestType = 'NEW' | 'RENEWAL' | 'CHANGE';
export type ManualRequestStatus =
  | 'PENDING'
  | 'PAYMENT_SENT'
  | 'PAID'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface ManualSubscriptionRequest {
  id: string;
  user_id: string;
  barbershop_id: string;
  subscription_id: string | null;
  request_type: ManualRequestType;
  plan: Exclude<BillingPlan, 'free'>;
  billing_interval: ManualBillingInterval;
  status: ManualRequestStatus;
  payment_method: 'MANUAL';
  price: number;
  currency: 'EUR';
  payment_link: string | null;
  payment_sent_at: string | null;
  paid_at: string | null;
  processed_at: string | null;
  started_at: string | null;
  expires_at: string | null;
  last_email_error: string | null;
  payment_email_message_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function uuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function validatePaymentLink(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BillingError(
      'O link de pagamento é obrigatório.',
      'INVALID_PRICE',
    );
  }

  if (trimmed.length > 2048) {
    throw new BillingError(
      'O link de pagamento é demasiado longo.',
      'INVALID_PRICE',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BillingError(
      'Introduz um URL de pagamento válido.',
      'INVALID_PRICE',
    );
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new BillingError(
      'O link de pagamento só pode utilizar http:// ou https://.',
      'INVALID_PRICE',
    );
  }

  if (parsed.username || parsed.password) {
    throw new BillingError(
      'O link de pagamento não pode conter credenciais embutidas.',
      'INVALID_PRICE',
    );
  }

  return trimmed;
}

function planLabel(plan: Exclude<BillingPlan, 'free'>) {
  return plan === PLANS.ENTERPRISE ? 'Barbers Enterprise' : 'Barbers Pro';
}

function requestTypeLabel(type: ManualRequestType) {
  return type === 'RENEWAL'
    ? 'renovação'
    : type === 'CHANGE'
      ? 'alteração de plano'
      : 'subscrição';
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

export class ManualPaymentService {
  static async getRequestForUser(
    userId: string,
  ): Promise<ManualSubscriptionRequest | null> {
    const { data, error } = await createAdminClient()
      .from('subscription_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new BillingError(
        'Não foi possível carregar o pedido de subscrição.',
        'DB_READ_FAILED',
        { userId },
      );
    }

    return (data as ManualSubscriptionRequest | null) ?? null;
  }

  static async listRequests(
    status?: ManualRequestStatus,
  ): Promise<ManualSubscriptionRequest[]> {
    let query = createAdminClient()
      .from('subscription_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error)
      throw new BillingError(
        'Não foi possível carregar os pedidos de subscrição.',
        'DB_READ_FAILED',
      );

    return (data ?? []) as ManualSubscriptionRequest[];
  }

  static async getRequest(
    requestId: string,
  ): Promise<ManualSubscriptionRequest | null> {
    if (!uuid(requestId)) return null;
    const { data, error } = await createAdminClient()
      .from('subscription_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (error)
      throw new BillingError(
        'Não foi possível carregar o pedido de subscrição.',
        'DB_READ_FAILED',
        { requestId },
      );

    return (data as ManualSubscriptionRequest | null) ?? null;
  }

  static async createRequest(input: {
    userId: string;
    barbershopId: string;
    plan: Exclude<BillingPlan, 'free'>;
    billingInterval?: ManualBillingInterval;
    requestType?: ManualRequestType;
  }): Promise<ManualSubscriptionRequest> {
    const interval = input.billingInterval ?? 'month';
    const requestType = input.requestType ?? 'NEW';
    const price = getManualPrice(input.plan, interval);

    if (!price) {
      throw new BillingError(
        'Este plano não está configurado para o período de faturação selecionado.',
        'INVALID_PRICE',
      );
    }

    const admin = createAdminClient();

    const { data: active, error: activeError } = await admin
      .from('subscriptions')
      .select(
        'id, plan, status, payment_method, current_period_end, barbershop_id',
      )
      .eq('barbershop_id', input.barbershopId)
      .maybeSingle();

    if (activeError)
      throw new BillingError(
        'Não foi possível verificar a subscrição atual.',
        'DB_READ_FAILED',
      );

    const hasActivePaid = Boolean(
      active &&
        active.plan !== PLANS.FREE &&
        ['active', 'trialing'].includes(active.status),
    );

    if (requestType === 'NEW' && hasActivePaid) {
      throw new BillingError(
        'A tua barbearia já tem uma subscrição ativa.',
        'SUBSCRIPTION_NOT_ACTIVE',
      );
    }

    if (
      requestType === 'RENEWAL' &&
      (!active || active.payment_method !== 'MANUAL')
    ) {
      throw new BillingError(
        'Só podes renovar uma subscrição criada através do modo manual.',
        'SUBSCRIPTION_NOT_FOUND',
      );
    }

    if (
      requestType === 'CHANGE' &&
      (!hasActivePaid || active?.payment_method !== 'MANUAL')
    ) {
      throw new BillingError(
        active?.payment_method === 'STRIPE'
          ? 'A subscrição atual é gerida pela Stripe e não pode ser alterada através do pagamento manual.'
          : 'Não foi encontrada uma subscrição manual ativa para alterar.',
        active?.payment_method === 'STRIPE'
          ? 'SUBSCRIPTION_NOT_ACTIVE'
          : 'SUBSCRIPTION_NOT_FOUND',
      );
    }

    if (requestType === 'CHANGE' && active?.plan === input.plan) {
      throw new BillingError(
        'O plano selecionado já é o plano atual.',
        'SUBSCRIPTION_NOT_ACTIVE',
      );
    }

    const { data: row, error } = await admin
      .from('subscription_requests')
      .insert({
        user_id: input.userId,
        barbershop_id: input.barbershopId,
        subscription_id:
          requestType === 'NEW' ? null : (active?.id ?? null),
        request_type: requestType,
        plan: input.plan,
        billing_interval: interval,
        status: 'PENDING',
        payment_method: 'MANUAL',
        price: Number(price.unitAmount.toFixed(2)),
        currency: price.currency,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BillingError(
          'Já existe um pedido de subscrição pendente para esta barbearia.',
          'SUBSCRIPTION_NOT_ACTIVE',
        );
      }
      throw new BillingError(
        'Não foi possível criar o pedido de subscrição.',
        'DB_WRITE_FAILED',
      );
    }

    return row as ManualSubscriptionRequest;
  }

  static async notifyAdmin(
    requestRow: ManualSubscriptionRequest,
    context: {
      customerName: string;
      customerEmail: string;
      barbershopName: string;
      appOrigin?: string;
    },
  ) {
    const adminEmail =
      process.env.SILENTRA_PLATFORM_ADMIN_EMAIL?.trim() ||
      process.env.ADMIN_EMAIL?.trim();
    if (!adminEmail) {
      console.error('[MANUAL_PAYMENT_ADMIN_EMAIL_MISSING]', {
        requestId: requestRow.id,
      });
      return { sent: false, error: 'Admin email is not configured.' };
    }

    const configuredBaseUrl =
      context.appOrigin?.trim() ||
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
      process.env.VERCEL_URL?.trim() ||
      'https://barbers.silentra.me';

    let baseUrl = 'https://barbers.silentra.me';
    try {
      const parsed = new URL(
        configuredBaseUrl.startsWith('http://') ||
          configuredBaseUrl.startsWith('https://')
          ? configuredBaseUrl
          : `https://${configuredBaseUrl}`,
      );
      parsed.pathname = '';
      parsed.search = '';
      parsed.hash = '';
      baseUrl = parsed.toString().replace(/\/$/, '');
    } catch {
      console.warn('[MANUAL_PAYMENT_ADMIN_URL_INVALID]', {
        configuredBaseUrl,
        requestId: requestRow.id,
      });
    }

    const adminUrl = new URL('/silentra-admin', baseUrl);
    adminUrl.searchParams.set('tab', 'payment_requests');
    adminUrl.searchParams.set('request_id', requestRow.id);
    const adminPath = adminUrl.toString();
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#18181b">
        <h2>Nova solicitação de subscrição — Silentra</h2>
        <p><strong>Cliente:</strong> ${escapeHtml(context.customerName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(context.customerEmail)}</p>
        <p><strong>Barbearia:</strong> ${escapeHtml(context.barbershopName)}</p>
        <p><strong>Plano:</strong> ${escapeHtml(planLabel(requestRow.plan))}</p>
        <p><strong>Preço:</strong> ${escapeHtml(formatManualPrice(requestRow.plan, requestRow.billing_interval))}</p>
        <p><strong>Data:</strong> ${escapeHtml(new Date(requestRow.created_at).toLocaleString('pt-PT'))}</p>
        <p><a href="${escapeHtml(adminPath)}" style="display:inline-block;padding:12px 18px;background:#18181b;color:#fff;text-decoration:none;border-radius:8px">VER SOLICITAÇÃO</a></p>
      </div>
    `;

    const result = await sendEmail(
      { email: adminEmail },
      {
        subject: 'Nova solicitação de subscrição — Silentra',
        body: `Nova solicitação de subscrição — ${planLabel(requestRow.plan)}.`,
        html,
        senderName: 'Silentra',
      },
    );

    return result.success
      ? { sent: true, messageId: result.messageId }
      : { sent: false, error: result.error };
  }

  static async sendPayment(
    requestId: string,
    paymentLink: string,
    actorUserId: string,
  ) {
    const link = validatePaymentLink(paymentLink);
    const row = await this.getRequest(requestId);
    if (!row)
      throw new BillingError(
        'Pedido de subscrição não encontrado.',
        'SUBSCRIPTION_NOT_FOUND',
      );

    if (!['PENDING', 'PAYMENT_SENT'].includes(row.status)) {
      throw new BillingError(
        'Este pedido já não pode receber um pagamento.',
        'SUBSCRIPTION_NOT_ACTIVE',
      );
    }

    const admin = createAdminClient();
    const { data: customer, error: customerError } = await admin
      .from('users')
      .select('id, name_complete, email')
      .eq('id', row.user_id)
      .maybeSingle();
    if (customerError || !customer?.email)
      throw new BillingError(
        'Não foi possível encontrar o email do cliente.',
        'DB_READ_FAILED',
      );

    const { data: shop, error: shopError } = await admin
      .from('barbershops')
      .select('name')
      .eq('id', row.barbershop_id)
      .maybeSingle();
    if (shopError || !shop)
      throw new BillingError(
        'Não foi possível encontrar a barbearia.',
        'DB_READ_FAILED',
      );

    await admin
      .from('subscription_requests')
      .update({
        payment_link: link,
        last_email_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#18181b">
        <h2>Pagamento da tua subscrição Silentra</h2>
        <p>Olá, ${escapeHtml(customer.name_complete ?? 'Cliente')}.</p>
        <p>A tua solicitação de ${escapeHtml(requestTypeLabel(row.request_type))} do plano <strong>${escapeHtml(planLabel(row.plan))}</strong> foi processada.</p>
        <p><strong>Valor:</strong> ${escapeHtml(formatManualPrice(row.plan, row.billing_interval))}</p>
        <p>Para concluir a ativação da tua subscrição, utiliza o botão abaixo.</p>
        <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 18px;background:#18181b;color:#fff;text-decoration:none;border-radius:8px">EFETUAR PAGAMENTO</a></p>
        <p>Depois de o pagamento ser confirmado, a tua subscrição será ativada.</p>
        <p>Obrigado,<br>Equipa Silentra</p>
      </div>
    `;

    const emailResult = await sendEmail(
      {
        email: customer.email,
        userId: customer.id,
      },
      {
        subject: 'Pagamento da tua subscrição Silentra',
        body: 'Foi disponibilizado um link para concluir o pagamento da tua subscrição.',
        html,
        senderName: 'Silentra',
      },
    );

    if (!emailResult.success) {
      await admin
        .from('subscription_requests')
        .update({
          last_email_error: emailResult.error ?? 'Email failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      return {
        sent: false as const,
        error: emailResult.error ?? 'Não foi possível enviar o email.',
      };
    }

    const sentAt = new Date().toISOString();
    const { error: markSentError } = await admin
      .from('subscription_requests')
      .update({
        status: 'PAYMENT_SENT',
        payment_sent_at: sentAt,
        payment_email_message_id: emailResult.messageId ?? null,
        last_email_error: null,
        updated_at: sentAt,
      })
      .eq('id', row.id)
      .in('status', ['PENDING', 'PAYMENT_SENT']);

    if (markSentError) {
      console.error('[MANUAL_PAYMENT_MARK_SENT_ERROR]', {
        requestId: row.id,
        actorUserId,
      });
      return {
        sent: false as const,
        error:
          'O email foi enviado, mas não foi possível atualizar o estado do pedido. Tenta novamente.',
      };
    }

    await admin.from('audit_logs').insert({
      action: 'PAYMENT_LINK_SENT',
      entity_type: 'subscription_request',
      entity_id: row.id,
      metadata: {
        actor_user_id: actorUserId,
        barbershop_id: row.barbershop_id,
        user_id: row.user_id,
        request_type: row.request_type,
      },
      created_at: sentAt,
    });

    return { sent: true as const, messageId: emailResult.messageId };
  }

  static async confirmPayment(requestId: string, actorUserId: string) {
    if (!uuid(requestId))
      throw new BillingError(
        'Pedido de subscrição inválido.',
        'SUBSCRIPTION_NOT_FOUND',
      );

    const admin = createAdminClient();
    const { data, error } = await admin.rpc(
      'activate_manual_subscription_payment',
      {
        p_request_id: requestId,
        p_actor_user_id: actorUserId,
      },
    );

    if (error) {
      const known: Record<string, string> = {
        PAYMENT_NOT_READY_FOR_CONFIRMATION:
          'O pagamento ainda não foi enviado ao cliente.',
        PAYMENT_LINK_NOT_SENT:
          'É necessário enviar primeiro o link de pagamento.',
        ACTIVE_MANUAL_SUBSCRIPTION_EXISTS:
          'Esta barbearia já tem uma subscrição manual ativa.',
        ACTIVE_STRIPE_SUBSCRIPTION_EXISTS:
          'Esta barbearia já tem uma subscrição Stripe ativa. Não é seguro convertê-la através deste pedido manual.',
        SUBSCRIPTION_REQUEST_NOT_FOUND:
          'Pedido de subscrição não encontrado.',
        MANUAL_SUBSCRIPTION_NOT_FOUND:
          'Não foi encontrada uma subscrição manual válida para esta operação.',
        PLAN_ALREADY_ACTIVE:
          'O plano selecionado já está ativo nesta barbearia.',
        USER_SUBSCRIPTION_TENANT_CONFLICT:
          'A conta já está associada a uma subscrição de outra barbearia. Corrige a associação antes de confirmar este pagamento.',
        INVALID_CONFIRMATION_REQUEST:
          'Os dados de confirmação do pagamento são inválidos.',
      };

      // PGRST202 means the database function is missing from PostgREST's
      // schema cache. Keep this actionable instead of reporting a generic
      // "subscription not active" error.
      const isRpcUnavailable =
        error.code === 'PGRST202' ||
        /could not find the function|function .*activate_manual_subscription_payment.*does not exist/i.test(
          error.message ?? '',
        );

      console.error('[MANUAL_PAYMENT_CONFIRMATION_RPC_ERROR]', {
        requestId,
        actorUserId,
        code: error.code ?? null,
        message: error.message ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
      });

      const rpcMessage = error.message ?? '';
      const knownCode =
        isRpcUnavailable
          ? 'DB_WRITE_FAILED'
          : rpcMessage === 'SUBSCRIPTION_REQUEST_NOT_FOUND'
            ? 'SUBSCRIPTION_NOT_FOUND'
            : rpcMessage === 'MANUAL_SUBSCRIPTION_NOT_FOUND'
              ? 'SUBSCRIPTION_NOT_FOUND'
              : rpcMessage === 'PAYMENT_NOT_READY_FOR_CONFIRMATION'
                ? 'MANUAL_REQUEST_INVALID'
                : rpcMessage === 'PAYMENT_LINK_NOT_SENT'
                  ? 'MANUAL_REQUEST_INVALID'
                  : rpcMessage === 'INVALID_CONFIRMATION_REQUEST'
                    ? 'MANUAL_REQUEST_INVALID'
                    : rpcMessage === 'ACTIVE_MANUAL_SUBSCRIPTION_EXISTS'
                      ? 'SUBSCRIPTION_NOT_ACTIVE'
                      : rpcMessage === 'ACTIVE_STRIPE_SUBSCRIPTION_EXISTS'
                        ? 'SUBSCRIPTION_NOT_ACTIVE'
                        : rpcMessage === 'PLAN_ALREADY_ACTIVE'
                          ? 'SUBSCRIPTION_NOT_ACTIVE'
                          : rpcMessage === 'USER_SUBSCRIPTION_TENANT_CONFLICT'
                            ? 'SUBSCRIPTION_NOT_ACTIVE'
                            : 'DB_WRITE_FAILED';

      console.error('[MANUAL_PAYMENT_CONFIRMATION_FAILED]', {
        requestId,
        actorUserId,
        rpcCode: error.code ?? null,
        rpcMessage: rpcMessage || null,
        billingCode: knownCode,
      });

      throw new BillingError(
        isRpcUnavailable
          ? 'O serviço de confirmação de pagamentos ainda não está sincronizado com a base de dados. Aplica as migrações pendentes e atualiza o schema do Supabase.'
          : (known[rpcMessage] ??
              'Não foi possível confirmar o pagamento. Verifica os registos de faturação e tenta novamente.'),
        knownCode,
      );
    }

    const confirmation = Array.isArray(data) ? data[0] : data;
    if (!confirmation) {
      throw new BillingError(
        'A confirmação não devolveu o estado da subscrição.',
        'DB_WRITE_FAILED',
      );
    }

    let emailSent = true;
    const user = await admin
      .from('users')
      .select('name_complete,email')
      .eq('id', confirmation.user_id)
      .maybeSingle();

    if (user.data?.email) {
      const result = await sendEmail(
        { email: user.data.email, userId: confirmation.user_id },
        {
          subject: 'A tua subscrição Silentra está ativa',
          body: 'O teu pagamento foi confirmado e a subscrição está ativa.',
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#18181b">
              <h2>A tua subscrição Silentra está ativa</h2>
              <p>Olá, ${escapeHtml(user.data.name_complete ?? 'Cliente')}.</p>
              <p>O pagamento foi confirmado.</p>
              <p><strong>Plano:</strong> ${escapeHtml(planLabel(confirmation.plan as 'pro' | 'enterprise'))}</p>
              <p><strong>Início:</strong> ${escapeHtml(new Date(confirmation.started_at).toLocaleString('pt-PT'))}</p>
              <p><strong>Próxima renovação:</strong> ${escapeHtml(new Date(confirmation.expires_at).toLocaleString('pt-PT'))}</p>
              <p><strong>Estado:</strong> Ativo</p>
              <p>Obrigado,<br>Equipa Silentra</p>
            </div>
          `,
          senderName: 'Silentra',
        },
      );
      emailSent = result.success;
      if (!result.success)
        console.error('[MANUAL_PAYMENT_ACTIVATION_EMAIL_ERROR]', {
          requestId,
          error: result.error,
        });
    }

    return {
      ...confirmation,
      emailSent,
    };
  }

  static async reject(requestId: string, actorUserId: string, reason?: string) {
    const row = await this.getRequest(requestId);
    if (!row)
      throw new BillingError(
        'Pedido de subscrição não encontrado.',
        'SUBSCRIPTION_NOT_FOUND',
      );

    if (!['PENDING', 'PAYMENT_SENT'].includes(row.status)) {
      throw new BillingError(
        'Este pedido já não está pendente.',
        'SUBSCRIPTION_NOT_ACTIVE',
      );
    }

    const now = new Date().toISOString();
    const { error } = await createAdminClient()
      .from('subscription_requests')
      .update({
        status: 'REJECTED',
        processed_at: now,
        notes: reason?.trim().slice(0, 500) || null,
        updated_at: now,
      })
      .eq('id', row.id)
      .in('status', ['PENDING', 'PAYMENT_SENT']);

    if (error)
      throw new BillingError(
        'Não foi possível rejeitar o pedido.',
        'DB_WRITE_FAILED',
      );

    await createAdminClient().from('audit_logs').insert({
      action: 'PAYMENT_REJECTED',
      entity_type: 'subscription_request',
      entity_id: row.id,
      metadata: {
        actor_user_id: actorUserId,
        barbershop_id: row.barbershop_id,
        reason: reason?.trim().slice(0, 500) || null,
      },
      created_at: now,
    });

    return { success: true };
  }
}
