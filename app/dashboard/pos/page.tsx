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

async function authHeaders() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token)
    throw new Error('Sessão expirada. Volta a iniciar sessão.');
  return { Authorization: `Bearer ${session.access_token}` };
}

const money = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(
    Number(value) || 0,
  );

export default function POSPage() {
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
        throw new Error('Não foi possível carregar o catálogo do POS.');
      setProducts(productRows ?? []);
      setServices(serviceRows ?? []);
      setClients(clientRows ?? []);

      const response = await fetch('/api/enterprise/pos', {
        headers: await authHeaders(),
        cache: 'no-store',
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error ?? 'Não foi possível carregar o histórico.');
      setTransactions(json.transactions ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao carregar o POS.',
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
          toast.error('Stock insuficiente.');
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
      toast.error('Não foi possível repetir esta venda com o catálogo atual.');
      return;
    }
    setCart(nextCart);
    setDiscount(0);
    setPaymentMethod('cash');
    setClientId('');
    toast.success(
      missing.length
        ? `Venda repetida com ${missing.length} item(ns) indisponível(is).`
        : 'Venda repetida no carrinho. Confirma os dados antes de concluir.',
    );
  }, [products, repeatedTransactionId, services, transactions]);

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
          ...(await authHeaders()),
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
        throw new Error(json.error ?? 'Não foi possível concluir a venda.');
      toast.success(`Venda concluída · ${money(json.transaction.total)}`);
      setCart([]);
      setDiscount(0);
      setClientId('');
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao concluir a venda.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function reverseTransaction(
    transaction: Transaction,
    mode: 'refund' | 'void',
  ) {
    const label = mode === 'refund' ? 'reembolsar' : 'anular';
    const confirmed = await confirm({
      title: mode === 'refund' ? 'Confirmar reembolso?' : 'Confirmar anulação?',
      description: `Confirma ${label} a transação de ${money(transaction.total)}? O stock dos produtos será reposto automaticamente.`,
      confirmLabel: mode === 'refund' ? 'Reembolsar' : 'Anular transação',
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
            ...(await authHeaders()),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mode }),
        },
      );
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error ?? 'Não foi possível reverter a transação.');
      setTransactions((current) =>
        current.map((item) =>
          item.id === transaction.id
            ? { ...item, status: json.transaction.status }
            : item,
        ),
      );
      toast.success(
        mode === 'refund' ? 'Transação reembolsada.' : 'Transação anulada.',
      );
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao reverter a transação.',
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
              <h1 className="text-2xl font-semibold">POS Enterprise</h1>
              <p className="text-muted-foreground">
                Vendas, pagamentos, stock e reembolsos num único fluxo.
              </p>
              <Button asChild>
                <Link href="/dashboard/billing">Fazer upgrade</Link>
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
            <p className="text-sm font-medium text-primary">ENTERPRISE · POS</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Ponto de venda
            </h1>
            <p className="mt-2 text-muted-foreground">
              Cria vendas, associa clientes e gere reversões com stock
              sincronizado.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void loadData()}
              disabled={loading}
            >
              <RefreshCcw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
              </Link>
            </Button>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" /> Catálogo
              </CardTitle>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar produto ou serviço..."
              />
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="py-10 text-center text-muted-foreground">
                  A carregar catálogo...
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
                        Produto · {p.stock_quantity} em stock
                      </p>
                      <p className="mt-2 font-semibold">
                        {money(p.unit_price)}
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
                        Serviço · {s.duration} min
                      </p>
                      <p className="mt-2 font-semibold">{money(s.price)}</p>
                    </button>
                  ))}
                  {!filteredProducts.length && !filteredServices.length && (
                    <p className="col-span-full py-10 text-center text-muted-foreground">
                      Nenhum resultado.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit xl:sticky xl:top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" /> Nova venda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">
                  Adiciona produtos ou serviços.
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
                            {money(item.unitPrice)} cada
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setCart((current) =>
                              current.filter((x) => x.key !== item.key),
                            )
                          }
                          aria-label={`Remover ${item.description}`}
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
                            aria-label="Diminuir quantidade"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span
                            className="w-6 text-center"
                            aria-label={`Quantidade ${item.quantity}`}
                          >
                            {item.quantity}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => changeQuantity(item.key, 1)}
                            aria-label="Aumentar quantidade"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <span className="font-semibold">
                          {money(item.quantity * item.unitPrice)}
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
                  Cliente (opcional)
                </label>
                <select
                  id="pos-client"
                  className="mt-1 h-10 w-full rounded-md border border-white/10 bg-background px-3"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">Cliente ocasional</option>
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
                  Desconto
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
                  Método de pagamento
                </label>
                <select
                  id="pos-payment"
                  className="mt-1 h-10 w-full rounded-md border border-white/10 bg-background px-3"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">Dinheiro</option>
                  <option value="card">Cartão</option>
                  <option value="transfer">Transferência</option>
                  <option value="other">Outro</option>
                </select>
                <div className="mt-5 flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span>Desconto</span>
                  <span>-{money(appliedDiscount)}</span>
                </div>
                <div className="mt-2 flex justify-between text-xl font-semibold">
                  <span>Total</span>
                  <span>{money(total)}</span>
                </div>
                <Button
                  className="mt-5 w-full"
                  size="lg"
                  disabled={!cart.length || submitting}
                  onClick={() => void checkout()}
                >
                  {submitting ? 'A processar...' : 'Concluir venda'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" /> Histórico
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">
                Ainda não existem transações.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-sm">
                  <thead className="border-b border-white/10 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3">Data</th>
                      <th className="px-3 py-3">Itens</th>
                      <th className="px-3 py-3">Pagamento</th>
                      <th className="px-3 py-3">Total</th>
                      <th className="px-3 py-3">Estado</th>
                      <th className="px-3 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td className="px-3 py-4 text-muted-foreground">
                          {new Date(transaction.created_at).toLocaleString(
                            'pt-PT',
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
                          {transaction.payment_method}
                        </td>
                        <td className="px-3 py-4 font-medium">
                          {money(transaction.total)}
                        </td>
                        <td className="px-3 py-4">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs capitalize">
                            {transaction.status}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          {transaction.status === 'completed' ? (
                            <div className="flex justify-end gap-2">
                              <Button asChild size="sm" variant="outline">
                                <Link
                                  href={`/dashboard/pos?repeat=${encodeURIComponent(transaction.id)}`}
                                >
                                  Repetir venda
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
                                Reembolsar
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
                                Anular
                              </Button>
                            </div>
                          ) : (
                            <span className="block text-right text-xs text-muted-foreground">
                              Sem ações
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
            Os preços, stock e total são sempre revalidados pelo servidor antes
            de concluir a venda.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
