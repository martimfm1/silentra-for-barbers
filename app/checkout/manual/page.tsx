import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { verifyCheckoutIntent } from '@/lib/stripe/checkout-intent';
import { PaymentModeService } from '@/services/billing/payment-mode.service';
import { ManualCheckout } from '@/components/billing/manual-checkout';

export const dynamic = 'force-dynamic';

export default async function ManualCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/registo');

  const params = await searchParams;
  const token = params.intent?.trim() ?? '';
  const intent = token ? verifyCheckoutIntent(token) : null;

  if (!intent || intent.sub !== user.id || intent.barbershopId === '') {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 px-4 py-10 text-zinc-50">
        <div className="w-full max-w-xl rounded-3xl border border-red-400/20 bg-zinc-900/70 p-7 text-center shadow-[0_30px_100px_rgba(0,0,0,0.3)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-300/80">
            Manual checkout
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-white">
            Checkout indisponível
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Este checkout expirou ou não pertence à tua conta. Volta aos planos
            e inicia um novo pedido.
          </p>
          <a
            href="/plans"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-zinc-950"
          >
            Voltar aos planos
          </a>
        </div>
      </main>
    );
  }

  const mode = await PaymentModeService.getPaymentMode();
  if (mode !== 'MANUAL')
    redirect(`/checkout?intent=${encodeURIComponent(token)}`);

  if (intent.plan !== 'pro' && intent.plan !== 'enterprise') {
    redirect('/plans');
  }

  return (
    <ManualCheckout
      checkoutToken={token}
      plan={intent.plan}
      interval={intent.interval}
    />
  );
}
