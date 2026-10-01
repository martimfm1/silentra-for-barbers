import { useMutation } from '@tanstack/react-query';

export interface UseCheckoutParams {
  plan: 'pro' | 'enterprise';
  interval?: 'month' | 'year';
}

export function useCheckout() {
  const checkoutMutation = useMutation({
    mutationFn: async ({
      plan,
      interval = 'month',
    }: UseCheckoutParams) => {
      const response = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ plan, interval }),
        cache: 'no-store',
      });
      const body = (await response.json().catch(() => ({}))) as {
        redirectUrl?: string;
        message?: string;
        error?: string;
        mode?: 'MANUAL' | 'STRIPE';
      };

      if (!response.ok) {
        throw new Error(
          body.error ?? 'Não foi possível iniciar a subscrição.',
        );
      }

      if (typeof body.redirectUrl !== 'string') {
        if (body.mode === 'MANUAL') {
          window.location.assign('/dashboard/billing?manual=pending');
        }
        throw new Error(
          body.message ?? 'Não foi possível iniciar a subscrição.',
        );
      }

      window.location.assign(body.redirectUrl);
      return { url: body.redirectUrl, mode: body.mode };
    },
  });

  return {
    checkout: checkoutMutation.mutateAsync,
    loading: checkoutMutation.isPending,
    error: checkoutMutation.error
      ? (checkoutMutation.error as Error).message
      : null,
  };
}
