'use client';

import { useDashboardConfirm } from '@/components/dashboard/dashboard-confirm-provider';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Lock,
  Minus,
  Plus,
  Receipt,
  RefreshCcw,
  Search,
  ShoppingCart,
  Trash2,
  Undo2,
  RotateCcw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type Product = {
  id: string;
  name: string;
  unit_price: number;
  stock_quantity: number;
  active: boolean;
};
type Service = { id: string; name: string; price: number; duration: number };
type Client = {
  id: string;
  name_complete: string;
  email: string | null;
  num_phone: string | null;
};
type CartItem = {
  key: string;
  productId: string | null;
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  maxStock?: number;
};
type PosItem = {
  id: string;
  product_id?: string | null;
  service_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
};
type Transaction = {
  id: string;
  status: string;
  payment_method: string;
  subtotal: number;
  discount: number;
  total: number;
  created_at: string;
  pos_transaction_items?: PosItem[];
};

async function authHeaders(t: (key: string) => string) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token)
    throw new Error(t('posPage.sessionExpired'));
  return { Authorization: `Bearer ${session.access_token}` };
}

const money = (value: number, locale: 'pt' | 'en' = 'pt') =>
  new Intl.NumberFormat(locale === 'pt' ? 'pt-PT' : 'en-IE', { style: 'currency', currency: 'EUR' }).format(
    Number(value) || 0,
  );

