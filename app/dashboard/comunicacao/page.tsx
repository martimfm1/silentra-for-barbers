'use client';

import Link from 'next/link';
import {
  ArrowRight, BellRing, CalendarCheck, CheckCircle2, Clock3, Mail,
  Megaphone, MessageCircle, ShieldCheck, Sparkles, Users, Zap,
} from 'lucide-react';
import { FeaturePlanBadge } from '@/components/billing/FeaturePlanBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useLanguage } from '@/context/LanguageContext';

const workflows = [
  { href: '/dashboard/mensagens', titleKey: 'messagesTitle', descriptionKey: 'messagesDescription', actionKey: 'messagesAction', detailKey: 'messagesDetail', icon: MessageCircle, feature: 'messaging' as const, step: '01', accent: 'text-sky-300', surface: 'border-sky-300/15 bg-sky-300/[.07]' },
  { href: '/dashboard/marketing', titleKey: 'campaignsTitle', descriptionKey: 'campaignsDescription', actionKey: 'campaignsAction', detailKey: 'campaignsDetail', icon: Megaphone, feature: 'marketing_campaigns' as const, step: '02', accent: 'text-violet-300', surface: 'border-violet-300/15 bg-violet-300/[.07]' },
  { href: '/dashboard/automations', titleKey: 'automationsTitle', descriptionKey: 'automationsDescription', actionKey: 'automationsAction', detailKey: 'automationsDetail', icon: Zap, feature: 'marketing_campaigns' as const, step: '03', accent: 'text-emerald-300', surface: 'border-emerald-300/15 bg-emerald-300/[.07]' },
];

const playbook = [
  { icon: CalendarCheck, titleKey: 'beforeVisitTitle', descriptionKey: 'beforeVisitDescription' },
  { icon: CheckCircle2, titleKey: 'afterVisitTitle', descriptionKey: 'afterVisitDescription' },
  { icon: Users, titleKey: 'winBackTitle', descriptionKey: 'winBackDescription' },
];

