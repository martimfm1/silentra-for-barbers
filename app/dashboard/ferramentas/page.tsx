'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  Check,
  Clock3,
  CreditCard,
  Globe2,
  Heart,
  LayoutGrid,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Store,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FeaturePlanBadge } from '@/components/billing/FeaturePlanBadge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  accent: string;
  iconSurface: string;
  secondaryLinks?: {
    href: string;
    title: string;
    titleEn: string;
    icon: LucideIcon;
  }[];
};

const customerTools: ToolLink[] = [
  {
    href: '/dashboard/qr-code',
    title: 'QR Code da barbearia',
    titleEn: 'Barbershop QR code',
    description: 'Facilita o acesso à tua página de marcação: os clientes leem o código e chegam diretamente ao teu espaço online.',
    descriptionEn: 'Make your booking page easier to reach. Customers scan the code and go straight to your online booking page.',
    icon: QrCode,
    accent: 'text-sky-300',
    iconSurface: 'border-sky-300/15 bg-sky-300/[.07]',
  },
  {
    href: '/dashboard/espera',
    title: 'Lista de espera',
    titleEn: 'Waitlist',
    description: 'Organiza pedidos para horários indisponíveis e acompanha oportunidades de preencher vagas.',
    descriptionEn: 'Organise requests for unavailable times and keep track of opportunities to fill open slots.',
    icon: Clock3,
    feature: 'waitlist',
    accent: 'text-amber-300',
    iconSurface: 'border-amber-300/15 bg-amber-300/[.07]',
  },
  {
    href: '/dashboard/loyalty',
    title: 'Fidelização',
    titleEn: 'Loyalty',
    description: 'Cria recompensas e incentiva os clientes a regressarem, com regras claras e acompanhamento de pontos.',
    descriptionEn: 'Create rewards and give customers a reason to return, with clear rules and points tracking.',
    icon: Heart,
    feature: 'loyalty',
    accent: 'text-rose-300',
    iconSurface: 'border-rose-300/15 bg-rose-300/[.07]',
    secondaryLinks: [
      {
        href: '/dashboard/loyalty/points',
        title: 'Regras de pontos',
        titleEn: 'Points rules',
        icon: Sparkles,
      },
      {
        href: '/dashboard/loyalty/validate',
        title: 'Validar recompensa',
        titleEn: 'Validate reward',
        icon: ScanLine,
      },
    ],
  },
];

