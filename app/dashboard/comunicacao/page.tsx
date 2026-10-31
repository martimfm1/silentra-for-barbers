'use client';

import Link from 'next/link';
import {
  Bell,
  Megaphone,
  MessageCircle,
  Cake,
  ArrowUpRight,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

const sections = [
  {
    href: '/dashboard/mensagens',
    titleKey: 'messagesTitle',
    descriptionKey: 'messagesDescription',
    icon: MessageCircle,
    feature: 'messaging' as const,
  },
  {
    href: '/dashboard/marketing',
    titleKey: 'campaignsTitle',
    descriptionKey: 'campaignsDescription',
    icon: Megaphone,
    feature: 'marketing_campaigns' as const,
  },
  {
    href: '/dashboard/mensagens/birthdays',
    titleKey: 'birthdaysTitle',
    descriptionKey: 'birthdaysDescription',
    icon: Cake,
    feature: 'messaging' as const,
  },
];

export default function CommunicationPage() {
  const { hasFeature, loading } = useFeatureAccess();
  const { t } = useLanguage();

  if (loading) return <main className="min-h-screen bg-background" />;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t('communicationPage.eyebrow')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('communicationPage.title')}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {t('communicationPage.description')}
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;
            const locked = !hasFeature(section.feature);
            return (
              <Card
                key={section.href}
                className="border-white/10 bg-white/[0.02] transition hover:bg-white/[0.035]"
              >
                <CardHeader>
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="mt-2">
                    {t(`communicationPage.${section.titleKey}`)}
                  </CardTitle>
                  <CardDescription>
                    {t(`communicationPage.${section.descriptionKey}`)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {locked ? (
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/dashboard/billing">
                        {t('communicationPage.viewPlans')}
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild className="w-full">
                      <Link href={section.href}>
                        {t('communicationPage.open', {
                          section: t(
                            `communicationPage.${section.titleKey}`,
                          ).toLowerCase(),
                        })}{' '}
                        <ArrowUpRight className="ml-2 size-4" />
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>

        <Card className="border-primary/15 bg-primary/[0.04]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">
                  {t('communicationPage.centralTitle')}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('communicationPage.centralDescription')}
                </p>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard">
                {t('communicationPage.backToOverview')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
