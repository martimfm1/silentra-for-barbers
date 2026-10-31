'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Cake,
  CheckCircle2,
  Eye,
  Gift,
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const MAX_BODY_LENGTH = 10000;
const EDITABLE_STATUSES = ['draft', 'scheduled'] as const;

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  sending: 'A enviar',
  completed: 'Concluída',
  sent: 'Enviada',
  failed: 'Falhou',
  cancelled: 'Cancelada',
};

const EVENT_LABELS = {
  booking_created: 'Marcação criada',
  booking_completed: 'Marcação concluída',
  booking_cancelled: 'Marcação cancelada',
} as const;

type EventKey = keyof typeof EVENT_LABELS;
type View = 'campaigns' | 'automation' | 'performance';
type Campaign = {
  id: string;
  name: string;
  channel: 'email' | 'sms';
  subject: string | null;
  body: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  updated_at?: string | null;
  trigger_type?: 'manual' | 'interval' | 'event' | 'birthday' | null;
  interval_value?: number | null;
  interval_unit?: 'hours' | 'days' | null;
  next_run_at?: string | null;
  event_name?: string | null;
  birthday_offset_days?: number | null;
  birthday_reward_type?: 'none' | 'free_service' | null;
  birthday_reward_service_id?: string | null;
  active?: boolean | null;
  total_recipients?: number | null;
  sent_count?: number | null;
  failed_count?: number | null;
};
type Service = {
  id: string;
  name: string;
  price: number;
  duration: number | null;
};
type Metric = { label: string; value: number; Icon: LucideIcon; tone: string };
type FormState = {
  name: string;
  channel: 'email' | 'sms';
  subject: string;
  body: string;
  scheduledAt: string;
};
type AutomationState = {
  mode: 'manual' | 'interval' | 'event' | 'birthday';
  intervalValue: string;
  intervalUnit: 'hours' | 'days';
  eventName: EventKey;
  birthdayOffset: string;
  birthdayRewardType: 'none' | 'free_service';
  birthdayRewardServiceId: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  channel: 'email',
  subject: '',
  body: '',
  scheduledAt: '',
};
const EMPTY_AUTOMATION: AutomationState = {
  mode: 'manual',
  intervalValue: '24',
  intervalUnit: 'hours',
  eventName: 'booking_created',
  birthdayOffset: '0',
  birthdayRewardType: 'none',
  birthdayRewardServiceId: '',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('pt-PT', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

function statusClass(status: string) {
  if (status === 'completed' || status === 'sent')
    return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
  if (status === 'scheduled')
    return 'border-sky-400/20 bg-sky-400/10 text-sky-300';
  if (status === 'sending')
    return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
  if (status === 'failed')
    return 'border-red-400/20 bg-red-400/10 text-red-300';
  return 'border-white/10 bg-white/[0.03] text-zinc-300';
}

function automationLabel(campaign: Campaign) {
  if (campaign.trigger_type === 'interval')
    return `A cada ${campaign.interval_value ?? '?'} ${campaign.interval_unit === 'days' ? 'dias' : 'horas'}`;
  if (campaign.trigger_type === 'event')
    return (
      EVENT_LABELS[campaign.event_name as EventKey] ??
      campaign.event_name ??
      'Evento'
    );
  if (campaign.trigger_type === 'birthday') {
    const offset = campaign.birthday_offset_days ?? 0;
    if (offset === 0) return 'No aniversário';
    return offset < 0
      ? `${Math.abs(offset)} dia(s) antes`
      : `${offset} dia(s) depois`;
  }
  return 'Manual';
}

export function MarketingWorkspace({
  initialView = 'campaigns',
}: {
  initialView?: View;
}) {
  const { hasFeature, loading: accessLoading } = useFeatureAccess();
  const allowed = hasFeature('marketing_campaigns');
  const [view, setView] = useState<View>(initialView);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [events, setEvents] = useState<EventKey[]>(
    Object.keys(EVENT_LABELS) as EventKey[],
  );
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [sendingId, setSendingId] = useState('');
  const [automationSaving, setAutomationSaving] = useState(false);
  const [creatingBirthday, setCreatingBirthday] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [details, setDetails] = useState<Campaign | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Campaign | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [automation, setAutomation] =
    useState<AutomationState>(EMPTY_AUTOMATION);
  const [liveMessage, setLiveMessage] = useState('');

  const selected =
    campaigns.find((campaign) => campaign.id === selectedId) ?? null;
  const birthdayCampaign =
    campaigns.find(
      (campaign) =>
        campaign.trigger_type === 'birthday' &&
        campaign.active !== false &&
        campaign.status !== 'cancelled',
    ) ?? null;
  const canManage = (campaign: Campaign) =>
    EDITABLE_STATUSES.includes(
      campaign.status as (typeof EDITABLE_STATUSES)[number],
    );

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const [campaignResponse, automationResponse] = await Promise.all([
        fetch('/api/marketing/campaigns', { cache: 'no-store' }),
        fetch('/api/marketing/campaigns/automation', { cache: 'no-store' }),
      ]);
      const campaignData = await campaignResponse.json();
      const automationData = await automationResponse.json();
      if (!campaignResponse.ok)
        throw new Error(
          campaignData.error ?? 'Não foi possível carregar as campanhas.',
        );
      if (!automationResponse.ok)
        throw new Error(
          automationData.error ?? 'Não foi possível carregar as automações.',
        );

      const base = (campaignData.campaigns ?? []) as Campaign[];
      const automated = (automationData.campaigns ?? []) as Campaign[];
      const merged = base.map((campaign) => ({
        ...campaign,
        ...(automated.find((item) => item.id === campaign.id) ?? {}),
      }));
      setCampaigns(merged);
      setServices((automationData.services ?? []) as Service[]);
      setEvents(
        (automationData.events ?? Object.keys(EVENT_LABELS)) as EventKey[],
      );
      if (!merged.some((campaign) => campaign.id === selectedId))
        setSelectedId(merged[0]?.id ?? '');
      setLiveMessage('Marketing atualizado.');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erro ao carregar o marketing.';
      setLiveMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [allowed, selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    setAutomation({
      mode: selected.trigger_type ?? 'manual',
      intervalValue: String(selected.interval_value ?? 24),
      intervalUnit: selected.interval_unit ?? 'hours',
      eventName: (selected.event_name as EventKey) ?? 'booking_created',
      birthdayOffset: String(selected.birthday_offset_days ?? 0),
      birthdayRewardType: selected.birthday_reward_type ?? 'none',
      birthdayRewardServiceId: selected.birthday_reward_service_id ?? '',
    });
  }, [selected]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-PT');
    return campaigns.filter((campaign) => {
      const matchesQuery =
        !needle ||
        `${campaign.name} ${campaign.subject ?? ''} ${campaign.body}`
          .toLocaleLowerCase('pt-PT')
          .includes(needle);
      const matchesStatus =
        statusFilter === 'all' || campaign.status === statusFilter;
      const matchesChannel =
        channelFilter === 'all' || campaign.channel === channelFilter;
      return matchesQuery && matchesStatus && matchesChannel;
    });
  }, [campaigns, channelFilter, query, statusFilter]);

  const metrics: Metric[] = useMemo(
    () => [
      {
        label: 'Campanhas ativas',
        value: campaigns.filter(
          (item) =>
            item.active !== false &&
            !['completed', 'cancelled'].includes(item.status),
        ).length,
        Icon: Zap,
        tone: 'text-primary',
      },
      {
        label: 'Destinatários',
        value: campaigns.reduce(
          (sum, item) => sum + Number(item.total_recipients ?? 0),
          0,
        ),
        Icon: MessageSquare,
        tone: 'text-sky-300',
      },
      {
        label: 'Enviadas',
        value: campaigns.reduce(
          (sum, item) => sum + Number(item.sent_count ?? 0),
          0,
        ),
        Icon: CheckCircle2,
        tone: 'text-emerald-300',
      },
      {
        label: 'Falhas',
        value: campaigns.reduce(
          (sum, item) => sum + Number(item.failed_count ?? 0),
          0,
        ),
        Icon: AlertTriangle,
        tone: 'text-red-300',
      },
    ],
    [campaigns],
  );

  function openCreate() {
    setEditorMode('create');
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  }

  function openEdit(campaign: Campaign) {
    if (!canManage(campaign)) {
      toast.error(
        'Esta campanha já começou a enviar e já não pode ser editada.',
      );
      return;
    }
    setSelectedId(campaign.id);
    setEditorMode('edit');
    setForm({
      name: campaign.name,
      channel: campaign.channel,
      subject: campaign.subject ?? '',
      body: campaign.body,
      scheduledAt: campaign.scheduled_at
        ? new Date(campaign.scheduled_at).toISOString().slice(0, 16)
        : '',
    });
    setEditorOpen(true);
  }

  async function saveCampaign(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch('/api/marketing/campaigns', {
        method: editorMode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          id: editorMode === 'edit' ? selectedId : undefined,
          scheduledAt: form.scheduledAt
            ? new Date(form.scheduledAt).toISOString()
            : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? 'Não foi possível guardar a campanha.');
      setCampaigns((current) =>
        editorMode === 'edit'
          ? current.map((item) =>
              item.id === data.campaign.id
                ? { ...item, ...data.campaign }
                : item,
            )
          : [data.campaign, ...current],
      );
      setSelectedId(data.campaign.id);
      setEditorOpen(false);
      toast.success(
        editorMode === 'edit' ? 'Campanha atualizada.' : 'Campanha criada.',
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao guardar a campanha.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCampaign(campaign: Campaign) {
    if (!canManage(campaign)) return;
    setDeletingId(campaign.id);
    try {
      const response = await fetch(
        `/api/marketing/campaigns?id=${encodeURIComponent(campaign.id)}`,
        { method: 'DELETE' },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? 'Não foi possível apagar a campanha.');
      setCampaigns((current) =>
        current.filter((item) => item.id !== campaign.id),
      );
      if (selectedId === campaign.id) setSelectedId('');
      if (details?.id === campaign.id) setDetails(null);
      setConfirmDelete(null);
      toast.success('Campanha apagada.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao apagar a campanha.',
      );
    } finally {
      setDeletingId('');
    }
  }

  async function sendCampaign(campaign: Campaign) {
    if (!canManage(campaign)) return;
    setSendingId(campaign.id);
    try {
      const response = await fetch(
        `/api/marketing/campaigns/${campaign.id}/send`,
        { method: 'POST' },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? 'Não foi possível iniciar o envio.');
      toast.success(`${data.queued ?? 0} destinatários colocados na fila.`);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao iniciar o envio.',
      );
    } finally {
      setSendingId('');
    }
  }

  async function createBirthdayAutomation() {
    if (birthdayCampaign) {
      setSelectedId(birthdayCampaign.id);
      setView('automation');
      toast.info(
        'A automação de aniversário já existe. Abri a configuração atual.',
      );
      return;
    }

    setCreatingBirthday(true);
    let createdCampaignId = '';
    try {
      const createResponse = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Aniversários',
          channel: 'email',
          subject: 'Feliz aniversário, {{nome}}! 🎂',
          body: 'Olá {{nome}},\n\nA equipa da {{barbearia}} deseja-te um feliz aniversário, cheio de coisas boas! 🎉\n\nObrigado por fazeres parte da nossa comunidade. Esperamos ver-te em breve!\n\nCom os melhores votos,\n{{barbearia}}',
        }),
      });
      const createData = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok || !createData.campaign?.id) {
        throw new Error(
          createData.error ??
            'Não foi possível criar a campanha de aniversário.',
        );
      }

      const campaign = createData.campaign as Campaign;
      createdCampaignId = campaign.id;

      const automationResponse = await fetch(
        '/api/marketing/campaigns/automation',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: campaign.id,
            triggerType: 'birthday',
            birthdayOffsetDays: 0,
            birthdayRewardType: 'none',
            birthdayRewardServiceId: null,
          }),
        },
      );
      const automationData = await automationResponse.json().catch(() => ({}));
      if (!automationResponse.ok || !automationData.campaign) {
        throw new Error(
          automationData.error ??
            'A campanha foi criada, mas não foi possível ativar o gatilho de aniversário.',
        );
      }

      setCampaigns((current) => [
        { ...campaign, ...automationData.campaign },
        ...current.filter((item) => item.id !== campaign.id),
      ]);
      setSelectedId(campaign.id);
      setAutomation({
        ...EMPTY_AUTOMATION,
        mode: 'birthday',
      });
      setView('automation');
      setLiveMessage('Automação de aniversário criada e ativada.');
      toast.success('Automação de aniversário criada e ativada.');
    } catch (error) {
      if (createdCampaignId) {
        await fetch(
          `/api/marketing/campaigns?id=${encodeURIComponent(createdCampaignId)}`,
          { method: 'DELETE' },
        ).catch(() => undefined);
      }
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar a automação de aniversário.',
      );
    } finally {
      setCreatingBirthday(false);
    }
  }

  async function saveAutomation() {
    if (!selected) return;
    setAutomationSaving(true);
    try {
      const response = await fetch('/api/marketing/campaigns/automation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selected.id,
          triggerType: automation.mode,
          intervalValue: Number(automation.intervalValue),
          intervalUnit: automation.intervalUnit,
          eventName: automation.eventName,
          birthdayOffsetDays: Number(automation.birthdayOffset),
          birthdayRewardType: automation.birthdayRewardType,
          birthdayRewardServiceId: automation.birthdayRewardServiceId || null,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? 'Não foi possível guardar a automação.');
      setCampaigns((current) =>
        current.map((item) =>
          item.id === selected.id ? { ...item, ...data.campaign } : item,
        ),
      );
      toast.success('Automação atualizada.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao guardar a automação.',
      );
    } finally {
      setAutomationSaving(false);
    }
  }

  if (accessLoading) return <main className="min-h-screen" aria-busy="true" />;
  if (!allowed)
    return (
      <main className="min-h-screen px-4 py-20 sm:px-8">
        <Card className="mx-auto max-w-xl border-white/10 bg-white/[0.02]">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Sparkles className="size-8 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-semibold">Marketing avançado</h1>
            <p className="text-muted-foreground">
              Campanhas de email e SMS, automações e delivery num só lugar.
            </p>
            <Button asChild>
              <Link href="/dashboard/billing">Ver plano</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );

  return (
    <main
      className="min-h-screen px-4 py-6 text-foreground sm:px-8 sm:py-8"
      aria-labelledby="marketing-title"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="sr-only" aria-live="polite">
          {liveMessage}
        </div>
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" /> Marketing ·
              Pro
            </div>
            <h1
              id="marketing-title"
              className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Marketing
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Cria, gere, automatiza e acompanha campanhas num só lugar.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
                Dashboard
              </Link>
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 size-4" aria-hidden="true" />
              Nova campanha
            </Button>
          </div>
        </header>

        <section
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Resumo de marketing"
        >
          {metrics.map(({ label, value, Icon, tone }) => (
            <Card key={label} className="border-white/10 bg-white/[0.025]">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {value}
                  </p>
                </div>
                <Icon className={`size-5 ${tone}`} aria-hidden="true" />
              </CardContent>
            </Card>
          ))}
        </section>

        <div
          className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02] p-1"
          role="tablist"
          aria-label="Secções de marketing"
        >
          {(['campaigns', 'automation', 'performance'] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={view === item}
              onClick={() => setView(item)}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium whitespace-nowrap ${view === item ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/[0.04]'}`}
            >
              {item === 'campaigns'
                ? 'Campanhas'
                : item === 'automation'
                  ? 'Automação'
                  : 'Desempenho'}
            </button>
          ))}
        </div>

        {view === 'campaigns' && (
          <section className="space-y-4" aria-labelledby="campaign-list-title">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                <div className="relative flex-1 sm:max-w-md">
                  <Search
                    className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                    aria-hidden="true"
                  />
                  <Input
                    aria-label="Pesquisar campanhas"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Pesquisar por nome, assunto ou mensagem…"
                    className="pl-9"
                  />
                </div>
                <select
                  aria-label="Estado"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Todos os estados</option>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Canal"
                  value={channelFilter}
                  onChange={(event) => setChannelFilter(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Todos os canais</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <Button
                variant="outline"
                onClick={() => void load()}
                disabled={loading}
              >
                <RefreshCw
                  className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                Atualizar
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <h2
                id="campaign-list-title"
                className="font-medium text-zinc-300"
              >
                {filtered.length} campanha(s)
              </h2>
              <span>
                Editar/apagar disponível enquanto não começou o envio.
              </span>
            </div>
            {loading && campaigns.length === 0 ? (
              <Card className="border-white/10 bg-white/[0.02]">
                <CardContent className="flex flex-col items-center py-16 text-sm text-muted-foreground">
                  <Loader2
                    className="mb-3 size-5 animate-spin"
                    aria-hidden="true"
                  />
                  A carregar…
                </CardContent>
              </Card>
            ) : filtered.length === 0 ? (
              <Card className="border-dashed border-white/10 bg-white/[0.02]">
                <CardContent className="flex flex-col items-center py-16 text-center">
                  <Sparkles
                    className="size-7 text-zinc-500"
                    aria-hidden="true"
                  />
                  <h3 className="mt-3 font-medium">Sem campanhas</h3>
                  <Button className="mt-4" onClick={openCreate}>
                    <Plus className="mr-2 size-4" aria-hidden="true" />
                    Nova campanha
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {filtered.map((campaign) => {
                  const editable = canManage(campaign);
                  return (
                    <article
                      key={campaign.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.035]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-semibold">
                              {campaign.name}
                            </h3>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(campaign.status)}`}
                            >
                              {STATUS_LABELS[campaign.status] ??
                                campaign.status}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {campaign.subject || campaign.body}
                          </p>
                        </div>
                        {campaign.channel === 'email' ? (
                          <Mail
                            className="size-4 shrink-0 text-sky-300"
                            aria-label="Email"
                          />
                        ) : (
                          <MessageSquare
                            className="size-4 shrink-0 text-emerald-300"
                            aria-label="SMS"
                          />
                        )}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-black/10 p-3 text-xs sm:grid-cols-4">
                        <div>
                          <p className="text-zinc-500">Automação</p>
                          <p className="mt-1 font-medium">
                            {automationLabel(campaign)}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Enviadas</p>
                          <p className="mt-1 font-medium">
                            {campaign.sent_count ?? 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Falhas</p>
                          <p className="mt-1 font-medium">
                            {campaign.failed_count ?? 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Atualizada</p>
                          <p className="mt-1 font-medium">
                            {formatDate(
                              campaign.updated_at ?? campaign.created_at,
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedId(campaign.id);
                            setView('automation');
                          }}
                        >
                          <Settings2
                            className="mr-2 size-4"
                            aria-hidden="true"
                          />
                          Gerir
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDetails(campaign)}
                        >
                          <Eye className="mr-2 size-4" aria-hidden="true" />
                          Detalhes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(campaign)}
                          disabled={!editable}
                        >
                          <Pencil className="mr-2 size-4" aria-hidden="true" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmDelete(campaign)}
                          disabled={!editable || deletingId === campaign.id}
                          className="text-red-300 hover:bg-red-400/10 hover:text-red-200"
                        >
                          <Trash2 className="mr-2 size-4" aria-hidden="true" />
                          Apagar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => void sendCampaign(campaign)}
                          disabled={!editable || sendingId === campaign.id}
                        >
                          {sendingId === campaign.id ? (
                            <Loader2
                              className="mr-2 size-4 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Send className="mr-2 size-4" aria-hidden="true" />
                          )}
                          {sendingId === campaign.id
                            ? 'A iniciar…'
                            : 'Enviar agora'}
                        </Button>
                      </div>
                      {!editable && (
                        <p className="mt-2 text-xs text-zinc-500">
                          Esta campanha está bloqueada porque o envio já começou
                          ou terminou.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {view === 'automation' && (
          <>
            <Card className="overflow-hidden border-amber-400/20 bg-gradient-to-br from-amber-400/[0.09] via-white/[0.025] to-white/[0.015]">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
                    <Cake className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-zinc-100">
                      Automação de aniversário
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
                      Cria automaticamente uma mensagem de aniversário por
                      email, configurada para ser enviada no próprio dia. Podes
                      editar o texto e escolher uma recompensa depois.
                    </p>
                    {birthdayCampaign && (
                      <p className="mt-2 text-xs font-medium text-emerald-300">
                        Já existe uma automação de aniversário ativa.
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => void createBirthdayAutomation()}
                  disabled={creatingBirthday || loading}
                  className="min-h-11 shrink-0"
                >
                  {creatingBirthday ? (
                    <Loader2
                      className="mr-2 size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus className="mr-2 size-4" aria-hidden="true" />
                  )}
                  {creatingBirthday
                    ? 'A configurar…'
                    : birthdayCampaign
                      ? 'Abrir automação'
                      : 'Adicionar automaticamente'}
                </Button>
              </CardContent>
            </Card>
            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              {!selected ? (
                <Card className="border-white/10 bg-white/[0.02]">
                  <CardContent className="py-16 text-center">
                    <p className="font-medium">Seleciona uma campanha</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Volta a Campanhas e escolhe “Gerir”.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card className="border-white/10 bg-white/[0.02]">
                    <CardHeader>
                      <CardTitle>Automação da campanha</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {selected.name} ·{' '}
                        {STATUS_LABELS[selected.status] ?? selected.status}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="automation-mode"
                            className="text-sm font-medium"
                          >
                            Gatilho
                          </label>
                          <select
                            id="automation-mode"
                            value={automation.mode}
                            onChange={(event) =>
                              setAutomation((current) => ({
                                ...current,
                                mode: event.target
                                  .value as AutomationState['mode'],
                              }))
                            }
                            className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            disabled={!canManage(selected)}
                          >
                            <option value="manual">Manual</option>
                            <option value="interval">Intervalo</option>
                            <option value="event">Evento</option>
                            <option value="birthday">Aniversário</option>
                          </select>
                        </div>
                        {automation.mode === 'interval' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label
                                htmlFor="interval-value"
                                className="text-sm font-medium"
                              >
                                Valor
                              </label>
                              <Input
                                id="interval-value"
                                type="number"
                                min={1}
                                max={3650}
                                value={automation.intervalValue}
                                onChange={(event) =>
                                  setAutomation((current) => ({
                                    ...current,
                                    intervalValue: event.target.value,
                                  }))
                                }
                                disabled={!canManage(selected)}
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="interval-unit"
                                className="text-sm font-medium"
                              >
                                Unidade
                              </label>
                              <select
                                id="interval-unit"
                                value={automation.intervalUnit}
                                onChange={(event) =>
                                  setAutomation((current) => ({
                                    ...current,
                                    intervalUnit: event.target
                                      .value as AutomationState['intervalUnit'],
                                  }))
                                }
                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                disabled={!canManage(selected)}
                              >
                                <option value="hours">Horas</option>
                                <option value="days">Dias</option>
                              </select>
                            </div>
                          </div>
                        )}
                        {automation.mode === 'event' && (
                          <div>
                            <label
                              htmlFor="event-name"
                              className="text-sm font-medium"
                            >
                              Evento
                            </label>
                            <select
                              id="event-name"
                              value={automation.eventName}
                              onChange={(event) =>
                                setAutomation((current) => ({
                                  ...current,
                                  eventName: event.target.value as EventKey,
                                }))
                              }
                              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                              disabled={!canManage(selected)}
                            >
                              {events.map((event) => (
                                <option key={event} value={event}>
                                  {EVENT_LABELS[event] ?? event}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      {automation.mode === 'birthday' && (
                        <div className="grid gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-4 sm:grid-cols-3">
                          <div>
                            <label
                              htmlFor="birthday-offset"
                              className="text-sm font-medium"
                            >
                              <Cake
                                className="mr-1 inline size-4"
                                aria-hidden="true"
                              />
                              Momento
                            </label>
                            <select
                              id="birthday-offset"
                              value={automation.birthdayOffset}
                              onChange={(event) =>
                                setAutomation((current) => ({
                                  ...current,
                                  birthdayOffset: event.target.value,
                                }))
                              }
                              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                              disabled={!canManage(selected)}
                            >
                              <option value="-1">1 dia antes</option>
                              <option value="0">No próprio dia</option>
                              <option value="1">1 dia depois</option>
                            </select>
                          </div>
                          <div>
                            <label
                              htmlFor="birthday-reward"
                              className="text-sm font-medium"
                            >
                              <Gift
                                className="mr-1 inline size-4"
                                aria-hidden="true"
                              />
                              Recompensa
                            </label>
                            <select
                              id="birthday-reward"
                              value={automation.birthdayRewardType}
                              onChange={(event) =>
                                setAutomation((current) => ({
                                  ...current,
                                  birthdayRewardType: event.target
                                    .value as AutomationState['birthdayRewardType'],
                                }))
                              }
                              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                              disabled={!canManage(selected)}
                            >
                              <option value="none">Mensagem apenas</option>
                              <option value="free_service">
                                Serviço gratuito
                              </option>
                            </select>
                          </div>
                          {automation.birthdayRewardType === 'free_service' && (
                            <div>
                              <label
                                htmlFor="birthday-service"
                                className="text-sm font-medium"
                              >
                                Serviço
                              </label>
                              <select
                                id="birthday-service"
                                value={automation.birthdayRewardServiceId}
                                onChange={(event) =>
                                  setAutomation((current) => ({
                                    ...current,
                                    birthdayRewardServiceId: event.target.value,
                                  }))
                                }
                                className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                disabled={!canManage(selected)}
                              >
                                <option value="">Selecionar serviço</option>
                                {services.map((service) => (
                                  <option key={service.id} value={service.id}>
                                    {service.name} ·{' '}
                                    {Number(service.price).toFixed(2)} €
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                          Próxima execução:{' '}
                          <span className="font-medium text-zinc-200">
                            {selected.next_run_at
                              ? formatDate(selected.next_run_at)
                              : automation.mode === 'manual'
                                ? 'Manual'
                                : 'Calculada ao guardar'}
                          </span>
                        </p>
                        <Button
                          onClick={() => void saveAutomation()}
                          disabled={automationSaving || !canManage(selected)}
                        >
                          {automationSaving
                            ? 'A guardar…'
                            : 'Guardar automação'}
                        </Button>
                      </div>
                      {!canManage(selected) && (
                        <p className="text-xs text-zinc-500">
                          A automação desta campanha está bloqueada porque o
                          envio já começou.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border-white/10 bg-white/[0.02]">
                    <CardHeader>
                      <CardTitle>Ações rápidas</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setDetails(selected)}
                      >
                        <Eye className="mr-2 size-4" aria-hidden="true" />
                        Detalhes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => openEdit(selected)}
                        disabled={!canManage(selected)}
                      >
                        <Pencil className="mr-2 size-4" aria-hidden="true" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setConfirmDelete(selected)}
                        disabled={!canManage(selected)}
                        className="text-red-300"
                      >
                        <Trash2 className="mr-2 size-4" aria-hidden="true" />
                        Apagar
                      </Button>
                      <Button
                        onClick={() => void sendCampaign(selected)}
                        disabled={
                          !canManage(selected) || sendingId === selected.id
                        }
                      >
                        <Send className="mr-2 size-4" aria-hidden="true" />
                        Enviar agora
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}
            </section>
          </>
        )}

        {view === 'performance' && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Campanhas</p>
                <p className="mt-1 text-2xl font-semibold">
                  {campaigns.length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Destinatários</p>
                <p className="mt-1 text-2xl font-semibold">
                  {campaigns.reduce(
                    (sum, item) => sum + Number(item.total_recipients ?? 0),
                    0,
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Enviadas</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-300">
                  {campaigns.reduce(
                    (sum, item) => sum + Number(item.sent_count ?? 0),
                    0,
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Falhas</p>
                <p className="mt-1 text-2xl font-semibold text-red-300">
                  {campaigns.reduce(
                    (sum, item) => sum + Number(item.failed_count ?? 0),
                    0,
                  )}
                </p>
              </CardContent>
            </Card>
          </section>
        )}
      </div>

      {details && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8">
          <section
            className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-details-title"
          >
            <div className="flex items-start justify-between border-b border-white/10 p-5">
              <div>
                <h2
                  id="campaign-details-title"
                  className="text-xl font-semibold"
                >
                  Detalhes da campanha
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {details.name}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDetails(null)}
                aria-label="Fechar"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="grid gap-6 p-5 sm:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-zinc-500">Estado</p>
                  <span
                    className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs ${statusClass(details.status)}`}
                  >
                    {STATUS_LABELS[details.status] ?? details.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Automação</p>
                  <p className="mt-1">{automationLabel(details)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Agendada</p>
                  <p className="mt-1">{formatDate(details.scheduled_at)}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/10 p-3 text-center">
                    <p className="text-lg font-semibold">
                      {details.total_recipients ?? 0}
                    </p>
                    <p className="text-[10px] text-zinc-500">destinatários</p>
                  </div>
                  <div className="rounded-xl border border-white/10 p-3 text-center">
                    <p className="text-lg font-semibold text-emerald-300">
                      {details.sent_count ?? 0}
                    </p>
                    <p className="text-[10px] text-zinc-500">enviadas</p>
                  </div>
                  <div className="rounded-xl border border-white/10 p-3 text-center">
                    <p className="text-lg font-semibold text-red-300">
                      {details.failed_count ?? 0}
                    </p>
                    <p className="text-[10px] text-zinc-500">falhas</p>
                  </div>
                </div>
                {details.channel === 'email' && (
                  <div>
                    <p className="text-xs text-zinc-500">Assunto</p>
                    <p className="mt-1 rounded-xl border border-white/10 p-3">
                      {details.subject || '—'}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-zinc-500">Mensagem</p>
                  <div className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 p-4 text-sm leading-6">
                    {details.body}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-white/10 p-5">
              <Button variant="outline" onClick={() => setDetails(null)}>
                Fechar
              </Button>
              <Button
                onClick={() => {
                  setDetails(null);
                  openEdit(details);
                }}
                disabled={!canManage(details)}
              >
                <Pencil className="mr-2 size-4" aria-hidden="true" />
                Editar
              </Button>
            </div>
          </section>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <section
            className="w-full max-w-md rounded-3xl border border-red-400/20 bg-zinc-950 p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-campaign-title"
          >
            <div className="flex size-11 items-center justify-center rounded-2xl bg-red-400/10 text-red-300">
              <Trash2 className="size-5" aria-hidden="true" />
            </div>
            <h2
              id="delete-campaign-title"
              className="mt-4 text-lg font-semibold"
            >
              Apagar campanha?
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              A campanha{' '}
              <span className="font-medium text-zinc-200">
                {confirmDelete.name}
              </span>{' '}
              será removida permanentemente. Só é possível fazer isto enquanto o
              envio ainda não começou.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(null)}
                disabled={deletingId === confirmDelete.id}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => void deleteCampaign(confirmDelete)}
                disabled={deletingId === confirmDelete.id}
                className="bg-red-500/90 hover:bg-red-500"
              >
                {deletingId === confirmDelete.id ? (
                  <Loader2
                    className="mr-2 size-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Trash2 className="mr-2 size-4" aria-hidden="true" />
                )}
                {deletingId === confirmDelete.id
                  ? 'A apagar…'
                  : 'Apagar campanha'}
              </Button>
            </div>
          </section>
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="flex max-h-[90vh] sm:min-w-1lg max-w-6xl lg:min-w-4xl flex-col gap-0 overflow-hidden border border-white/15 bg-zinc-950/70 p-0 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl rounded-2xl">
          {/* Header Fixo com Glassmorphism */}
          <DialogHeader className="shrink-0 border-b border-white/10 bg-zinc-900/30 p-4 text-left backdrop-blur-md sm:p-6">
            <DialogTitle className="text-lg font-semibold text-zinc-100 sm:text-xl">
              {editorMode === 'create' ? 'Nova campanha' : 'Editar campanha'}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-zinc-400 sm:text-sm">
              {editorMode === 'edit'
                ? 'Podes editar enquanto o envio ainda não começou.'
                : 'Cria primeiro; depois podes editar, apagar ou automatizar.'}
            </DialogDescription>
          </DialogHeader>

          {/* Formulário com Scroll Interno (Mobile-First) */}
          <form
            onSubmit={saveCampaign}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="grid flex-1 overflow-y-auto grid-cols-1 lg:grid-cols-2 divide-y divide-white/10 lg:divide-y-0 lg:divide-x">
              {/* Lado Esquerdo: Formulário */}
              <div className="space-y-4 p-4 sm:p-6">
                <div>
                  <label
                    htmlFor="marketing-campaign-name"
                    className="block text-xs font-medium text-zinc-200 sm:text-sm"
                  >
                    Nome
                  </label>
                  <Input
                    id="marketing-campaign-name"
                    value={form.name}
                    maxLength={120}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className="mt-1.5 border-white/10 bg-white/[0.03] text-zinc-100 backdrop-blur-sm focus-visible:ring-emerald-400/50"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="marketing-campaign-channel"
                    className="block text-xs font-medium text-zinc-200 sm:text-sm"
                  >
                    Canal
                  </label>
                  <select
                    id="marketing-campaign-channel"
                    disabled={editorMode === 'edit'}
                    value={form.channel}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        channel: event.target.value as FormState['channel'],
                        subject:
                          event.target.value === 'sms' ? '' : current.subject,
                      }))
                    }
                    className="mt-1.5 h-10 w-full rounded-md border border-white/10 bg-zinc-900/60 px-3 text-xs text-zinc-100 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                  >
                    <option value="email" className="bg-zinc-900 text-zinc-100">
                      Email
                    </option>
                    <option value="sms" className="bg-zinc-900 text-zinc-100">
                      SMS
                    </option>
                  </select>
                </div>

                {form.channel === 'email' && (
                  <div>
                    <label
                      htmlFor="marketing-campaign-subject"
                      className="block text-xs font-medium text-zinc-200 sm:text-sm"
                    >
                      Assunto
                    </label>
                    <Input
                      id="marketing-campaign-subject"
                      value={form.subject}
                      maxLength={200}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          subject: event.target.value,
                        }))
                      }
                      className="mt-1.5 border-white/10 bg-white/[0.03] text-zinc-100 backdrop-blur-sm focus-visible:ring-emerald-400/50"
                      required
                    />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="marketing-campaign-body"
                      className="text-xs font-medium text-zinc-200 sm:text-sm"
                    >
                      Mensagem
                    </label>
                    <span className="text-xs text-zinc-400">
                      {form.body.length}/{MAX_BODY_LENGTH}
                    </span>
                  </div>
                  <Textarea
                    id="marketing-campaign-body"
                    value={form.body}
                    maxLength={MAX_BODY_LENGTH}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    className="mt-1.5 min-h-[140px] border-white/10 bg-white/[0.03] text-zinc-100 backdrop-blur-sm focus-visible:ring-emerald-400/50 sm:min-h-[180px]"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="marketing-campaign-schedule"
                    className="block text-xs font-medium text-zinc-200 sm:text-sm"
                  >
                    Agendar (opcional)
                  </label>
                  <Input
                    id="marketing-campaign-schedule"
                    type="datetime-local"
                    value={form.scheduledAt}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        scheduledAt: event.target.value,
                      }))
                    }
                    className="mt-1.5 border-white/10 bg-white/[0.03] text-zinc-100 backdrop-blur-sm focus-visible:ring-emerald-400/50"
                  />
                </div>
              </div>

              {/* Lado Direito: Pré-visualização com Efeito Card Glass */}
              <div className="bg-white/[0.015] p-4 sm:p-6">
                <p className="text-xs font-medium text-zinc-200 sm:text-sm">
                  Pré-visualização
                </p>
                <div className="mt-3 rounded-xl border border-white/10 bg-zinc-900/40 p-4 backdrop-blur-md shadow-inner">
                  {form.channel === 'email' && (
                    <>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                        Assunto
                      </p>
                      <h3 className="mt-1 text-sm font-semibold text-zinc-100 sm:text-base">
                        {form.subject || 'Assunto da campanha'}
                      </h3>
                    </>
                  )}
                  <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-zinc-300 sm:text-sm">
                    {form.body || 'A mensagem aparece aqui.'}
                  </p>
                </div>
                <p className="mt-3 text-xs text-zinc-400">
                  Enquanto estiver em rascunho ou agendada, podes voltar aqui e
                  alterar o conteúdo.
                </p>
              </div>
            </div>

            {/* Rodapé Fixo (Sticky) com Glassmorphism */}
            <div className="shrink-0 flex items-center justify-end gap-2 border-t border-white/10 bg-zinc-900/30 p-4 backdrop-blur-md sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditorOpen(false)}
                disabled={saving}
                className="border-white/10 bg-white/5 text-xs text-zinc-200 hover:bg-white/10 sm:text-sm"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-emerald-500 text-xs text-zinc-950 hover:bg-emerald-400 font-medium sm:text-sm"
              >
                {saving ? (
                  <Loader2
                    className="mr-2 size-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />
                )}
                {saving
                  ? 'A guardar…'
                  : editorMode === 'create'
                    ? 'Criar campanha'
                    : 'Guardar alterações'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
