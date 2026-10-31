'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarPlus,
  Check,
  Copy,
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

  if (!visible) return null;

  return (
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
                onClick={() => setShowInstructions((value) => !value)}
                className="min-h-10 border-white/10"
              >
                <Smartphone className="mr-2 size-4" aria-hidden="true" />
                {showInstructions
                  ? t('agenda.calendarSyncHideInstructions')
                  : t('agenda.calendarSyncInstructions')}
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
            {showInstructions && (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="mb-3 text-sm font-medium text-zinc-200">
                  {t('agenda.calendarSyncHowTo')}
                </p>
                <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-400">
                  <li>{t('agenda.calendarSyncStepOne')}</li>
                  <li>{t('agenda.calendarSyncStepTwo')}</li>
                  <li>{t('agenda.calendarSyncStepThree')}</li>
                </ol>
                <p className="mt-3 text-xs leading-5 text-zinc-500">
                  {t('agenda.calendarSyncRefreshNotice')}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
