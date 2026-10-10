'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  ChevronRight,
  MailCheck,
  Clock3,
  Copy,
  Database,
  Gauge,
  KeyRound,
  MailWarning,
  RefreshCw,
  Search,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
  TrendingUp,
  WalletCards,
  UserRoundCog,
  Wrench,
  XCircle,
} from 'lucide-react';
import ObservabilityPanel from '@/app/_silentra-admin/observability-panel';

type Plan = 'free' | 'pro' | 'enterprise';
type Overview = {
  generatedAt: string;
  stats: {
    barbershops: number;
    users: number;
    owners: number;
    barbers: number;
    clients: number;
    appointments: number;
    upcomingAppointments: number;
    activeSubscriptions: number;
    planAssignments: number;
    activePaidSubscriptions: number;
  };
  operations: {
    openPaymentRequests: number;
    paymentSentRequests: number;
    paidManualRequests30d: number;
    manualRevenue30d: number;
    manualConversion30d: number;
    emailFailures: number;
    manualExpiring7d: number;
    newShops7d: number;
    newUsers7d: number;
    appointmentsNext7d: number;
    canceledSubscriptions30d: number;
  };
  system: {
    adminIdentityConfigured: boolean;
    emailConfigured: boolean;
    stripeConfigured: boolean;
    manualPricingConfigured: boolean;
    manualPaymentHostAllowlistConfigured: boolean;
  };
  activity: Array<{
    action: string;
    entityType: string;
    entityId: string | null;
    detail: string | null;
    createdAt: string;
  }>;
  plans: { free: number; pro: number; enterprise: number };
  recentShops: Array<{
    id: string;
    name: string;
    slug: string | null;
    created_at: string | null;
    plan: Plan;
    assigned: boolean;
    expires_at: string | null;
  }>;
};

type ApiResponse = { ok?: boolean; error?: string; [key: string]: unknown };

const tabs = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'shops', label: 'Barbearias', icon: Building2 },
  { id: 'plans', label: 'Planos', icon: KeyRound },
  { id: 'payments', label: 'Pagamentos', icon: CreditCard },
  { id: 'payment_requests', label: 'Pedidos de pagamento', icon: MailCheck },
  { id: 'subscriptions', label: 'Subscrições', icon: Database },
  { id: 'observability', label: 'Saúde & Logs', icon: Activity },
  { id: 'diagnostics', label: 'Diagnóstico', icon: Wrench },
] as const;

type Tab = (typeof tabs)[number]['id'];

type PaymentMode = 'MANUAL' | 'STRIPE';

type ManualRequest = {
  id: string;
  user_id: string;
  barbershop_id: string;
  subscription_id: string | null;
  request_type: 'NEW' | 'RENEWAL' | 'CHANGE';
  plan: 'pro' | 'enterprise';
  billing_interval: 'month' | 'year';
  status:
    'PENDING' | 'PAYMENT_SENT' | 'PAID' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
  payment_method: 'MANUAL';
  price: number;
  currency: string;
  payment_link: string | null;
  payment_sent_at: string | null;
  paid_at: string | null;
  processed_at: string | null;
  started_at: string | null;
  expires_at: string | null;
  last_email_error: string | null;
  notes: string | null;
  billing_name: string | null;
  tax_id: string | null;
  billing_email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  website: string | null;
  business_type: string | null;
  location_count: number | null;
  team_size: number | null;
  customer_message: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    id: string;
    name_complete: string | null;
    email: string | null;
  } | null;
  barbershop: { id: string; name: string } | null;
};

const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  'platform.plan_assignment.updated': 'Plano de uma barbearia atualizado',
  'platform.plan_assignment.cleared': 'Atribuição manual de plano removida',
  PAYMENT_MODE_CHANGED: 'Método de pagamento da plataforma alterado',
  PAYMENT_LINK_SENT: 'Link de pagamento enviado ao cliente',
  PAYMENT_CONFIRMED: 'Pagamento confirmado',
  SUBSCRIPTION_ACTIVATED: 'Subscrição ativada',
  MANUAL_SUBSCRIPTION_CANCELLATION_REQUESTED: 'Pedido de cancelamento de subscrição recebido',
  manual_email_sent: 'Email enviado manualmente',
  loyalty_redemption_validated: 'Resgate de pontos validado',
  SUBSCRIPTION_EXPIRED: 'Subscrição expirada',
  SUBSCRIPTION_CREATED: 'Subscrição criada',
  SUBSCRIPTION_CANCELLED: 'Subscrição cancelada',
  SUBSCRIPTION_CANCELED: 'Subscrição cancelada',
  'professional.created': 'Profissional adicionado à barbearia',
  'appointment.created': 'Marcação criada',
  'appointment.cancelled': 'Marcação cancelada',
  'appointment.completed': 'Marcação concluída',
};

const ACTIVITY_ENTITY_LABELS: Record<string, string> = {
  barbershop: 'Barbearia',
  subscription_request: 'Pedido de subscrição',
  subscription: 'Subscrição',
  platform_settings: 'Definições da plataforma',
  loyalty_redemption: 'Resgate de pontos',
  user: 'Utilizador',
  appointment: 'Marcação',
  professional: 'Profissional',
  payment: 'Pagamento',
};

function activityActionLabel(action: string) {
  const known = ACTIVITY_ACTION_LABELS[action];
  if (known) return known;
  const translations: Record<string, string> = {
    created: 'criado',
    create: 'criar',
    updated: 'atualizado',
    update: 'atualizar',
    deleted: 'removido',
    delete: 'remover',
    cleared: 'removido',
    sent: 'enviado',
    send: 'enviar',
    confirmed: 'confirmado',
    confirm: 'confirmar',
    rejected: 'rejeitado',
    reject: 'rejeitar',
    cancelled: 'cancelado',
    canceled: 'cancelado',
    completed: 'concluído',
    expired: 'expirado',
    payment: 'pagamento',
    plan: 'plano',
    assignment: 'atribuição',
    subscription: 'subscrição',
    request: 'pedido',
    user: 'utilizador',
    barbershop: 'barbearia',
    professional: 'profissional',
    appointment: 'marcação',
    loyalty: 'fidelização',
    redemption: 'resgate',
    manual: 'manual',
    email: 'email',
    changed: 'alterado',
    mode: 'método',
    failed: 'falhou',
  };
  const words = action
    .replace(/^platform\./, '')
    .replace(/[._-]+/g, ' ')
    .toLowerCase()
    .split(/\s+/);
  return words
    .map((word) => translations[word] ?? word)
    .join(' ')
    .replace(/^\w/, (first) => first.toLocaleUpperCase('pt-PT'));
}

