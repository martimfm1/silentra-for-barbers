import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  Gift,
  Mail,
  Scissors,
  UsersRound,
} from 'lucide-react';
import { SiteNavbar } from '@/components/site-navbar';
import { FooterSection } from '@/components/hero/footer-section';
import { TrackedMarketingLink } from '@/components/marketing/tracked-marketing-link';

const SITE_URL = 'https://barbers.silentra.me';
const PAGE_URL = SITE_URL + '/software-gestao-barbearia';

export const metadata: Metadata = {
  title: 'Software de Gestão para Barbearias',
  description:
    'Gere a tua barbearia com agenda e marcações online, equipa, clientes, lembretes e fidelização. Os clientes reservam sem conta. Começa gratuitamente.',
  keywords: [
    'software de gestão para barbearias',
    'programa para barbearia',
    'agendamento online barbearia',
    'gestão de marcações para barbeiros',
    'software para barbeiros em Portugal',
  ],
  alternates: { canonical: PAGE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    title: 'Software de Gestão para Barbearias | Silentra for Barbers',
    description:
      'Agenda, clientes, equipa e marcações online num único painel. Dá aos teus clientes uma forma simples de reservar, sem conta nem aplicação.',
    url: PAGE_URL,
    siteName: 'Silentra for Barbers',
    locale: 'pt_PT',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Silentra for Barbers — software de gestão para barbearias',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Software de Gestão para Barbearias | Silentra',
    description:
      'Agenda, clientes e marcações online num único painel. Começa com o plano gratuito.',
    images: ['/og-image.png'],
  },
};