export default function CommunicationPage() {
  const { hasFeature, loading } = useFeatureAccess();
  const { t, locale } = useLanguage();
  const english = locale === 'en';

  if (loading) {
    return (
      <main className="dashboard-page min-h-screen px-4 pb-28 pt-8 sm:px-6 lg:px-8" aria-busy="true">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="h-48 animate-pulse rounded-3xl bg-white/[.025]" />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="h-60 animate-pulse rounded-2xl bg-white/[.025]" />
            <div className="h-60 animate-pulse rounded-2xl bg-white/[.025]" />
            <div className="h-60 animate-pulse rounded-2xl bg-white/[.025]" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page min-h-screen px-3 pb-28 pt-5 text-foreground sm:px-6 sm:pt-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-7 sm:space-y-9">
        <header className="relative isolate overflow-hidden rounded-3xl border border-white/[.09] bg-[radial-gradient(ellipse_at_top_right,rgba(52,211,153,.12),transparent_52%),linear-gradient(135deg,rgba(255,255,255,.045),rgba(255,255,255,.012))] p-5 shadow-[0_24px_80px_rgba(0,0,0,.18)] sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-28 -z-10 size-80 rounded-full bg-emerald-300/[.07] blur-3xl" />
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.17em] text-emerald-200">
                <MessageCircle className="size-3.5" aria-hidden="true" />
                {t('communicationPage.eyebrow')}
              </div>
              <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-[-.04em] text-white sm:text-4xl">
                {t('communicationPage.title')}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                {t('communicationPage.description')}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row xl:flex-col xl:items-stretch">
              <Button asChild className="min-h-11 bg-emerald-400 px-5 font-semibold text-zinc-950 hover:bg-emerald-300">
                <Link href="/dashboard/mensagens">
                  <Mail className="mr-2 size-4" aria-hidden="true" />
                  {t('communicationPage.primaryAction')}
                  <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                </Link>
              </Button>
              <p className="text-xs leading-5 text-zinc-500 sm:max-w-48 xl:max-w-none xl:text-right">
                {english ? 'Choose a channel and a message that fits the moment.' : 'Escolhe o canal e a mensagem certos para cada momento.'}
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-2 border-t border-white/[.08] pt-5 sm:grid-cols-3">
            <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-black/15 px-3 py-2.5">
              <Mail className="size-4 shrink-0 text-emerald-300" aria-hidden="true" />
              <span className="min-w-0 text-xs font-medium text-zinc-300">{t('communicationPage.emailAvailable')}</span>
              <span className="ml-auto size-1.5 shrink-0 rounded-full bg-emerald-300" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-black/15 px-3 py-2.5">
              <BellRing className="size-4 shrink-0 text-sky-300" aria-hidden="true" />
              <span className="min-w-0 text-xs font-medium text-zinc-300">{t('communicationPage.pushOperational')}</span>
              <span className="ml-auto size-1.5 shrink-0 rounded-full bg-sky-300" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-black/15 px-3 py-2.5">
              <MessageCircle className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
              <span className="min-w-0 text-xs font-medium text-zinc-400">{t('communicationPage.smsUnavailable')}</span>
              <span className="ml-auto size-1.5 shrink-0 rounded-full bg-zinc-600" aria-hidden="true" />
            </div>
          </div>
        </header>

        <section className="space-y-4" aria-labelledby="communication-workflows">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.17em] text-emerald-300">{t('communicationPage.workspaceEyebrow')}</p>
              <h2 id="communication-workflows" className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">{t('communicationPage.workspaceTitle')}</h2>
              <p className="mt-1 text-sm leading-5 text-zinc-500">{t('communicationPage.workspaceDescription')}</p>
            </div>
            <span className="text-xs text-zinc-600">{t('communicationPage.threeTools')}</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {workflows.map((workflow) => {
              const Icon = workflow.icon;
              const locked = !hasFeature(workflow.feature);
              return (
                <Card key={workflow.href} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border-white/[.09] bg-white/[.025] transition duration-200 hover:-translate-y-0.5 hover:border-white/[.16] hover:bg-white/[.04]">
                  <CardHeader className="flex-1 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className={'flex size-11 items-center justify-center rounded-2xl border ' + workflow.surface + ' ' + workflow.accent}>
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <span className="text-[10px] font-semibold tracking-[.16em] text-zinc-600">{(english ? 'FLOW ' : 'FLUXO ') + workflow.step}</span>
                    </div>
                    <CardTitle className="mt-4 flex flex-wrap items-center gap-2 text-lg text-zinc-100">
                      {t('communicationPage.' + workflow.titleKey)}
                      <FeaturePlanBadge feature={workflow.feature} />
                    </CardTitle>
                    <CardDescription className="text-sm leading-6 text-zinc-400">{t('communicationPage.' + workflow.descriptionKey)}</CardDescription>
                    <p className="mt-3 text-xs leading-5 text-zinc-500">{t('communicationPage.' + workflow.detailKey)}</p>
                  </CardHeader>
                  <CardContent className="border-t border-white/[.07] p-4 sm:p-5">
                    <Button asChild variant={locked ? 'outline' : 'secondary'} className={locked ? 'min-h-11 w-full border-white/10 bg-transparent text-zinc-300' : 'min-h-11 w-full justify-between bg-white/[.06] text-zinc-100 hover:bg-emerald-300/[.09] hover:text-emerald-100'}>
                      <Link href={locked ? '/dashboard/billing' : workflow.href}>
                        {locked ? (
                          <><ShieldCheck className="mr-2 size-4" aria-hidden="true" />{t('communicationPage.viewPlans')}</>
                        ) : (
                          <>{t('communicationPage.' + workflow.actionKey)}<ArrowRight className="ml-auto size-4" aria-hidden="true" /></>
                        )}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.7fr)]">
          <Card className="overflow-hidden rounded-2xl border-white/[.09] bg-white/[.02]">
            <CardHeader className="border-b border-white/[.06] px-4 py-4 sm:px-5">
              <div className="flex items-center gap-2 text-emerald-300">
                <Sparkles className="size-4" aria-hidden="true" />
                <span className="text-[10px] font-semibold uppercase tracking-[.17em]">{t('communicationPage.playbookEyebrow')}</span>
              </div>
              <CardTitle className="text-lg text-zinc-100">{t('communicationPage.playbookTitle')}</CardTitle>
              <CardDescription>{t('communicationPage.playbookDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 p-3 sm:grid-cols-3 sm:p-4">
              {playbook.map(({ icon: Icon, titleKey, descriptionKey }, index) => (
                <div key={titleKey} className="relative min-w-0 rounded-xl border border-white/[.07] bg-black/15 p-3.5 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex size-9 items-center justify-center rounded-xl border border-emerald-300/10 bg-emerald-300/[.06] text-emerald-200"><Icon className="size-4" aria-hidden="true" /></span>
                    <span className="text-[10px] font-semibold tracking-[.15em] text-zinc-600">{(english ? 'STEP 0' : 'PASSO 0') + (index + 1)}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-zinc-200">{t('communicationPage.' + titleKey)}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-zinc-500">{t('communicationPage.' + descriptionKey)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-white/[.09] bg-white/[.02]">
            <CardHeader className="px-4 pb-3 pt-4 sm:px-5">
              <div className="flex items-center gap-2 text-sky-300">
                <Clock3 className="size-4" aria-hidden="true" />
                <span className="text-[10px] font-semibold uppercase tracking-[.17em]">{t('communicationPage.channelEyebrow')}</span>
              </div>
              <CardTitle className="text-lg text-zinc-100">{t('communicationPage.channelTitle')}</CardTitle>
              <CardDescription>{t('communicationPage.channelDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4 sm:px-5">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-300/10 bg-emerald-300/[.035] p-3">
                <Mail className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden="true" />
                <div className="min-w-0"><p className="text-sm font-medium text-zinc-200">{t('communicationPage.emailTitle')}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{t('communicationPage.emailDescription')}</p></div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-white/[.07] p-3">
                <BellRing className="mt-0.5 size-4 shrink-0 text-sky-300" aria-hidden="true" />
                <div className="min-w-0"><p className="text-sm font-medium text-zinc-200">{t('communicationPage.pushTitle')}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{t('communicationPage.pushDescription')}</p></div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-white/[.07] p-3">
                <MessageCircle className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden="true" />
                <div className="min-w-0"><p className="text-sm font-medium text-zinc-200">{t('communicationPage.smsTitle')}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{t('communicationPage.smsDescription')}</p></div>
              </div>
            </CardContent>
          </Card>
        </section>

        <p className="flex items-start gap-2 border-t border-white/[.06] pt-4 text-xs leading-5 text-zinc-600">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {t('communicationPage.privacyNote')}
        </p>
      </div>
    </main>
  );
}
