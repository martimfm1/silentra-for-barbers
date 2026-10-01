import { redirect } from 'next/navigation';

export default async function BillingCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ priceId?: string; plan?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.priceId) query.set('priceId', params.priceId);
  if (params.plan) query.set('plan', params.plan);
  redirect(`/plans${query.toString() ? `?${query.toString()}` : ''}`);
}
