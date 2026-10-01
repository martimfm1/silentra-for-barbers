import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hasActivePaidSubscription } from '@/lib/billing/plan-access';

export interface SubscriptionData {
  id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status:
    | 'active'
    | 'trialing'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'incomplete'
    | 'incomplete_expired'
    | 'paused';
  cancel_at_period_end: boolean;
  payment_method: 'MANUAL' | 'STRIPE';
  current_period_start?: string | null;
  current_period_end: string | null;
  plan: 'free' | 'pro' | 'enterprise';
}

export interface ManualSubscriptionRequest {
  id: string;
  plan: 'pro' | 'enterprise';
  billingInterval: 'month' | 'year';
  status:
    | 'PENDING'
    | 'PAYMENT_SENT'
    | 'PAID'
    | 'REJECTED'
    | 'EXPIRED'
    | 'CANCELLED';
  price: number;
  currency: string;
  paymentLink: string | null;
  paymentSentAt: string | null;
  createdAt: string;
  startedAt: string | null;
  expiresAt: string | null;
}

export interface SubscriptionCancellation {
  canceledAt: string | null;
  canceledByName: string | null;
  canceledByEmail: string | null;
  previousPlan: 'free' | 'pro' | 'enterprise' | null;
  requestedAt: string | null;
}

interface SubscriptionQueryResult {
  subscription: SubscriptionData | null;
  plan: 'free' | 'pro' | 'enterprise';
  planSource: 'free' | 'admin' | 'subscription_override' | 'stripe' | 'manual';
  cancellation: SubscriptionCancellation | null;
  isAuthenticated: boolean;
  isBillingOwner: boolean;
  barbershopId: string | null;
  barbershopName: string | null;
  billingInterval: 'month' | 'year' | null;
  paymentMode: 'MANUAL' | 'STRIPE';
  manualRequest: ManualSubscriptionRequest | null;
}

async function fetchSubscription(): Promise<SubscriptionQueryResult> {
  const searchParams =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : null;
  const checkoutSessionId = searchParams?.get('session_id')?.trim();

  const endpoint = checkoutSessionId
    ? `/api/stripe/subscription?session_id=${encodeURIComponent(checkoutSessionId)}`
    : '/api/stripe/billing-summary';

  const res = await fetch(endpoint, { cache: 'no-store' });
  if (!res.ok) {
    if (res.status === 401) {
      return {
        subscription: null,
        plan: 'free',
        planSource: 'free',
        cancellation: null,
        isAuthenticated: false,
        isBillingOwner: false,
        barbershopId: null,
        barbershopName: null,
        billingInterval: null,
        paymentMode: 'MANUAL',
        manualRequest: null,
      };
    }
    throw new Error('Failed to fetch subscription data.');
  }

  const json = await res.json();
  return {
    subscription: json.subscription ?? null,
    plan: json.plan ?? 'free',
    planSource: json.planSource ?? 'free',
    cancellation: json.cancellation ?? null,
    isAuthenticated: true,
    isBillingOwner: Boolean(json.isBillingOwner),
    barbershopId: json.barbershopId ?? null,
    barbershopName: json.barbershopName ?? null,
    billingInterval:
      json.billingInterval === 'year' || json.billingInterval === 'month'
        ? json.billingInterval
        : null,
    paymentMode: json.paymentMode === 'STRIPE' ? 'STRIPE' : 'MANUAL',
    manualRequest: json.manualRequest
      ? {
          id: json.manualRequest.id,
          plan: json.manualRequest.plan,
          billingInterval: json.manualRequest.billing_interval,
          status: json.manualRequest.status,
          price: Number(json.manualRequest.price),
          currency: json.manualRequest.currency ?? 'EUR',
          paymentLink: json.manualRequest.payment_link ?? null,
          paymentSentAt: json.manualRequest.payment_sent_at ?? null,
          createdAt: json.manualRequest.created_at,
          startedAt: json.manualRequest.started_at ?? null,
          expiresAt: json.manualRequest.expires_at ?? null,
        }
      : null,
  };
}

export function useSubscription() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<SubscriptionQueryResult>({
    queryKey: ['user-subscription'],
    queryFn: fetchSubscription,
    staleTime: 30_000,
    gcTime: 1000 * 60 * 10,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const isAuthenticated = data?.isAuthenticated ?? false;
  const isBillingOwner = data?.isBillingOwner ?? false;
  const plan = data?.plan ?? 'free';
  const planSource = data?.planSource ?? 'free';
  const subscription = data?.subscription
    ? { ...data.subscription, plan }
    : null;
  const cancellation = data?.cancellation ?? null;

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/stripe/cancel', { method: 'POST' });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to cancel subscription.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-subscription'] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/stripe/resume', { method: 'POST' });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to resume subscription.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-subscription'] });
    },
  });

  const isAdministrativePlan = planSource === 'admin';
  const isPro =
    plan === 'pro' &&
    (isAdministrativePlan || hasActivePaidSubscription(subscription));
  const isBusiness =
    plan === 'enterprise' &&
    (isAdministrativePlan || hasActivePaidSubscription(subscription));
  const isTrial = subscription?.status === 'trialing';
  const loading =
    isLoading || cancelMutation.isPending || resumeMutation.isPending;

  return {
    subscription,
    cancellation,
    isAuthenticated,
    isBillingOwner,
    plan,
    planSource,
    isAdministrativePlan,
    isPro,
    isBusiness,
    isTrial,
    loading,
    barbershopId: data?.barbershopId ?? null,
    barbershopName: data?.barbershopName ?? null,
    billingInterval: data?.billingInterval ?? null,
    paymentMode: data?.paymentMode ?? 'MANUAL',
    manualRequest: data?.manualRequest ?? null,
    cancel: cancelMutation.mutateAsync,
    resume: resumeMutation.mutateAsync,
    upgrade: async () => {
      window.location.assign('/plans');
    },
    checkout: async ({
      priceId,
      plan: requestedPlan = 'pro',
    }: {
      priceId: string;
      plan?: 'pro' | 'enterprise';
    }) => {
      window.location.assign(
        `/checkout?priceId=${encodeURIComponent(priceId)}&plan=${requestedPlan}`,
      );
    },
  };
}
