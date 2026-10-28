'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  RefreshCcw,
  Receipt,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

type TransactionItem = {
  id: string;
  description: string;
  quantity: number;
  total: number;
};

type Transaction = {
  id: string;
  status: string;
  payment_method: string;
  total: number;
  discount: number;
  created_at: string;
  pos_transaction_items?: TransactionItem[];
};

const money = (value: number, locale: 'pt' | 'en') =>
  new Intl.NumberFormat(locale === 'pt' ? 'pt-PT' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

function paymentLabel(value: string, t: (key: string) => string) {
  return (
    (
      {
        cash: t('posOverviewPage.cash'),
        card: t('posOverviewPage.card'),
        transfer: t('posOverviewPage.transfer'),
        other: t('posOverviewPage.other'),
      } as Record<string, string>
    )[value] ?? value
  );
}

async function authHeaders() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token)
    throw new Error('A tua sessão terminou. Volta a iniciar sessão.');
  return { Authorization: `Bearer ${session.access_token}` };
}

export default function SalesOverviewPage() {
  const { t, locale } = useLanguage();
  const { hasFeature, loading: accessLoading } = useFeatureAccess();
  const allowed = hasFeature('pos');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('30d');

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/enterprise/pos', {
        headers: await authHeaders(),
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || t('posOverviewPage.loadError'));
      setTransactions(body.transactions ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('posOverviewPage.loadError'),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!accessLoading && allowed) void load();
  }, [accessLoading, allowed]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const ms =
      period === 'today'
        ? 24 * 60 * 60 * 1000
        : period === '7d'
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;
    return transactions.filter(
      (item) => now - new Date(item.created_at).getTime() <= ms,
    );
  }, [transactions, period]);

  const completed = useMemo(
    () => filtered.filter((item) => item.status === 'completed'),
    [filtered],
  );
  const reversed = useMemo(
    () =>
      filtered.filter(
        (item) => item.status === 'refunded' || item.status === 'void',
      ),
    [filtered],
  );
  const revenue = useMemo(
    () => completed.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [completed],
  );
  const reversedValue = useMemo(
    () => reversed.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [reversed],
  );
  const average = completed.length ? revenue / completed.length : 0;
  const discounts = useMemo(
    () => completed.reduce((sum, item) => sum + Number(item.discount || 0), 0),
    [completed],
  );

  const topItems = useMemo(() => {
    const map = new Map<string, { quantity: number; revenue: number }>();
    for (const transaction of completed) {
      for (const item of transaction.pos_transaction_items ?? []) {
        const current = map.get(item.description) ?? {
          quantity: 0,
          revenue: 0,
        };
        map.set(item.description, {
          quantity: current.quantity + Number(item.quantity || 0),
          revenue: current.revenue + Number(item.total || 0),
        });
      }
    }
    return [...map.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [completed]);

  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const transaction of completed) {
      const current = map.get(transaction.payment_method) ?? {
        count: 0,
        revenue: 0,
      };
      map.set(transaction.payment_method, {
        count: current.count + 1,
        revenue: current.revenue + Number(transaction.total || 0),
      });
    }
    return [...map.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  }, [completed]);

  if (accessLoading || loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Spinner className="size-7" />
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen px-4 py-16">
        <div className="mx-auto max-w-xl">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <ShoppingBag className="size-8 text-primary" />
              <h1 className="text-2xl font-semibold">{t('posOverviewPage.managementTitle')}</h1>
              <p className="text-muted-foreground">
                {t('posOverviewPage.managementDescription')}
              </p>
              <Button asChild>
                <Link href="/dashboard/billing">{t('posOverviewPage.viewPlans')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/dashboard/pos"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft className="size-4" /> {t('posOverviewPage.backToPos')}
            </Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Vendas
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              {t('posOverviewPage.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {t('posOverviewPage.description')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-white/10 bg-white/[0.02] p-1">
              {(['today', '7d', '30d'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={period === value}
                  onClick={() => setPeriod(value)}
                  className={`min-h-10 rounded-lg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${period === value ? 'bg-white text-zinc-950' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {value === 'today'
                    ? t('posOverviewPage.today')
                    : value === '7d'
                      ? t('posOverviewPage.sevenDays')
                      : t('posOverviewPage.thirtyDays')}
                </button>
              ))}
            </div>
            <Button asChild className="min-h-10">
              <Link href="/dashboard/pos">{t('posOverviewPage.newSale')}</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => void load()}
              className="min-h-10"
            >
              <RefreshCcw className="mr-2 size-4" />
              Atualizar
            </Button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{t('posOverviewPage.revenue')}</p>
              <p className="mt-2 text-2xl font-semibold">{money(revenue, locale)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('posOverviewPage.completedSales')}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{t('posOverviewPage.eyebrow')}</p>
              <p className="mt-2 text-2xl font-semibold">{completed.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('posOverviewPage.completedOperations')}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{t('posOverviewPage.averageValue')}</p>
              <p className="mt-2 text-2xl font-semibold">{money(average, locale)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('posOverviewPage.perSale')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{t('posOverviewPage.discounts')}</p>
              <p className="mt-2 text-2xl font-semibold">{money(discounts, locale)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('posOverviewPage.discountValue')}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">
                {t('posOverviewPage.refundsVoids')}
              </p>
              <p className="mt-2 text-2xl font-semibold">{reversed.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {money(reversedValue, locale)} {t('posOverviewPage.reversed')}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="size-5" />
                {t('posOverviewPage.topItems')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topItems.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">
                  {t('posOverviewPage.noCompletedInPeriod')}
                </p>
              ) : (
                <div className="space-y-3">
                  {topItems.map((item, index) => {
                    const share =
                      revenue > 0
                        ? Math.round((item.revenue / revenue) * 100)
                        : 0;
                    return (
                      <div
                        key={item.name}
                        className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {item.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.quantity} · {t('posOverviewPage.units')} · {share}% {t('posOverviewPage.ofRevenue')}
                              </p>
                            </div>
                          </div>
                          <p className="font-semibold">{money(item.revenue, locale)}</p>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-5" />
                {t('posOverviewPage.paymentMethods')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {paymentBreakdown.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">
                  {t('posOverviewPage.noSalesInPeriod')}
                </p>
              ) : (
                paymentBreakdown.map(([method, stats]) => (
                  <div
                    key={method}
                    className="flex items-center justify-between rounded-xl border border-white/10 p-3"
                  >
                    <div>
                      <p className="font-medium">{paymentLabel(method, t)}</p>
                      <p className="text-xs text-muted-foreground">
                        {stats.count} {t('posOverviewPage.salesCount')}
                      </p>
                    </div>
                    <p className="font-semibold">{money(stats.revenue, locale)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-5" />
              {t('posOverviewPage.latestSales')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {completed.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">
                {t('posOverviewPage.noCompletedSales')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-b border-white/10 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3">{t('posOverviewPage.date')}</th>
                      <th className="px-3 py-3">{t('posOverviewPage.items')}</th>
                      <th className="px-3 py-3">{t('posOverviewPage.payment')}</th>
                      <th className="px-3 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {completed.slice(0, 20).map((transaction) => (
                      <tr key={transaction.id}>
                        <td className="px-3 py-4 text-muted-foreground">
                          {new Date(transaction.created_at).toLocaleString(locale === 'pt' ? 'pt-PT' : 'en-GB')}
                        </td>
                        <td className="max-w-[420px] px-3 py-4">
                          {(transaction.pos_transaction_items ?? [])
                            .map(
                              (item) =>
                                `${item.description} × ${item.quantity}`,
                            )
                            .join(', ') || '—'}
                        </td>
                        <td className="px-3 py-4">
                          {paymentLabel(transaction.payment_method, t)}
                        </td>
                        <td className="px-3 py-4 text-right font-semibold">
                          {money(transaction.total, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
