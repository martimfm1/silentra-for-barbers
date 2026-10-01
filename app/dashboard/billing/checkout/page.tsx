import { redirect } from 'next/navigation';

export default async function BillingCheckoutPage() {
  redirect('/plans');
}
