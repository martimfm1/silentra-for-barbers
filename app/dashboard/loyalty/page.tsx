'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  Gift,
  Loader2,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDashboardConfirm } from '@/components/dashboard/dashboard-confirm-provider';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type LoyaltySettings = {
  enabled: boolean;
  points_per_euro: number;
  welcome_points: number;
  referral_points: number;
};

type Reward = {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  reward_type: 'discount' | 'free_service' | 'custom';
  reward_value: number | null;
  active: boolean;
};

type RewardForm = {
  name: string;
  description: string;
  points_cost: string;
  reward_type: Reward['reward_type'];
  reward_value: string;
};

const DEFAULT_SETTINGS: LoyaltySettings = {
  enabled: false,
  points_per_euro: 1,
  welcome_points: 0,
  referral_points: 0,
};

const EMPTY_REWARD: RewardForm = {
  name: '',
  description: '',
  points_cost: '100',
  reward_type: 'discount',
  reward_value: '',
};

async function readResponse(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, any>>;
}

export default function LoyaltyPage() {
  const { t } = useLanguage();
  const confirm = useDashboardConfirm();
  const { hasFeature, loading: accessLoading } = useFeatureAccess();
  const allowed = hasFeature('loyalty');

  const [settings, setSettings] = useState<LoyaltySettings>(DEFAULT_SETTINGS);
  const [initialSettings, setInitialSettings] =
    useState<LoyaltySettings>(DEFAULT_SETTINGS);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingReward, setSavingReward] = useState(false);
  const [changingRewardId, setChangingRewardId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [rewardForm, setRewardForm] = useState<RewardForm>(EMPTY_REWARD);
  const [status, setStatus] = useState('');

  const activeRewards = useMemo(
    () => rewards.filter((reward) => reward.active),
    [rewards],
  );
  const inactiveRewards = useMemo(
    () => rewards.filter((reward) => !reward.active),
    [rewards],
  );
  const settingsDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(initialSettings),
    [settings, initialSettings],
  );

  const load = useCallback(async (silent = false) => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const response = await fetch('/api/loyalty', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const data = await readResponse(response);
      if (!response.ok)
        throw new Error(data.error || t('loyaltyPage.loadError'));

      const nextSettings: LoyaltySettings = {
        enabled: data.settings?.enabled === true,
        points_per_euro: Number(data.settings?.points_per_euro ?? 1),
        welcome_points: Number(data.settings?.welcome_points ?? 0),
        referral_points: Number(data.settings?.referral_points ?? 0),
      };
      setSettings(nextSettings);
      setInitialSettings(nextSettings);
      setRewards(Array.isArray(data.rewards) ? data.rewards : []);
      setStatus('');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('loyaltyPage.loadGenericError');
      setStatus(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [allowed, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings() {
    if (savingSettings) return;
    if (
      !Number.isFinite(settings.points_per_euro) ||
      settings.points_per_euro <= 0 ||
      settings.points_per_euro > 100 ||
      !Number.isInteger(settings.welcome_points) ||
      settings.welcome_points < 0 ||
      settings.welcome_points > 100000 ||
      !Number.isInteger(settings.referral_points) ||
      settings.referral_points < 0 ||
      settings.referral_points > 100000
    ) {
      toast.error(t('loyaltyPage.invalidSettings'));
      return;
    }

    setSavingSettings(true);
    setStatus(t('loyaltyPage.savingSettings'));
    try {
      const response = await fetch('/api/loyalty', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(settings),
      });
      const data = await readResponse(response);
      if (!response.ok)
        throw new Error(data.error || t('loyaltyPage.saveError'));

      const nextSettings: LoyaltySettings = {
        enabled: data.settings?.enabled === true,
        points_per_euro: Number(data.settings?.points_per_euro ?? 1),
        welcome_points: Number(data.settings?.welcome_points ?? 0),
        referral_points: Number(data.settings?.referral_points ?? 0),
      };
      setSettings(nextSettings);
      setInitialSettings(nextSettings);
      const message = nextSettings.enabled
        ? t('loyalty.programEnabled')
        : t('loyalty.programDisabled');
      setStatus(message);
      toast.success(message);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('loyaltyPage.saveGenericError');
      setStatus(message);
      toast.error(message);
    } finally {
      setSavingSettings(false);
    }
  }

  function openNewReward() {
    setEditingId(null);
    setRewardForm(EMPTY_REWARD);
    setRewardDialogOpen(true);
  }

  function openEditReward(reward: Reward) {
    setEditingId(reward.id);
    setRewardForm({
      name: reward.name,
      description: reward.description ?? '',
      points_cost: String(reward.points_cost),
      reward_type: reward.reward_type,
      reward_value:
        reward.reward_value === null ? '' : String(reward.reward_value),
    });
    setRewardDialogOpen(true);
  }

  async function saveReward(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingReward) return;

    const name = rewardForm.name.trim();
    const pointsCost = Number(rewardForm.points_cost);
    const rewardValue =
      rewardForm.reward_value.trim() === ''
        ? null
        : Number(rewardForm.reward_value);

    if (!name || name.length > 120) {
      toast.error(t('loyaltyPage.invalidRewardName'));
      return;
    }
    if (!Number.isInteger(pointsCost) || pointsCost <= 0 || pointsCost > 10000000) {
      toast.error(t('loyaltyPage.invalidRewardPoints'));
      return;
    }
    if (
      rewardValue !== null &&
      (!Number.isFinite(rewardValue) || rewardValue < 0)
    ) {
      toast.error(t('loyaltyPage.invalidRewardValue'));
      return;
    }

    setSavingReward(true);
    try {
      const existing = editingId
        ? rewards.find((reward) => reward.id === editingId)
        : null;
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        name,
        description: rewardForm.description.trim(),
        points_cost: pointsCost,
        reward_type: rewardForm.reward_type,
        reward_value: rewardValue,
        active: existing?.active ?? true,
      };
      const response = await fetch('/api/loyalty/rewards', {
        method: editingId ? 'PATCH' : 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await readResponse(response);
      if (!response.ok)
        throw new Error(data.error || t('loyaltyPage.saveRewardError'));
      if (!data.reward) throw new Error(t('loyaltyPage.saveRewardError'));

      setRewards((current) =>
        editingId
          ? current.map((reward) =>
              reward.id === editingId ? { ...reward, ...data.reward } : reward,
            )
          : [data.reward as Reward, ...current],
      );
      setRewardDialogOpen(false);
      setEditingId(null);
      setRewardForm(EMPTY_REWARD);
      toast.success(
        editingId ? t('loyalty.rewardUpdated') : t('loyalty.rewardCreated'),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('loyaltyPage.saveRewardGenericError'),
      );
    } finally {
      setSavingReward(false);
    }
  }

  async function setRewardActive(reward: Reward, active: boolean) {
    if (changingRewardId) return;
    setChangingRewardId(reward.id);
    try {
      const response = await fetch('/api/loyalty/rewards', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ id: reward.id, active }),
      });
      const data = await readResponse(response);
      if (!response.ok)
        throw new Error(data.error || t('loyaltyPage.rewardStatusError'));
      setRewards((current) =>
        current.map((item) =>
          item.id === reward.id ? { ...item, active: data.reward?.active ?? active } : item,
        ),
      );
      toast.success(
        active
          ? t('loyaltyPage.rewardReactivated')
          : t('loyalty.rewardDisabled'),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('loyaltyPage.rewardStatusError'),
      );
    } finally {
      setChangingRewardId(null);
    }
  }

  async function deactivateReward(reward: Reward) {
    const confirmed = await confirm({
      title: t('loyaltyPage.deactivateRewardConfirm'),
      description: t('loyaltyPage.deactivateRewardDescription'),
      confirmLabel: t('loyaltyPage.deactivateRewardAction'),
      destructive: true,
    });
    if (!confirmed) return;
    if (changingRewardId) return;

    setChangingRewardId(reward.id);
    try {
      const response = await fetch(
        `/api/loyalty/rewards?id=${encodeURIComponent(reward.id)}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
          cache: 'no-store',
        },
      );
      const data = await readResponse(response);
      if (!response.ok)
        throw new Error(data.error || t('loyaltyPage.disableError'));
      setRewards((current) =>
        current.map((item) =>
          item.id === reward.id ? { ...item, active: false } : item,
        ),
      );
      toast.success(t('loyalty.rewardDisabled'));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('loyaltyPage.disableRewardGenericError'),
      );
    } finally {
      setChangingRewardId(null);
    }
  }

  if (accessLoading)
    return (
      <main className="min-h-screen bg-background">
        <span className="sr-announcer" aria-live="polite">
          {t('loyaltyPage.statusLoading')}
        </span>
      </main>
    );

  if (!allowed)
    return (
      <main id="main-content" className="min-h-screen bg-background px-4 py-20">
        <div className="mx-auto max-w-xl" id="loyalty-content">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
              <Gift className="size-9 text-primary" aria-hidden="true" />
              <h1 className="text-2xl font-semibold">
                {t('loyalty.upgradeTitle')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('loyalty.upgradeDescription')}
              </p>
              <Button asChild>
                <Link href="/dashboard/billing">{t('loyaltyPage.upgrade')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );

  return (
    <main
      id="main-content"
      className="min-h-screen bg-background px-4 py-7 text-foreground sm:px-6 sm:py-10"
    >
      <a className="skip-link" href="#loyalty-content">
        {t('loyaltyPage.skipContent')}
      </a>
      <div id="loyalty-content" className="mx-auto max-w-6xl space-y-7" tabIndex={-1}>
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {t('loyalty.kicker')}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t('loyaltyPage.pointsAndRewards')}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t('loyaltyPage.subtitle')}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
            className="min-h-10 shrink-0"
            aria-label={t('loyaltyPage.refresh')}
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {t('loyaltyPage.refresh')}
          </Button>
        </header>

        <p className="sr-announcer" aria-live="polite" aria-atomic="true">
          {status}
        </p>

        <section className="grid gap-3 sm:grid-cols-2" aria-label={t('loyaltyPage.navigation')}>
          <Link
            href="/dashboard/loyalty/validate"
            className="group flex min-h-24 items-center gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 transition hover:border-emerald-400/35 hover:bg-emerald-400/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-200">
              <QrCode className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t('loyaltyPage.validateButton')}</span>
              <span className="mt-1 block text-xs leading-5 text-zinc-500">
                {t('loyaltyPage.validateShortcutDescription')}
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-emerald-300 transition group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <Link
            href="/dashboard/loyalty/points"
            className="group flex min-h-24 items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-white/20 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t('loyaltyPage.pointsButton')}</span>
              <span className="mt-1 block text-xs leading-5 text-zinc-500">
                {t('loyaltyPage.pointsShortcutDescription')}
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-zinc-500 transition group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <Card className="border-white/10">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings2 className="size-4 text-primary" aria-hidden="true" />
                  {t('loyaltyPage.programRules')}
                </CardTitle>
                <CardDescription className="mt-1">
                  {t('loyaltyPage.programSetupDescription')}
                </CardDescription>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${settings.enabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-zinc-400'}`}
              >
                {settings.enabled
                  ? t('loyaltyPage.enabledState')
                  : t('loyaltyPage.disabledState')}
              </span>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t('loyaltyPage.active')}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {settings.enabled
                      ? t('loyaltyPage.activeProgramDescription')
                      : t('loyaltyPage.disabledDescription')}
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(enabled) =>
                    setSettings((current) => ({ ...current, enabled }))
                  }
                  aria-label={t('loyaltyPage.active')}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="points-per-euro">
                    {t('loyaltyPage.pointsPerEuroLabel')}
                  </Label>
                  <Input
                    id="points-per-euro"
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={settings.points_per_euro}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        points_per_euro: Number(event.target.value),
                      }))
                    }
                  />
                  <p className="text-xs leading-5 text-zinc-500">
                    {t('loyaltyPage.pointsRateHint')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="welcome-points">
                    {t('loyaltyPage.welcomePointsLabel')}
                  </Label>
                  <Input
                    id="welcome-points"
                    type="number"
                    min="0"
                    max="100000"
                    step="1"
                    value={settings.welcome_points}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        welcome_points: Number(event.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="referral-points">
                    {t('loyaltyPage.referralPointsLabel')}
                  </Label>
                  <Input
                    id="referral-points"
                    type="number"
                    min="0"
                    max="100000"
                    step="1"
                    value={settings.referral_points}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        referral_points: Number(event.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {settingsDirty
                    ? t('loyaltyPage.unsavedSettings')
                    : t('loyaltyPage.settingsUpToDate')}
                </p>
                <Button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={!settingsDirty || savingSettings}
                  className="min-h-11 sm:min-w-36"
                  aria-busy={savingSettings}
                >
                  {savingSettings ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="size-4" aria-hidden="true" />
                  )}
                  {savingSettings ? t('loyaltyPage.saving') : t('loyaltyPage.saveRules')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="size-4 text-primary" aria-hidden="true" />
                {t('loyalty.summary')}
              </CardTitle>
              <CardDescription>
                {t('loyaltyPage.programSummaryDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <p className="text-xs text-muted-foreground">{t('loyaltyPage.baseConversion')}</p>
                <p className="mt-2 text-xl font-semibold tabular-nums">
                  {settings.points_per_euro} <span className="text-xs font-medium text-zinc-500">pts / €</span>
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <p className="text-xs text-muted-foreground">{t('loyaltyPage.activeRewardsLabel')}</p>
                <p className="mt-2 text-xl font-semibold tabular-nums">{activeRewards.length}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <p className="text-xs text-muted-foreground">{t('loyaltyPage.welcomePointsLabel')}</p>
                <p className="mt-2 text-xl font-semibold tabular-nums">{settings.welcome_points} pts</p>
                <p className="mt-1 text-xs text-zinc-500">{t('loyaltyPage.welcomePointsHint')}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="rewards-heading" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                {t('loyaltyPage.rewardCatalogueEyebrow')}
              </p>
              <h2 id="rewards-heading" className="mt-1 text-xl font-semibold">
                {t('loyaltyPage.rewardsTitle')}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t('loyaltyPage.rewardsManagementDescription')}
              </p>
            </div>
            <Button type="button" onClick={openNewReward} className="min-h-11 shrink-0">
              <Plus className="size-4" aria-hidden="true" />
              {t('loyaltyPage.newReward')}
            </Button>
          </div>

          <Dialog
            open={rewardDialogOpen}
            onOpenChange={(open) => {
              setRewardDialogOpen(open);
              if (!open) {
                setEditingId(null);
                setRewardForm(EMPTY_REWARD);
              }
            }}
          >
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-white/10 bg-zinc-950 text-zinc-100 sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? t('loyalty.editReward') : t('loyaltyPage.newReward')}
                </DialogTitle>
                <DialogDescription className="text-zinc-400">
                  {t('loyaltyPage.rewardFormDescription')}
                </DialogDescription>
              </DialogHeader>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void saveReward(event)}>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="reward-name">{t('loyaltyPage.rewardName')}</Label>
                  <Input
                    id="reward-name"
                    value={rewardForm.name}
                    onChange={(event) =>
                      setRewardForm((current) => ({ ...current, name: event.target.value }))
                    }
                    maxLength={120}
                    required
                    placeholder={t('loyaltyPage.rewardNamePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reward-points">{t('loyaltyPage.requiredPoints')}</Label>
                  <Input
                    id="reward-points"
                    type="number"
                    min="1"
                    max="10000000"
                    step="1"
                    value={rewardForm.points_cost}
                    onChange={(event) =>
                      setRewardForm((current) => ({ ...current, points_cost: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reward-type">{t('loyaltyPage.rewardType')}</Label>
                  <select
                    id="reward-type"
                    value={rewardForm.reward_type}
                    onChange={(event) =>
                      setRewardForm((current) => ({
                        ...current,
                        reward_type: event.target.value as Reward['reward_type'],
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                  >
                    <option value="discount">{t('loyaltyPage.discount')}</option>
                    <option value="free_service">{t('loyaltyPage.freeService')}</option>
                    <option value="custom">{t('loyaltyPage.custom')}</option>
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="reward-description">{t('loyaltyPage.rewardDescription')}</Label>
                  <textarea
                    id="reward-description"
                    value={rewardForm.description}
                    onChange={(event) =>
                      setRewardForm((current) => ({ ...current, description: event.target.value }))
                    }
                    maxLength={1000}
                    rows={3}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={t('loyaltyPage.rewardDescriptionPlaceholder')}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="reward-value">{t('loyaltyPage.rewardValue')}</Label>
                  <Input
                    id="reward-value"
                    type="number"
                    min="0"
                    max="100000"
                    step="0.01"
                    value={rewardForm.reward_value}
                    onChange={(event) =>
                      setRewardForm((current) => ({ ...current, reward_value: event.target.value }))
                    }
                    placeholder={t('loyaltyPage.rewardValueHint')}
                  />
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-white/10 pt-4 sm:col-span-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setRewardDialogOpen(false);
                      setEditingId(null);
                      setRewardForm(EMPTY_REWARD);
                    }}
                  >
                    {t('loyaltyPage.cancel')}
                  </Button>
                  <Button type="submit" disabled={savingReward} className="min-h-11">
                    {savingReward ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Check className="size-4" aria-hidden="true" />
                    )}
                    {savingReward ? t('loyaltyPage.saving') : t('loyaltyPage.save')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {loading && rewards.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground" aria-live="polite">
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              {t('loyaltyPage.loadingRewards')}
            </div>
          ) : rewards.length === 0 ? (
            <Card className="border-dashed border-white/15">
              <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Gift className="size-6" aria-hidden="true" />
                </span>
                <h3 className="font-semibold">{t('loyaltyPage.noRewards')}</h3>
                <p className="max-w-md text-sm leading-6 text-muted-foreground">
                  {t('loyaltyPage.noRewardsHint')}
                </p>
                <Button type="button" onClick={openNewReward} className="mt-1 min-h-11">
                  <Plus className="size-4" aria-hidden="true" />
                  {t('loyaltyPage.newReward')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeRewards.map((reward) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    busy={changingRewardId === reward.id}
                    onEdit={() => openEditReward(reward)}
                    onDeactivate={() => void deactivateReward(reward)}
                    onReactivate={() => void setRewardActive(reward, true)}
                    active
                    t={t}
                  />
                ))}
              </div>
              {activeRewards.length === 0 ? (
                <Card className="border-dashed border-white/15">
                  <CardContent className="py-8 text-center">
                    <p className="font-medium">{t('loyaltyPage.noActiveRewards')}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('loyaltyPage.noActiveRewardsHint')}
                    </p>
                  </CardContent>
                </Card>
              ) : null}
              {inactiveRewards.length > 0 ? (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      {t('loyaltyPage.inactiveRewardsLabel')}
                    </h3>
                    <span className="text-xs tabular-nums text-zinc-500">
                      {inactiveRewards.length}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {inactiveRewards.map((reward) => (
                      <RewardCard
                        key={reward.id}
                        reward={reward}
                        busy={changingRewardId === reward.id}
                        onEdit={() => openEditReward(reward)}
                        onDeactivate={() => void deactivateReward(reward)}
                        onReactivate={() => void setRewardActive(reward, true)}
                        active={false}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function RewardCard({
  reward,
  busy,
  active,
  onEdit,
  onDeactivate,
  onReactivate,
  t,
}: {
  reward: Reward;
  busy: boolean;
  active: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const rewardType =
    reward.reward_type === 'discount'
      ? t('loyaltyPage.discount')
      : reward.reward_type === 'free_service'
        ? t('loyaltyPage.freeService')
        : t('loyaltyPage.custom');

  return (
    <Card className={active ? 'border-white/10' : 'border-white/5 opacity-70'}>
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Gift className="size-5" aria-hidden="true" />
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {reward.points_cost} {t('loyaltyPage.pointsUnit')}
          </span>
        </div>
        <div className="mt-4 flex items-start justify-between gap-2">
          <h3 className="font-semibold">{reward.name}</h3>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-zinc-500'}`}>
            {active ? t('loyaltyPage.available') : t('loyaltyPage.deactivated')}
          </span>
        </div>
        <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
          {reward.description || t('loyaltyPage.defaultRewardDescription')}
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          {rewardType}
          {reward.reward_value !== null ? ` · ${reward.reward_value}` : ''}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onEdit}
            className="min-h-9 flex-1"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            {t('loyaltyPage.editReward')}
          </Button>
          {active ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onDeactivate}
              disabled={busy}
              className="min-h-9"
              aria-label={t('loyaltyPage.disableRewardAria', { name: reward.name })}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5 text-red-300" aria-hidden="true" />}
              <span className="sr-only sm:not-sr-only">{t('loyaltyPage.deactivate')}</span>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onReactivate}
              disabled={busy}
              className="min-h-9"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
              {t('loyaltyPage.reactivate')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