const growthTools: ToolLink[] = [
  {
    href: '/dashboard/pos',
    title: 'Vendas e produtos',
    titleEn: 'Sales and products',
    description: 'Regista vendas, gere produtos e acompanha os movimentos da loja no mesmo espaço.',
    descriptionEn: 'Record sales, manage products and keep track of shop activity in one place.',
    icon: CreditCard,
    feature: 'pos',
    accent: 'text-violet-300',
    iconSurface: 'border-violet-300/15 bg-violet-300/[.07]',
  },
  {
    href: '/dashboard/website',
    title: 'Site próprio',
    titleEn: 'Custom website',
    description: 'Acompanha o pedido e o estado do site da tua barbearia, com os próximos passos visíveis.',
    descriptionEn: 'Track your barbershop website request and its progress, with the next steps in view.',
    icon: Globe2,
    accent: 'text-emerald-300',
    iconSurface: 'border-emerald-300/15 bg-emerald-300/[.07]',
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
  const title = english ? tool.titleEn : tool.title;
  const description = english ? tool.descriptionEn : tool.description;

  return (
    <Card className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border-white/[.09] bg-white/[.025] transition duration-200 hover:-translate-y-0.5 hover:border-white/[.16] hover:bg-white/[.04]">
      <CardHeader className="flex-1 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <span className={'flex size-11 shrink-0 items-center justify-center rounded-2xl border ' + tool.iconSurface + ' ' + tool.accent}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
          {tool.feature ? <FeaturePlanBadge feature={tool.feature} /> : null}
        </div>
        <CardTitle className="mt-4 text-base text-zinc-100 sm:text-lg">{title}</CardTitle>
        <CardDescription className="text-sm leading-6 text-zinc-400">{description}</CardDescription>
        {tool.secondaryLinks && !locked ? (
          <div className="mt-3 grid gap-2 border-t border-white/[.07] pt-3 sm:grid-cols-2">
            {tool.secondaryLinks.map((link) => {
              const SubIcon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-white/[.07] bg-black/10 px-2.5 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-rose-300/20 hover:bg-rose-300/[.05] hover:text-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <SubIcon className="size-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                  <span className="min-w-0 truncate">{english ? link.titleEn : link.title}</span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="border-t border-white/[.07] p-4 sm:p-5">
        <Button
          asChild
          variant={locked ? 'outline' : 'secondary'}
          className={locked
            ? 'min-h-11 w-full border-white/10 bg-transparent text-zinc-300'
            : 'min-h-11 w-full justify-between bg-white/[.06] text-zinc-100 hover:bg-white/[.08]'}
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
      </CardContent>
    </Card>
  );
}

export default function ToolsGrowthPage() {
  const { hasFeature, loading } = useFeatureAccess();
  const { locale } = useLanguage();
  const english = locale === 'en';

  const copy = english
    ? {
        eyebrow: 'Business toolkit',
        title: 'Tools to build a stronger barbershop.',
        description: 'Keep customer experience, day-to-day sales and your online presence organised from one place.',
        customersEyebrow: 'Customer experience',
        customersTitle: 'Make every visit easier',
        customersDescription: 'Tools that remove friction from booking, help manage demand and give customers a reason to return.',
        growthEyebrow: 'Business growth',
        growthTitle: 'Build your presence and sales',
        growthDescription: 'Keep your online shopfront and in-person sales connected to the rest of your business.',
        available: 'Available',
        open: 'Open tool',
        upgrade: 'View plans',
        quickActions: 'Quick access',
        bookingPage: 'Booking page',
        reports: 'Business reports',
        returnToDashboard: 'Back to dashboard',
      }
    : {
        eyebrow: 'Ferramentas do negócio',
        title: 'Tudo o que precisas para fazer crescer a barbearia.',
        description: 'Organiza a experiência dos clientes, as vendas do dia a dia e a presença online num só lugar.',
        customersEyebrow: 'Experiência do cliente',
        customersTitle: 'Torna cada visita mais simples',
        customersDescription: 'Ferramentas para facilitar as marcações, gerir a procura e dar aos clientes motivos para regressarem.',
        growthEyebrow: 'Crescimento do negócio',
        growthTitle: 'Desenvolve a tua presença e as vendas',
        growthDescription: 'Mantém a montra digital e as vendas presenciais ligadas ao resto do negócio.',
        available: 'Disponível',
        open: 'Abrir ferramenta',
        upgrade: 'Ver planos',
        quickActions: 'Acesso rápido',
        bookingPage: 'Página de marcação',
        reports: 'Relatórios do negócio',
        returnToDashboard: 'Voltar à dashboard',
      };

  if (loading) {
    return (
      <main className="dashboard-page min-h-screen px-4 pb-28 pt-8 sm:px-6 lg:px-8" aria-busy="true">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="h-48 animate-pulse rounded-3xl bg-white/[.025]" />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="h-64 animate-pulse rounded-2xl bg-white/[.025]" />
            <div className="h-64 animate-pulse rounded-2xl bg-white/[.025]" />
            <div className="h-64 animate-pulse rounded-2xl bg-white/[.025]" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page min-h-screen px-3 pb-28 pt-5 text-foreground sm:px-6 sm:pt-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8 sm:space-y-10">
        <header className="relative isolate overflow-hidden rounded-3xl border border-white/[.09] bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,.10),transparent_48%),linear-gradient(135deg,rgba(255,255,255,.045),rgba(255,255,255,.012))] p-5 shadow-[0_24px_80px_rgba(0,0,0,.18)] sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 -z-10 size-80 rounded-full bg-sky-300/[.06] blur-3xl" />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/15 bg-sky-300/[.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.17em] text-sky-200">
                <LayoutGrid className="size-3.5" aria-hidden="true" />
                {copy.eyebrow}
              </div>
              <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-[-.04em] text-white sm:text-4xl">
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

        <section className="space-y-4" aria-labelledby="customer-tools-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.17em] text-sky-300">{copy.customersEyebrow}</p>
              <h2 id="customer-tools-heading" className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">{copy.customersTitle}</h2>
              <p className="mt-1 text-sm leading-5 text-zinc-500">{copy.customersDescription}</p>
            </div>
            <span className="text-xs text-zinc-600">{english ? '3 tools' : '3 ferramentas'}</span>
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
            <span className="text-xs text-zinc-600">{english ? '2 tools' : '2 ferramentas'}</span>
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
                pointsEnabledLabel={copy.noFeature}
              />
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-white/[.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs leading-5 text-zinc-600">
            <Check className="size-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
            {copy.available}
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
