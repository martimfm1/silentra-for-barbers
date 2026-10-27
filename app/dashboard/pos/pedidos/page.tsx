'use client';

import { useDashboardConfirm } from '@/components/dashboard/dashboard-confirm-provider';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ClipboardList,
  Clock3,
  Mail,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  Send,
  Truck,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

type Item = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
};

type Event = {
  id: string;
  previous_status: string | null;
  new_status: string;
  source: string;
  customer_message: string | null;
  created_at: string;
};

type Status =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled';

type Order = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
  subtotal: number;
  total: number;
  fulfillment_method: 'pickup' | 'delivery';
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  status: Status;
  created_at: string;
  marketplace_order_items: Item[];
  marketplace_order_events?: Event[];
};

const money = (n: number, locale: string) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(n) || 0);

const statusMeta: Record<
  Status,
  { label: string; icon: typeof Clock3; classes: string }
> = {
  pending: {
    label: 'Recebida',
    icon: Clock3,
    classes: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
  },
  confirmed: {
    label: 'Confirmada',
    icon: Check,
    classes: 'bg-sky-400/10 text-sky-300 border-sky-400/20',
  },
  preparing: {
    label: 'Em preparação',
    icon: Clock3,
    classes: 'bg-violet-400/10 text-violet-300 border-violet-400/20',
  },
  ready: {
    label: 'Pronta',
    icon: PackageCheck,
    classes: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
  },
  shipped: {
    label: 'Enviada',
    icon: Truck,
    classes: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/20',
  },
  delivered: {
    label: 'Entregue',
    icon: Check,
    classes: 'bg-teal-400/10 text-teal-300 border-teal-400/20',
  },
  completed: {
    label: 'Concluída',
    icon: ClipboardList,
    classes: 'bg-zinc-400/10 text-zinc-300 border-zinc-400/20',
  },
  cancelled: {
    label: 'Cancelada',
    icon: XCircle,
    classes: 'bg-rose-400/10 text-rose-300 border-rose-400/20',
  },
};

const nextStatus = (order: Order): Status | null => {
  if (order.status === 'pending') return 'confirmed';
  if (order.status === 'confirmed') return 'preparing';
  if (order.status === 'preparing') return 'ready';
  if (order.status === 'ready')
    return order.fulfillment_method === 'delivery' ? 'shipped' : 'completed';
  if (order.status === 'shipped') return 'delivered';
  if (order.status === 'delivered') return 'completed';
  return null;
};

const canCancel = (status: Status) =>
  ['pending', 'confirmed', 'preparing', 'ready'].includes(status);

