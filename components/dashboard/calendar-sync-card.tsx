'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarPlus,
  Check,
  ChevronRight,
  Copy,
  Info,
  RefreshCw,
  Smartphone,
  Unplug,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { SilentraLoading } from '@/components/ui/silentra-loading';

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
  const [dialogOpen, setDialogOpen] = useState(false);
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
      <Button
        type="button"
        variant="outline"
        onClick={() => setDialogOpen(true)}
        className="mt-5 flex min-h-14 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.025] px-4 text-left text-zinc-100 hover:bg-white/[.06] sm:w-auto sm:min-w-[20rem]"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
            <CalendarPlus className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {t('agenda.calendarSyncTitle')}
            </span>
            <span className="mt-0.5 block truncate text-xs font-normal text-zinc-500">
              {t('agenda.calendarSyncDescription')}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-zinc-400">
          {loading ? (
            <Spinner className="size-4" />
          ) : enabled ? (
            <span className="flex items-center gap-1.5 text-emerald-300">
              <Check className="size-3.5" aria-hidden="true" />
              {t('agenda.calendarSyncActive')}
            </span>
          ) : (
            t('agenda.calendarSyncEnable')
          )}
          <ChevronRight className="size-4" aria-hidden="true" />
        </span>
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[min(90dvh,54rem)] w-[calc(100%-1rem)] min-w-0 max-w-xl overflow-x-hidden overflow-y-auto border border-white/10 bg-zinc-950 p-0 text-zinc-100 shadow-2xl">
          <div className="border-b border-white/8 bg-gradient-to-br from-emerald-400/[.08] via-transparent to-transparent px-4 pb-5 pt-6 sm:px-6">
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
                {t('agenda.calendarSyncTitle')}
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-zinc-400">
                {t('agenda.calendarSyncDescription')}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="min-w-0 space-y-5 px-4 py-5 sm:px-6">
            {loading ? (
              <SilentraLoading variant="compact" message={t('agenda.calendarSyncLoading')} />
            ) : loadFailed ? (
              <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-rose-400/15 bg-rose-400/[.04] p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 text-sm leading-5 text-rose-300">
                  {t('agenda.calendarSyncLoadFailed')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void load()}
                  className="min-h-10 shrink-0 border-white/10"
                >
                  {t('agenda.calendarSyncRetry')}
                </Button>
              </div>
            ) : !enabled ? (
              <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-white/10 bg-white/[.025] p-4">
                <p className="text-sm leading-6 text-zinc-400">
                  {t('agenda.calendarSyncDisabledDescription')}
                </p>
                <Button
                  type="button"
                  onClick={() => void activate()}
                  disabled={saving}
                  className="min-h-11 w-full bg-white text-zinc-950 hover:bg-zinc-200 sm:w-auto sm:self-start"
                >
                  {saving ? (
                    <Spinner className="mr-2 size-4" />
                  ) : (
                    <CalendarPlus className="mr-2 size-4" aria-hidden="true" />
                  )}
                  {saving
                    ? t('agenda.calendarSyncActivating')
                    : t('agenda.calendarSyncEnable')}
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2 rounded-xl border border-emerald-300/15 bg-emerald-300/[.045] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                    <Check className="size-4" aria-hidden="true" />
                    {t('agenda.calendarSyncActive')}
                  </div>
                  <p className="text-xs leading-5 text-amber-200/80">
                    {t('agenda.calendarSyncPrivacyNotice')}
                  </p>
                </div>

                <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                  <Input
                    readOnly
                    value={feedUrl}
                    aria-label={t('agenda.calendarSyncUrlLabel')}
                    className="box-border min-h-11 w-full min-w-0 max-w-full border-white/10 bg-black/20 text-xs text-zinc-300"
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void copyLink()}
                    className="min-h-11 w-full shrink-0 border-white/10 sm:w-auto"
                  >
                    <Copy className="mr-2 size-4" aria-hidden="true" />
                    {t('agenda.calendarSyncCopy')}
                  </Button>
                </div>

                <section className="min-w-0 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      {t('agenda.calendarSyncStepsLabel')}
                    </p>
                    <p className="mt-1 text-sm leading-5 text-zinc-400">
                      {t('agenda.calendarSyncHowTo')}
                    </p>
                  </div>
                  <ol className="space-y-3">
                    {tutorialSteps.map((step, index) => (
                      <li
                        key={step.title}
                        className="flex min-w-0 gap-3 rounded-xl border border-white/[.07] bg-white/[.025] p-3.5 sm:p-4"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-xs font-semibold tabular-nums text-emerald-200">
                          {index + 1}
                        </span>
                        <div className="min-w-0 pt-0.5">
                          <p className="text-sm font-medium text-zinc-100">
                            {step.title}
                          </p>
                          <p className="mt-1 break-words text-sm leading-6 text-zinc-400">
                            {step.description}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>

                <div className="min-w-0 space-y-3 rounded-xl border border-sky-300/10 bg-sky-300/[.045] p-4">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Info className="mt-0.5 size-4 shrink-0 text-sky-200" aria-hidden="true" />
                    <p className="min-w-0 text-sm leading-6 text-sky-50/90">
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

                <div className="flex min-w-0 flex-col gap-2 border-t border-white/[.07] pt-4 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void rotate()}
                    disabled={saving}
                    className="min-h-10 w-full border-white/10 sm:w-auto"
                  >
                    {saving ? (
                      <Spinner className="mr-2 size-4" />
                    ) : (
                      <RefreshCw className="mr-2 size-4" aria-hidden="true" />
                    )}
                    {t('agenda.calendarSyncRotate')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void disable()}
                    disabled={saving}
                    className="min-h-10 w-full text-rose-300 hover:bg-rose-400/10 hover:text-rose-200 sm:w-auto"
                  >
                    <Unplug className="mr-2 size-4" aria-hidden="true" />
                    {t('agenda.calendarSyncDisable')}
                  </Button>
                </div>
              </>
            )}

            <div className="flex justify-end border-t border-white/[.07] pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
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
