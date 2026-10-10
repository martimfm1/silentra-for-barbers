import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import { getStripeClient } from '@/lib/stripe/server';
import { PLANS, NEW_MEMBER_PRO_PROMOTION_CODE } from '@/lib/stripe/constants';
import { PLAN_ACCESS_STATUSES } from '@/lib/billing/plan-access';
import { BillingError } from '@/types/stripe';
import {
  assertSameOrigin,
  billingErrorResponse,
  readJsonObject,
} from '@/services/billing/http';
import { verifyCheckoutIntent } from '@/lib/stripe/checkout-intent';
import { StripePriceService } from '@/services/billing/stripe-price.service';
import { PaymentModeService } from '@/services/billing/payment-mode.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHECKOUT_IDEMPOTENCY_BUCKET_MS = 10 * 60 * 1000;

async function recoverBillingCustomer(
  userId: string,
  barbershopId: string,
  email: string,
): Promise<string> {
  const database = createAdminClient();
  const customer = await getStripeClient().customers.create(
    {
      email,
      metadata: {
        app: 'silentra-for-barbers',
        barbershop_id: barbershopId,
        billing_owner_user_id: userId,
        recovery: 'true',
      },
    },
    {
      idempotencyKey: `barbershop-customer-recovery:${barbershopId}:${Date.now()}`,
    },
  );

  const { error: billingAccountError } = await database
    .from('barbershop_billing_accounts')
    .upsert(
      {
        barbershop_id: barbershopId,
        billing_owner_user_id: userId,
        stripe_customer_id: customer.id,
        billing_email: email,
      },
      { onConflict: 'barbershop_id' },
    );

  if (billingAccountError) {
    throw new BillingError(
      'Could not persist the recovered Stripe billing account.',
      'DB_WRITE_FAILED',
    );
  }

  return customer.id;
}

async function hasStripeBillingHistory(customerId: string): Promise<boolean> {
  const stripe = getStripeClient();

  const [subscriptions, invoices] = await Promise.all([
    stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 1,
    }),
    stripe.invoices.list({
      customer: customerId,
      limit: 1,
    }),
  ]);

  return subscriptions.data.length > 0 || invoices.data.length > 0;
}

function stripeErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function checkoutErrorResponse(error: unknown) {
  if (error instanceof BillingError) {
    const messages: Record<string, string> = {
      INVALID_PRICE: 'O plano selecionado não está disponível neste momento.',
      CUSTOMER_NOT_FOUND:
        'A conta de pagamento não está disponível. Atualiza a página e tenta novamente.',
      SUBSCRIPTION_NOT_FOUND:
        'Não foi encontrada uma subscrição válida para esta operação.',
      SUBSCRIPTION_NOT_ACTIVE:
        'Já existe uma subscrição ativa para esta barbearia.',
      PROMOTION_NOT_ELIGIBLE:
        'Esta oferta é exclusiva para novos clientes e não está disponível para esta conta.',
      CHECKOUT_RESOURCE_MISSING:
        'A configuração de pagamento deixou de estar disponível. Atualiza a página e tenta novamente.',
      CHECKOUT_FAILED:
        'Não foi possível iniciar o checkout neste momento. Tenta novamente.',
      DB_READ_FAILED:
        'Não foi possível carregar os dados de faturação. Tenta novamente.',
      DB_WRITE_FAILED:
        'Não foi possível guardar o estado de faturação. Tenta novamente.',
      WEBHOOK_VERIFICATION_FAILED:
        'Não foi possível validar a operação de pagamento.',
      WEBHOOK_PROCESSING_FAILED:
        'Não foi possível concluir a preparação do checkout. Tenta novamente.',
      BILLING_NOT_CONFIGURED:
        'A faturação ainda não está configurada para esta conta.',
    };

    const status =
      error.code === 'INVALID_PRICE'
        ? 400
        : error.code === 'SUBSCRIPTION_NOT_ACTIVE' ||
            error.code === 'PROMOTION_NOT_ELIGIBLE' ||
            error.code === 'CHECKOUT_RESOURCE_MISSING'
          ? 409
          : 500;

    return {
      status,
      code: error.code,
      message: messages[error.code] ?? 'Não foi possível iniciar o checkout.',
    };
  }

  const message =
    error instanceof Error
      ? error.message
      : 'Não foi possível iniciar o checkout.';

  if (
    /prior transactions|first[_ -]?time transaction|cannot be redeemed/i.test(
      message,
    )
  ) {
    return {
      status: 409,
      code: 'PROMOTION_NOT_ELIGIBLE' as const,
      message:
        'Esta oferta é exclusiva para novos clientes. A tua subscrição anterior não impede uma nova subscrição, mas esta oferta já não está disponível para esta conta.',
    };
  }

  const code = stripeErrorCode(error);
  if (code === 'resource_missing') {
    return {
      status: 409,
      code: 'CHECKOUT_RESOURCE_MISSING' as const,
      message:
        'A configuração de pagamento deixou de estar disponível. Atualiza a página e tenta novamente.',
    };
  }

  return {
    status: 502,
    code: 'CHECKOUT_FAILED' as const,
    message:
      'Não foi possível iniciar o checkout neste momento. Os teus dados de faturação não foram alterados. Tenta novamente.',
  };
}

