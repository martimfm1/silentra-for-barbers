'use client';

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { AlertTriangle, ArrowLeft, CreditCard, RefreshCw } from 'lucide-react';

export default function CheckoutErrorPage() {
  const { locale } = useLanguage();
  const english = locale === 'en';
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-950 px-4 py-12 text-white">
      <div className="w-full max-w-xl rounded-[2rem] border border-red-400/15 bg-zinc-900/80 p-7 shadow-[0_30px_100px_rgba(0,0,0,0.28)] sm:p-10">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10 text-red-200">
          <AlertTriangle className="size-7" />
        </div>
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-red-300/80">
          {english ? 'Checkout not completed' : 'Checkout não concluído'}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
          {english
            ? 'Could not complete the subscription.'
            : 'Não foi possível concluir a subscrição.'}
        </h1>
        <p className="mt-4 text-sm leading-7 text-zinc-400">
          {english
            ? 'The payment may have been declined, cancelled or the session may have expired. The subscription is not active until Stripe confirms the purchase.'
            : 'O pagamento pode ter sido recusado, cancelado ou a sessão pode ter expirado. Nenhuma nova subscrição deve ser considerada ativa até a Stripe confirmar a compra.'}
        </p>
        <div className="mt-7 rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-zinc-400">
          <div className="flex gap-3">
            <CreditCard className="mt-0.5 size-4 shrink-0 text-zinc-500" />
            <p>
              {english
                ? 'You can return to the plans page and start a new checkout. Previous attempts should not prevent another attempt once they expire or are cancelled.'
                : 'Podes voltar aos planos e iniciar um novo checkout. As tentativas anteriores não devem bloquear uma nova tentativa depois de expirarem ou serem canceladas.'}
            </p>
          </div>
        </div>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/plans"
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-zinc-950"
          >
            <RefreshCw className="size-4" />
            {english ? 'Try again' : 'Tentar novamente'}
          </Link>
          <Link
            href="/dashboard/billing"
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 text-sm font-semibold text-zinc-100"
          >
            <ArrowLeft className="size-4" />
            {english ? 'Back to billing' : 'Voltar ao billing'}
          </Link>
        </div>
      </div>
    </main>
  );
}