export default function POSPage() {
  const { t, locale } = useLanguage();
  const confirm = useDashboardConfirm();
  const { hasFeature, loading: billingLoading } = useFeatureAccess();
  const allowed = hasFeature('pos');
  const searchParams = useSearchParams();
  const repeatedTransactionId = searchParams.get('repeat');
  const repeatedRef = useRef<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reversing, setReversing] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const supabase = createClient();
      const [
        { data: productRows, error: productsError },
        { data: serviceRows, error: servicesError },
        { data: clientRows, error: clientsError },
      ] = await Promise.all([
        supabase
          .from('inventory_products')
          .select('id,name,unit_price,stock_quantity,active')
          .eq('active', true)
          .order('name'),
        supabase
          .from('services')
          .select('id,name,price,duration')
          .order('name'),
        supabase
          .from('users')
          .select('id,name_complete,email,num_phone')
          .order('name_complete')
          .limit(500),
      ]);
      if (productsError || servicesError || clientsError)
        throw new Error(t('posPage.loadCatalogError'));
      setProducts(productRows ?? []);
      setServices(serviceRows ?? []);
      setClients(clientRows ?? []);

      const response = await fetch('/api/enterprise/pos', {
        headers: await authHeaders(t),
        cache: 'no-store',
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error ?? t('posPage.loadHistoryError'));
      setTransactions(json.transactions ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('posPage.posGenericError'),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!billingLoading && allowed) void loadData();
  }, [billingLoading, allowed]);

  const filteredProducts = useMemo(
    () =>
      products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [products, search],
  );
  const filteredServices = useMemo(
    () =>
      services.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [services, search],
  );
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [cart],
  );
  const appliedDiscount = Math.min(
    Math.max(0, Number.isFinite(discount) ? discount : 0),
    subtotal,
  );
  const total = Math.max(0, subtotal - appliedDiscount);

  function addProduct(product: Product) {
    const stock = Number(product.stock_quantity);
    if (stock <= 0) return toast.error('Produto sem stock.');
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= stock) {
          toast.error(t('posPage.stockInsufficient'));
          return current;
        }
        return current.map((item) =>
          item.key === existing.key
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...current,
        {
          key: `product-${product.id}`,
          productId: product.id,
          serviceId: null,
          description: product.name,
          quantity: 1,
          unitPrice: Number(product.unit_price),
          maxStock: stock,
        },
      ];
    });
  }

  function addService(service: Service) {
    setCart((current) => {
      const existing = current.find((item) => item.serviceId === service.id);
      if (existing)
        return current.map((item) =>
          item.key === existing.key
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      return [
        ...current,
        {
          key: `service-${service.id}`,
          productId: null,
          serviceId: service.id,
          description: service.name,
          quantity: 1,
          unitPrice: Number(service.price),
        },
      ];
    });
  }

  useEffect(() => {
    if (!repeatedTransactionId || repeatedRef.current === repeatedTransactionId)
      return;
    const transaction = transactions.find(
      (item) =>
        item.id === repeatedTransactionId && item.status === 'completed',
    );
    if (!transaction) return;
    if (!products.length && !services.length) return;

    const missing: string[] = [];
    const nextCart: CartItem[] = [];
    for (const item of transaction.pos_transaction_items ?? []) {
      const product = item.product_id
        ? products.find((candidate) => candidate.id === item.product_id)
        : null;
      const service = item.service_id
        ? services.find((candidate) => candidate.id === item.service_id)
        : null;
      if (product) {
        const stock = Number(product.stock_quantity);
        if (stock <= 0) {
          missing.push(`${product.name} (sem stock)`);
          continue;
        }
        nextCart.push({
          key: `product-${product.id}`,
          productId: product.id,
          serviceId: null,
          description: product.name,
          quantity: Math.min(Number(item.quantity) || 1, stock),
          unitPrice: Number(product.unit_price),
          maxStock: stock,
        });
        continue;
      }
      if (service) {
        nextCart.push({
          key: `service-${service.id}`,
          productId: null,
          serviceId: service.id,
          description: service.name,
          quantity: Math.max(1, Number(item.quantity) || 1),
          unitPrice: Number(service.price),
        });
        continue;
      }
      missing.push(item.description);
    }

    repeatedRef.current = repeatedTransactionId;
    if (!nextCart.length) {
      toast.error(t('posPage.repeatSaleError'));
      return;
    }
    setCart(nextCart);
    setDiscount(0);
    setPaymentMethod('cash');
    setClientId('');
    toast.success(
      missing.length
        ? t('posPage.repeatedSale', { count: missing.length })
        : t('posPage.repeatSaleComplete'),
    );
  }, [products, repeatedTransactionId, services, transactions, t]);

  function changeQuantity(key: string, delta: number) {
    setCart((current) =>
      current.flatMap((item) => {
        if (item.key !== key) return [item];
        const next = item.quantity + delta;
        if (next <= 0) return [];
        if (item.maxStock !== undefined && next > item.maxStock) {
          toast.error('Stock insuficiente.');
          return [item];
        }
        return [{ ...item, quantity: next }];
      }),
    );
  }

  async function checkout() {
    if (!cart.length || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/enterprise/pos', {
        method: 'POST',
        headers: {
          ...(await authHeaders(t)),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethod,
          discount: appliedDiscount,
          clientId: clientId || null,
          items: cart.map(
            ({ key: _key, maxStock: _maxStock, ...item }) => item,
          ),
        }),
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error ?? t('posPage.checkoutError'));
      toast.success(t('posPage.saleCompleted', { total: money(json.transaction.total, locale) }));
      setCart([]);
      setDiscount(0);
      setClientId('');
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('posPage.checkoutGenericError'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function reverseTransaction(
    transaction: Transaction,
    mode: 'refund' | 'void',
  ) {
    const label = mode === 'refund' ? t('posPage.refund').toLowerCase() : t('posPage.voidAction').toLowerCase();
    const confirmed = await confirm({
      title: mode === 'refund' ? t('posPage.confirmRefund') : t('posPage.confirmVoid'),
      description: t('posPage.confirmActionDescription', { action: label, total: money(transaction.total, locale) }),
      confirmLabel: mode === 'refund' ? t('posPage.refund') : t('posPage.voidTransaction'),
      destructive: true,
    });
    if (!confirmed) return;
    setReversing(transaction.id);
    try {
      const response = await fetch(
        `/api/enterprise/pos/${transaction.id}/reversal`,
        {
          method: 'POST',
          headers: {
            ...(await authHeaders(t)),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mode }),
        },
      );
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error ?? t('posPage.reverseError'));
      setTransactions((current) =>
        current.map((item) =>
          item.id === transaction.id
            ? { ...item, status: json.transaction.status }
            : item,
        ),
      );
      toast.success(
        mode === 'refund' ? t('posPage.refunded') : t('posPage.voided'),
      );
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('posPage.reverseGenericError'),
      );
    } finally {
      setReversing(null);
    }
  }

  if (billingLoading) return <main className="min-h-screen" />;
  if (!allowed)
    return (
      <main className="min-h-screen px-4 py-24">
        <div className="mx-auto max-w-xl">
          <Card>
            <CardContent className="flex flex-col items-center gap-5 py-16 text-center">
              <Lock className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-semibold">{t('posPage.enterpriseTitle')}</h1>
              <p className="text-muted-foreground">
                {t('posPage.enterpriseDescription')}
              </p>
              <Button asChild>
                <Link href="/dashboard/billing">{t('posPage.upgrade')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );

  return (
    <main className="min-h-screen px-4 py-12 text-foreground sm:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-primary">{t('posPage.kicker')}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              {t('posPage.title')}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {t('posPage.subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void loadData()}
              disabled={loading}
            >
              <RefreshCcw className="mr-2 h-4 w-4" /> {t('posPage.refresh')}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" /> {t('posPage.dashboard')}
              </Link>
            </Button>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" /> {t('posPage.catalog')}
              </CardTitle>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('posPage.searchPlaceholder')}
              />
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="py-10 text-center text-muted-foreground">
                  {t('posPage.loadingCatalog')}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="rounded-xl border border-white/10 p-4 text-left transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <p className="font-medium">{p.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t('posPage.productAndStock', { count: p.stock_quantity })}
                      </p>
                      <p className="mt-2 font-semibold">
                        {money(p.unit_price, locale)}
                      </p>
                    </button>
                  ))}
                  {filteredServices.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => addService(s)}
                      className="rounded-xl border border-white/10 p-4 text-left transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <p className="font-medium">{s.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t('posPage.serviceDuration', { minutes: s.duration })}
                      </p>
                      <p className="mt-2 font-semibold">{money(s.price, locale)}</p>
                    </button>
                  ))}
                  {!filteredProducts.length && !filteredServices.length && (
                    <p className="col-span-full py-10 text-center text-muted-foreground">
                      {t('posPage.noResults')}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit xl:sticky xl:top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" /> {t('posPage.newSale')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">
                  {t('posPage.emptyCart')}
                </p>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-xl border border-white/10 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {money(item.unitPrice, locale)} {t('posPage.each')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setCart((current) =>
                              current.filter((x) => x.key !== item.key),
                            )
                          }
                          aria-label={t('posPage.removeItem', { item: item.description })}
                          className="rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => changeQuantity(item.key, -1)}
                            aria-label={t('posPage.decreaseQuantity')}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span
                            className="w-6 text-center"
                            aria-label={t('posPage.quantity', { count: item.quantity })}
                          >
                            {item.quantity}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => changeQuantity(item.key, 1)}
                            aria-label={t('posPage.increaseQuantity')}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <span className="font-semibold">
                          {money(item.quantity * item.unitPrice, locale)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-white/10 pt-4">
                <label
                  className="text-sm text-muted-foreground"
                  htmlFor="pos-client"
                >
                  {t('posPage.clientOptional')}
                </label>
                <select
                  id="pos-client"
                  className="mt-1 h-10 w-full rounded-md border border-white/10 bg-background px-3"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">{t('posPage.walkInClient')}</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name_complete}
                      {client.num_phone ? ` · ${client.num_phone}` : ''}
                    </option>
                  ))}
                </select>
                <label
                  className="mt-4 block text-sm text-muted-foreground"
                  htmlFor="pos-discount"
                >
                  {t('posPage.discount')}
                </label>
                <Input
                  id="pos-discount"
                  className="mt-1"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                />
                <label
                  className="mt-4 block text-sm text-muted-foreground"
                  htmlFor="pos-payment"
                >
                  {t('posPage.paymentMethod')}
                </label>
                <select
                  id="pos-payment"
                  className="mt-1 h-10 w-full rounded-md border border-white/10 bg-background px-3"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">{t('posPage.cash')}</option>
                  <option value="card">{t('posPage.card')}</option>
                  <option value="transfer">{t('posPage.transfer')}</option>
                  <option value="other">{t('posPage.other')}</option>
                </select>
                <div className="mt-5 flex justify-between text-sm">
                  <span>{t('posPage.subtotal')}</span>
                  <span>{money(subtotal, locale)}</span>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span>{t('posPage.discount')}</span>
                  <span>-{money(appliedDiscount, locale)}</span>
                </div>
                <div className="mt-2 flex justify-between text-xl font-semibold">
                  <span>{t('posPage.total')}</span>
                  <span>{money(total, locale)}</span>
                </div>
                <Button
                  className="mt-5 w-full"
                  size="lg"
                  disabled={!cart.length || submitting}
                  onClick={() => void checkout()}
                >
                  {submitting ? t('posPage.processing') : t('posPage.completeSale')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" /> {t('posPage.history')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">
                {t('posPage.noTransactions')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-sm">
                  <thead className="border-b border-white/10 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3">{t('posPage.date')}</th>
                      <th className="px-3 py-3">{t('posPage.items')}</th>
                      <th className="px-3 py-3">{t('posPage.payment')}</th>
                      <th className="px-3 py-3">{t('posPage.total')}</th>
                      <th className="px-3 py-3">{t('posPage.state')}</th>
                      <th className="px-3 py-3 text-right">{t('posPage.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td className="px-3 py-4 text-muted-foreground">
                          {new Date(transaction.created_at).toLocaleString(
                            locale === 'pt' ? 'pt-PT' : 'en-IE',
                          )}
                        </td>
                        <td className="max-w-[300px] px-3 py-4">
                          {(transaction.pos_transaction_items ?? [])
                            .map(
                              (item) =>
                                `${item.description} × ${item.quantity}`,
                            )
                            .join(', ') || '—'}
                        </td>
                        <td className="px-3 py-4 capitalize">
                          {transaction.payment_method === 'cash' ? t('posPage.cash') : transaction.payment_method === 'card' ? t('posPage.card') : transaction.payment_method === 'transfer' ? t('posPage.transfer') : t('posPage.other')}
                        </td>
                        <td className="px-3 py-4 font-medium">
                          {money(transaction.total, locale)}
                        </td>
                        <td className="px-3 py-4">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs capitalize">
                            {transaction.status === 'completed' ? t('posPage.transactionStatus.completed') : transaction.status === 'refunded' ? t('posPage.transactionStatus.refunded') : transaction.status === 'voided' ? t('posPage.transactionStatus.voided') : transaction.status}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          {transaction.status === 'completed' ? (
                            <div className="flex justify-end gap-2">
                              <Button asChild size="sm" variant="outline">
                                <Link
                                  href={`/dashboard/pos?repeat=${encodeURIComponent(transaction.id)}`}
                                >
                                  {t('posPage.repeatSale')}
                                </Link>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={reversing === transaction.id}
                                onClick={() =>
                                  void reverseTransaction(transaction, 'refund')
                                }
                              >
                                <Undo2 className="mr-1.5 h-3.5 w-3.5" />{' '}
                                {t('posPage.refundAction')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={reversing === transaction.id}
                                onClick={() =>
                                  void reverseTransaction(transaction, 'void')
                                }
                              >
                                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />{' '}
                                {t('posPage.voidAction')}
                              </Button>
                            </div>
                          ) : (
                            <span className="block text-right text-xs text-muted-foreground">
                              {t('posPage.noActions')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
            {t('posPage.serverValidationNote')}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
