import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  LayoutDashboard,
  ShieldCheck,
  Smartphone,
  Users,
  Zap,
} from 'lucide-react';
import { SiteNavbar } from '@/components/site-navbar';
import { PwaInstallButton } from '@/components/pwa-install-button';

export const metadata: Metadata = {
  title: 'Instalar a aplicação Silentra for Barbers',
  description:
    'Adiciona a Silentra ao ecrã principal do teu iPhone ou Android e acede à dashboard da tua barbearia como uma aplicação.',
  alternates: {
    canonical: 'https://barbers.silentra.me/instalar',
  },
  robots: {
    index: false,
    follow: true,
  },
};

const features = [
  {
    icon: CalendarDays,
    title: { pt: 'Agenda e marcações', en: 'Appointments and calendar' },
    description: {
      pt: 'Consulta e gere as marcações sem teres de procurar o site no navegador.',
      en: 'Review and manage bookings without searching for the site in your browser.',
    },
  },
  {
    icon: Users,
    title: { pt: 'Clientes e equipa', en: 'Clients and team' },
    description: {
      pt: 'Acede aos contactos, serviços e equipa a partir do mesmo painel.',
      en: 'Access clients, services and your team from the same dashboard.',
    },
  },
  {
    icon: Zap,
    title: { pt: 'Acesso rápido', en: 'Quick access' },
    description: {
      pt: 'Abre a Silentra através de um ícone no ecrã principal.',
      en: 'Open Silentra from an icon on your home screen.',
    },
  },
] as const;

