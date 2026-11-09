'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  Check,
  Clock3,
  CreditCard,
  Gift,
  Globe2,
  Heart,
  Image as ImageIcon,
  MapPin,
  QrCode,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FeaturePlanBadge } from '@/components/billing/FeaturePlanBadge';
import { Button } from '@/components/ui/button';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useLanguage } from '@/context/LanguageContext';
import type { FeatureKey } from '@/lib/billing/plan-features';

type ToolLink = {
  href: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  icon: LucideIcon;
  feature?: FeatureKey;
  label?: string;
  labelEn?: string;
  secondaryLinks?: {
    href: string;
    title: string;
    titleEn: string;
    icon: LucideIcon;
  }[];
};

const experienceSettings = [
  {
    icon: ImageIcon,
    title: 'Identidade e apresentação',
    titleEn: 'Identity and presentation',
    description: 'Nome, contactos, logótipo, capa e informação pública.',
    descriptionEn: 'Name, contact details, logo, cover image and public information.',
  },
  {
    icon: CalendarCheck2,
    title: 'Regras de marcação',
    titleEn: 'Booking rules',
    description: 'Marcações online, antecedência, confirmações e cancelamentos.',
    descriptionEn: 'Online bookings, notice periods, confirmations and cancellations.',
  },
  {
    icon: Clock3,
    title: 'Horários e disponibilidade',
    titleEn: 'Hours and availability',
    description: 'Horário, pausas, dias de folga, localização e comodidades.',
    descriptionEn: 'Opening hours, breaks, days off, location and amenities.',
  },
] as const;

const customerTools: ToolLink[] = [
  {
    href: '/dashboard/qr-code',
    title: 'QR Code da barbearia',
    titleEn: 'Barbershop QR code',
    description: 'Dá aos clientes uma entrada rápida para a tua página pública e para as marcações, em cartazes, cartões ou no espaço.',
    descriptionEn: 'Give customers a quick route to your public page and bookings on posters, cards or around the shop.',
    icon: QrCode,
    label: 'Primeiro contacto',
    labelEn: 'First impression',
  },
  {
    href: '/dashboard/espera',
    title: 'Lista de espera',
    titleEn: 'Waitlist',
    description: 'Permite que os clientes manifestem interesse quando não encontram um horário. Acompanha os pedidos e gere oportunidades de preencher vagas.',
    descriptionEn: 'Let customers register interest when no suitable time is available. Track requests and fill newly opened slots.',
    icon: Clock3,
    feature: 'waitlist',
    label: 'Não percas pedidos',
    labelEn: 'Keep every request',
  },
  {
    href: '/dashboard/loyalty',
    title: 'Fidelização e recompensas',
    titleEn: 'Loyalty and rewards',
    description: 'Cria um programa com pontos, vantagens e recompensas que dão aos clientes uma razão clara para regressarem.',
    descriptionEn: 'Build a points and rewards programme that gives customers a clear reason to come back.',
    icon: Heart,
    feature: 'loyalty',
    label: 'Fazer regressar',
    labelEn: 'Bring customers back',
    secondaryLinks: [
      { href: '/dashboard/loyalty/points', title: 'Regras de pontos', titleEn: 'Points rules', icon: Sparkles },
      { href: '/dashboard/loyalty/validate', title: 'Validar recompensa', titleEn: 'Redeem a reward', icon: ScanLine },
    ],
  },
];

const growthTools: ToolLink[] = [
  {
    href: '/dashboard/website',
    title: 'Site próprio',
    titleEn: 'Custom website',
    description: 'Dá à barbearia uma presença online própria, com uma experiência alinhada com a identidade do espaço.',
    descriptionEn: 'Give your barbershop its own online presence, aligned with the identity of your space.',
    icon: Globe2,
  },
  {
    href: '/dashboard/pos',
    title: 'Vendas e produtos',
    titleEn: 'Sales and products',
    description: 'Regista vendas e gere produtos sem separar essa informação da operação diária.',
    descriptionEn: 'Record sales and manage products without separating them from daily operations.',
    icon: CreditCard,
    feature: 'pos',
  },
];

