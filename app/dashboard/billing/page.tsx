'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ArrowLeft, CreditCard, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BillingHub } from '@/components/billing/BillingHub';

export default function BillingPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    const sessionId = params.get('session_id');

    if (checkout === 'return' && sessionId) {
      void fetch(
        `/api/stripe/subscription?session_id=${encodeURIComponent(sessionId)}`,
        { cache: 'no-store' },
      ).finally(() => {
        window.location.replace('/dashboard/billing');
      });
      return;
    }

    if (checkout === 'success') {
      void fetch('/api/stripe/finalize-plan-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      }).finally(() => {
        window.location.replace('/checkout/success');
      });
      return;
    }

    if (checkout === 'error') window.location.replace('/checkout/error');
  }, []);

  return (
    <main className="dashboard-page min-h-screen bg-zinc-950 px-4 pb-20 pt-24 text-white sm:px-6 lg:px-8 lg:pt-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="dashboard-page-header border-b border-white/10 pb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
              <CreditCard className="size-4" aria-hidden="true" /> Subscrição
            </div>
            <h1 className="mt-2 text-2xl font-heading font-bold tracking-tight sm:text-4xl">
              Plano e faturação
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Resumo do teu plano, estado da subscrição e comprovativos de
              pagamento. As decisões de compra e mudança de plano acontecem em
              /plans.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="min-h-11 w-full border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10 sm:w-auto"
          >
            <Link href="/dashboard/settings">
              <ArrowLeft className="mr-2 size-4" />
              Definições
            </Link>
          </Button>
        </header>
        <section className="grid gap-3 sm:grid-cols-2" aria-label="Faturação">
          <div className="border border-white/10 bg-white/[0.025] px-4 py-4">
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-100">
              <ReceiptText
                className="size-4 text-emerald-400"
                aria-hidden="true"
              />{' '}
              Recibos
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Os pagamentos manuais geram automaticamente um comprovativo em PDF
              enviado por email.
            </p>
          </div>
          <div className="border border-white/10 bg-white/[0.025] px-4 py-4">
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-100">
              <CreditCard
                className="size-4 text-emerald-400"
                aria-hidden="true"
              />{' '}
              Gestão simples
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Cancela no fim do período atual ou compara planos quando quiseres
              mudar.
            </p>
          </div>
        </section>
        <BillingHub />
      </div>
    </main>
  );
}
