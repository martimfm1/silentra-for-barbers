import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CustomCheckout } from '@/components/billing/custom-checkout';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    priceId?: string;
    plan?: string;
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
  const priceId = params.priceId?.trim() ?? '';
  const plan = params.plan === 'enterprise' ? 'enterprise' : 'pro';

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

  if (!priceId) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-50 sm:px-6 lg:px-8">
        <div className="glassmorphism mx-auto max-w-xl rounded-2xl border border-white/10 bg-zinc-900/70 p-7 text-center shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
          <h1 className="text-2xl font-semibold text-white">Checkout</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Seleciona um plano para continuares para o checkout.
          </p>
          <a
            href="/plans"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-zinc-950"
          >
            Ver planos
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-50 sm:px-6 sm:py-10 lg:px-8">
      <CustomCheckout priceId={priceId} plan={plan} />
    </main>
  );
}
