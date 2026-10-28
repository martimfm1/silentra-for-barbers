'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Eye,
  Info,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Monitor,
  Plus,
  RefreshCw,
  Send,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useLanguage } from '@/context/LanguageContext';

type Campaign = {
  id: string;
  name: string;
  channel: 'email' | 'sms';
  subject: string | null;
  body: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
};

const MAX_BODY_LENGTH = 10000;

function formatStatus(status: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    draft: t('marketingPage.statuses.draft'),
    scheduled: t('marketingPage.statuses.scheduled'),
    sending: t('marketingPage.statuses.sending'),
    sent: t('marketingPage.statuses.sent'),
    failed: t('marketingPage.statuses.failed'),
    cancelled: t('marketingPage.statuses.cancelled'),
  };
  return labels[status] ?? status;
}

function statusClass(status: string) {
  if (status === 'sent')
    return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
  if (status === 'scheduled')
    return 'border-sky-400/20 bg-sky-400/10 text-sky-300';
  if (status === 'failed')
    return 'border-red-400/20 bg-red-400/10 text-red-300';
  return 'border-white/10 bg-white/[0.03] text-zinc-300';
}

export default function MarketingPage() {
  const { t, locale } = useLanguage();
  const { hasFeature, loading: accessLoading } = useFeatureAccess();
  const allowed = hasFeature('marketing_campaigns');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>(
    'desktop',
  );
  const [form, setForm] = useState({
    name: '',
    channel: 'email' as 'email' | 'sms',
    subject: '',
    body: '',
  });

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const response = await fetch('/api/marketing/campaigns', {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error ?? t('marketingPage.loadError'),
        );
      setCampaigns(data.campaigns ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('marketingPage.loadGenericError'),
      );
    } finally {
      setLoading(false);
    }
  }, [allowed, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const preview = useMemo(() => {
    const fallbackName = form.name.trim() || t('marketingPage.fallbackCampaignName');
    const fallbackSubject = form.subject.trim() || t('marketingPage.fallbackSubject');
    const fallbackBody =
      form.body.trim() || t('marketingPage.fallbackBody');
    return {
      name: fallbackName,
      subject: fallbackSubject,
      body: fallbackBody,
    };
  }, [form, t]);

  function openComposer() {
    setForm({ name: '', channel: 'email', subject: '', body: '' });
    setPreviewMode('desktop');
    setOpen(true);
  }

  function closeComposer() {
    if (creating) return;
    setOpen(false);
  }

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? t('marketingPage.createError'));
      toast.success(t('marketingPage.createdDraft'));
      setCampaigns((current) => [data.campaign, ...current]);
      setForm({ name: '', channel: 'email', subject: '', body: '' });
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('marketingPage.createGenericError'),
      );
    } finally {
      setCreating(false);
    }
  }

  if (accessLoading) return <main className="min-h-screen" />;

  if (!allowed) {
    return (
      <main className="min-h-screen px-4 py-24">
        <div className="mx-auto max-w-xl">
          <Card>
            <CardContent className="flex flex-col items-center gap-5 py-16 text-center">
              <Lock className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-semibold">{t('marketingPage.marketingCampaigns')}</h1>
              <p className="text-muted-foreground">
                {t('marketingPage.upgradeDescription')}
              </p>
              <Button asChild>
                <Link href="/dashboard/billing">{t('marketingPage.upgrade')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 text-foreground sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {t('marketingPage.marketingPro')}
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t('marketingPage.campaigns')}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
              {t('marketingPage.subtitle')}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('marketingPage.dashboard')}
              </Link>
            </Button>
            <Button onClick={openComposer} className="sm:min-w-40">
              <Plus className="mr-2 h-4 w-4" />
              {t('marketingPage.newCampaign')}
            </Button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          {[
            {
              step: '01',
              title: t('marketingPage.defineCampaign'),
              description:
                t('marketingPage.defineCampaignDescription'),
              icon: Sparkles,
            },
            {
              step: '02',
              title: t('marketingPage.chooseChannel'),
              description:
                t('marketingPage.chooseChannelDescription'),
              icon: Send,
            },
            {
              step: '03',
              title: t('marketingPage.reviewBeforeSave'),
              description:
                t('marketingPage.reviewBeforeSaveDescription'),
              icon: Eye,
            },
          ].map(({ step, title, description, icon: Icon }) => (
            <div
              key={step}
              className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-primary">
                  <Icon className="size-4" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    {t('marketingPage.step')} {step}
                  </div>
                  <p className="mt-1 text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {open && (
          <Card className="overflow-hidden border-white/10 bg-zinc-950/40 shadow-2xl">
            <CardHeader className="border-b border-white/10 pb-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl">{t('marketingPage.newCampaign')}</CardTitle>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                      {t('marketingPage.draft')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('marketingPage.preparationHint')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={closeComposer}
                  aria-label={t('marketingPage.closeEditor')}
                  disabled={creating}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
                <form
                  onSubmit={createCampaign}
                  className="space-y-6 border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r"
                >
                  <section className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span className="flex size-6 items-center justify-center rounded-full bg-white text-[11px] text-zinc-950">
                          1
                        </span>
                        {t('marketingPage.configuration')}
                      </div>
                      <p className="mt-1 pl-8 text-xs text-muted-foreground">
                        {t('marketingPage.configurationDescription')}
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="campaign-name"
                          className="text-sm font-medium"
                        >
                          {t('marketingPage.internalName')}
                        </label>
                        <Input
                          id="campaign-name"
                          className="mt-1.5"
                          value={form.name}
                          maxLength={120}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          placeholder={t('marketingPage.campaignNamePlaceholder')}
                          required
                        />
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {t('marketingPage.internalOnly')}
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="campaign-channel"
                          className="text-sm font-medium"
                        >
                          {t('marketingPage.channel')}
                        </label>
                        <select
                          id="campaign-channel"
                          className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                          value={form.channel}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              channel: e.target.value as 'email' | 'sms',
                              subject:
                                e.target.value === 'sms' ? '' : form.subject,
                            })
                          }
                        >
                          <option value="email">Email</option>
                          <option value="sms">SMS</option>
                        </select>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {t('marketingPage.channelHint')}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4 border-t border-white/10 pt-6">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span className="flex size-6 items-center justify-center rounded-full bg-white text-[11px] text-zinc-950">
                          2
                        </span>
                        {t('marketingPage.content')}
                      </div>
                      <p className="mt-1 pl-8 text-xs text-muted-foreground">
                        {t('marketingPage.contentHint')}
                      </p>
                    </div>

                    {form.channel === 'email' && (
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <label
                            htmlFor="campaign-subject"
                            className="text-sm font-medium"
                          >
                            {t('marketingPage.subject')}
                          </label>
                          <span className="text-[11px] text-muted-foreground">
                            {form.subject.length}/200
                          </span>
                        </div>
                        <Input
                          id="campaign-subject"
                          className="mt-1.5"
                          value={form.subject}
                          maxLength={200}
                          onChange={(e) =>
                            setForm({ ...form, subject: e.target.value })
                          }
                          placeholder={t('marketingPage.subjectPlaceholder')}
                          required
                        />
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {t('marketingPage.subjectHint')}
                        </p>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <label
                          htmlFor="campaign-body"
                          className="text-sm font-medium"
                        >
                          {t('marketingPage.message')}
                        </label>
                        <span
                          className={`text-[11px] ${form.body.length > 9000 ? 'text-amber-400' : 'text-muted-foreground'}`}
                        >
                          {form.body.length}/{MAX_BODY_LENGTH}
                        </span>
                      </div>
                      <Textarea
                        id="campaign-body"
                        className="mt-1.5 min-h-40 resize-y"
                        value={form.body}
                        maxLength={MAX_BODY_LENGTH}
                        onChange={(e) =>
                          setForm({ ...form, body: e.target.value })
                        }
                        placeholder={
                          form.channel === 'email'
                            ? t('marketingPage.messagePlaceholder')
                            : t('marketingPage.messagePlaceholder')
                        }
                        required
                      />
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {form.channel === 'email'
                          ? t('marketingPage.emailBodyHint')
                          : t('marketingPage.smsBodyHint')}
                      </p>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-sky-400/15 bg-sky-400/[0.05] p-4">
                    <div className="flex gap-3">
                      <Info className="mt-0.5 size-4 shrink-0 text-sky-300" />
                      <div>
                        <p className="text-sm font-semibold text-sky-100">
                          {t('marketingPage.beforeSaving')}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-sky-100/65">
                          {t('marketingPage.draftWarning')}
                        </p>
                      </div>
                    </div>
                  </section>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={closeComposer}
                      disabled={creating}
                    >
                      {t('marketingPage.cancel')}
                    </Button>
                    <Button
                      type="submit"
                      disabled={creating}
                      className="sm:min-w-44"
                    >
                      {creating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      {t('marketingPage.saveDraft')}
                    </Button>
                  </div>
                </form>

                <aside className="bg-black/20 p-5 sm:p-7">
                  <div className="sticky top-6 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Eye className="size-4 text-primary" />
                          {t('marketingPage.livePreview')}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('marketingPage.previewHint')}
                        </p>
                      </div>
                      <div className="inline-flex w-fit rounded-lg border border-white/10 bg-white/[0.03] p-1">
                        <button
                          type="button"
                          onClick={() => setPreviewMode('desktop')}
                          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${previewMode === 'desktop' ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                          <Monitor className="size-3.5" /> {t('marketingPage.desktop')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewMode('mobile')}
                          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${previewMode === 'mobile' ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                          <Smartphone className="size-3.5" /> {t('marketingPage.mobile')}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-center rounded-2xl border border-white/10 bg-zinc-900/80 p-4 sm:p-6">
                      {form.channel === 'email' ? (
                        <div
                          className={`w-full overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl transition-all ${previewMode === 'mobile' ? 'max-w-[320px]' : 'max-w-[520px]'}`}
                        >
                          <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-3">
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                              <Mail className="size-3.5" />
                              {t('marketingPage.emailPreview')}
                            </div>
                            <p className="mt-1 truncate text-xs text-zinc-300">
                              {t('marketingPage.to')}: client@example.com
                            </p>
                          </div>
                          <div className="space-y-4 bg-white p-5 text-zinc-900 sm:p-6">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                                {preview.name}
                              </p>
                              <h3 className="mt-2 text-lg font-bold leading-tight">
                                {preview.subject}
                              </h3>
                            </div>
                            <div className="whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                              {preview.body}
                            </div>
                            <div className="rounded-xl bg-zinc-100 p-3 text-[11px] text-zinc-500">
                              {t('marketingPage.sampleMessage')}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`rounded-[28px] border border-zinc-700 bg-zinc-950 p-3 shadow-2xl transition-all ${previewMode === 'mobile' ? 'w-full max-w-[300px]' : 'w-full max-w-[440px]'}`}
                        >
                          <div className="overflow-hidden rounded-[22px] border border-zinc-800 bg-zinc-900">
                            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3 text-[10px] text-zinc-500">
                              <span>{t('marketingPage.messages')}</span>
                              <MessageSquare className="size-3.5" />
                            </div>
                            <div className="min-h-64 bg-zinc-900 p-4">
                              <div className="mb-3 text-center text-[10px] text-zinc-600">
                                {t('marketingPage.todayNow')}
                              </div>
                              <div className="ml-auto max-w-[86%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-5 text-primary-foreground shadow-lg">
                                {preview.body}
                              </div>
                              <div className="mt-2 text-right text-[9px] text-zinc-600">
                                {t('marketingPage.sentByShop')}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                      <div className="flex gap-3">
                        {form.channel === 'email' ? (
                          <Mail className="mt-0.5 size-4 text-zinc-400" />
                        ) : (
                          <MessageSquare className="mt-0.5 size-4 text-zinc-400" />
                        )}
                        <div>
                          <p className="text-sm font-semibold">
                            {t('marketingPage.previewExplainer')}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {form.channel === 'email'
                              ? t('marketingPage.emailPreviewDescription')
                              : t('marketingPage.smsPreviewDescription')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-white/10 bg-white/[0.015]">
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>{t('marketingPage.recentCampaigns')}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('marketingPage.recentDescription')}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void load()}
              disabled={loading}
              aria-label={t('marketingPage.refreshCampaigns')}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
            </Button>
          </CardHeader>
          <CardContent>
            {loading && !campaigns.length ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('marketingPage.loading')}
              </div>
            ) : campaigns.length ? (
              <div className="space-y-2">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="group flex flex-col gap-4 rounded-2xl border border-transparent p-4 transition hover:border-white/10 hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-primary">
                        {campaign.channel === 'email' ? (
                          <Mail className="h-4 w-4" />
                        ) : (
                          <MessageSquare className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{campaign.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            {campaign.channel === 'email' ? 'Email' : 'SMS'}
                          </span>
                          <span>·</span>
                          <span>
                            {new Date(campaign.created_at).toLocaleDateString(
                              locale === 'pt' ? 'pt-PT' : 'en-GB',
                            )}
                          </span>
                          {campaign.subject && (
                            <>
                              <span>·</span>
                              <span className="max-w-[240px] truncate">
                                {campaign.subject}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${statusClass(campaign.status)}`}
                    >
                      {formatStatus(campaign.status, t)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                  <Send className="size-5 text-muted-foreground" />
                </div>
                <p className="mt-4 font-medium">{t('marketingPage.noCampaigns')}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('marketingPage.noCampaignsDescription')}
                </p>
                <Button className="mt-5" onClick={openComposer}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('marketingPage.createCampaign')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