export default async function InstallAppPage() {
  const cookieStore = await cookies();
  const english = cookieStore.get('locale')?.value === 'en';
  const locale = english ? 'en' : 'pt';

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-50 antialiased">
      <SiteNavbar />

      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-32 lg:px-8">
        <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900/55 px-5 py-8 shadow-[0_32px_100px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:px-8 sm:py-12 lg:px-12 lg:py-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-32 -z-10 size-[26rem] rounded-full bg-emerald-400/[0.09] blur-[100px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-40 left-1/4 -z-10 size-[22rem] rounded-full bg-sky-400/[0.05] blur-[100px]"
          />

          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100 sm:text-xs">
                <Smartphone className="size-3.5" aria-hidden="true" />
                {english
                  ? 'Silentra on your phone'
                  : 'Silentra no teu telemóvel'}
              </span>

              <h1 className="mt-6 max-w-3xl text-[2.65rem] font-semibold leading-[0.98] tracking-[-0.06em] text-white sm:text-5xl lg:text-6xl">
                {english ? (
                  <>
                    Your barbershop.
                    <span className="mt-1 block text-zinc-400">
                      One tap away.
                    </span>
                  </>
                ) : (
                  <>
                    A tua barbearia.
                    <span className="mt-1 block text-zinc-400">
                      Sempre à mão.
                    </span>
                  </>
                )}
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-6 text-zinc-300 sm:text-base sm:leading-7">
                {english
                  ? 'Add the existing Silentra dashboard to your home screen. Your agenda, clients, services and team stay in one place.'
                  : 'Adiciona a dashboard da Silentra ao ecrã principal. A agenda, os clientes, os serviços e a equipa continuam no mesmo lugar.'}
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <PwaInstallButton locale={locale} />
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm font-semibold text-zinc-100 transition-colors hover:border-white/20 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  {english ? 'Open dashboard' : 'Abrir dashboard'}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>

              <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-zinc-500">
                <ShieldCheck
                  className="mt-0.5 size-4 shrink-0 text-emerald-200/70"
                  aria-hidden="true"
                />
                {english
                  ? 'No App Store download or Apple Developer subscription is required. This is the web app, not a native iOS package.'
                  : 'Não precisas da App Store nem de uma subscrição Apple Developer. Esta é a aplicação Web, não um pacote iOS nativo.'}
              </p>
            </div>

            <div className="mx-auto w-full max-w-sm lg:max-w-md">
              <div className="relative mx-auto max-w-[19rem] rounded-[2.7rem] border border-white/15 bg-black/80 p-2.5 shadow-[0_35px_100px_rgba(0,0,0,0.55)]">
                <div className="relative min-h-[25rem] overflow-hidden rounded-[2.1rem] border border-white/8 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.11),transparent_48%),#09090b] p-4 sm:min-h-[27rem] sm:p-5">
                  <div className="mx-auto mb-6 h-1.5 w-16 rounded-full bg-white/15" />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                        SILENTRA / BARBERS
                      </p>
                      <p className="mt-1 text-lg font-semibold tracking-tight text-white">
                        {english ? 'Overview' : 'Visão geral'}
                      </p>
                    </div>
                    <div className="flex size-10 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100">
                      <LayoutDashboard className="size-5" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-3">
                      <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-200">
                        <CalendarDays className="size-4" aria-hidden="true" />
                      </div>
                      <p className="mt-4 text-[10px] text-zinc-500">
                        {english ? 'Appointments' : 'Marcações'}
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-white">
                        12
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-3">
                      <div className="flex size-8 items-center justify-center rounded-xl bg-sky-400/10 text-sky-200">
                        <Users className="size-4" aria-hidden="true" />
                      </div>
                      <p className="mt-4 text-[10px] text-zinc-500">
                        {english ? 'Clients' : 'Clientes'}
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-white">
                        86
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-100">
                        {english ? 'Today' : 'Hoje'}
                      </p>
                      <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-2 py-1 text-[9px] font-medium text-emerald-100">
                        {english ? 'Live dashboard' : 'Dashboard ativa'}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {[
                        ['09:30', english ? 'Haircut' : 'Corte de cabelo'],
                        ['11:00', english ? 'Beard trim' : 'Aparar barba'],
                        [
                          '14:30',
                          english ? 'Haircut + beard' : 'Corte + barba',
                        ],
                      ].map(([time, service], index) => (
                        <div key={time} className="flex items-center gap-3">
                          <span className="w-10 text-[10px] tabular-nums text-zinc-500">
                            {time}
                          </span>
                          <span
                            className={
                              index === 0
                                ? 'h-8 w-0.5 rounded-full bg-emerald-300/70'
                                : 'h-8 w-0.5 rounded-full bg-white/15'
                            }
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                            {service}
                          </span>
                          <CheckCircle2
                            className="size-3.5 shrink-0 text-emerald-200/70"
                            aria-hidden="true"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.025] p-3">
                    <div className="flex size-8 items-center justify-center rounded-xl bg-white/[0.05] text-zinc-300">
                      <Smartphone className="size-4" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-100">
                        {english ? 'On your home screen' : 'No ecrã principal'}
                      </p>
                      <p className="mt-0.5 text-[10px] text-zinc-500">
                        {english
                          ? 'Tap to launch Silentra'
                          : 'Toca para abrir a Silentra'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-center text-[10px] leading-5 text-zinc-600">
                {english
                  ? 'Illustrative preview. Your actual dashboard data is loaded after signing in.'
                  : 'Pré-visualização ilustrativa. Os dados reais da dashboard são carregados depois de iniciares sessão.'}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-3 sm:mt-10 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title.pt}
                className="rounded-2xl border border-white/8 bg-white/[0.025] p-5 sm:p-6"
              >
                <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-100">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-base font-semibold tracking-tight text-white">
                  {english ? feature.title.en : feature.title.pt}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {english ? feature.description.en : feature.description.pt}
                </p>
              </article>
            );
          })}
        </section>

        <section className="mt-8 rounded-2xl border border-white/8 bg-white/[0.02] p-5 sm:mt-10 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {english
                  ? 'How to add it on iPhone'
                  : 'Como instalar no iPhone'}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
                {english
                  ? 'Open this page in Safari, tap Share, choose “Add to Home Screen” and confirm. If you do not see the option, open the page directly in Safari rather than an in-app browser.'
                  : 'Abre esta página no Safari, toca em Partilhar, escolhe «Adicionar ao ecrã principal» e confirma. Se não encontrares a opção, abre o endereço diretamente no Safari e não dentro de outra aplicação.'}
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              {english ? 'Sign in' : 'Iniciar sessão'}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