async function resolveNewMemberPromotionCodeId(): Promise<string> {
  const promotions = await getStripeClient().promotionCodes.list({
    code: NEW_MEMBER_PRO_PROMOTION_CODE,
    active: true,
    limit: 1,
  });

  const promotion = promotions.data[0];
  if (!promotion) {
    throw new BillingError(
      'A oferta de novos membros não está disponível neste momento.',
      'WEBHOOK_PROCESSING_FAILED',
    );
  }

  return promotion.id;
}

async function POST__unobserved(request: Request) {
  try {
    assertSameOrigin(request);

    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await readJsonObject(request);
    const checkoutToken =
      typeof body.checkoutToken === 'string' ? body.checkoutToken.trim() : '';
    if (!checkoutToken) {
      throw new BillingError(
        'O checkout não foi autorizado. Inicia novamente a partir dos planos.',
        'CHECKOUT_INTENT_INVALID',
      );
    }

    const intent = verifyCheckoutIntent(checkoutToken);
    if (!intent || intent.sub !== user.id) {
      throw new BillingError(
        'O checkout expirou ou não pertence a esta conta. Inicia novamente a partir dos planos.',
        'CHECKOUT_INTENT_INVALID',
      );
    }

    const tenant = await BarbershopStripeService.getTenantContext(user.id);
    if (intent.barbershopId !== tenant.barbershopId) {
      throw new BillingError(
        'O checkout não pertence a esta barbearia.',
        'CHECKOUT_INTENT_INVALID',
      );
    }

    // Verification 2: resolve and validate the actual Stripe Price again on
    // the server. A modified or stale signed intent can never select another
    // arbitrary Stripe price.
    const verifiedPrice = await StripePriceService.resolveVerifiedPrice(
      intent.plan,
      intent.interval,
    );
    const priceId = verifiedPrice.id;
    const requestedPlan = intent.plan;
    const existing = await BarbershopStripeService.reconcileSubscription(
      tenant.barbershopId,
      await BarbershopStripeService.getSubscriptionForBarbershop(
        tenant.barbershopId,
      ),
    );

    const hasActivePaidSubscription = Boolean(
      existing?.stripe_subscription_id &&
      existing.plan !== PLANS.FREE &&
      (PLAN_ACCESS_STATUSES as readonly string[]).includes(existing.status),
    );

    const paymentMode = await PaymentModeService.getPaymentMode();
    const existingIsManual = existing?.payment_method === 'MANUAL';
    if (
      (hasActivePaidSubscription && existingIsManual) ||
      (!hasActivePaidSubscription && paymentMode === 'MANUAL')
    ) {
      throw new BillingError(
        'Os pagamentos Stripe estão atualmente desativados.',
        'PAYMENT_MODE_STRIPE_DISABLED',
      );
    }
    const previousSubscriptionId = hasActivePaidSubscription
      ? (existing?.stripe_subscription_id ?? null)
      : null;

    let customer: string;
    try {
      customer = await BarbershopStripeService.getOrCreateCustomer(user.id);
    } catch (error) {
      if (
        !(error instanceof BillingError) ||
        error.code !== 'CUSTOMER_NOT_FOUND'
      )
        throw error;
      customer = await recoverBillingCustomer(
        user.id,
        tenant.barbershopId,
        tenant.email,
      );
    }

    const hasBillingHistory =
      Boolean(existing?.stripe_subscription_id) ||
      (await hasStripeBillingHistory(customer));

    const isNewMemberProOffer =
      requestedPlan === PLANS.PRO && !hasBillingHistory;
    const promotionCodeId = isNewMemberProOffer
      ? await resolveNewMemberPromotionCodeId()
      : null;

    let appOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!appOrigin) {
      try {
        appOrigin = new URL(request.url).origin;
      } catch {
        appOrigin = 'https://barbers.silentra.me';
      }
    }
    if (!appOrigin.startsWith('http://') && !appOrigin.startsWith('https://')) {
      appOrigin = `https://${appOrigin}`;
    }

    const returnUrl = `${appOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const bucket = Math.floor(Date.now() / CHECKOUT_IDEMPOTENCY_BUCKET_MS);

    const session = await getStripeClient().checkout.sessions.create(
      {
        customer,
        mode: 'subscription',
        ui_mode: 'elements',
        line_items: [{ price: priceId, quantity: 1 }],
        return_url: returnUrl,
        client_reference_id: tenant.barbershopId,
        ...(promotionCodeId
          ? { discounts: [{ promotion_code: promotionCodeId }] }
          : { allow_promotion_codes: true }),
        metadata: {
          app: 'silentra-for-barbers',
          user_id: tenant.userId,
          barbershop_id: tenant.barbershopId,
          stripe_customer_id: customer,
          plan: requestedPlan,
          new_member_offer: isNewMemberProOffer
            ? NEW_MEMBER_PRO_PROMOTION_CODE
            : 'none',
          previous_subscription_id: previousSubscriptionId ?? 'none',
          is_plan_change: previousSubscriptionId ? 'true' : 'false',
        },
        subscription_data: {
          metadata: {
            app: 'silentra-for-barbers',
            user_id: tenant.userId,
            barbershop_id: tenant.barbershopId,
            new_member_offer: isNewMemberProOffer
              ? NEW_MEMBER_PRO_PROMOTION_CODE
              : 'none',
            previous_subscription_id: previousSubscriptionId ?? 'none',
            is_plan_change: previousSubscriptionId ? 'true' : 'false',
          },
        },
        billing_address_collection: 'required',
        customer_update: { name: 'auto', address: 'auto' },
        tax_id_collection: { enabled: true },
        locale: 'pt',
      },
      {
        idempotencyKey: `checkout-elements:${tenant.barbershopId}:${intent.jti}:${bucket}`,
      },
    );

    if (!session.client_secret) {
      throw new BillingError(
        'Stripe did not return a Checkout Elements client secret.',
        'WEBHOOK_PROCESSING_FAILED',
      );
    }

    return NextResponse.json(
      {
        clientSecret: session.client_secret,
        sessionId: session.id,
        planChange: previousSubscriptionId
          ? { previousSubscriptionId, targetPlan: requestedPlan }
          : null,
        newMemberOffer: isNewMemberProOffer
          ? { code: NEW_MEMBER_PRO_PROMOTION_CODE, months: 1 }
          : null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const mapped = checkoutErrorResponse(error);
    const billingResponse = billingErrorResponse(error);

    console.error('[STRIPE_CUSTOM_CHECKOUT_ERROR]', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      code: error instanceof BillingError ? error.code : stripeErrorCode(error),
      publicCode: mapped.code,
    });

    return NextResponse.json(
      {
        error: mapped.message,
        code: mapped.code,
      },
      {
        status:
          error instanceof BillingError
            ? billingResponse.status
            : mapped.status,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}

export const POST = withApiObservability('/api/stripe/embedded-checkout', POST__unobserved);
