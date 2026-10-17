import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import {
  CheckCircle2,
  CircleHelp,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { SiteNavbar } from '@/components/site-navbar';
import { PricingSection } from '@/components/hero/pricing-section';
import { PlanComparison } from '@/components/billing/plan-comparison';

export const metadata: Metadata = {
  title: 'Preços e Planos do Software para Barbearias',
  description:
    'Compara preços, funcionalidades e limites dos planos da Silentra for Barbers e escolhe o software certo para a tua barbearia.',
  alternates: {
    canonical: 'https://barbers.silentra.me/plans',
  },
  openGraph: {
    title: 'Preços e Planos para Barbearias | Silentra for Barbers',
    description:
      'Compara os planos e funcionalidades do software de gestão para barbearias da Silentra for Barbers.',
    url: 'https://barbers.silentra.me/plans',
    siteName: 'Silentra for Barbers',
    locale: 'pt_PT',
    type: 'website',
  },
};

const faqs = [
  [
    'Posso mudar de plano quando quiser?',
    'Sim. A escolha do plano e o checkout são feitos nesta página. Depois podes gerir o cancelamento na faturação.',
  ],
  [
    'Como funciona a oferta do Pro?',
    'Novos utilizadores elegíveis recebem a oferta aplicável no checkout. A primeira cobrança só acontece de acordo com as condições apresentadas durante a compra.',
  ],
  [
    'Como são tratados os pagamentos?',
    'Os pagamentos, métodos de pagamento e faturas são processados com segurança pela Stripe através do checkout da Silentra.',
  ],
  [
    'O Enterprise inclui uma landing page?',
    'Sim. A subscrição Enterprise inclui uma landing page pública ligada ao perfil e aos serviços. Um site próprio, com design personalizado e endereço /nome-da-barbearia, é um serviço adicional por orçamento: o cliente contacta a Silentra e a publicação só acontece após acordo.',
  ],
  [
    'O que acontece se cancelar?',
    'Manténs o acesso ao plano atual até ao final do período de faturação em curso, de acordo com as condições da subscrição.',
  ],
] as const;

const englishFaqs = [
  ['Can I change plans whenever I want?', 'Yes. Choose your plan and check out on this page. You can manage cancellation later in billing.'],
  ['How does the Pro offer work?', 'Eligible new users receive the applicable offer during checkout. The first charge only takes place under the terms shown at purchase.'],
  ['How are payments handled?', 'Payments, payment methods and invoices are securely processed by Stripe through Silentra checkout.'],
  ['Does Enterprise include a landing page?', 'Yes. Enterprise includes a public landing page linked to the barbershop profile and services. A bespoke website with a custom design and /your-barbershop address is a separately quoted service, agreed directly with Silentra.'],
  ['What happens if I cancel?', 'You keep access to your current plan until the end of the active billing period, subject to your subscription terms.'],
] as const;

export default async function PlansPage() {
  const cookieStore = await cookies();
  const english = cookieStore.get('locale')?.value === 'en';
  const localizedFaqs = english ? englishFaqs : faqs;
  return (
    <div className="min-h-screen overflow-x-clip bg-zinc-950 text-zinc-50 antialiased">
      <SiteNavbar />
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28 lg:px-8 lg:pt-32">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_34%),rgba(24,24,27,0.72)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.24)] sm:p-8 lg:p-10">
          <div className="glassmorphism absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              {english ? 'Silentra plans' : 'Planos Silentra'}
            </span>
            <h1 className="mt-5 text-[2.45rem] font-semibold leading-[1] tracking-[-0.055em] sm:text-5xl">
              {english ? 'Choose a plan. Compare. Check out.' : 'Escolhe o plano. Compara. Faz o checkout.'}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
              {english ? 'Compare all Silentra for Barbers plans here and start checkout whenever you are ready.' : 'Esta é a página de decisão da Silentra for Barbers. Aqui encontras a comparação completa e, quando estiveres pronto, inicias o checkout.'}
            </p>
            <div className="mt-6 grid gap-2 text-xs text-zinc-500 sm:flex sm:flex-wrap sm:gap-x-5">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-300" />
                {english ? 'Free plan available with no card' : 'Free disponível sem cartão'}
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-300" />
                {english ? 'Pro offer for eligible new users' : 'Oferta Pro para novos utilizadores elegíveis'}
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-300" />
                {english ? 'The plan belongs to the barbershop' : 'Plano pertence à barbearia'}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-8 sm:mt-12">
          <PricingSection destination="checkout" showDecisionHeader={false} />
        </section>

        <section
          id="comparacao"
          className="glassmorphism mt-10 scroll-mt-24 rounded-[2rem] border border-white/10 bg-white/[0.02] p-5 sm:mt-14 sm:p-8"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                {english ? 'Full comparison' : 'Comparação completa'}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">
                {english ? 'Review your choice before you buy.' : 'Confirma a decisão antes de comprar.'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                {english ? 'Compare features and limits in one view, then return to the cards above to check out.' : 'Compara funcionalidades e limites numa única vista. Depois volta aos cartões acima para iniciar o checkout.'}
              </p>
            </div>
            <Link
              href="#precos"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-zinc-100 hover:bg-white/[0.07]"
            >
              {english ? 'Back to plans' : 'Voltar aos planos'} <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-7 overflow-x-auto">
            <PlanComparison />
          </div>
        </section>

        <section className="mt-10 sm:mt-14">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
              {english ? 'Frequently asked questions' : 'Perguntas frequentes'}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
              {english ? 'Get your main questions answered before choosing.' : 'Antes de escolher, tira as dúvidas principais.'}
            </h2>
          </div>
          <div className="mt-7 grid gap-3 md:grid-cols-2">
            {localizedFaqs.map(([question, answer]) => (
              <article
                key={question}
                className="glassmorphism rounded-2xl border border-white/10 bg-zinc-900/45 p-5 transition hover:border-white/20 hover:bg-white/[0.035]"
              >
                <CircleHelp
                  className="size-5 text-emerald-300"
                  aria-hidden="true"
                />
                <h2 className="mt-4 font-semibold text-zinc-100">{question}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{answer}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="mt-10 glassmorphism rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:mt-14 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
                {english ? 'Next step' : 'Próximo passo'}
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                {english ? 'Choose a plan above and continue to checkout.' : 'Escolhe um plano acima e continua para o checkout.'}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {english ? 'Checkout is the only payment step. Your subscription is then linked to the barbershop.' : 'O checkout é a única etapa de pagamento; depois a subscrição fica associada à barbearia.'}
              </p>
            </div>
            <Link
              href="#precos"
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-white px-5 text-sm font-semibold text-zinc-950"
            >
              {english ? 'Choose a plan' : 'Escolher plano'} <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
