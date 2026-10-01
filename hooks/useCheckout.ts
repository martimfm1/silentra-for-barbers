import { useMutation } from '@tanstack/react-query';

export interface UseCheckoutParams {
  plan: 'pro' | 'enterprise';
  interval?: 'month' | 'year';
}

export function useCheckout() {
  const checkoutMutation = useMutation({
    mutationFn: async ({ plan, interval = 'month' }: UseCheckoutParams) => {
      const response = await fetch('/api/stripe/checkout-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ plan, interval }),
        cache: 'no-store',
      });

      const body = (await response.json().catch(() => ({}))) as {
        checkoutToken?: string;
        error?: string;
      };

      if (!response.ok || typeof body.checkoutToken !== 'string') {
        throw new Error(body.error ?? 'Não foi possível iniciar o checkout.');
      }

      window.location.assign(
        '/checkout?intent=' + encodeURIComponent(body.checkoutToken),
      );

      return { token: body.checkoutToken };
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
