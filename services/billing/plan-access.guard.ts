import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { SubscriptionService } from './subscription.service';
import { PLANS } from '@/lib/stripe/constants';
import type { BillingPlan } from '@/types/stripe';

/**
 * Resolves the plan that grants access for the authenticated request.
 * Only active/trialing paid subscriptions grant Pro/Enterprise.
 * Checkout-in-progress, incomplete, past_due, canceled, or unpaid do not.
 */
export async function getAccessPlanForRequest(
  request?: Request,
  permissionKeys: readonly string[] = [],
): Promise<
  | {
      ok: true;
      userId: string;
      plan: BillingPlan;
      barbershopId: string | null;
      role: string;
      permissionGranted: boolean;
    }
  | { ok: false; status: 401 }
> {
  let userId: string | null = null;

  if (request) {
    const user = await getCurrentUser(request);
    userId = user?.id ?? null;
  } else {
    const {
      data: { user },
      error,
    } = await (await createClient()).auth.getUser();
    if (!error && user) userId = user.id;
  }

  if (!userId) return { ok: false, status: 401 };

  // Read plan, tenant and module permissions together. Stripe is reconciled
  // asynchronously by the billing/webhook flows, never during normal auth.
  const context = await SubscriptionService.getAccessContextForUser(
    userId,
    permissionKeys,
  );
  return {
    ok: true,
    userId,
    plan: context.plan,
    barbershopId: context.barbershopId,
    role: context.role,
    permissionGranted: context.permissionGranted,
  };
}

/** Returns the plan for a given user without requiring a request context. */
export async function resolveAccessPlanForUser(
  userId: string,
): Promise<BillingPlan> {
  return SubscriptionService.getAccessPlan(userId);
}

export function requirePaidPlan(
  plan: BillingPlan,
): asserts plan is 'pro' | 'enterprise' {
  if (plan === PLANS.FREE) {
    throw new Error('Este recurso requer um plano pago ativo.');
  }
}
