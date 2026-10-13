'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Minus,
  PackageCheck,
  Plus,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react';

type Shop = {
  id?: string;
  name: string;
  slug: string | null;
} | null;

type Product = {
  id: string;
  barbershop_id: string;
  name: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  unit_price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  marketplace_featured: boolean;
  marketplace_published_at: string | null;
  marketplace_featured_until: string | null;
  barbershops: Shop | Shop[];
};

const money = (value: number) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value) || 0);

const getShop = (product: Product) =>
  Array.isArray(product.barbershops)
    ? product.barbershops[0]
    : product.barbershops;

export default function MarketplaceProductPage() {
  const params = useParams<{ productId: string }>();
  const productId = params.productId;
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadProduct() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(
          `/api/marketplace/products?id=${encodeURIComponent(productId)}`,
          { cache: 'no-store' },
        );
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || 'Não foi possível carregar o produto.');
        }
        if (active) setProduct(json.product as Product);
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Não foi possível carregar o produto.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    if (productId) void loadProduct();
    return () => {
      active = false;
    };
  }, [productId]);

  function addToCart() {
    if (!product || product.stock_quantity <= 0) return;
    const url = new URL('/marketplace', window.location.origin);
    url.searchParams.set('add', product.id);
    url.searchParams.set(
      'qty',
      String(Math.min(Math.max(1, quantity), Number(product.stock_quantity))),
    );
    window.location.assign(url.toString());
  }

  const shop = product ? getShop(product) : null;
  const discounted =
    product?.compare_at_price != null &&
    product.compare_at_price > product.unit_price;

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-16 text-zinc-100">
        <div className="mx-auto max-w-6xl animate-pulse">
          <div className="h-5 w-40 rounded bg-white/10" />
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div className="aspect-square rounded-3xl bg-white/[0.04]" />
            <div className="space-y-4 py-4">
              <div className="h-4 w-24 rounded bg-white/10" />
              <div className="h-10 w-3/4 rounded bg-white/10" />
              <div className="h-20 rounded bg-white/[0.04]" />
              <div className="h-12 w-48 rounded bg-white/10" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-16 text-zinc-100">
        <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.025] p-8 text-center">
          <ShoppingBag className="mx-auto size-9 text-zinc-500" />
          <h1 className="mt-4 text-2xl font-semibold">Produto indisponível</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {error || 'Este produto já não está publicado no marketplace.'}
          </p>
          <Link
            href="/marketplace"
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
          >
            <ArrowLeft className="size-4" />
            Voltar ao marketplace
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/marketplace"
            className="inline-flex min-h-10 items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Marketplace
          </Link>
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
            <Store className="size-4" />
            Silentra Marketplace
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <nav aria-label="Breadcrumb" className="mb-7 text-xs text-zinc-600">
          <Link href="/marketplace" className="transition hover:text-zinc-300">
            Marketplace
          </Link>
          <span className="px-2">/</span>
          <span className="text-zinc-400">{product.category || 'Produto'}</span>
        </nav>

        <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-14">
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.015]">
            {product.image_url ? (
              <div
                className="absolute inset-0 bg-contain bg-center bg-no-repeat p-6"
                style={{ backgroundImage: `url("${product.image_url}")` }}
                role="img"
                aria-label={product.name}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex size-24 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03]">
                  <ShoppingBag className="size-10 text-zinc-700" />
                </span>
              </div>
            )}
            {product.marketplace_featured && (
              <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-zinc-950/80 px-3 py-1.5 text-xs font-semibold text-amber-200 backdrop-blur">
                <Sparkles className="size-3.5" />
                Produto em destaque
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              {product.category || 'Coleção da barbearia'}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {product.name}
            </h1>
            {shop && (
              <p className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
                <Store className="size-4" />
                Vendido por{' '}
                <span className="font-medium text-zinc-300">{shop.name}</span>
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-semibold text-white">
                {money(product.unit_price)}
              </span>
              {discounted && (
                <>
                  <span className="text-base text-zinc-500 line-through">
                    {money(product.compare_at_price!)}
                  </span>
                  <span className="rounded-full bg-rose-400/15 px-2.5 py-1 text-xs font-semibold text-rose-200">
                    Poupa{' '}
                    {money(product.compare_at_price! - product.unit_price)}
                  </span>
                </>
              )}
            </div>

            <div className="mt-6 h-px bg-white/10" />
            <h2 className="mt-6 text-sm font-semibold text-white">Descrição</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-zinc-400">
              {product.description ||
                'A barbearia ainda não adicionou uma descrição para este produto.'}
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <PackageCheck className="mt-0.5 size-5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-semibold text-zinc-200">
                    Stock disponível
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {product.stock_quantity > 0
                      ? `${Number(product.stock_quantity)} unidade(s) disponíveis`
                      : 'Temporariamente esgotado'}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <Truck className="mt-0.5 size-5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-semibold text-zinc-200">
                    Entrega pela barbearia
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Levantamento ou envio conforme as opções do vendedor.
                  </p>
                </div>
              </div>
            </div>

            {product.stock_quantity > 0 ? (
              <div className="mt-7 rounded-3xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Quantidade
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Máximo de {Number(product.stock_quantity)} unidade(s)
                    </p>
                  </div>
                  <div className="inline-flex items-center rounded-xl border border-white/10 bg-zinc-950 p-1">
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((value) => Math.max(1, value - 1))
                      }
                      disabled={quantity <= 1}
                      className="flex size-9 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-white/10 disabled:opacity-30"
                      aria-label="Diminuir quantidade"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="w-10 text-center text-sm font-semibold tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((value) =>
                          Math.min(Number(product.stock_quantity), value + 1),
                        )
                      }
                      disabled={quantity >= Number(product.stock_quantity)}
                      className="flex size-9 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-white/10 disabled:opacity-30"
                      aria-label="Aumentar quantidade"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addToCart}
                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  <ShoppingBag className="size-4" />
                  Adicionar ao carrinho · {money(product.unit_price * quantity)}
                </button>
              </div>
            ) : (
              <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm text-zinc-500">
                Este produto está esgotado. Consulta o marketplace para veres
                alternativas.
              </div>
            )}

            <Link
              href={`/marketplace?shop=${encodeURIComponent(product.barbershop_id)}`}
              className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm text-zinc-400 transition hover:text-emerald-300"
            >
              Ver mais produtos desta barbearia
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <footer className="mt-14 border-t border-white/10 pt-6 text-xs text-zinc-600">
          O pagamento e o cumprimento da encomenda são tratados diretamente pela
          barbearia vendedora.
        </footer>
      </div>
    </main>
  );
}