const content = {
  pt: {
    eyebrow: 'Software de gestão para barbearias',
    title: 'Menos tempo na gestão. Mais tempo na cadeira.',
    intro:
      'Organiza a agenda, simplifica as marcações e mantém a operação da tua barbearia num único lugar. Os clientes reservam pelo browser, sem instalar uma app nem criar uma conta.',
    primaryCta: 'Começar grátis',
    secondaryCta: 'Comparar planos',
    reassurance: [
      'Plano gratuito disponível',
      'Sem cartão para começar',
      'Reservas sem conta do cliente',
    ],
    sectionEyebrow: 'Uma plataforma, não mais folhas e mensagens',
    sectionTitle: 'Tudo o que precisas para gerir a barbearia.',
    sectionIntro:
      'A Silentra liga a experiência de marcação às tarefas diárias do negócio, para não teres de saltar entre ferramentas.',
    features: [
      [
        'Agenda e marcações',
        'Gere disponibilidade, duração dos serviços, pausas e marcações num calendário central.',
      ],
      [
        'Clientes e equipa',
        'Mantém histórico de clientes e organiza a equipa com funções e permissões adequadas.',
      ],
      [
        'Página pública e reservas',
        'Apresenta serviços e informações da barbearia numa página que os clientes podem abrir e partilhar.',
      ],
      [
        'Confirmações e lembretes',
        'Reduz a troca de mensagens manuais com comunicação por email e fluxos automatizados disponíveis na plataforma.',
      ],
      [
        'Fidelização e crescimento',
        'Cria motivos para os clientes voltarem com ferramentas de fidelização, campanhas e recompensas, conforme o plano.',
      ],
      [
        'Métricas do negócio',
        'Acompanha a atividade e os indicadores disponíveis para perceber como está a evoluir a barbearia.',
      ],
    ],
    workflowEyebrow: 'Como funciona',
    workflowTitle: 'Começa de forma simples.',
    workflow: [
      [
        '1. Cria o espaço',
        'Regista a barbearia e configura os serviços, horários e informação pública.',
      ],
      [
        '2. Partilha o link',
        'Coloca a página de marcações na bio, no perfil social, no site ou num QR code.',
      ],
      [
        '3. Gere num painel',
        'Acompanha marcações e operação sem depender de conversas dispersas.',
      ],
    ],
    whyTitle: 'Uma experiência mais simples para quem marca.',
    whyText:
      'Um processo de reserva com menos passos facilita a decisão do cliente. A pessoa consulta a informação e avança pelo browser, enquanto tu manténs a agenda e os serviços organizados.',
    benefits: [
      'O cliente pode reservar sem criar conta.',
      'A página pública ajuda a partilhar os serviços e a informação da barbearia.',
      'A gestão diária fica centralizada num painel.',
      'Podes começar no Free e comparar planos quando precisares de mais funcionalidades.',
    ],
    faqTitle: 'Perguntas frequentes',
    faqs: [
      [
        'O que é um software de gestão para barbearias?',
        'É uma plataforma para organizar marcações, serviços, clientes e equipa. A Silentra junta estas tarefas à página pública, às ferramentas de comunicação e às funcionalidades de crescimento disponíveis em cada plano.',
      ],
      [
        'Os clientes precisam de criar conta para marcar?',
        'Não. Os clientes podem consultar a página pública e avançar com uma marcação pelo browser, sem instalar uma app nem criar uma conta.',
      ],
      [
        'Posso começar sem pagar?',
        'Sim. A Silentra disponibiliza um plano Free. Consulta a página de planos para ver as funcionalidades e condições atuais de cada opção.',
      ],
      [
        'Posso gerir uma equipa?',
        'Sim. A plataforma inclui funções e permissões para diferentes membros da equipa, associadas à barbearia.',
      ],
      [
        'A Silentra cria uma página pública para a barbearia?',
        'Sim. A barbearia pode utilizar a sua página pública. O plano Enterprise inclui também uma landing page gerida e associada ao perfil da barbearia, enquanto a subscrição estiver elegível.',
      ],
    ],
    closingTitle: 'A tua próxima marcação pode começar aqui.',
    closingText:
      'Cria o espaço da tua barbearia, configura os serviços e dá aos clientes uma forma simples de reservar online.',
    closingCta: 'Criar barbearia grátis',
  },
  en: {
    eyebrow: 'Barbershop management software',
    title: 'Less time managing. More time behind the chair.',
    intro:
      'Organise your schedule, simplify bookings and keep your barbershop operations in one place. Customers book in their browser without installing an app or creating an account.',
    primaryCta: 'Start for free',
    secondaryCta: 'Compare plans',
    reassurance: [
      'Free plan available',
      'No card to get started',
      'Customers book without an account',
    ],
    sectionEyebrow: 'One platform, not more spreadsheets and messages',
    sectionTitle: 'Everything you need to run your barbershop.',
    sectionIntro:
      'Silentra connects the booking experience with day-to-day operations, so you do not have to jump between tools.',
    features: [
      [
        'Schedule and bookings',
        'Manage availability, service duration, breaks and bookings in one central calendar.',
      ],
      [
        'Customers and team',
        'Keep customer history and organise the team with suitable roles and permissions.',
      ],
      [
        'Public profile and bookings',
        'Show services and barbershop information on a page customers can open and share.',
      ],
      [
        'Confirmations and reminders',
        'Reduce manual messaging with email communication and automation workflows available in the platform.',
      ],
      [
        'Loyalty and growth',
        'Give customers reasons to return with loyalty tools, campaigns and rewards, depending on the plan.',
      ],
      [
        'Business metrics',
        'Track activity and the available metrics to understand how your barbershop is performing.',
      ],
    ],
    workflowEyebrow: 'How it works',
    workflowTitle: 'Get started without the complexity.',
    workflow: [
      [
        '1. Create your space',
        'Register your barbershop and configure services, opening hours and public information.',
      ],
      [
        '2. Share your link',
        'Put the booking page in your bio, social profile, website or QR code.',
      ],
      [
        '3. Manage from one dashboard',
        'Track bookings and daily operations without relying on scattered conversations.',
      ],
    ],
    whyTitle: 'A simpler booking experience for customers.',
    whyText:
      'A booking flow with fewer steps makes it easier for customers to decide. They can check the information and continue in their browser while you keep the schedule and services organised.',
    benefits: [
      'Customers can book without creating an account.',
      'A public page makes your services and information easier to share.',
      'Daily management is centralised in one dashboard.',
      'Start on Free and compare plans when you need more features.',
    ],
    faqTitle: 'Frequently asked questions',
    faqs: [
      [
        'What is barbershop management software?',
        'It is a platform for organising bookings, services, customers and staff. Silentra connects these tasks to a public page, communication tools and growth features available on each plan.',
      ],
      [
        'Do customers need an account to book?',
        'No. Customers can view the public page and continue with a booking in their browser without installing an app or creating an account.',
      ],
      [
        'Can I start without paying?',
        'Yes. Silentra offers a Free plan. Visit the plans page to compare the current features and terms for each option.',
      ],
      [
        'Can I manage a team?',
        'Yes. The platform includes roles and permissions for different team members, associated with the barbershop.',
      ],
      [
        'Does Silentra create a public page for my barbershop?',
        'Yes. Your barbershop can use its public profile. The Enterprise plan also includes a managed landing page associated with the profile while the subscription remains eligible.',
      ],
    ],
    closingTitle: 'Your next booking can start here.',
    closingText:
      'Create your barbershop space, configure your services and give customers a simple way to book online.',
    closingCta: 'Create a free barbershop',
  },
} as const;

const featureIcons = [
  CalendarDays,
  UsersRound,
  Scissors,
  Mail,
  Gift,
  BarChart3,
];

