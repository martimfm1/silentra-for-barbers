'use client';

import { useDashboardConfirm } from '@/components/dashboard/dashboard-confirm-provider';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Gift,
  Loader2,
  Lock,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useLanguage } from '@/context/LanguageContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
const emptyReward = {
  name: '',
  description: '',
  points_cost: '100',
  reward_type: 'discount',
  reward_value: '',
};

export default function LoyaltyPage() {
  const { t } = useLanguage();
  const confirm = useDashboardConfirm();
  const { hasFeature, loading: accessLoading } = useFeatureAccess();
  const allowed = hasFeature('loyalty');
  const [settings, setSettings] = useState<LoyaltySettings>({
    enabled: false,
    points_per_euro: 1,
    welcome_points: 0,
    referral_points: 0,
  });
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [rewardForm, setRewardForm] = useState(emptyReward);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setStatus(t('loyalty.loadingLoyalty'));
    try {
      const response = await fetch('/api/loyalty', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error ?? t('loyaltyPage.loadError'),
        );
      setSettings({
        enabled: data.settings?.enabled === true,
        points_per_euro: Number(data.settings?.points_per_euro ?? 1),
        welcome_points: Number(data.settings?.welcome_points ?? 0),
        referral_points: Number(data.settings?.referral_points ?? 0),
      });
      setRewards(data.rewards ?? []);
      setStatus(t('loyalty.loaded'));
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

  const saveSettings = async () => {
    setSaving(true);
    setStatus(t('loyaltyPage.savingSettings'));
    try {
      const response = await fetch('/api/loyalty', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? t('loyaltyPage.saveError'));
      setSettings({
        enabled: data.settings.enabled === true,
        points_per_euro: Number(data.settings.points_per_euro),
        welcome_points: Number(data.settings.welcome_points),
        referral_points: Number(data.settings.referral_points),
      });
      const message = data.settings.enabled
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
      setSaving(false);
    }
  };

  const saveReward = async () => {
    setSaving(true);
    setStatus(editing ? t('loyaltyPage.updatingReward') : t('loyaltyPage.savingReward'));
    try {
      const payload = {
        id: editing ?? undefined,
        ...rewardForm,
        points_cost: Number(rewardForm.points_cost),
        reward_value:
          rewardForm.reward_value === ''
            ? null
            : Number(rewardForm.reward_value),
        active: true,
      };
      const response = await fetch('/api/loyalty/rewards', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? t('loyaltyPage.saveRewardError'));
      setRewards((current) =>
        editing
          ? current.map((item) =>
              item.id === editing ? { ...item, ...data.reward } : item,
            )
          : [data.reward, ...current],
      );
      setEditing(null);
      setCreating(false);
      setRewardForm(emptyReward);
      setStatus(editing ? t('loyalty.rewardUpdated') : t('loyalty.rewardCreated'));
      toast.success(editing ? t('loyalty.rewardUpdated') : t('loyalty.rewardCreated'));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('loyaltyPage.saveRewardGenericError');
      setStatus(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const editReward = (reward: Reward) => {
    setEditing(reward.id);
    setCreating(true);
    setRewardForm({
      name: reward.name,
      description: reward.description ?? '',
      points_cost: String(reward.points_cost),
      reward_type: reward.reward_type,
      reward_value:
        reward.reward_value === null ? '' : String(reward.reward_value),
    });
  };
  const deleteReward = async (id: string) => {
    const confirmed = await confirm({
      title: t('loyalty.deactivateRewardConfirm'),
      description: t('loyalty.deactivateRewardConfirm'),
      confirmLabel: t('loyalty.rewardDisabled'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const response = await fetch(
        `/api/loyalty/rewards?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? t('loyaltyPage.disableError'));
      setRewards((current) =>
        current.map((item) =>
          item.id === id ? { ...item, active: false } : item,
        ),
      );
      setStatus(t('loyalty.rewardDisabled'));
      toast.success(t('loyalty.rewardDisabled'));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('loyaltyPage.disableRewardGenericError');
      setStatus(message);
      toast.error(message);
    }
  };

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
      <main id="main-content" className="min-h-screen bg-background px-4 py-24">
        <a className="skip-link" href="#loyalty-content">
          {t('loyaltyPage.skipContent')}
        </a>
        <div id="loyalty-content" className="mx-auto max-w-xl" tabIndex={-1}>
          <Card>
            <CardContent className="flex flex-col items-center gap-5 py-16 text-center">
              <Lock className="h-8 w-8 text-primary" aria-hidden="true" />
              <h1 className="text-2xl font-semibold">
                {t('loyalty.upgradeTitle')}
              </h1>
              <p className="text-muted-foreground">
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
      className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8"
    >
      <a className="skip-link" href="#loyalty-content">
        {t('loyaltyPage.skipContent')}
      </a>
      <div
        id="loyalty-content"
        className="mx-auto max-w-6xl space-y-6"
        tabIndex={-1}
      >
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">{t('loyalty.kicker')}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              {t('loyaltyPage.pointsAndRewards')}
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {t('loyaltyPage.subtitle')}
            </p>
          </div>
          <nav
            aria-label={t('loyaltyPage.navigation')}
            className="grid grid-cols-2 gap-2 sm:flex"
          >
            <Button variant="outline" asChild>
              <Link href="/dashboard/loyalty/points">
                <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('loyaltyPage.pointsButton')}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/loyalty/validate">
                <QrCode className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('loyaltyPage.validateButton')}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('dashboard.overview')}
              </Link>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void load()}
              disabled={loading}
              aria-label={t('loyaltyPage.refresh')}
              aria-busy={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </Button>
          </nav>
        </header>
        <p className="sr-announcer" aria-live="polite" aria-atomic="true">
          {status}
        </p>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
                {t('loyaltyPage.programRules')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <fieldset className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <legend className="px-1 text-sm font-medium">
                  {t('loyaltyPage.programState')}
                </legend>
                <label className="mt-2 flex min-h-11 cursor-pointer items-center justify-between gap-4">
                  <span>
                    <span className="block font-medium">{t('loyaltyPage.active')}</span>
                    <span
                      id="loyalty-enabled-help"
                      className="mt-1 block text-xs text-muted-foreground"
                    >
                      {t('loyaltyPage.disabledDescription')}
                    </span>
                  </span>
                  <input
                    id="loyalty-enabled"
                    type="checkbox"
                    className="size-5"
                    checked={settings.enabled}
                    onChange={(e) =>
                      setSettings((value) => ({
                        ...value,
                        enabled: e.target.checked,
                      }))
                    }
                    aria-describedby="loyalty-enabled-help"
                  />
                </label>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="silentra-form-field">
                  <Label htmlFor="points-per-euro">{t('loyaltyPage.pointsPerEuroLabel')}</Label>
                  <Input
                    id="points-per-euro"
                    className="mt-1"
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={settings.points_per_euro}
                    onChange={(e) =>
                      setSettings((value) => ({
                        ...value,
                        points_per_euro: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="silentra-form-field">
                  <Label htmlFor="welcome-points">Pontos de boas-vindas</Label>
                  <Input
                    id="welcome-points"
                    className="mt-1"
                    type="number"
                    min="0"
                    max="100000"
                    value={settings.welcome_points}
                    onChange={(e) =>
                      setSettings((value) => ({
                        ...value,
                        welcome_points: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="silentra-form-field">
                  <Label htmlFor="referral-points">{t('loyaltyPage.referralPointsLabel')}</Label>
                  <Input
                    id="referral-points"
                    className="mt-1"
                    type="number"
                    min="0"
                    max="100000"
                    value={settings.referral_points}
                    onChange={(e) =>
                      setSettings((value) => ({
                        ...value,
                        referral_points: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
              <Button
                onClick={() => void saveSettings()}
                disabled={saving}
                className="min-h-11"
                aria-busy={saving}
              >
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                {saving ? t('loyaltyPage.saving') : t('loyaltyPage.saveRules')}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" aria-hidden="true" />
                {t('loyalty.summary')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl>
                <div className="rounded-xl border p-4">
                  <dt className="text-xs text-muted-foreground">{t('loyalty.state')}</dt>
                  <dd className="mt-1 text-2xl font-semibold">
                    {settings.enabled ? t('loyaltyPage.enabledState') : t('loyaltyPage.disabledState')}
                  </dd>
                </div>
                <div className="mt-4 rounded-xl border p-4">
                  <dt className="text-xs text-muted-foreground">
                    {t('loyaltyPage.baseConversion')}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold">
                    €1 = {settings.points_per_euro} pts
                  </dd>
                </div>
                <div className="mt-4 rounded-xl border p-4">
                  <dt className="text-xs text-muted-foreground">
                    {t('loyalty.activeRewards')}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold">
                    {rewards.filter((r) => r.active).length}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="rewards-heading">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="rewards-heading" className="text-xl font-semibold">
                Recompensas
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('loyalty.rewardsDescription')}
              </p>
            </div>
            <Button
              onClick={() => {
                setCreating(true);
                setEditing(null);
                setRewardForm(emptyReward);
              }}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('loyaltyPage.newReward')}
            </Button>
          </div>
          <Dialog
            open={creating}
            onOpenChange={(open) => {
              setCreating(open);
              if (!open) setEditing(null);
            }}
          >
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-white/10 bg-zinc-950 text-zinc-100 sm:max-w-2xl">
              <DialogHeader className="sr-only">
                <DialogTitle>{editing ? t('loyalty.editReward') : t('loyaltyPage.newReward')}</DialogTitle>
                <DialogDescription>
                  {t('loyaltyPage.rewardFormDescription')}
                </DialogDescription>
              </DialogHeader>
              {creating && (
            <Card className="mb-0 border-white/10 bg-white/[0.02]">
              <CardHeader>
                <CardTitle>
                  {editing ? t('loyalty.editReward') : t('loyaltyPage.newReward')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-4 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveReward();
                  }}
                >
                <div className="silentra-form-field">
                  <Label htmlFor="reward-name">{t('loyaltyPage.rewardName')}</Label>
                  <Input
                    id="reward-name"
                    className="mt-1"
                    value={rewardForm.name}
                    onChange={(e) =>
                      setRewardForm((v) => ({ ...v, name: e.target.value }))
                    }
                    maxLength={120}
                    placeholder={t('loyaltyPage.rewardNamePlaceholder')}
                  />
                </div>
                <div className="silentra-form-field">
                  <Label htmlFor="reward-points">{t('loyaltyPage.requiredPoints')}</Label>
                  <Input
                    id="reward-points"
                    className="mt-1"
                    type="number"
                    min="1"
                    value={rewardForm.points_cost}
                    onChange={(e) =>
                      setRewardForm((v) => ({
                        ...v,
                        points_cost: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="sm:col-span-2 silentra-form-field">
                  <Label htmlFor="reward-description">{t('loyaltyPage.rewardDescription')}</Label>
                  <Textarea
                    id="reward-description"
                    className="mt-1"
                    value={rewardForm.description}
                    onChange={(e) =>
                      setRewardForm((v) => ({
                        ...v,
                        description: e.target.value,
                      }))
                    }
                    maxLength={1000}
                    placeholder={t('loyaltyPage.rewardDescriptionPlaceholder')}
                  />
                </div>
                <div className="silentra-form-field">
                  <Label htmlFor="reward-type">{t('loyaltyPage.rewardType')}</Label>
                  <select
                    id="reward-type"
                    className="mt-1"
                    value={rewardForm.reward_type}
                    onChange={(e) =>
                      setRewardForm((v) => ({
                        ...v,
                        reward_type: e.target.value as Reward['reward_type'],
                      }))
                    }
                  >
                    <option value="discount">{t('loyaltyPage.discount')}</option>
                    <option value="free_service">{t('loyaltyPage.freeService')}</option>
                    <option value="custom">{t('loyaltyPage.custom')}</option>
                  </select>
                </div>
                <div className="silentra-form-field">
                  <Label htmlFor="reward-value">{t('loyaltyPage.rewardValue')}</Label>
                  <Input
                    id="reward-value"
                    className="mt-1"
                    type="number"
                    min="0"
                    step="0.01"
                    value={rewardForm.reward_value}
                    onChange={(e) =>
                      setRewardForm((v) => ({
                        ...v,
                        reward_value: e.target.value,
                      }))
                    }
                    placeholder="Ex.: 5"
                  />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button
                    type="submit"
                    disabled={saving || !rewardForm.name.trim()}
                    aria-busy={saving}
                  >
                    <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t('loyaltyPage.save')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCreating(false);
                      setEditing(null);
                    }}
                  >
                    {t('loyaltyPage.cancel')}
                  </Button>
                </div>
                </form>
              </CardContent>
            </Card>
              )}
            </DialogContent>
          </Dialog>
          {loading && rewards.length === 0 ? (
            <div
              className="flex h-40 items-center justify-center text-muted-foreground"
              aria-live="polite"
            >
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              {t('loyaltyPage.loadingRewards')}
            </div>
          ) : rewards.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rewards.map((reward) => (
                <Card
                  key={reward.id}
                  className={reward.active ? '' : 'opacity-60'}
                >
                  <CardContent className="flex h-full flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Gift className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {reward.points_cost} {t('loyaltyPage.pointsUnit')}
                      </span>
                    </div>
                    <h3 className="mt-5 font-semibold">{reward.name}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                      {reward.description || t('loyaltyPage.defaultRewardDescription')}
                    </p>
                    <p className="mt-4 text-xs text-muted-foreground">
                      {reward.active ? t('loyaltyPage.available') : t('loyaltyPage.deactivated')} ·{' '}
                      {reward.reward_type === 'discount' ? t('loyaltyPage.discount') : reward.reward_type === 'free_service' ? t('loyaltyPage.freeService') : t('loyaltyPage.custom')}
                      {reward.reward_value !== null
                        ? ` · ${reward.reward_value}`
                        : ''}
                    </p>
                    <div className="mt-4 flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => editReward(reward)}
                        aria-label={t('loyaltyPage.editRewardAria', { name: reward.name })}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      {reward.active ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => void deleteReward(reward.id)}
                          aria-label={t('loyaltyPage.disableRewardAria', { name: reward.name })}
                        >
                          <Trash2
                            className="h-4 w-4 text-red-300"
                            aria-hidden="true"
                          />
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <Gift
                  className="h-8 w-8 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="font-medium">{t('loyaltyPage.noRewards')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('loyaltyPage.noRewardsHint')}
                </p>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
