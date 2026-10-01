import { useMutation } from '@tanstack/react-query';

export interface UseCheckoutParams {
  priceId: string;
  plan?: 'pro' | 'enterprise';
  successUrl?: string;
  cancelUrl?: string;
}

export function useCheckout() {
  const checkoutMutation = useMutation({
    mutationFn: async ({ priceId, plan = 'pro' }: UseCheckoutParams) => {
      window.location.assign(
        `/checkout?priceId=${encodeURIComponent(priceId)}&plan=${plan}`,
      );
      return {
        url: `/checkout?priceId=${encodeURIComponent(priceId)}&plan=${plan}`,
      };
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
