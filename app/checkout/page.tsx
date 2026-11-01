import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { CustomCheckout } from '@/components/billing/custom-checkout';
import { verifyCheckoutIntent } from '@/lib/stripe/checkout-intent';
import { PaymentModeService } from '@/services/billing/payment-mode.service';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    intent?: string;
    checkout?: string;
    session_id?: string;
  }>;
}) {
  const cookieStore = await cookies();
  const english = cookieStore.get('locale')?.value === 'en';
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/registo');
  }

  const params = await searchParams;

  const paymentMode = await PaymentModeService.getPaymentMode();
  const tenant = await BarbershopStripeService.getTenantContext(user.id);
  const existingSubscription =
    await BarbershopStripeService.getSubscriptionForBarbershop(
      tenant.barbershopId,
    );
  const existingStripeSubscription = Boolean(
    existingSubscription?.payment_method === 'STRIPE' &&
    existingSubscription.stripe_subscription_id &&
    existingSubscription.plan !== 'free' &&
    ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(
      existingSubscription.status,
    ),
  );

  if (params.checkout === 'return') {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-50 sm:px-6 lg:px-8">
        <div className="glassmorphism mx-auto max-w-xl rounded-2xl border border-emerald-400/20 bg-zinc-900/70 p-7 text-center shadow-[0_24px_90px_rgba(0,0,0,0.28)] sm:p-9">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
            ✓
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-white">
            {english
              ? 'Subscription request received'
              : 'Pedido de subscrição recebido'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {english
              ? 'Stripe has completed checkout. Your subscription status will sync automatically.'
              : 'A Stripe terminou o processo de checkout. O estado da subscrição será sincronizado automaticamente.'}
          </p>
          <Link
            href="/dashboard/billing"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-zinc-950"
          >
            {english ? 'Go to billing' : 'Ir para faturação'}
          </Link>
        </div>
      </main>
    );
  }

  const token = params.intent?.trim() ?? '';
  const intent = token ? verifyCheckoutIntent(token) : null;

  if (!intent || intent.sub !== user.id) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 px-4 py-10 text-zinc-50">
        <div className="glassmorphism w-full max-w-xl rounded-2xl border border-red-400/20 bg-zinc-900/70 p-7 text-center shadow-[0_24px_90px_rgba(0,0,0,0.28)] sm:p-9">
          <h1 className="text-2xl font-semibold text-white">
            {english ? 'Checkout unavailable' : 'Checkout indisponível'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {english
              ? 'This checkout has expired or does not belong to your account. Start a new checkout from the plans page.'
              : 'Este checkout expirou ou não pertence à tua conta. Inicia um novo checkout a partir dos planos.'}
          </p>
          <Link
            href="/plans"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-zinc-950"
          >
            {english ? 'Back to plans' : 'Voltar aos planos'}
          </Link>
        </div>
      </main>
    );
  }

  if (paymentMode === 'MANUAL' && !existingStripeSubscription) {
    redirect(`/checkout/manual?intent=${encodeURIComponent(token)}`);
  }

  if (intent.barbershopId !== tenant.barbershopId) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 px-4 py-10 text-zinc-50">
        <div className="glassmorphism w-full max-w-xl rounded-2xl border border-red-400/20 bg-zinc-900/70 p-7 text-center shadow-[0_24px_90px_rgba(0,0,0,0.28)] sm:p-9">
          <h1 className="text-2xl font-semibold text-white">
            {english ? 'Checkout unavailable' : 'Checkout indisponível'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {english
              ? 'This checkout does not match the barbershop currently linked to your account.'
              : 'O checkout não corresponde à barbearia atualmente associada à tua conta.'}
          </p>
          <Link
            href="/dashboard/billing"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-zinc-950"
          >
            {english ? 'Go to billing' : 'Ir para faturação'}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-50 sm:px-6 sm:py-10 lg:px-8">
      {intent.plan === 'enterprise' && (
        <section className="mx-auto mb-5 flex max-w-6xl flex-col gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.045] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-sm font-semibold text-zinc-100">
              {english
                ? 'Would you also like a custom website?'
                : 'Queres também um site próprio?'}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              {english
                ? 'Your Enterprise plan includes a landing page and an address on the Silentra domain. A custom website can be activated for a one-time €50 fee, with no extra monthly charge.'
                : 'O plano Enterprise inclui uma landing page e um endereço no domínio Silentra. O site próprio pode ser ativado por 50 € (pagamento único), sem mensalidade adicional.'}
            </p>
          </div>
          <a
            href={`mailto:contact.silentra@gmail.com?subject=${encodeURIComponent(english ? 'Custom website Enterprise' : 'Site próprio Enterprise')}`}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-zinc-950 hover:bg-emerald-200"
          >
            {english ? 'Contact Silentra' : 'Contactar a Silentra'}
          </a>
        </section>
      )}
      <CustomCheckout checkoutToken={token} plan={intent.plan} />
    </main>
  );
}
