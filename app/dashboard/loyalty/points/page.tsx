'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { EarningRulesCard } from '@/components/dashboard/loyalty/earning-rules-card';
import { useLanguage } from '@/context/LanguageContext';

export default function LoyaltyPointsPage() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link
            href="/dashboard/loyalty"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" / > {t('loyaltyPointsPage.loyalty')}
          </Link>
          <p className="mt-6 text-sm font-medium text-primary">{t('loyaltyPointsPage.kicker')}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {t('loyaltyPointsPage.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t('loyaltyPointsPage.description')}
          </p>
        </header>
        <EarningRulesCard />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/loyalty/validate"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            {t('loyaltyPointsPage.validateReward')}
          </Link>
          <Link
            href="/dashboard/loyalty"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm"
          >
            {t('loyaltyPointsPage.manageRewards')}
          </Link>
        </div>
      </div>
    </main>
  );
}
