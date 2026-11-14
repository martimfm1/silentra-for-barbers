import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { CheckCircle2, CircleHelp, ShieldCheck } from 'lucide-react';
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
    'Novos utilizadores elegíveis podem ter o primeiro mês de Pro grátis numa subscrição mensal. A elegibilidade e o valor a pagar são confirmados no checkout antes de concluir.',
  ],
  [
    'Como são tratados os pagamentos?',
    'O método disponível é indicado antes de confirmares. No modo manual, recebes as instruções ou o link de pagamento depois de o pedido ser analisado; quando a Stripe está ativa, o pagamento é concluído no checkout seguro.',
  ],
  [
    'O Enterprise inclui uma landing page e domínio?',
    'Sim. A subscrição Enterprise inclui a landing page e um endereço público no domínio barbers.silentra.me. Se também quiseres um site próprio personalizado, a ativação custa 50 € uma única vez, sem mensalidade adicional. A Silentra confirma o nome e publica depois da aprovação e confirmação do pagamento.',
  ],
  [
    'O que acontece se cancelar?',
    'Manténs o acesso ao plano atual até ao final do período de faturação em curso, de acordo com as condições da subscrição.',
  ],
] as const;

const englishFaqs = [
  [
    'Can I change plans whenever I want?',
    'Yes. Choose your plan and check out on this page. You can manage cancellation later in billing.',
  ],
  [
    'How does the Pro offer work?',
    'Eligible new users may receive their first month of Pro free on a monthly subscription. Eligibility and the amount due are confirmed in checkout before you proceed.',
  ],
  [
    'How are payments handled?',
    'The available payment method is shown before you confirm. With manual billing, Silentra reviews your request and sends payment instructions or a link; when Stripe is enabled, payment is completed in secure checkout.',
  ],
  [
    'Does Enterprise include a landing page and domain?',
    'Yes. Enterprise includes the landing page and a public address on barbers.silentra.me. A custom website can also be activated for a one-time €50 fee, with no additional monthly charge. Silentra confirms the address and publishes the site after approval and payment confirmation.',
  ],
  [
    'What happens if I cancel?',
    'You keep access to your current plan until the end of the active billing period, subject to your subscription terms.',
  ],
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
              {english
                ? 'One platform for your barbershop.'
                : 'Tudo o que a tua barbearia precisa, num só lugar.'}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
              {english
                ? 'Manage appointments, customers, your team and growth tools. Compare what each plan unlocks before choosing.'
                : 'Gere marcações, clientes, equipa e ferramentas de crescimento. Compara o que cada plano desbloqueia antes de escolher.'}
            </p>
            <div className="mt-6 grid gap-2 text-xs text-zinc-500 sm:flex sm:flex-wrap sm:gap-x-5">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-300" />
                {english
                  ? 'Free plan available with no card'
                  : 'Free disponível sem cartão'}
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-300" />
                {english
                  ? 'Pro offer for eligible new users'
                  : 'Oferta Pro para novos utilizadores elegíveis'}
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-300" />
                {english
                  ? 'The plan belongs to the barbershop'
                  : 'Plano pertence à barbearia'}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-8 sm:mt-12">
          <PricingSection destination="checkout" showDecisionHeader={false} />
        </section>

        <section id="comparacao" className="mt-10 scroll-mt-24 sm:mt-14">
          <PlanComparison />
        </section>

        <section className="mt-10 sm:mt-14">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
              {english ? 'Frequently asked questions' : 'Perguntas frequentes'}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
              {english
                ? 'Get your main questions answered before choosing.'
                : 'Antes de escolher, tira as dúvidas principais.'}
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
      </main>
    </div>
  );
}
