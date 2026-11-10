'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, Bell, CheckCircle2, CircleAlert, Clock3,
  Mail, Megaphone, MessageCircle, RefreshCw, Send, ShieldCheck,
  Sparkles, Users, Zap,
} from 'lucide-react';
import { FeaturePlanBadge } from '@/components/billing/FeaturePlanBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useLanguage } from '@/context/LanguageContext';
import { SettingsPushNotificationsPanel } from '@/components/dashboard/settings-push-notifications-panel';

type Campaign = {
  id: string;
  name: string;
  status: string;
  trigger_type?: string | null;
  active?: boolean | null;
  sent_count?: number | null;
  failed_count?: number | null;
  scheduled_at?: string | null;
  next_run_at?: string | null;
};
type ChannelState = 'loading' | 'ready' | 'setup' | 'unavailable' | 'locked' | 'error';

function Metric({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint: string; icon: LucideIcon }) {
  return (
    <Card className="min-w-0 rounded-2xl border-white/[.08] bg-white/[.025] shadow-none">
      <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100 tabular-nums">{value}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{hint}</p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/[.08] bg-white/[.04] text-zinc-300">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}

export default function CommunicationPage() {
  const { hasFeature, loading: accessLoading } = useFeatureAccess();
  const { t, locale } = useLanguage();
  const english = locale === 'en';
  const messagingAllowed = hasFeature('messaging');
  const marketingAllowed = hasFeature('marketing_campaigns');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [emailState, setEmailState] = useState<ChannelState>('loading');
  const [pushState, setPushState] = useState<ChannelState>('loading');
  const [emailContacts, setEmailContacts] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function refresh() {
    setRefreshing(true);
    const jobs: Promise<void>[] = [];
    if (messagingAllowed) {
      jobs.push((async () => {
        try {
          const response = await fetch('/api/messages/status', { cache: 'no-store' });
          const data = await response.json();
          if (!response.ok) throw new Error('email_status');
          setEmailState(data.configured ? 'ready' : 'setup');
          setEmailContacts(Number(data.contactsWithEmail ?? 0));
        } catch { setEmailState('error'); }
      })());
    } else {
      setEmailState('locked');
      setEmailContacts(null);
    }
    jobs.push((async () => {
      try {
        const response = await fetch('/api/notifications/push', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error('push_status');
        setPushState(data.configured ? 'ready' : 'setup');
      } catch { setPushState('error'); }
    })());
    if (marketingAllowed) {
      jobs.push((async () => {
        try {
          const response = await fetch('/api/marketing/campaigns', { cache: 'no-store' });
          const data = await response.json();
          if (!response.ok) throw new Error('campaign_status');
          setCampaigns((data.campaigns ?? []) as Campaign[]);
        } catch { setCampaigns([]); }
      })());
    } else {
      setCampaigns([]);
    }
    await Promise.all(jobs);
    setLastUpdated(new Date());
    setRefreshing(false);
  }

  useEffect(() => {
    if (!accessLoading) void refresh();
    // refresh intentionally follows the resolved plan entitlements.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessLoading, messagingAllowed, marketingAllowed]);

  const stats = useMemo(() => ({
    active: campaigns.filter(item => item.active !== false && !['completed', 'cancelled', 'failed'].includes(item.status)).length,
    sent: campaigns.reduce((sum, item) => sum + Number(item.sent_count ?? 0), 0),
    failed: campaigns.reduce((sum, item) => sum + Number(item.failed_count ?? 0), 0),
    automated: campaigns.filter(item => item.active !== false && item.trigger_type && item.trigger_type !== 'manual' && item.status !== 'cancelled').length,
  }), [campaigns]);

  const attention = stats.failed > 0
    ? { tone: 'warning', title: english ? 'Some deliveries need attention' : 'Alguns envios precisam de atenção', description: english ? `${stats.failed} failed deliveries were reported across your campaigns. Review the campaign results before sending again.` : `${stats.failed} falhas de entrega foram registadas nas campanhas. Revê os resultados antes de voltares a enviar.`, href: '/dashboard/marketing', action: english ? 'Review campaigns' : 'Rever campanhas' }
    : stats.active === 0 && marketingAllowed
      ? { tone: 'neutral', title: english ? 'Your communication can work harder' : 'Podes tirar mais partido da comunicação', description: english ? 'Set up a useful follow-up or birthday automation so clients hear from you at the right moment.' : 'Configura um seguimento ou uma automação de aniversário para contactares os clientes no momento certo.', href: '/dashboard/automations', action: english ? 'Explore automations' : 'Ver automações' }
      : null;

  const workflows = [
    { href: '/dashboard/mensagens', title: english ? 'Direct email' : 'Email direto', description: english ? 'Contact one client with a personal message, a ready-made template and a live preview.' : 'Contacta um cliente com uma mensagem pessoal, um modelo pronto e pré-visualização.', detail: english ? 'One-to-one communication' : 'Comunicação individual', icon: Mail, feature: 'messaging' as const, action: english ? 'Write an email' : 'Escrever email' },
    { href: '/dashboard/marketing', title: english ? 'Campaigns' : 'Campanhas', description: english ? 'Prepare, schedule and measure email campaigns for your client base.' : 'Prepara, agenda e acompanha campanhas de email para a tua base de clientes.', detail: english ? 'Reach a selected audience' : 'Alcançar vários clientes', icon: Megaphone, feature: 'marketing_campaigns' as const, action: english ? 'Manage campaigns' : 'Gerir campanhas' },
    { href: '/dashboard/automations', title: english ? 'Automations' : 'Automações', description: english ? 'Keep useful follow-ups running after bookings, visits and birthdays.' : 'Mantém contactos úteis a funcionar após marcações, visitas e aniversários.', detail: english ? 'Timely, repeatable messages' : 'Mensagens no momento certo', icon: Zap, feature: 'marketing_campaigns' as const, action: english ? 'Configure automations' : 'Configurar automações' },
  ];

  const channelLabel = (state: ChannelState) => ({
    loading: english ? 'Checking…' : 'A verificar…',
    ready: english ? 'Ready' : 'Configurado',
    setup: english ? 'Needs setup' : 'Precisa de configuração',
    unavailable: english ? 'Not available' : 'Indisponível',
    locked: english ? 'Plan restricted' : 'Limitado pelo plano',
    error: english ? 'Could not verify' : 'Não foi possível verificar',
  })[state];
  const channelTone = (state: ChannelState) => state === 'ready'
    ? 'text-emerald-300 bg-emerald-300/10 border-emerald-300/15'
    : state === 'setup' || state === 'error'
      ? 'text-amber-300 bg-amber-300/10 border-amber-300/15'
      : 'text-zinc-400 bg-white/[.03] border-white/[.08]';

  if (accessLoading) return <main className="dashboard-page min-h-screen px-4 pb-28 pt-8" aria-busy="true"><div className="mx-auto max-w-7xl space-y-4"><div className="h-40 animate-pulse rounded-3xl bg-white/[.03]" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map(n => <div key={n} className="h-28 animate-pulse rounded-2xl bg-white/[.03]" />)}</div></div></main>;

  return (
    <main className="dashboard-page min-h-screen px-3 pb-28 pt-5 text-foreground sm:px-6 sm:pt-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-7 sm:space-y-8">
        <header className="relative isolate overflow-hidden rounded-3xl border border-white/[.08] bg-[radial-gradient(ellipse_at_top_right,rgba(52,211,153,.13),transparent_52%),linear-gradient(135deg,rgba(255,255,255,.045),rgba(255,255,255,.012))] p-5 shadow-[0_24px_80px_rgba(0,0,0,.16)] sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-28 -z-10 size-80 rounded-full bg-emerald-300/[.07] blur-3xl" />
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.17em] text-emerald-200"><MessageCircle className="size-3.5" />{t('communicationPage.eyebrow')}</div>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">{t('communicationPage.title')}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">{t('communicationPage.description')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="min-h-11 bg-emerald-400 px-5 font-semibold text-zinc-950 hover:bg-emerald-300" ><Link href={messagingAllowed ? '/dashboard/mensagens' : '/dashboard/billing'}><Send className="mr-2 size-4" />{english ? 'Send an email' : 'Enviar email'}<ArrowRight className="ml-2 size-4" /></Link></Button>
              <Button type="button" variant="outline" className="min-h-11 border-white/10 bg-white/[.025]" onClick={() => void refresh()} disabled={refreshing}><RefreshCw className={`mr-2 size-4 ${refreshing ? 'animate-spin' : ''}`} />{english ? 'Refresh' : 'Atualizar'}</Button>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[.08] pt-4 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="size-3.5 text-emerald-300" />{t('communicationPage.privacyNote')}</span>
            {lastUpdated && <span>{english ? 'Updated' : 'Atualizado'} {lastUpdated.toLocaleTimeString(english ? 'en-GB' : 'pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
        </header>

        {attention && (
          <section className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${attention.tone === 'warning' ? 'border-amber-300/20 bg-amber-300/[.05]' : 'border-white/[.08] bg-white/[.025]'}`} aria-live="polite">
            <div className="flex min-w-0 gap-3">
              {attention.tone === 'warning' ? <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-300" /> : <Sparkles className="mt-0.5 size-5 shrink-0 text-emerald-300" />}
              <div><h2 className="text-sm font-semibold text-zinc-100">{attention.title}</h2><p className="mt-1 text-sm leading-5 text-zinc-400">{attention.description}</p></div>
            </div>
            <Button asChild variant="outline" className="min-h-10 shrink-0 border-white/10 bg-black/10"><Link href={attention.href}>{attention.action}<ArrowUpRight className="ml-2 size-4" /></Link></Button>
          </section>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={english ? 'Communication overview' : 'Resumo da comunicação'}>
          <Metric label={english ? 'Open campaigns' : 'Campanhas abertas'} value={marketingAllowed ? stats.active : '—'} hint={english ? 'Drafts, scheduled and running' : 'Rascunhos, agendadas e em curso'} icon={Megaphone} />
          <Metric label={english ? 'Automations' : 'Automações'} value={marketingAllowed ? stats.automated : '—'} hint={english ? 'Event and time-based flows' : 'Fluxos por evento e data'} icon={Zap} />
          <Metric label={english ? 'Emails sent' : 'Emails enviados'} value={marketingAllowed ? stats.sent : '—'} hint={english ? 'Campaign delivery total' : 'Total de envios das campanhas'} icon={Send} />
          <Metric label={english ? 'Client email contacts' : 'Clientes com email'} value={emailContacts === null ? '—' : emailContacts.toLocaleString(english ? 'en-GB' : 'pt-PT')} hint={english ? 'Reachable from direct messages' : 'Contactáveis por mensagem direta'} icon={Users} />
        </section>

        <section className="space-y-3" aria-labelledby="communication-workflows">
          <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.17em] text-emerald-300">{english ? 'Workspace' : 'Área de trabalho'}</p><h2 id="communication-workflows" className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">{english ? 'Choose what you need to do' : 'O que precisas de fazer?'}</h2><p className="mt-1 text-sm text-zinc-500">{english ? 'Three clear workflows, each with a specific purpose.' : 'Três fluxos claros, cada um com uma função específica.'}</p></div></div>
          <div className="grid gap-3 lg:grid-cols-3">
            {workflows.map(workflow => {
              const Icon = workflow.icon;
              const locked = !hasFeature(workflow.feature);
              return <Card key={workflow.href} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border-white/[.08] bg-white/[.025] shadow-none transition hover:border-white/[.15] hover:bg-white/[.04]">
                <CardHeader className="flex-1 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3"><span className="flex size-11 items-center justify-center rounded-2xl border border-white/[.08] bg-white/[.04] text-emerald-200"><Icon className="size-5" /></span><FeaturePlanBadge feature={workflow.feature} /></div>
                  <CardTitle className="mt-4 text-lg text-zinc-100">{workflow.title}</CardTitle>
                  <CardDescription className="text-sm leading-6 text-zinc-400">{workflow.description}</CardDescription>
                  <p className="mt-3 text-xs text-zinc-500">{workflow.detail}</p>
                </CardHeader>
                <CardContent className="border-t border-white/[.06] p-4 sm:p-5"><Button asChild className="min-h-11 w-full justify-between" variant={locked ? 'outline' : 'secondary'}><Link href={locked ? '/dashboard/billing' : workflow.href}>{locked ? (english ? 'View plans' : 'Ver planos') : workflow.action}<ArrowRight className="size-4" /></Link></Button></CardContent>
              </Card>;
            })}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,.85fr)]">
          <Card className="rounded-2xl border-white/[.08] bg-white/[.02] shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-base text-zinc-100">{english ? 'Channel availability' : 'Estado dos canais'}</CardTitle><CardDescription>{english ? 'Only channels that are actually configured are marked as ready.' : 'Só os canais realmente configurados aparecem como disponíveis.'}</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3 rounded-xl border border-white/[.06] bg-black/10 p-3"><Mail className="size-4 shrink-0 text-emerald-300" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-zinc-200">Email</p><p className="text-xs text-zinc-500">{emailContacts === null ? (english ? 'Direct messages and campaigns' : 'Mensagens diretas e campanhas') : (english ? `${emailContacts} contacts with email` : `${emailContacts} clientes com email`)}</p></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${channelTone(emailState)}`}>{channelLabel(emailState)}</span></div>
              <div className="flex items-center gap-3 rounded-xl border border-white/[.06] bg-black/10 p-3"><Bell className="size-4 shrink-0 text-sky-300" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-zinc-200">Push</p><p className="text-xs text-zinc-500">{english ? 'Operational alerts on installed devices' : 'Alertas operacionais nos dispositivos instalados'}</p></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${channelTone(pushState)}`}>{channelLabel(pushState)}</span></div>
              <div className="flex items-center gap-3 rounded-xl border border-white/[.06] bg-black/10 p-3"><MessageCircle className="size-4 shrink-0 text-zinc-500" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-zinc-300">SMS / WhatsApp</p><p className="text-xs text-zinc-500">{english ? 'Not enabled — no inactive controls shown' : 'Não ativos — sem controlos que não funcionam'}</p></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${channelTone('unavailable')}`}>{english ? 'Unavailable' : 'Não disponível'}</span></div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-white/[.08] bg-white/[.02] shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-base text-zinc-100">{english ? 'Keep communication useful' : 'Comunicação com propósito'}</CardTitle><CardDescription>{english ? 'A simple rhythm beats sending more messages.' : 'Uma boa cadência vale mais do que enviar mensagens a toda a hora.'}</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-300/10 text-emerald-200"><Clock3 className="size-4" /></span><div><p className="text-sm font-medium text-zinc-200">{english ? 'Before the visit' : 'Antes da visita'}</p><p className="text-xs leading-5 text-zinc-500">{english ? 'Send useful appointment information, not repetitive promotions.' : 'Envia informação útil sobre a marcação, sem promoções repetitivas.'}</p></div></div>
              <div className="flex gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-300/10 text-emerald-200"><CheckCircle2 className="size-4" /></span><div><p className="text-sm font-medium text-zinc-200">{english ? 'After the visit' : 'Depois da visita'}</p><p className="text-xs leading-5 text-zinc-500">{english ? 'Thank clients and invite them back at a sensible interval.' : 'Agradece a visita e convida o cliente a regressar no momento adequado.'}</p></div></div>
              <div className="flex gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-300/10 text-emerald-200"><Sparkles className="size-4" /></span><div><p className="text-sm font-medium text-zinc-200">{english ? 'On relevant dates' : 'Em datas relevantes'}</p><p className="text-xs leading-5 text-zinc-500">{english ? 'Use birthday and event automations only when they add value.' : 'Usa automações de aniversário e eventos quando acrescentam valor.'}</p></div></div>
              <Button asChild variant="outline" className="mt-1 min-h-10 w-full border-white/10 bg-white/[.02]"><Link href="/dashboard/automations">{english ? 'Review automations' : 'Rever automações'}<ArrowUpRight className="ml-2 size-4" /></Link></Button>
            </CardContent>
          </Card>
        </section>
      </div>
      <div className="mx-auto mt-6 w-full max-w-7xl"><SettingsPushNotificationsPanel /></div>
    </main>
  );
}
