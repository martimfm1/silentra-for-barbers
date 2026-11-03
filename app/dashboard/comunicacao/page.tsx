'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Mail,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useLanguage } from '@/context/LanguageContext';

const workflows = [
  {
    href: '/dashboard/mensagens',
    titleKey: 'messagesTitle',
    descriptionKey: 'messagesDescription',
    actionKey: 'messagesAction',
    detailKey: 'messagesDetail',
    icon: MessageCircle,
    feature: 'messaging' as const,
    step: '01',
  },
  {
    href: '/dashboard/marketing',
    titleKey: 'campaignsTitle',
    descriptionKey: 'campaignsDescription',
    actionKey: 'campaignsAction',
    detailKey: 'campaignsDetail',
    icon: Megaphone,
    feature: 'marketing_campaigns' as const,
    step: '02',
  },
  {
    href: '/dashboard/automations',
    titleKey: 'automationsTitle',
    descriptionKey: 'automationsDescription',
    actionKey: 'automationsAction',
    detailKey: 'automationsDetail',
    icon: Zap,
    feature: 'marketing_campaigns' as const,
    step: '03',
  },
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

  if (loading) return <main className="min-h-screen bg-background" aria-busy="true" />;

  return (
    <main className="dashboard-page min-h-screen px-4 pb-28 pt-8 text-foreground sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/[0.10] via-white/[0.025] to-transparent p-5 sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-20 size-64 rounded-full bg-emerald-400/[0.08] blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                <MessageCircle className="size-4" aria-hidden="true" />
                {t('communicationPage.eyebrow')}
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {t('communicationPage.title')}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                {t('communicationPage.description')}
              </p>
            </div>
            <Button asChild className="min-h-11 w-full sm:w-auto">
              <Link href="/dashboard/mensagens">
                <Mail className="mr-2 size-4" aria-hidden="true" />
                {t('communicationPage.primaryAction')}
                <ArrowRight className="ml-2 size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <div className="relative mt-6 flex flex-wrap gap-2">
            <Badge variant="outline" className="border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300">
              <Mail className="mr-1.5 size-3" aria-hidden="true" />
              {t('communicationPage.emailAvailable')}
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-zinc-400">
              {t('communicationPage.smsUnavailable')}
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-zinc-400">
              <BellRing className="mr-1.5 size-3" aria-hidden="true" />
              {t('communicationPage.pushOperational')}
            </Badge>
          </div>
        </header>

        <section className="space-y-4" aria-labelledby="communication-workflows">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
                {t('communicationPage.workspaceEyebrow')}
              </p>
              <h2 id="communication-workflows" className="mt-1 text-xl font-semibold text-white sm:text-2xl">
                {t('communicationPage.workspaceTitle')}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">{t('communicationPage.workspaceDescription')}</p>
            </div>
            <span className="text-xs text-zinc-600">{t('communicationPage.threeTools')}</span>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {workflows.map((workflow) => {
              const Icon = workflow.icon;
              const locked = !hasFeature(workflow.feature);
              return (
                <Card key={workflow.href} className="group flex min-w-0 flex-col overflow-hidden border-white/10 bg-white/[0.025] transition-colors hover:border-emerald-400/20 hover:bg-white/[0.04]">
                  <CardHeader className="flex-1 p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex size-11 items-center justify-center rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.08] text-emerald-300">
                        <Icon className="size-5" aria-hidden="true" />
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-zinc-600">{workflow.step}</span>
                    </div>
                    <CardTitle className="mt-4 text-lg text-zinc-100">
                      {t(`communicationPage.${workflow.titleKey}`)}
                    </CardTitle>
                    <CardDescription className="text-sm leading-6 text-zinc-400">
                      {t(`communicationPage.${workflow.descriptionKey}`)}
                    </CardDescription>
                    <p className="mt-3 text-xs leading-5 text-zinc-500">
                      {t(`communicationPage.${workflow.detailKey}`)}
                    </p>
                  </CardHeader>
                  <CardContent className="border-t border-white/[0.06] p-5 sm:px-6">
                    {locked ? (
                      <Button asChild variant="outline" className="min-h-11 w-full border-white/10">
                        <Link href="/dashboard/billing">
                          <ShieldCheck className="mr-2 size-4" aria-hidden="true" />
                          {t('communicationPage.viewPlans')}
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild variant="outline" className="min-h-11 w-full border-white/10 bg-white/[0.02] text-zinc-100 hover:border-emerald-400/20 hover:bg-emerald-400/[0.06]">
                        <Link href={workflow.href}>
                          {t(`communicationPage.${workflow.actionKey}`)}
                          <ArrowRight className="ml-auto size-4" aria-hidden="true" />
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <Card className="border-white/10 bg-white/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <Sparkles className="size-4" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                  {t('communicationPage.playbookEyebrow')}
                </span>
              </div>
              <CardTitle className="text-lg text-zinc-100">
                {t('communicationPage.playbookTitle')}
              </CardTitle>
              <CardDescription>{t('communicationPage.playbookDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 pt-1 md:grid-cols-3">
              {playbook.map(({ icon: Icon, titleKey, descriptionKey }, index) => (
                <div key={titleKey} className="rounded-2xl border border-white/[0.07] bg-black/10 p-4">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <Icon className="size-4" aria-hidden="true" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                      {english ? `STEP ${index + 1}` : `PASSO ${index + 1}`}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-zinc-200">{t(`communicationPage.${titleKey}`)}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-zinc-500">{t(`communicationPage.${descriptionKey}`)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-sky-300">
                <Clock3 className="size-4" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                  {t('communicationPage.channelEyebrow')}
                </span>
              </div>
              <CardTitle className="text-lg text-zinc-100">{t('communicationPage.channelTitle')}</CardTitle>
              <CardDescription>{t('communicationPage.channelDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-1">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] p-3">
                <Mail className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-zinc-200">{t('communicationPage.emailTitle')}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">{t('communicationPage.emailDescription')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] p-3">
                <BellRing className="mt-0.5 size-4 shrink-0 text-sky-300" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-zinc-200">{t('communicationPage.pushTitle')}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">{t('communicationPage.pushDescription')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] p-3">
                <PhoneIcon />
                <div>
                  <p className="text-sm font-medium text-zinc-200">{t('communicationPage.smsTitle')}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">{t('communicationPage.smsDescription')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <p className="text-xs leading-5 text-zinc-600">
          {t('communicationPage.privacyNote')}
        </p>
      </div>
    </main>
  );
}

function PhoneIcon() {
  return <MessageCircle className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden="true" />;
}