function ToolCard({
  tool,
  english,
  hasFeature,
  upgradeLabel,
  openLabel,
}: {
  tool: ToolLink;
  english: boolean;
  hasFeature: (feature: FeatureKey) => boolean;
  upgradeLabel: string;
  openLabel: string;
}) {
  const Icon = tool.icon;
  const locked = tool.feature ? !hasFeature(tool.feature) : false;

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[.085] bg-white/[.025] transition duration-200 hover:-translate-y-0.5 hover:border-white/[.15] hover:bg-white/[.04]">
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-sky-300/15 bg-sky-300/[.07] text-sky-200">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          {tool.feature ? <FeaturePlanBadge feature={tool.feature} /> : null}
        </div>
        {tool.label ? (
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.15em] text-sky-300">
            {english ? tool.labelEn : tool.label}
          </p>
        ) : null}
        <h3 className="mt-2 text-base font-semibold tracking-tight text-zinc-100 sm:text-lg">
          {english ? tool.titleEn : tool.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-6 text-zinc-400">
          {english ? tool.descriptionEn : tool.description}
        </p>
        {tool.secondaryLinks && !locked ? (
          <div className="mt-4 grid gap-2 border-t border-white/[.07] pt-3 sm:grid-cols-2">
            {tool.secondaryLinks.map((link) => {
              const SubIcon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-h-10 min-w-0 items-center gap-2 rounded-xl border border-white/[.07] bg-black/10 px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-sky-300/20 hover:bg-sky-300/[.05] hover:text-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <SubIcon className="size-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                  <span className="min-w-0 truncate">{english ? link.titleEn : link.title}</span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="border-t border-white/[.07] p-4 sm:px-5">
        <Button
          asChild
          variant={locked ? 'outline' : 'secondary'}
          className={locked
            ? 'min-h-11 w-full border-white/10 bg-transparent text-zinc-300'
            : 'min-h-11 w-full justify-between bg-white/[.06] text-zinc-100 hover:bg-white/[.09]'}
        >
          <Link href={locked ? '/dashboard/billing' : tool.href}>
            {locked ? (
              <>
                <ShieldCheck className="mr-2 size-4" aria-hidden="true" />
                {upgradeLabel}
              </>
            ) : (
              <>
                {openLabel}
                <ArrowRight className="ml-auto size-4" aria-hidden="true" />
              </>
            )}
          </Link>
        </Button>
      </div>
    </article>
  );
}

export default function ToolsGrowthPage() {
  const { hasFeature, loading } = useFeatureAccess();
  const { locale } = useLanguage();
  const english = locale === 'en';

  const copy = english
    ? {
        eyebrow: 'Customer experience · Business growth',
        title: 'Make every customer visit feel effortless.',
        description: 'Shape the experience from the first impression to the next visit. Set up the details customers see, make booking easier and give people reasons to return.',
        customize: 'Personalise the customer journey',
        customizeDescription: 'You control how your barbershop looks, how customers book and what happens around each visit.',
        settingsAction: 'Customise experience',
        customerEyebrow: 'The customer journey',
        customerTitle: 'A better experience, at every step',
        customerDescription: 'Start with the moments that matter most to customers. Each tool opens a focused workflow.',
        growthEyebrow: 'Grow your business',
        growthTitle: 'Build a stronger business around great service',
        growthDescription: 'Once the customer experience is in place, improve your online presence and manage additional sales.',
        open: 'Open tool',
        upgrade: 'View plans',
        bookingPage: 'Booking calendar',
        reports: 'Business reports',
        returnToDashboard: 'Back to dashboard',
        settingsLabel: 'Experience settings',
        settingsHint: 'Three areas you can shape in one place',
        customerCount: '3 tools',
        growthCount: '2 tools',
        preview: 'Customer-facing details',
        previewItems: ['Public identity and images', 'Opening hours and availability', 'Booking rules and cancellation window', 'Points, rewards and return visits'],
      }
    : {
        eyebrow: 'Experiência do cliente · Crescimento do negócio',
        title: 'Torna cada visita simples para o cliente.',
        description: 'Constrói a experiência desde o primeiro contacto até à próxima visita. Personaliza o que os clientes veem, facilita as marcações e dá-lhes motivos para regressarem.',
        customize: 'Personaliza a jornada do cliente',
        customizeDescription: 'És tu que defines a apresentação da barbearia, a forma como os clientes marcam e o que acontece antes e depois de cada visita.',
        settingsAction: 'Personalizar experiência',
        customerEyebrow: 'A jornada do cliente',
        customerTitle: 'Uma experiência melhor, em cada etapa',
        customerDescription: 'Começa pelos momentos que mais importam aos clientes. Cada ferramenta abre uma área de trabalho específica.',
        growthEyebrow: 'Faz crescer o negócio',
        growthTitle: 'Constrói um negócio mais forte à volta de um bom serviço',
        growthDescription: 'Depois de melhorares a experiência do cliente, reforça a presença online e gere as vendas adicionais.',
        open: 'Abrir ferramenta',
        upgrade: 'Ver planos',
        bookingPage: 'Agenda de marcações',
        reports: 'Relatórios do negócio',
        returnToDashboard: 'Voltar à dashboard',
        settingsLabel: 'Definições da experiência',
        settingsHint: 'Três áreas que podes personalizar num só lugar',
        customerCount: '3 ferramentas',
        growthCount: '2 ferramentas',
        preview: 'O que o cliente vê',
        previewItems: ['Identidade pública e imagens', 'Horários e disponibilidade', 'Regras e prazo de cancelamento', 'Pontos, recompensas e regresso'],
      };

  if (loading) {
    return (
      <main className="dashboard-page min-h-screen px-4 pb-28 pt-8 sm:px-6 lg:px-8" aria-busy="true">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="h-64 animate-pulse rounded-3xl bg-white/[.025]" />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="h-52 animate-pulse rounded-2xl bg-white/[.025]" />
            <div className="h-52 animate-pulse rounded-2xl bg-white/[.025]" />
            <div className="h-52 animate-pulse rounded-2xl bg-white/[.025]" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page min-h-screen px-3 pb-28 pt-5 text-foreground sm:px-6 sm:pt-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8 sm:space-y-10">
        <header className="relative isolate overflow-hidden rounded-3xl border border-white/[.09] bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,.12),transparent_46%),radial-gradient(ellipse_at_bottom_left,rgba(52,211,153,.07),transparent_48%),linear-gradient(135deg,rgba(255,255,255,.05),rgba(255,255,255,.012))] p-5 shadow-[0_24px_80px_rgba(0,0,0,.18)] sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute -right-20 -top-24 -z-10 size-80 rounded-full bg-sky-300/[.07] blur-3xl" />
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/15 bg-sky-300/[.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.17em] text-sky-200">
                <Sparkles className="size-3.5" aria-hidden="true" />
                {copy.eyebrow}
              </div>
              <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-[-.04em] text-white sm:text-4xl lg:text-5xl">
                {copy.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                {copy.description}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button asChild variant="outline" className="min-h-11 border-white/10 bg-white/[.025] text-zinc-200">
                <Link href="/dashboard/agenda">
                  <CalendarClock className="mr-2 size-4" aria-hidden="true" />
                  {copy.bookingPage}
                </Link>
              </Button>
              <Button asChild variant="outline" className="min-h-11 border-white/10 bg-white/[.025] text-zinc-200">
                <Link href="/dashboard/analytics">
                  <Store className="mr-2 size-4" aria-hidden="true" />
                  {copy.reports}
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <section aria-labelledby="experience-settings-heading" className="overflow-hidden rounded-3xl border border-emerald-300/15 bg-[linear-gradient(120deg,rgba(52,211,153,.055),rgba(255,255,255,.018))] p-5 sm:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-xl">
              <p className="text-[10px] font-semibold uppercase tracking-[.17em] text-emerald-300">{copy.settingsLabel}</p>
              <h2 id="experience-settings-heading" className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">{copy.customize}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{copy.customizeDescription}</p>
              <Button asChild className="mt-5 min-h-11 bg-emerald-300 text-zinc-950 hover:bg-emerald-200">
                <Link href="/dashboard/settings">
                  <Settings2 className="mr-2 size-4" aria-hidden="true" />
                  {copy.settingsAction}
                  <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
              {experienceSettings.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.title}
                    href="/dashboard/settings"
                    className="group min-w-0 rounded-2xl border border-white/[.07] bg-black/10 p-3.5 transition-colors hover:border-emerald-300/20 hover:bg-emerald-300/[.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:p-4"
                  >
                    <Icon className="size-4 text-emerald-300" aria-hidden="true" />
                    <h3 className="mt-3 text-sm font-semibold text-zinc-100">{english ? item.titleEn : item.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">{english ? item.descriptionEn : item.description}</p>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 border-t border-white/[.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-zinc-400">{copy.preview}</p>
            <div className="flex flex-wrap gap-2">
              {copy.previewItems.map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/[.07] bg-white/[.025] px-3 py-1.5 text-[11px] text-zinc-400">
                  <Check className="size-3 text-emerald-300" aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="customer-tools-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.17em] text-sky-300">{copy.customerEyebrow}</p>
              <h2 id="customer-tools-heading" className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">{copy.customerTitle}</h2>
              <p className="mt-1 text-sm leading-5 text-zinc-500">{copy.customerDescription}</p>
            </div>
            <span className="text-xs text-zinc-600">{copy.customerCount}</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {customerTools.map((tool) => (
              <ToolCard
                key={tool.href}
                tool={tool}
                english={english}
                hasFeature={hasFeature}
                upgradeLabel={copy.upgrade}
                openLabel={copy.open}
              />
            ))}
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="growth-tools-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.17em] text-emerald-300">{copy.growthEyebrow}</p>
              <h2 id="growth-tools-heading" className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">{copy.growthTitle}</h2>
              <p className="mt-1 text-sm leading-5 text-zinc-500">{copy.growthDescription}</p>
            </div>
            <span className="text-xs text-zinc-600">{copy.growthCount}</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {growthTools.map((tool) => (
              <ToolCard
                key={tool.href}
                tool={tool}
                english={english}
                hasFeature={hasFeature}
                upgradeLabel={copy.upgrade}
                openLabel={copy.open}
              />
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-white/[.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs leading-5 text-zinc-600">
            <Users className="size-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
            {copy.settingsHint}
          </p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 transition-colors hover:text-white">
            {copy.returnToDashboard}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </footer>
      </div>
    </main>
  );
}
