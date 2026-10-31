'use client';

import { useDashboardConfirm } from '@/components/dashboard/dashboard-confirm-provider';

import { useEffect, useState } from 'react';
import { Ban, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

const ACTIVE_STATES = ['scheduled', 'sending'] as const;
const VISIBLE_STATES = ['scheduled', 'sending', 'cancelled'] as const;

type Campaign = {
  id: string;
  name: string;
  channel: 'email' | 'sms';
  status: string;
};

function statusLabel(status: string, t: (key: string) => string) {
  if (status === 'scheduled') return t('marketingPage.statuses.scheduled');
  if (status === 'sending') return t('marketingPage.statuses.sending');
  if (status === 'cancelled') return t('marketingPage.statuses.cancelled');
  return status;
}

export function CampaignLifecycleActions() {
  const { t } = useLanguage();
  const confirm = useDashboardConfirm();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/marketing/campaigns', {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? t('campaignLifecycle.loadError'));
      setCampaigns(
        (data.campaigns ?? []).filter((campaign: Campaign) =>
          VISIBLE_STATES.includes(
            campaign.status as (typeof VISIBLE_STATES)[number],
          ),
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('campaignLifecycle.loadGenericError'),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [t]);

  async function cancel(campaign: Campaign) {
    const confirmed = await confirm({
      title: t('campaignLifecycle.cancelTitle'),
      description: t('campaignLifecycle.cancelDescription', {
        name: campaign.name,
      }),
      confirmLabel: t('campaignLifecycle.cancelAction'),
      destructive: true,
    });
    if (!confirmed) return;
    setBusyId(campaign.id);
    try {
      const response = await fetch(
        `/api/marketing/campaigns/${campaign.id}/cancel`,
        { method: 'POST' },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? t('campaignLifecycle.cancelError'));
      toast.success(data.message ?? t('campaignLifecycle.cancelled'));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('campaignLifecycle.cancelGenericError'),
      );
    } finally {
      setBusyId('');
    }
  }

  async function remove(campaign: Campaign) {
    const confirmed = await confirm({
      title: t('campaignLifecycle.deleteTitle'),
      description: t('campaignLifecycle.deleteDescription', {
        name: campaign.name,
      }),
      confirmLabel: t('campaignLifecycle.deleteAction'),
      destructive: true,
    });
    if (!confirmed) return;
    setBusyId(campaign.id);
    try {
      const response = await fetch(
        `/api/marketing/campaigns?id=${encodeURIComponent(campaign.id)}`,
        { method: 'DELETE' },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? t('campaignLifecycle.deleteError'));
      toast.success(t('campaignLifecycle.deleted'));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('campaignLifecycle.deleteGenericError'),
      );
    } finally {
      setBusyId('');
    }
  }

  if (!campaigns.length && !loading) return null;

  return (
    <section
      className="border-b border-white/10 bg-zinc-950/80 px-4 py-3 backdrop-blur-xl"
      aria-labelledby="campaign-lifecycle-title"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p
            id="campaign-lifecycle-title"
            className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
          >
            {t('campaignLifecycle.title')}
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            {t('campaignLifecycle.description')}
          </p>
        </div>
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 lg:justify-end">
          {campaigns.map((campaign) => {
            const active = ACTIVE_STATES.includes(
              campaign.status as (typeof ACTIVE_STATES)[number],
            );
            const busy = busyId === campaign.id;
            return (
              <div
                key={campaign.id}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="max-w-56 truncate text-xs font-medium text-white">
                    {campaign.name}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {campaign.channel.toUpperCase()} ·{' '}
                    {statusLabel(campaign.status, t)}
                  </p>
                </div>
                {active ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void cancel(campaign)}
                    disabled={busy}
                    className="border-amber-400/20 text-amber-300 hover:bg-amber-400/10 hover:text-amber-200"
                  >
                    {busy ? (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Ban className="mr-1.5 size-4" aria-hidden="true" />
                    )}
                    {busy
                      ? t('campaignLifecycle.cancelling')
                      : t('campaignLifecycle.cancel')}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void remove(campaign)}
                    disabled={busy}
                    className="border-red-400/20 text-red-300 hover:bg-red-400/10 hover:text-red-200"
                  >
                    {busy ? (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
                    )}
                    {busy
                      ? t('campaignLifecycle.deleting')
                      : t('campaignLifecycle.delete')}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          aria-label={t('campaignLifecycle.refresh')}
        >
          <RefreshCw
            className={`size-4 ${loading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </Button>
      </div>
    </section>
  );
}
