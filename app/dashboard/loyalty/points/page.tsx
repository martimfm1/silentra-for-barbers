'use client';

import Link from 'next/link';
import { ArrowLeft, Gift, QrCode, Sparkles } from 'lucide-react';
import { EarningRulesCard } from '@/components/dashboard/loyalty/earning-rules-card';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function LoyaltyPointsPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-background px-4 py-7 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-7">
        <header className="space-y-4 border-b border-white/10 pb-6">
          <Link
            href="/dashboard/loyalty"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-muted-foreground transition hover:border-white/20 hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('loyaltyPointsPage.loyalty')}
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {t('loyaltyPointsPage.kicker')}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                {t('loyaltyPointsPage.title')}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t('loyaltyPointsPage.description')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="min-h-10">
                <Link href="/dashboard/loyalty">
                  <Gift className="size-4" aria-hidden="true" />
                  {t('loyaltyPointsPage.manageRewards')}
                </Link>
              </Button>
              <Button asChild className="min-h-10">
                <Link href="/dashboard/loyalty/validate">
                  <QrCode className="size-4" aria-hidden="true" />
                  {t('loyaltyPointsPage.validateReward')}
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <Card className="border-primary/15 bg-primary/[0.035]">
          <CardContent className="flex items-start gap-3 p-4 sm:p-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <p className="text-sm leading-6 text-muted-foreground">
              {t('loyaltyPointsPage.earningHint')}
            </p>
          </CardContent>
        </Card>

        <EarningRulesCard />
      </div>
    </main>
  );
}