function activityEntityLabel(entityType: string) {
  return (
    ACTIVITY_ENTITY_LABELS[entityType] ??
    entityType.replace(/[._-]+/g, ' ').toLocaleLowerCase('pt-PT')
  );
}
function formatMoney(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function StatCard({
  label,
  value,
  meta,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  meta?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const Icon =
    tone === 'good'
      ? CheckCircle2
      : tone === 'warn'
        ? AlertTriangle
        : tone === 'bad'
          ? XCircle
          : Activity;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {value}
          </p>
          {meta ? <p className="mt-1 text-xs text-zinc-500">{meta}</p> : null}
        </div>
        <Icon
          className={`size-4 ${tone === 'good' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : tone === 'bad' ? 'text-red-400' : 'text-zinc-500'}`}
        />
      </div>
    </div>
  );
}

export default function PlatformAdminConsole() {
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<Overview | null>(null);
  const [query, setQuery] = useState('');
  const [selectedShop, setSelectedShop] = useState<
    Overview['recentShops'][number] | null
  >(null);
  const [plan, setPlan] = useState<Plan>('pro');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<{
    status: number;
    latencyMs: number;
    ok: boolean;
  } | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('MANUAL');
  const [paymentModeLoading, setPaymentModeLoading] = useState(true);
  const [changingPaymentMode, setChangingPaymentMode] = useState(false);
  const [manualRequests, setManualRequests] = useState<ManualRequest[]>([]);
  const [manualRequestFilter, setManualRequestFilter] = useState<
    'ALL' | ManualRequest['status']
  >('ALL');
  const [selectedRequest, setSelectedRequest] = useState<ManualRequest | null>(
    null,
  );
  const [paymentLink, setPaymentLink] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [paymentAction, setPaymentAction] = useState(false);
  const [requestsRefreshKey, setRequestsRefreshKey] = useState(0);

  const load = useCallback(
    async (search = query) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/silentra-admin/overview?q=${encodeURIComponent(search)}`,
          { cache: 'no-store' },
        );
        const payload = (await response.json()) as Overview & ApiResponse;
        if (!response.ok || !payload.stats)
          throw new Error(
            payload.error || 'Não foi possível carregar o painel.',
          );
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro inesperado.');
      } finally {
        setLoading(false);
      }
    },
    [query],
  );

  useEffect(() => {
    void load('');

    const queryTab = new URLSearchParams(window.location.search).get('tab');
    if (queryTab && tabs.some((item) => item.id === queryTab)) {
      setTab(queryTab as Tab);
    }
  }, [load]);

  useEffect(() => {
    const loadPaymentMode = async () => {
      try {
        setPaymentModeLoading(true);
        const response = await fetch('/api/silentra-admin/payment-mode', {
          cache: 'no-store',
        });
        const payload = (await response.json()) as {
          paymentMode?: PaymentMode;
          error?: string;
        };
        if (
          !response.ok ||
          (payload.paymentMode !== 'MANUAL' && payload.paymentMode !== 'STRIPE')
        ) {
          throw new Error(
            payload.error || 'Não foi possível carregar o método de pagamento.',
          );
        }
        setPaymentMode(payload.paymentMode);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro inesperado.');
      } finally {
        setPaymentModeLoading(false);
      }
    };

    const loadRequests = async () => {
      try {
        const query =
          manualRequestFilter === 'ALL'
            ? ''
            : `?status=${encodeURIComponent(manualRequestFilter)}`;
        const response = await fetch(
          `/api/silentra-admin/subscription-requests${query}`,
          { cache: 'no-store' },
        );
        const payload = (await response.json()) as {
          requests?: ManualRequest[];
          error?: string;
        };
        if (!response.ok || !Array.isArray(payload.requests)) {
          throw new Error(
            payload.error ||
              'Não foi possível carregar os pedidos de subscrição.',
          );
        }
        const requestId = new URLSearchParams(window.location.search)
          .get('request_id')
          ?.trim();
        const requested = requestId
          ? (payload.requests.find((item) => item.id === requestId) ?? null)
          : null;

        const requests = payload.requests;
        setManualRequests(requests);
        setSelectedRequest(
          (current) =>
            requested ??
            (current
              ? (requests.find((item) => item.id === current.id) ?? null)
              : null),
        );
        if (requested) setPaymentLink(requested.payment_link ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro inesperado.');
      }
    };

    void loadPaymentMode();
    void loadRequests();
  }, [manualRequestFilter, requestsRefreshKey]);

  const searchResults = useMemo(() => data?.recentShops ?? [], [data]);

  const assignPlan = async () => {
    if (!selectedShop) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch('/api/silentra-admin/plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barbershopId: selectedShop.id,
          plan,
          reason,
          expiresAt: expiresAt || null,
        }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok)
        throw new Error(payload.error || 'Não foi possível atribuir o plano.');
      setMessage(
        `Plano ${plan.toUpperCase()} atribuído a ${selectedShop.name}.`,
      );
      await load(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setSaving(false);
    }
  };

  const clearPlan = async () => {
    if (!selectedShop) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/silentra-admin/plan?barbershopId=${encodeURIComponent(selectedShop.id)}`,
        { method: 'DELETE' },
      );
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok)
        throw new Error(
          payload.error || 'Não foi possível remover a atribuição.',
        );
      setMessage(`A atribuição manual de ${selectedShop.name} foi removida.`);
      await load(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setSaving(false);
    }
  };

  const changePaymentMode = async (nextMode: PaymentMode) => {
    if (nextMode === paymentMode || changingPaymentMode) return;

    const confirmed = window.confirm(
      nextMode === 'STRIPE'
        ? 'Tens a certeza que queres ativar os pagamentos Stripe? As novas subscrições utilizarão o checkout automático via Stripe. Subscrições existentes não serão migradas.'
        : 'Tens a certeza que queres ativar os pagamentos manuais? As novas subscrições utilizarão o fluxo manual. Subscrições Stripe existentes não serão migradas.',
    );
    if (!confirmed) return;

    try {
      setChangingPaymentMode(true);
      const response = await fetch('/api/silentra-admin/payment-mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMode: nextMode }),
      });
      const payload = (await response.json()) as {
        paymentMode?: PaymentMode;
        error?: string;
      };
      if (!response.ok || !payload.paymentMode)
        throw new Error(
          payload.error || 'Não foi possível alterar o método de pagamento.',
        );

      setPaymentMode(payload.paymentMode);
      setMessage(
        payload.paymentMode === 'STRIPE'
          ? 'Checkout automático via Stripe ativado para novas subscrições.'
          : 'Checkout manual ativado para novas subscrições.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setChangingPaymentMode(false);
    }
  };

  const runManualRequestAction = async (
    request: ManualRequest,
    action:
      | 'send_payment'
      | 'resend_payment'
      | 'confirm_payment'
      | 'create_renewal'
      | 'reject',
  ) => {
    try {
      setPaymentAction(true);
      setError(null);
      const response = await fetch(
        `/api/silentra-admin/subscription-requests/${encodeURIComponent(request.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            ...(action === 'send_payment' || action === 'resend_payment'
              ? { paymentLink }
              : action === 'reject'
                ? { reason: rejectReason }
                : {}),
          }),
        },
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.ok)
        throw new Error(
          payload.error || 'Não foi possível atualizar o pedido.',
        );

      setMessage(
        action === 'confirm_payment'
          ? 'Pagamento confirmado e subscrição ativada.'
          : action === 'create_renewal'
            ? 'Pedido de renovação criado.'
            : action === 'reject'
              ? 'Pedido rejeitado.'
              : action === 'resend_payment'
                ? 'Pagamento reenviado.'
                : 'Instruções de pagamento enviadas.',
      );

      const refresh = await fetch(
        `/api/silentra-admin/subscription-requests${manualRequestFilter === 'ALL' ? '' : `?status=${encodeURIComponent(manualRequestFilter)}`}`,
        { cache: 'no-store' },
      );
      const refreshed = (await refresh.json()) as {
        requests?: ManualRequest[];
      };
      const nextRequests = Array.isArray(refreshed.requests)
        ? refreshed.requests
        : [];
      setManualRequests(nextRequests);
      const nextSelected =
        nextRequests.find((item) => item.id === request.id) ?? null;
      setSelectedRequest(nextSelected);
      setPaymentLink(nextSelected?.payment_link ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setPaymentAction(false);
    }
  };

  const runHealth = async () => {
    const started = performance.now();
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      setHealth({
        status: response.status,
        latencyMs: Math.round(performance.now() - started),
        ok: response.ok,
      });
    } catch {
      setHealth({
        status: 0,
        latencyMs: Math.round(performance.now() - started),
        ok: false,
      });
    }
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setMessage('Copiado para a área de transferência.');
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <div className="mx-auto w-full max-w-[1500px] px-4 pb-16 pt-5 sm:px-6 lg:px-8">
        <header className="sticky top-3 z-20 mb-5 rounded-2xl border border-red-400/15 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-red-300">
                <ShieldCheck className="size-3.5" /> Internal / Platform Control
              </div>
              <div className="mt-2 flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Silentra Control Center
                </h1>
                <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-300">
                  Private
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
                Operação interna. Esta área não é exposta na navegação pública
                nem deve substituir as permissões normais das barbearias.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load(query)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-medium hover:bg-white/[0.08]"
            >
              <RefreshCw
                className={`size-4 ${loading ? 'animate-spin' : ''}`}
              />
              Atualizar
            </button>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map(({ id, label: label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (id === 'payment_requests') setManualRequestFilter('ALL');
                  setTab(id);
                }}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium ${tab === id ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/[0.025] text-zinc-500 hover:text-zinc-200'}`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </header>

        {message ? (
          <div className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {tab === 'overview' && data ? (
          <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Barbearias"
                value={data.stats.barbershops}
                meta="tenants"
              />
              <StatCard
                label="Utilizadores"
                value={data.stats.users}
                meta={`${data.stats.owners} owners · ${data.stats.barbers} barbeiros`}
              />
              <StatCard
                label="Clientes"
                value={data.stats.clients}
                meta="CRM por tenant"
              />
              <StatCard
                label="Bookings"
                value={data.stats.appointments}
                meta={`${data.stats.upcomingAppointments} futuros`}
                tone={data.stats.upcomingAppointments > 0 ? 'good' : 'default'}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Free"
                value={data.plans.free}
                meta="plano efetivo"
              />
              <StatCard
                label="Pro"
                value={data.plans.pro}
                meta="plano efetivo"
                tone="good"
              />
              <StatCard
                label="Enterprise"
                value={data.plans.enterprise}
                meta="plano efetivo"
                tone="good"
              />
              <StatCard
                label="Subscrições ativas"
                value={data.stats.activeSubscriptions}
                meta={`${data.stats.planAssignments} overrides`}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Receita manual · 30d"
                value={formatMoney(data.operations.manualRevenue30d)}
                meta={`${data.operations.paidManualRequests30d} pagamentos confirmados`}
                tone="good"
              />
              <StatCard
                label="Conversão manual · 30d"
                value={`${data.operations.manualConversion30d}%`}
                meta="pedidos → pagos"
                tone={
                  data.operations.manualConversion30d >= 50 ? 'good' : 'warn'
                }
              />
              <button
                type="button"
                onClick={() => {
                  setManualRequestFilter('ALL');
                  setTab('payment_requests');
                }}
                className="text-left"
              >
                <StatCard
                  label="Pedidos por tratar"
                  value={data.operations.openPaymentRequests}
                  meta={`${data.operations.paymentSentRequests} com pagamento enviado`}
                  tone={
                    data.operations.openPaymentRequests > 0 ? 'warn' : 'good'
                  }
                />
              </button>
              <StatCard
                label="Subscrições pagas"
                value={data.stats.activePaidSubscriptions}
                meta={`${data.operations.manualExpiring7d} manuais a expirar em 7d`}
                tone={data.operations.manualExpiring7d > 0 ? 'warn' : 'good'}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-emerald-300" />
                  <h2 className="font-semibold">Operação e crescimento</h2>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-white/8 bg-black/15 p-3">
                    <p className="text-[10px] uppercase text-zinc-600">
                      Novos tenants
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {data.operations.newShops7d}
                    </p>
                    <p className="text-[11px] text-zinc-600">últimos 7d</p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-black/15 p-3">
                    <p className="text-[10px] uppercase text-zinc-600">
                      Novos utilizadores
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {data.operations.newUsers7d}
                    </p>
                    <p className="text-[11px] text-zinc-600">últimos 7d</p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-black/15 p-3">
                    <p className="text-[10px] uppercase text-zinc-600">
                      Bookings próximos
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {data.operations.appointmentsNext7d}
                    </p>
                    <p className="text-[11px] text-zinc-600">próximos 7d</p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-black/15 p-3">
                    <p className="text-[10px] uppercase text-zinc-600">
                      Cancelamentos
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {data.operations.canceledSubscriptions30d}
                    </p>
                    <p className="text-[11px] text-zinc-600">últimos 30d</p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-amber-300" />
                  <h2 className="font-semibold">Atenção</h2>
                </div>
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setManualRequestFilter('PAYMENT_SENT');
                      setTab('payment_requests');
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-white/8 bg-black/15 p-3 text-left hover:border-white/15"
                  >
                    <span className="flex items-center gap-2 text-xs text-zinc-300">
                      <WalletCards className="size-4 text-amber-300" />
                      Pagamentos aguardam confirmação
                    </span>
                    <span className="font-semibold text-amber-200">
                      {data.operations.paymentSentRequests}
                    </span>
                  </button>
                  <div className="flex items-center justify-between rounded-xl border border-white/8 bg-black/15 p-3">
                    <span className="flex items-center gap-2 text-xs text-zinc-300">
                      <TimerReset className="size-4 text-amber-300" />
                      Manuais a expirar em 7d
                    </span>
                    <span className="font-semibold">
                      {data.operations.manualExpiring7d}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/8 bg-black/15 p-3">
                    <span className="flex items-center gap-2 text-xs text-zinc-300">
                      <MailWarning className="size-4 text-red-300" />
                      Pedidos com erro de email
                    </span>
                    <span className="font-semibold text-red-200">
                      {data.operations.emailFailures}
                    </span>
                  </div>
                </div>
              </section>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">Atividade recente</h2>
                    <p className="mt-1 text-xs text-zinc-600">
                      Últimas ações registadas na plataforma.
                    </p>
                  </div>
                  <ServerCog className="size-4 text-zinc-600" />
                </div>
                <div className="mt-4 space-y-1">
                  {data.activity.map((event) => (
                    <div
                      key={`${event.createdAt}-${activityActionLabel(event.action)}-${event.entityId ?? 'none'}`}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.02]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-zinc-200">
                          {activityActionLabel(event.action)}
                        </p>
                        <p className="truncate text-[10px] text-zinc-500">
                          {activityEntityLabel(event.entityType)}
                          {event.detail ? ` · ${event.detail}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] text-zinc-700">
                        {formatDate(event.createdAt)}
                      </span>
                    </div>
                  ))}
                  {data.activity.length === 0 ? (
                    <p className="py-6 text-center text-xs text-zinc-700">
                      Ainda não existem eventos.
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-300" />
                  <h2 className="font-semibold">Estado da plataforma</h2>
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    ['Admin identity', data.system.adminIdentityConfigured],
                    ['Email / Brevo', data.system.emailConfigured],
                    ['Stripe', data.system.stripeConfigured],
                    ['Preços manuais', data.system.manualPricingConfigured],
                    [
                      'Allowlist de pagamentos',
                      data.system.manualPaymentHostAllowlistConfigured,
                    ],
                  ].map(([label, ok]) => (
                    <div
                      key={String(label)}
                      className="flex items-center justify-between rounded-xl border border-white/8 bg-black/15 p-3"
                    >
                      <span className="text-xs text-zinc-400">{label}</span>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold ${ok ? 'bg-emerald-400/10 text-emerald-200' : 'bg-red-400/10 text-red-200'}`}
                      >
                        {ok ? 'OK' : 'Atenção'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">Barbearias recentes</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      Pesquisa por nome, slug ou ID.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('shops')}
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    Ver todas <ChevronRight className="inline size-3" />
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {data.recentShops.map((shop) => (
                    <button
                      key={shop.id}
                      type="button"
                      onClick={() => {
                        setSelectedShop(shop);
                        setTab('plans');
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/15 px-3 py-3 text-left hover:border-white/15"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-200">
                          {shop.name}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-zinc-600">
                          {shop.slug || shop.id}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${shop.plan === 'enterprise' ? 'bg-violet-400/10 text-violet-200' : shop.plan === 'pro' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-white/5 text-zinc-500'}`}
                      >
                        {shop.plan}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <Database className="size-4 text-emerald-300" />
                  <h2 className="font-semibold">System health</h2>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Health endpoint público de baixo risco.
                </p>
                <button
                  type="button"
                  onClick={() => void runHealth()}
                  className="mt-4 min-h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] text-sm hover:bg-white/[0.07]"
                >
                  Testar /api/health
                </button>
                {health ? (
                  <div className="mt-3 rounded-xl border border-white/8 bg-black/15 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span
                        className={
                          health.ok ? 'text-emerald-300' : 'text-red-300'
                        }
                      >
                        {health.ok ? 'Healthy' : 'Error'}
                      </span>
                      <span className="font-mono text-xs text-zinc-500">
                        {health.status} · {health.latencyMs}ms
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <p className="text-right text-[11px] text-zinc-700">
              Atualizado {formatDate(data.generatedAt)}
            </p>
          </section>
        ) : null}

        {tab === 'shops' ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Barbearias</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Pesquisa operacional por tenant.
                </p>
              </div>
              <div className="flex w-full gap-2 sm:max-w-xl">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void load(query);
                    }}
                    placeholder="Nome, slug ou ID…"
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 text-sm outline-none focus:border-emerald-400/30"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void load(query)}
                  className="min-h-11 shrink-0 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950"
                >
                  Pesquisar
                </button>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {searchResults.map((shop) => (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => {
                    setSelectedShop(shop);
                    setTab('plans');
                  }}
                  className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/15 px-4 py-3 text-left hover:border-white/15"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{shop.name}</p>
                    <p className="mt-1 truncate text-xs text-zinc-600">
                      {shop.slug || shop.id}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-700">
                      Criada {formatDate(shop.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase text-zinc-400">
                      {shop.plan}
                    </span>
                    <ChevronRight className="size-4 text-zinc-700" />
                  </div>
                </button>
              ))}
              {!loading && searchResults.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
                  Nenhuma barbearia encontrada.
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {tab === 'plans' ? (
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-emerald-300" />
                <h2 className="font-semibold">Atribuição de plano</h2>
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Concede acesso efetivo à barbearia sem alterar a subscrição
                Stripe. Pode ter expiração automática.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {(['free', 'pro', 'enterprise'] as Plan[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPlan(item)}
                    className={`rounded-xl border px-4 py-4 text-left ${plan === item ? 'border-emerald-400/30 bg-emerald-400/[0.08]' : 'border-white/10 bg-black/15'}`}
                  >
                    <div className="text-sm font-semibold uppercase">
                      {item}
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">
                      {item === 'free'
                        ? 'Acesso base'
                        : item === 'pro'
                          ? 'Funcionalidades Pro'
                          : 'Acesso Enterprise'}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-medium text-zinc-400">
                    Motivo
                  </span>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                    placeholder="Beta, compensação, suporte…"
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-emerald-400/30"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-medium text-zinc-400">
                    Expira em
                  </span>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-emerald-400/30"
                  />
                </label>
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={!selectedShop || saving}
                  onClick={() => void assignPlan()}
                  className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? 'A guardar…' : 'Atribuir plano'}
                </button>
                <button
                  type="button"
                  disabled={!selectedShop || saving}
                  onClick={() => void clearPlan()}
                  className="min-h-11 rounded-xl border border-red-400/15 bg-red-400/[0.05] px-4 text-sm font-semibold text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remover atribuição
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <h2 className="font-semibold">Barbearia selecionada</h2>
              {selectedShop ? (
                <>
                  <div className="mt-4 rounded-xl border border-white/8 bg-black/15 p-4">
                    <p className="font-medium">{selectedShop.name}</p>
                    <p className="mt-1 break-all text-xs text-zinc-600">
                      {selectedShop.id}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase text-zinc-600">
                          Plano efetivo
                        </p>
                        <p className="mt-1 text-sm font-semibold uppercase">
                          {selectedShop.plan}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase text-zinc-600">
                          Override
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {selectedShop.assigned ? 'Ativo' : 'Não'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copy(selectedShop.id)}
                      className="mt-3 inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-200"
                    >
                      <Copy className="size-3.5" />
                      Copiar ID
                    </button>
                  </div>
                  <p className="mt-4 text-[11px] leading-5 text-zinc-600">
                    A atribuição administrativa tem precedência enquanto estiver
                    válida. Quando expirar ou for removida, a resolução volta
                    para a subscrição normal.
                  </p>
                </>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-600">
                  Seleciona uma barbearia em Overview ou Barbearias.
                </div>
              )}
            </div>
          </section>
        ) : null}

        {tab === 'payments' ? (
          <section className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="size-4 text-emerald-300" />
                    <h2 className="text-lg font-semibold">
                      Método de pagamento
                    </h2>
                  </div>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
                    Controla qual método é usado por novas subscrições. Mudar
                    esta opção não migra nem cancela subscrições existentes.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  Atual: {paymentMode === 'MANUAL' ? 'Manual' : 'Stripe'}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {[
                  {
                    mode: 'MANUAL' as const,
                    title: 'Manual',
                    description:
                      'Novos clientes criam um pedido. A equipa envia o link e confirma o pagamento manualmente.',
                  },
                  {
                    mode: 'STRIPE' as const,
                    title: 'Automático (Stripe)',
                    description:
                      'Novas subscrições utilizam o checkout Stripe que já existe no projeto.',
                  },
                ].map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    disabled={paymentModeLoading || changingPaymentMode}
                    onClick={() => void changePaymentMode(item.mode)}
                    className={`rounded-2xl border p-5 text-left transition ${
                      paymentMode === item.mode
                        ? 'border-emerald-400/30 bg-emerald-400/[0.07]'
                        : 'border-white/10 bg-black/15 hover:border-white/20'
                    } disabled:cursor-wait disabled:opacity-60`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex size-9 items-center justify-center rounded-xl border ${
                            paymentMode === item.mode
                              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                              : 'border-white/10 bg-white/[0.03] text-zinc-500'
                          }`}
                        >
                          <CreditCard className="size-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">
                            {item.title}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {paymentMode === item.mode
                              ? 'Método atual'
                              : 'Selecionar método'}
                          </p>
                        </div>
                      </div>
                      {paymentMode === item.mode ? (
                        <CheckCircle2 className="size-4 text-emerald-300" />
                      ) : null}
                    </div>
                    <p className="mt-4 text-xs leading-5 text-zinc-500">
                      {item.description}
                    </p>
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-amber-400/10 bg-amber-400/[0.025] p-4 text-xs leading-5 text-amber-100/70">
                O método é aplicado apenas a novas subscrições. Uma subscrição
                manual continua manual e uma subscrição Stripe continua Stripe,
                mesmo depois de esta opção mudar.
              </div>
            </div>
          </section>
        ) : null}

        {tab === 'payment_requests' ? (
          <section className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <MailCheck className="size-4 text-emerald-300" />
                    <h2 className="text-lg font-semibold">
                      Pedidos de pagamento abertos
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Define o link de pagamento e envia-o diretamente para o
                    email do responsável pela barbearia.
                  </p>
                </div>
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                  {
                    manualRequests.filter(
                      (item) =>
                        item.status === 'PENDING' ||
                        item.status === 'PAYMENT_SENT',
                    ).length
                  }{' '}
                  abertos
                </span>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_440px]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Fila de pedidos</h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      Apenas pedidos que ainda precisam de tratamento.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRequestsRefreshKey((value) => value + 1)}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-zinc-300 hover:bg-white/[0.06]"
                  >
                    <RefreshCw className="size-3.5" />
                    Atualizar
                  </button>
                </div>

                <div className="mt-5 space-y-2">
                  {manualRequests
                    .filter(
                      (request) =>
                        request.status === 'PENDING' ||
                        request.status === 'PAYMENT_SENT',
                    )
                    .map((request) => (
                      <button
                        key={request.id}
                        type="button"
                        onClick={() => {
                          setSelectedRequest(request);
                          setPaymentLink(request.payment_link ?? '');
                          setRejectReason('');
                        }}
                        className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                          selectedRequest?.id === request.id
                            ? 'border-emerald-400/30 bg-emerald-400/[0.06]'
                            : 'border-white/8 bg-black/15 hover:border-white/15'
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zinc-100">
                              {request.customer?.name_complete ||
                                request.customer?.email ||
                                'Cliente'}
                            </p>
                            <p className="mt-1 truncate text-xs text-zinc-500">
                              {request.barbershop?.name ||
                                request.barbershop_id}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-200">
                              {formatMoney(request.price, request.currency)}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                request.status === 'PAYMENT_SENT'
                                  ? 'bg-blue-400/10 text-blue-200'
                                  : 'bg-amber-400/10 text-amber-200'
                              }`}
                            >
                              {request.status === 'PAYMENT_SENT'
                                ? 'LINK ENVIADO'
                                : 'AGUARDA LINK'}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-600">
                          <span>
                            {request.plan === 'enterprise'
                              ? 'Enterprise'
                              : 'Pro'}
                          </span>
                          <span>·</span>
                          <span>
                            {request.billing_interval === 'year'
                              ? 'Anual'
                              : 'Mensal'}
                          </span>
                          <span>·</span>
                          <span>{formatDate(request.created_at)}</span>
                        </div>
                      </button>
                    ))}

                  {manualRequests.filter(
                    (request) =>
                      request.status === 'PENDING' ||
                      request.status === 'PAYMENT_SENT',
                  ).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
                      <CheckCircle2 className="mx-auto size-8 text-emerald-300/60" />
                      <p className="mt-3 text-sm font-medium text-zinc-300">
                        Não existem pedidos de pagamento abertos.
                      </p>
                      <p className="mt-1 text-xs text-zinc-600">
                        Quando um cliente pedir uma subscrição manual, o pedido
                        aparece aqui.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Enviar pagamento</h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      O email é enviado para o responsável associado ao pedido.
                    </p>
                  </div>
                  {selectedRequest ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-zinc-500">
                      {selectedRequest.status}
                    </span>
                  ) : null}
                </div>

                {selectedRequest ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                      <p className="text-sm font-semibold text-zinc-100">
                        {selectedRequest.barbershop?.name ||
                          'Barbearia sem nome'}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {selectedRequest.customer?.name_complete ||
                          'Responsável'}
                      </p>
                      <p className="mt-1 break-all text-xs text-zinc-600">
                        {selectedRequest.customer?.email || 'Sem email'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.025] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-zinc-200">
                            Dados enviados no checkout
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-600">
                            Snapshot preenchido pelo cliente no momento do
                            pedido.
                          </p>
                        </div>
                        {selectedRequest.submitted_at ? (
                          <span className="text-[10px] text-zinc-600">
                            {formatDate(selectedRequest.submitted_at)}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                            Faturação
                          </p>
                          <p className="mt-1 text-xs text-zinc-300">
                            {selectedRequest.billing_name || '—'}
                          </p>
                          <p className="mt-0.5 break-all text-xs text-zinc-500">
                            {selectedRequest.billing_email || '—'}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {selectedRequest.tax_id || 'Sem NIF/VAT'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                            Contacto
                          </p>
                          <p className="mt-1 text-xs text-zinc-300">
                            {selectedRequest.phone || '—'}
                          </p>
                          <p className="mt-0.5 break-all text-xs text-zinc-500">
                            {selectedRequest.website || 'Sem website'}
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                            Morada
                          </p>
                          <p className="mt-1 text-xs text-zinc-300">
                            {[
                              selectedRequest.address_line1,
                              selectedRequest.address_line2,
                            ]
                              .filter(Boolean)
                              .join(', ') || '—'}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {[
                              selectedRequest.postal_code,
                              selectedRequest.city,
                              selectedRequest.country,
                            ]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                            Operação
                          </p>
                          <p className="mt-1 text-xs text-zinc-300">
                            {selectedRequest.business_type || '—'} ·{' '}
                            {selectedRequest.location_count ?? '—'} localizações
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {selectedRequest.team_size ?? '—'} elementos na
                            equipa
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                            Mensagem
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-zinc-400">
                            {selectedRequest.customer_message ||
                              'Sem mensagem adicional.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-white/8 bg-black/15 p-3">
                        <p className="text-[10px] uppercase tracking-wide text-zinc-600">
                          Plano
                        </p>
                        <p className="mt-1 text-sm font-semibold uppercase text-zinc-200">
                          {selectedRequest.plan}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-black/15 p-3">
                        <p className="text-[10px] uppercase tracking-wide text-zinc-600">
                          Valor
                        </p>
                        <p className="mt-1 text-sm font-semibold text-zinc-200">
                          {formatMoney(
                            selectedRequest.price,
                            selectedRequest.currency,
                          )}
                        </p>
                      </div>
                    </div>

                    <label className="block space-y-2">
                      <span className="text-xs font-medium text-zinc-300">
                        Link de pagamento
                      </span>
                      <input
                        value={paymentLink}
                        onChange={(event) => setPaymentLink(event.target.value)}
                        placeholder="https://..."
                        inputMode="url"
                        autoComplete="off"
                        maxLength={2048}
                        disabled={paymentAction}
                        className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10 disabled:opacity-50"
                      />
                      <p className="text-[11px] leading-5 text-zinc-600">
                        O servidor valida o URL antes de o guardar e enviar. O
                        cliente nunca pode escolher o preço deste pedido.
                      </p>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-medium text-zinc-300">
                        Nota interna para rejeição (opcional)
                      </span>
                      <textarea
                        value={rejectReason}
                        onChange={(event) =>
                          setRejectReason(event.target.value)
                        }
                        maxLength={500}
                        rows={3}
                        placeholder="Ex.: pagamento não identificado, dados incorretos…"
                        disabled={paymentAction}
                        className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-red-400/30 disabled:opacity-50"
                      />
                    </label>

                    {selectedRequest.last_email_error ? (
                      <div className="rounded-xl border border-red-400/15 bg-red-400/[0.05] p-3 text-xs leading-5 text-red-200">
                        Último erro de email: {selectedRequest.last_email_error}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      disabled={
                        paymentAction ||
                        !paymentLink.trim() ||
                        !['PENDING', 'PAYMENT_SENT'].includes(
                          selectedRequest.status,
                        )
                      }
                      onClick={() =>
                        void runManualRequestAction(
                          selectedRequest,
                          selectedRequest.status === 'PAYMENT_SENT'
                            ? 'resend_payment'
                            : 'send_payment',
                        )
                      }
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <MailCheck className="size-4" />
                      {selectedRequest.status === 'PAYMENT_SENT'
                        ? 'Reenviar email com o link'
                        : 'Enviar email com o link'}
                    </button>

                    {selectedRequest.payment_link ? (
                      <a
                        href={selectedRequest.payment_link}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-xs text-zinc-600 hover:text-zinc-300"
                      >
                        Abrir link atual
                      </a>
                    ) : null}

                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={
                          paymentAction ||
                          selectedRequest.status !== 'PAYMENT_SENT'
                        }
                        onClick={() =>
                          void runManualRequestAction(
                            selectedRequest,
                            'confirm_payment',
                          )
                        }
                        className="min-h-11 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/[0.1] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Confirmar pagamento
                      </button>
                      <button
                        type="button"
                        disabled={
                          paymentAction ||
                          !['PENDING', 'PAYMENT_SENT'].includes(
                            selectedRequest.status,
                          )
                        }
                        onClick={() =>
                          void runManualRequestAction(selectedRequest, 'reject')
                        }
                        className="min-h-11 rounded-xl border border-red-400/15 bg-red-400/[0.05] px-4 text-sm font-semibold text-red-200 transition hover:bg-red-400/[0.1] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Rejeitar pedido
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-12 text-center">
                    <MailCheck className="mx-auto size-8 text-zinc-700" />
                    <p className="mt-3 text-sm font-medium text-zinc-400">
                      Seleciona um pedido na fila.
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      Depois cola o link de pagamento e envia o email.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {tab === 'subscriptions' ? (
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Pedidos de subscrição
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Pedidos do fluxo de pagamento manual e respetivo histórico.
                  </p>
                </div>
                <select
                  value={manualRequestFilter}
                  onChange={(event) =>
                    setManualRequestFilter(
                      event.target.value as 'ALL' | ManualRequest['status'],
                    )
                  }
                  className="h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-zinc-200 outline-none"
                >
                  <option value="ALL">Todos</option>
                  <option value="PENDING">Pendentes</option>
                  <option value="PAYMENT_SENT">Pagamento enviado</option>
                  <option value="PAID">Pagos</option>
                  <option value="REJECTED">Rejeitados</option>
                  <option value="EXPIRED">Expirados</option>
                  <option value="CANCELLED">Cancelados</option>
                </select>
              </div>

              <div className="mt-5 space-y-2">
                {manualRequests.map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => {
                      setSelectedRequest(request);
                      setPaymentLink(request.payment_link ?? '');
                    }}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      selectedRequest?.id === request.id
                        ? 'border-emerald-400/30 bg-emerald-400/[0.06]'
                        : 'border-white/8 bg-black/15 hover:border-white/15'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-100">
                          {request.customer?.name_complete ||
                            request.customer?.email ||
                            'Cliente'}
                        </p>
                        <p className="mt-1 truncate text-xs text-zinc-500">
                          {request.barbershop?.name || request.barbershop_id} ·{' '}
                          {request.plan === 'enterprise' ? 'Enterprise' : 'Pro'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-200">
                          {formatMoney(request.price, request.currency)}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                            request.status === 'PAID'
                              ? 'bg-emerald-400/10 text-emerald-200'
                              : request.status === 'REJECTED' ||
                                  request.status === 'EXPIRED'
                                ? 'bg-red-400/10 text-red-200'
                                : 'bg-amber-400/10 text-amber-200'
                          }`}
                        >
                          {request.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-zinc-600">
                      {request.request_type} · {formatDate(request.created_at)}
                    </p>
                  </button>
                ))}
                {manualRequests.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-600">
                    Não existem pedidos neste filtro.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <h2 className="font-semibold">Detalhes</h2>
              {selectedRequest ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border border-white/8 bg-black/15 p-4">
                    <p className="text-sm font-semibold text-zinc-100">
                      {selectedRequest.customer?.name_complete || 'Cliente'}
                    </p>
                    <p className="mt-1 break-all text-xs text-zinc-500">
                      {selectedRequest.customer?.email || 'Sem email'}
                    </p>
                    <p className="mt-3 text-xs text-zinc-500">
                      {selectedRequest.barbershop?.name ||
                        selectedRequest.barbershop_id}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/8 bg-black/15 p-3">
                      <p className="text-[10px] uppercase text-zinc-600">
                        Plano
                      </p>
                      <p className="mt-1 text-sm font-semibold uppercase">
                        {selectedRequest.plan}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-black/15 p-3">
                      <p className="text-[10px] uppercase text-zinc-600">
                        Estado
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {selectedRequest.status}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-black/15 p-3">
                      <p className="text-[10px] uppercase text-zinc-600">
                        Preço
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatMoney(
                          selectedRequest.price,
                          selectedRequest.currency,
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-black/15 p-3">
                      <p className="text-[10px] uppercase text-zinc-600">
                        Período
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {selectedRequest.billing_interval === 'year'
                          ? 'Anual'
                          : 'Mensal'}
                      </p>
                    </div>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-xs font-medium text-zinc-400">
                      Link de pagamento
                    </span>
                    <input
                      value={paymentLink}
                      onChange={(event) => setPaymentLink(event.target.value)}
                      placeholder="https://..."
                      maxLength={2048}
                      disabled={
                        paymentAction ||
                        !['PENDING', 'PAYMENT_SENT'].includes(
                          selectedRequest.status,
                        )
                      }
                      className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-emerald-400/30 disabled:opacity-50"
                    />
                  </label>

                  {selectedRequest.last_email_error ? (
                    <div className="rounded-xl border border-red-400/15 bg-red-400/[0.05] p-3 text-xs leading-5 text-red-200">
                      Último erro de email: {selectedRequest.last_email_error}
                    </div>
                  ) : null}

                  {selectedRequest.payment_link ? (
                    <a
                      href={selectedRequest.payment_link}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-xs text-zinc-500 hover:text-zinc-200"
                    >
                      {selectedRequest.payment_link}
                    </a>
                  ) : null}

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={
                        paymentAction ||
                        !['PENDING', 'PAYMENT_SENT'].includes(
                          selectedRequest.status,
                        ) ||
                        !paymentLink.trim()
                      }
                      onClick={() =>
                        void runManualRequestAction(
                          selectedRequest,
                          selectedRequest.status === 'PAYMENT_SENT'
                            ? 'resend_payment'
                            : 'send_payment',
                        )
                      }
                      className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {selectedRequest.status === 'PAYMENT_SENT'
                        ? 'Reenviar pagamento'
                        : 'Enviar pagamento'}
                    </button>
                    <button
                      type="button"
                      disabled={
                        paymentAction ||
                        selectedRequest.status !== 'PAYMENT_SENT'
                      }
                      onClick={() =>
                        void runManualRequestAction(
                          selectedRequest,
                          'confirm_payment',
                        )
                      }
                      className="min-h-11 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Confirmar pagamento
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={
                        paymentAction ||
                        !['PAID', 'EXPIRED'].includes(selectedRequest.status)
                      }
                      onClick={() => {
                        if (
                          window.confirm(
                            'Criar um novo pedido de renovação para este plano?',
                          )
                        )
                          void runManualRequestAction(
                            selectedRequest,
                            'create_renewal',
                          );
                      }}
                      className="min-h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Criar renovação
                    </button>
                    <button
                      type="button"
                      disabled={
                        paymentAction ||
                        !['PENDING', 'PAYMENT_SENT'].includes(
                          selectedRequest.status,
                        )
                      }
                      onClick={() =>
                        void runManualRequestAction(selectedRequest, 'reject')
                      }
                      className="min-h-11 rounded-xl border border-red-400/15 bg-red-400/[0.05] px-4 text-sm font-semibold text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Rejeitar pedido
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-600">
                  Seleciona um pedido para gerir o pagamento.
                </div>
              )}
            </div>
          </section>
        ) : null}

        {tab === 'observability' ? <ObservabilityPanel /> : null}

        {tab === 'diagnostics' ? (
          <section className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-emerald-300" />
                <h2 className="font-semibold">Quick checks</h2>
              </div>
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => void runHealth()}
                  className="flex min-h-11 w-full items-center justify-between rounded-xl border border-white/10 bg-black/15 px-4 text-sm hover:bg-white/[0.04]"
                >
                  <span>GET /api/health</span>
                  <span>
                    {health
                      ? `${health.status} · ${health.latencyMs}ms`
                      : 'Executar'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void load(query)}
                  className="flex min-h-11 w-full items-center justify-between rounded-xl border border-white/10 bg-black/15 px-4 text-sm hover:bg-white/[0.04]"
                >
                  <span>Admin overview query</span>
                  <span>{loading ? 'A executar…' : 'Executar'}</span>
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-amber-400/10 bg-amber-400/[0.025] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-amber-300" />
                <h2 className="font-semibold">Segurança</h2>
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Este painel não aparece na navbar, não é indexável e todas as
                rotas internas repetem a validação do administrador no servidor.
              </p>
              <div className="mt-4 space-y-2 text-xs text-zinc-500">
                <p>
                  <span className="text-zinc-300">Auth:</span> sessão Supabase
                  obrigatória
                </p>
                <p>
                  <span className="text-zinc-300">Allowlist:</span>{' '}
                  SILENTRA_PLATFORM_ADMIN_USER_ID / EMAIL
                </p>
                <p>
                  <span className="text-zinc-300">Secrets:</span> nunca expostos
                  ao browser
                </p>
                <p>
                  <span className="text-zinc-300">Mutations:</span> apenas via
                  API interna autenticada
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