export default function MarketplaceOrdersPage() {
  const confirm = useDashboardConfirm();
  const { locale, t } = useLanguage();
  const formatLocale = locale === 'pt' ? 'pt-PT' : 'en-GB';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | Status>('all');
  const [fulfillment, setFulfillment] = useState<
    'all' | Order['fulfillment_method']
  >('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const [emailOrder, setEmailOrder] = useState<Order | null>(null);
  const [emailSubject, setEmailSubject] = useState(
    t('orderManagement.updateSubject'),
  );
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch('/api/marketplace/orders', {
        cache: 'no-store',
      });
      const json = await response.json();
      if (!response.ok) throw new Error(t('orderManagement.loadError'));
      setOrders(json.orders ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('orderManagement.loadError'),
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [locale]);

  const filtered = useMemo(() => {
    const term = query
      .trim()
      .toLocaleLowerCase(locale === 'pt' ? 'pt-PT' : 'en-GB');
    return orders.filter((order) => {
      const text =
        `${order.id} ${order.customer_name} ${order.customer_email} ${order.customer_phone}`.toLocaleLowerCase(
          'pt-PT',
        );
      return (
        (!term || text.includes(term)) &&
        (status === 'all' || order.status === status) &&
        (fulfillment === 'all' || order.fulfillment_method === fulfillment)
      );
    });
  }, [orders, query, status, fulfillment, locale]);

  const stats = useMemo(
    () => ({
      open: orders.filter((order) =>
        ['pending', 'confirmed', 'preparing', 'ready'].includes(order.status),
      ).length,
      delivery: orders.filter(
        (order) =>
          order.fulfillment_method === 'delivery' &&
          !['cancelled', 'completed'].includes(order.status),
      ).length,
      orderValue: orders
        .filter((order) => order.status !== 'cancelled')
        .reduce((sum, order) => sum + Number(order.total), 0),
      completed: orders.filter((order) =>
        ['completed', 'delivered'].includes(order.status),
      ).length,
    }),
    [orders],
  );

  async function changeStatus(order: Order, next: Status) {
    if (next === 'cancelled') {
      const confirmed = await confirm({
        title: t('orderPage.cancelTitle'),
        description: t('orderManagement.cancelOrderConfirm', {
          reference: order.id.slice(0, 8),
          customer: order.customer_name,
        }),
        confirmLabel: t('orderPage.cancelAction'),
        destructive: true,
      });
      if (!confirmed) return;
    }

    setUpdating(order.id);
    try {
      const response = await fetch(`/api/marketplace/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(t('orderManagement.updateError'));
      setOrders((current) =>
        current.map((item) =>
          item.id === order.id
            ? {
                ...item,
                ...json.order,
                marketplace_order_events: [
                  ...(item.marketplace_order_events ?? []),
                  ...(json.order?.marketplace_order_events ?? []),
                ],
              }
            : item,
        ),
      );
      toast.success(
        next === 'cancelled'
          ? 'Encomenda cancelada.'
          : `Encomenda marcada como ${t('orderManagement.status.' + next).toLowerCase()}.`,
      );
      await load(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('orderManagement.updateError'),
      );
    } finally {
      setUpdating(null);
    }
  }

  function openEmail(order: Order) {
    setEmailOrder(order);
    setEmailSubject(
      order.status === 'ready'
        ? t('orderManagement.readySubject')
        : t('orderManagement.updateSubject'),
    );
    setEmailMessage(
      order.status === 'ready'
        ? t('orderManagement.readyMessage')
        : t('orderManagement.updateMessage', {
            reference: order.id.slice(0, 8),
          }),
    );
  }

  async function sendEmail() {
    if (!emailOrder) return;
    setSendingEmail(true);
    try {
      const response = await fetch(
        `/api/marketplace/orders/${emailOrder.id}/email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: emailSubject,
            message: emailMessage,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(t('orderManagement.emailError'));
      toast.success('Email enviado ao cliente.');
      setEmailOrder(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('orderManagement.emailError'),
      );
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-clip px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <Link
              href="/dashboard/pos"
              className="inline-flex min-h-10 items-center gap-2 text-sm text-zinc-500 hover:text-white"
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Voltar ao
              ponto de venda
            </Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
              {t('orderPage.sales')}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              {t('orderPage.orders')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Acompanha cada encomenda desde a receção até à entrega, com o
              histórico da atividade num só lugar.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
            className="min-h-11 shrink-0"
          >
            <RefreshCw
              className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />{' '}
            Atualizar
          </Button>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Summary
            icon={Clock3}
            label={t('orderManagement.open')}
            value={String(stats.open)}
            detail={t('orderManagement.needsAction')}
          />
          <Summary
            icon={Truck}
            label={t('orderManagement.toShip')}
            value={String(stats.delivery)}
            detail={t('orderManagement.inDelivery')}
          />
          <Summary
            icon={ClipboardList}
            label={t('orderManagement.orderValue')}
            value={money(stats.orderValue, formatLocale)}
            detail={t('orderManagement.notCancelled')}
          />
          <Summary
            icon={Check}
            label={t('orderManagement.completed')}
            value={String(stats.completed)}
            detail={t('orderManagement.deliveredOrCompleted')}
          />
        </div>

        <Card className="glassmorphism border-white/10">
          <CardContent className="p-3">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600"
                  aria-hidden="true"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('orderManagement.searchPlaceholder')}
                  className="min-h-11 border-white/10 bg-white/[0.03] pl-9"
                  aria-label={t('orderManagement.searchOrders')}
                />
              </div>
              <select
                value={fulfillment}
                onChange={(event) =>
                  setFulfillment(
                    event.target.value as 'all' | Order['fulfillment_method'],
                  )
                }
                aria-label={t('orderManagement.filterFulfillment')}
                className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm"
              >
                <option value="all">
                  {t('orderManagement.allFulfillment')}
                </option>
                <option value="pickup">{t('orderManagement.pickup')}</option>
                <option value="delivery">
                  {t('orderManagement.delivery')}
                </option>
              </select>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as 'all' | Status)
                }
                aria-label={t('orderManagement.filterStatus')}
                className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm"
              >
                <option value="all">{t('orderManagement.allStatuses')}</option>
                {Object.entries(statusMeta).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {t('orderManagement.status.' + key)}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-56 animate-pulse rounded-3xl bg-white/[0.03]"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glassmorphism rounded-3xl border border-dashed border-white/10 p-14 text-center">
            <ClipboardList
              className="mx-auto size-7 text-zinc-700"
              aria-hidden="true"
            />
            <p className="mt-4 text-sm text-zinc-500">
              {t('orderManagement.empty')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((order) => {
              const meta = statusMeta[order.status];
              const Icon = meta.icon;
              const next = nextStatus(order);
              const isDelivery = order.fulfillment_method === 'delivery';
              const events = [...(order.marketplace_order_events ?? [])].sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime(),
              );
              return (
                <Card
                  key={order.id}
                  className="glassmorphism overflow-hidden border-white/10"
                >
                  <CardHeader className="border-b border-white/[0.06] p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${meta.classes}`}
                          >
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <CardTitle className="text-base">
                            {order.customer_name}
                          </CardTitle>
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold text-zinc-400">
                            {isDelivery
                              ? t('orderManagement.delivery')
                              : t('orderManagement.pickup')}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${meta.classes}`}
                          >
                            {t('orderManagement.status.' + order.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-zinc-500">
                          {t('orderPage.order')}{' '}
                          <span className="font-mono text-zinc-400">
                            #{order.id.slice(0, 8)}
                          </span>{' '}
                          ·{' '}
                          {new Date(order.created_at).toLocaleString(
                            formatLocale,
                          )}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 p-4 sm:p-5">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          {order.marketplace_order_items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.055] bg-white/[0.02] p-3 text-sm"
                            >
                              <span className="min-w-0 truncate">
                                <strong>{item.product_name}</strong>
                                <span className="ml-2 text-xs text-zinc-600">
                                  × {item.quantity}
                                </span>
                              </span>
                              <span className="shrink-0 font-semibold">
                                {money(item.total, formatLocale)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">
                              Cliente
                            </p>
                            <a
                              className="mt-2 flex items-center gap-2 text-sm text-zinc-200 hover:text-emerald-300"
                              href={`mailto:${order.customer_email}`}
                            >
                              <Mail className="size-3.5" aria-hidden="true" />
                              {order.customer_email}
                            </a>
                            <p className="mt-1 text-sm text-zinc-400">
                              {order.customer_phone}
                            </p>
                          </div>
                          {isDelivery && (
                            <div className="rounded-2xl border border-sky-400/10 bg-sky-400/[0.03] p-4">
                              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-sky-300">
                                <MapPin
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                                Morada
                              </p>
                              <p className="mt-2 text-sm leading-6 text-zinc-300">
                                {order.shipping_address}
                                <br />
                                {order.shipping_postal_code}{' '}
                                {order.shipping_city}
                              </p>
                            </div>
                          )}
                        </div>

                        {order.notes && (
                          <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.03] p-3 text-xs leading-5 text-amber-100">
                            <strong>{t('orderPage.note')}</strong> {order.notes}
                          </div>
                        )}
                      </div>

                      <aside className="space-y-3 xl:border-l xl:border-white/[0.06] xl:pl-4">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-500">Total</span>
                            <strong className="text-xl">
                              {money(order.total, formatLocale)}
                            </strong>
                          </div>
                        </div>
                        {events.length > 0 && (
                          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">
                              {t('orderPage.history')}
                            </p>
                            <div className="mt-3 space-y-3">
                              {events.map((event) => (
                                <div
                                  key={event.id}
                                  className="relative pl-4 text-xs before:absolute before:left-0 before:top-1.5 before:size-1.5 before:rounded-full before:bg-emerald-300"
                                >
                                  <p className="font-medium text-zinc-300">
                                    {t(
                                      'orderManagement.status.' +
                                        event.new_status,
                                    )}
                                  </p>
                                  <p className="mt-0.5 text-zinc-600">
                                    {new Date(event.created_at).toLocaleString(
                                      formatLocale,
                                    )}
                                  </p>
                                  {event.source === 'manual_email' && (
                                    <p className="mt-1 text-zinc-500">
                                      Email enviado ao cliente
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </aside>
                    </div>

                    <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-4 sm:flex-row sm:justify-end">
                      {next && (
                        <Button
                          disabled={updating === order.id}
                          onClick={() => void changeStatus(order, next)}
                          className="min-h-11 bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                        >
                          {next === 'confirmed'
                            ? 'Confirmar encomenda'
                            : next === 'preparing'
                              ? t('orderManagement.startPreparing')
                              : next === 'ready'
                                ? 'Marcar como pronta'
                                : next === 'shipped'
                                  ? 'Marcar como enviada'
                                  : next === 'delivered'
                                    ? 'Marcar como entregue'
                                    : t('orderManagement.markCompleted')}
                        </Button>
                      )}
                      {canCancel(order.status) && (
                        <Button
                          variant="outline"
                          disabled={updating === order.id}
                          onClick={() => void changeStatus(order, 'cancelled')}
                          className="min-h-11 text-rose-300 hover:text-rose-200"
                        >
                          <XCircle className="mr-2 size-4" aria-hidden="true" />
                          Cancelar
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        disabled={sendingEmail && emailOrder?.id === order.id}
                        onClick={() => openEmail(order)}
                        className="min-h-11"
                      >
                        <Mail className="mr-2 size-4" aria-hidden="true" />
                        Enviar email ao cliente
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {emailOrder && (
        <div
          className="fixed inset-0 z-[250] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="send-order-email-title"
        >
          <div className="glassmorphism w-full max-w-lg rounded-t-[1.5rem] border border-white/10 p-5 sm:rounded-[1.5rem] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  {t('orderManagement.communication')}
                </p>
                <h2
                  id="send-order-email-title"
                  className="mt-2 text-xl font-semibold"
                >
                  Enviar email ao cliente
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {emailOrder.customer_name} · {emailOrder.customer_email}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setEmailOrder(null)}
                className="min-h-10"
              >
                Fechar
              </Button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="grid gap-1.5 text-xs text-zinc-400">
                <span>{t('orderPage.subject')}</span>
                <Input
                  value={emailSubject}
                  onChange={(event) => setEmailSubject(event.target.value)}
                  maxLength={180}
                />
              </label>
              <label className="grid gap-1.5 text-xs text-zinc-400">
                <span>{t('orderPage.message')}</span>
                <textarea
                  value={emailMessage}
                  onChange={(event) => setEmailMessage(event.target.value)}
                  maxLength={5000}
                  rows={7}
                  className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                />
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setEmailOrder(null)}
                  className="min-h-11"
                >
                  Cancelar
                </Button>
                <Button
                  disabled={
                    sendingEmail ||
                    emailSubject.trim().length < 3 ||
                    emailMessage.trim().length < 3
                  }
                  onClick={() => void sendEmail()}
                  className="min-h-11"
                >
                  <Send className="mr-2 size-4" aria-hidden="true" />
                  {sendingEmail ? 'A enviar…' : 'Enviar email'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="glassmorphism border-white/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">{label}</span>
          <Icon className="size-4 text-zinc-600" aria-hidden="true" />
        </div>
        <p className="mt-3 text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-[11px] text-zinc-600">{detail}</p>
      </CardContent>
    </Card>
  );
}
