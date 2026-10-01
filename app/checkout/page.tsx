import { redirect } from 'next/navigation';
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

  if (paymentMode === 'MANUAL' && !existingStripeSubscription) {
    redirect('/plans?payment=manual');
  }

  if (params.checkout === 'return') {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-50 sm:px-6 lg:px-8">
        <div className="glassmorphism mx-auto max-w-xl rounded-2xl border border-emerald-400/20 bg-zinc-900/70 p-7 text-center shadow-[0_24px_90px_rgba(0,0,0,0.28)] sm:p-9">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
            ✓
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-white">
            Pedido de subscrição recebido
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            A Stripe terminou o processo de checkout. O estado da subscrição
            será sincronizado automaticamente.
          </p>
          <a
            href="/dashboard/billing"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-zinc-950"
          >
            Ir para faturação
          </a>
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
            Checkout indisponível
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Este checkout expirou ou não pertence à tua conta. Inicia um novo
            checkout a partir dos planos.
          </p>
          <a
            href="/plans"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-zinc-950"
          >
            Voltar aos planos
          </a>
        </div>
      </main>
    );
  }

  if (intent.barbershopId !== tenant.barbershopId) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 px-4 py-10 text-zinc-50">
        <div className="glassmorphism w-full max-w-xl rounded-2xl border border-red-400/20 bg-zinc-900/70 p-7 text-center shadow-[0_24px_90px_rgba(0,0,0,0.28)] sm:p-9">
          <h1 className="text-2xl font-semibold text-white">
            Checkout indisponível
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            O checkout não corresponde à barbearia atualmente associada à tua
            conta.
          </p>
          <a
            href="/dashboard/billing"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-zinc-950"
          >
            Ir para faturação
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-50 sm:px-6 sm:py-10 lg:px-8">
      <CustomCheckout checkoutToken={token} plan={intent.plan} />
    </main>
  );
}