export default async function BarbershopManagementSoftwarePage() {
  const locale = (await cookies()).get('locale')?.value === 'en' ? 'en' : 'pt';
  const copy = content[locale];

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': PAGE_URL + '#webpage',
        url: PAGE_URL,
        name: 'Software de Gestão para Barbearias | Silentra for Barbers',
        description:
          'Software de gestão para barbearias com agenda, marcações online, clientes, equipa e ferramentas de fidelização.',
        inLanguage: locale === 'pt' ? 'pt-PT' : 'en',
        isPartOf: { '@id': SITE_URL + '/#website' },
        about: { '@id': SITE_URL + '/#software' },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': SITE_URL + '/#software',
        name: 'Silentra for Barbers',
        url: SITE_URL,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web browser',
        description:
          'Software de gestão para barbearias com agenda online, gestão de clientes e equipa e marcações sem conta do cliente.',
        inLanguage: ['pt-PT', 'en'],
        provider: { '@id': SITE_URL + '/#organization' },
        isAccessibleForFree: true,
      },
      {
        '@type': 'FAQPage',
        mainEntity: copy.faqs.map(([question, answer]) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Silentra for Barbers',
            item: SITE_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: copy.eyebrow,
            item: PAGE_URL,
          },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-zinc-950 text-zinc-50 antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteNavbar />
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-8 lg:pt-36">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_34%),linear-gradient(135deg,rgba(24,24,27,0.9),rgba(9,9,11,0.98))] p-6 sm:p-10 lg:p-14">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />
          <div className="max-w-4xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
              <Scissors className="size-3.5" aria-hidden="true" />
              {copy.eyebrow}
            </span>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              {copy.title}
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">
              {copy.intro}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <TrackedMarketingLink
                href="/registo"
                ctaId="software_seo_start_free_hero"
                ctaLocation="software_seo_hero"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 text-sm font-semibold text-zinc-950 transition hover:-translate-y-0.5 hover:bg-emerald-200"
              >
                {copy.primaryCta} <ArrowRight className="size-4" />
              </TrackedMarketingLink>
              <Link
                href="/plans"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                {copy.secondaryCta}
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-400">
              {copy.reassurance.map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <Check
                    className="size-3.5 text-emerald-300"
                    aria-hidden="true"
                  />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
              {copy.sectionEyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              {copy.sectionTitle}
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400 sm:text-base">
              {copy.sectionIntro}
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {copy.features.map(([title, description], index) => {
              const Icon = featureIcons[index];
              return (
                <article
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition hover:border-emerald-300/25 hover:bg-white/[0.04] sm:p-6"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-200">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-white">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {description}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-8 rounded-[2rem] border border-white/10 bg-white/[0.025] p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12 lg:p-10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
              {copy.workflowEyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em]">
              {copy.workflowTitle}
            </h2>
          </div>
          <div className="grid gap-4">
            {copy.workflow.map(([title, description]) => (
              <article
                key={title}
                className="flex gap-4 border-b border-white/[0.08] pb-4 last:border-0 last:pb-0"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200">
                  <Check className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-semibold text-zinc-100">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    {description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-8 py-16 sm:py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
              {locale === 'pt'
                ? 'Feito para a rotina real'
                : 'Built for real day-to-day work'}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              {copy.whyTitle}
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400 sm:text-base">
              {copy.whyText}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
            <ul className="grid gap-4">
              {copy.benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="flex gap-3 text-sm leading-6 text-zinc-300"
                >
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-emerald-300"
                    aria-hidden="true"
                  />
                  {benefit}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row">
              <Link
                href="/plans"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-semibold hover:bg-white/[0.05]"
              >
                {copy.secondaryCta}
              </Link>
              <Link
                href="/barbershops"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-zinc-300 hover:text-white"
              >
                {locale === 'pt' ? 'Ver páginas públicas' : 'View public pages'}
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 py-16 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
              {locale === 'pt' ? 'Dúvidas comuns' : 'Common questions'}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              {copy.faqTitle}
            </h2>
          </div>
          <div className="mt-7 grid gap-3 md:grid-cols-2">
            {copy.faqs.map(([question, answer]) => (
              <article
                key={question}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"
              >
                <h3 className="font-semibold text-white">{question}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-emerald-300/20 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_38%),rgba(24,24,27,0.68)] p-6 sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              {copy.closingTitle}
            </h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300 sm:text-base">
              {copy.closingText}
            </p>
          </div>
          <TrackedMarketingLink
            href="/registo"
            ctaId="software_seo_start_free_bottom"
            ctaLocation="software_seo_bottom"
            className="mt-6 inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100 lg:mt-0"
          >
            {copy.closingCta} <ArrowRight className="size-4" />
          </TrackedMarketingLink>
        </section>
      </main>
      <FooterSection />
    </div>
  );
}
