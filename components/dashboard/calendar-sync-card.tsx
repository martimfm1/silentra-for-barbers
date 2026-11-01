'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarPlus,
  Check,
  Copy,
  Info,
  RefreshCw,
  Smartphone,
  Unplug,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

type CalendarFeedResponse = {
  enabled?: boolean;
  feedUrl?: string | null;
  error?: string;
};

export function CalendarSyncCard() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const response = await fetch('/api/calendar/feed/settings', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (response.status === 401 || response.status === 403) {
        setVisible(false);
        return;
      }
      const body = (await response.json()) as CalendarFeedResponse;
      if (!response.ok) throw new Error(body.error || t('agenda.calendarSyncLoadFailed'));
      setEnabled(body.enabled === true);
      setFeedUrl(body.feedUrl ?? '');
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const activate = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/calendar/feed/settings', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const body = (await response.json()) as CalendarFeedResponse;
      if (!response.ok || !body.feedUrl) {
        throw new Error(body.error || t('agenda.calendarSyncSaveFailed'));
      }
      setEnabled(true);
      setFeedUrl(body.feedUrl);
      toast.success(t('agenda.calendarSyncEnabled'));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('agenda.calendarSyncSaveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  const rotate = async () => {
    if (!window.confirm(t('agenda.calendarSyncRotateConfirm'))) return;
    await activate();
  };

  const disable = async () => {
    if (!window.confirm(t('agenda.calendarSyncDisableConfirm'))) return;
    setSaving(true);
    try {
      const response = await fetch('/api/calendar/feed/settings', {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });
      const body = (await response.json()) as CalendarFeedResponse;
      if (!response.ok) {
        throw new Error(body.error || t('agenda.calendarSyncSaveFailed'));
      }
      setEnabled(false);
      setFeedUrl('');
      setShowInstructions(false);
      toast.success(t('agenda.calendarSyncDisabled'));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('agenda.calendarSyncSaveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      toast.success(t('agenda.calendarSyncCopied'));
    } catch {
      toast.error(t('agenda.calendarSyncCopyFailed'));
    }
  };

  const tutorialSteps = [
    {
      title: t('agenda.calendarSyncStepOneTitle'),
      description: t('agenda.calendarSyncStepOneDescription'),
    },
    {
      title: t('agenda.calendarSyncStepTwoTitle'),
      description: t('agenda.calendarSyncStepTwoDescription'),
    },
    {
      title: t('agenda.calendarSyncStepThreeTitle'),
      description: t('agenda.calendarSyncStepThreeDescription'),
    },
    {
      title: t('agenda.calendarSyncStepFourTitle'),
      description: t('agenda.calendarSyncStepFourDescription'),
    },
  ];

  if (!visible) return null;

  return (
    <>
      <Card className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-zinc-100">
            <CalendarPlus className="size-4 text-emerald-300" aria-hidden="true" />
            {t('agenda.calendarSyncTitle')}
          </CardTitle>
          <CardDescription className="max-w-3xl text-sm leading-6 text-zinc-400">
            {t('agenda.calendarSyncDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex min-h-10 items-center gap-2 text-sm text-zinc-400">
              <Spinner className="size-4" />
              {t('agenda.calendarSyncLoading')}
            </div>
          ) : loadFailed ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-rose-300">
                {t('agenda.calendarSyncLoadFailed')}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                {t('agenda.calendarSyncRetry')}
              </Button>
            </div>
          ) : !enabled ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-400">
                {t('agenda.calendarSyncDisabledDescription')}
              </p>
              <Button
                type="button"
                onClick={() => void activate()}
                disabled={saving}
                className="min-h-10 shrink-0 bg-white text-zinc-950 hover:bg-zinc-200"
              >
                {saving ? <Spinner className="mr-2 size-4" /> : <CalendarPlus className="mr-2 size-4" />}
                {saving
                  ? t('agenda.calendarSyncActivating')
                  : t('agenda.calendarSyncEnable')}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-emerald-300">
                <Check className="size-4" aria-hidden="true" />
                {t('agenda.calendarSyncActive')}
              </div>
              <p className="text-xs leading-5 text-amber-200/80">
                {t('agenda.calendarSyncPrivacyNotice')}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  readOnly
                  value={feedUrl}
                  aria-label={t('agenda.calendarSyncUrlLabel')}
                  className="min-h-11 min-w-0 border-white/10 bg-black/20 text-xs text-zinc-300"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copyLink()}
                  className="min-h-11 shrink-0 border-white/10"
                >
                  <Copy className="mr-2 size-4" aria-hidden="true" />
                  {t('agenda.calendarSyncCopy')}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInstructions(true)}
                  className="min-h-10 border-white/10"
                >
                  <Smartphone className="mr-2 size-4" aria-hidden="true" />
                  {t('agenda.calendarSyncInstructions')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void rotate()}
                  disabled={saving}
                  className="min-h-10 text-zinc-400 hover:text-zinc-100"
                >
                  {saving ? <Spinner className="mr-2 size-4" /> : <RefreshCw className="mr-2 size-4" aria-hidden="true" />}
                  {t('agenda.calendarSyncRotate')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void disable()}
                  disabled={saving}
                  className="min-h-10 text-rose-300 hover:bg-rose-400/10 hover:text-rose-200"
                >
                  <Unplug className="mr-2 size-4" aria-hidden="true" />
                  {t('agenda.calendarSyncDisable')}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-h-[min(88dvh,48rem)] w-[calc(100%-1.5rem)] overflow-y-auto border border-white/10 bg-zinc-950 p-0 text-zinc-100 shadow-2xl sm:max-w-xl">
          <div className="border-b border-white/8 bg-gradient-to-br from-emerald-400/[.08] via-transparent to-transparent px-5 pb-5 pt-6 sm:px-6">
            <DialogHeader className="gap-2 text-left">
              <div className="mb-1 flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                  <Smartphone className="size-4" aria-hidden="true" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200/80">
                  {t('agenda.calendarSyncGuideLabel')}
                </span>
              </div>
              <DialogTitle className="text-xl font-semibold tracking-tight text-zinc-50">
                {t('agenda.calendarSyncHowTo')}
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-zinc-400">
                {t('agenda.calendarSyncDialogDescription')}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-white/10 bg-black/25 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-100">
                  {t('agenda.calendarSyncCopyBeforeStart')}
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  {t('agenda.calendarSyncCopyBeforeStartDescription')}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => void copyLink()}
                className="min-h-10 shrink-0 bg-white text-zinc-950 hover:bg-zinc-200"
              >
                <Copy className="mr-2 size-4" aria-hidden="true" />
                {t('agenda.calendarSyncCopy')}
              </Button>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {t('agenda.calendarSyncStepsLabel')}
              </p>
              <ol className="mt-3 space-y-3">
                {tutorialSteps.map((step, index) => (
                  <li
                    key={step.title}
                    className="flex gap-3 rounded-xl border border-white/[.07] bg-white/[.025] p-3.5 sm:p-4"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-xs font-semibold tabular-nums text-emerald-200">
                      {index + 1}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm font-medium text-zinc-100">
                        {step.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-zinc-400">
                        {step.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="space-y-3 rounded-xl border border-sky-300/10 bg-sky-300/[.045] p-4">
              <div className="flex items-start gap-2.5">
                <Info className="mt-0.5 size-4 shrink-0 text-sky-200" aria-hidden="true" />
                <p className="text-sm leading-6 text-sky-50/90">
                  {t('agenda.calendarSyncICloudNote')}
                </p>
              </div>
              <p className="border-t border-white/[.07] pt-3 text-xs leading-5 text-zinc-400">
                {t('agenda.calendarSyncVerifyNotice')}
              </p>
              <p className="text-xs leading-5 text-zinc-500">
                {t('agenda.calendarSyncReadOnlyNotice')}
              </p>
            </div>

            <div className="flex justify-end pb-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInstructions(false)}
                className="min-h-10 border-white/10"
              >
                {t('common.done')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
