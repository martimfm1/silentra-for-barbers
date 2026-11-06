'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  MessageSquareText,
  Search,
  SlidersHorizontal,
  Star,
  ThumbsUp,
} from 'lucide-react';
import { SiteNavbar } from '@/components/site-navbar';
import { useLanguage } from '@/context/LanguageContext';

type Review = {
  id: string;
  client_name: string;
  rating: number;
  comment?: string | null;
  created_at?: string;
};

type ReviewsPayload = {
  data?: {
    reviews?: Review[];
    rating?: number;
    reviewsCount?: number;
  };
  error?: string;
};

type SortMode = 'newest' | 'highest' | 'lowest';

export function PublicReviewsPage({
  slug,
  barbershopName,
  city,
}: {
  slug: string;
  barbershopName: string;
  city?: string | null;
}) {
  const { locale } = useLanguage();
  const isEnglish = locale === 'en';
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [query, setQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [withCommentOnly, setWithCommentOnly] = useState(false);

  async function loadReviews(signal?: AbortSignal) {
    setIsLoading(true);
    setHasError(false);
    try {
      const response = await fetch(
        `/api/public/barbershops/${encodeURIComponent(slug)}`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal,
        },
      );
      const payload = (await response.json()) as ReviewsPayload;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || 'Unable to load reviews');
      }
      const items = Array.isArray(payload.data.reviews)
        ? payload.data.reviews
        : [];
      setReviews(items);
      setAverage(Number(payload.data.rating || 0));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setHasError(true);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadReviews(controller.signal);
    return () => controller.abort();
  }, [slug]);

  const filteredReviews = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = reviews.filter((review) => {
      if (ratingFilter !== 'all' && Number(review.rating) !== ratingFilter) {
        return false;
      }
      if (withCommentOnly && !review.comment?.trim()) return false;
      if (!normalizedQuery) return true;
      return (
        review.client_name.toLocaleLowerCase().includes(normalizedQuery) ||
        (review.comment || '').toLocaleLowerCase().includes(normalizedQuery)
      );
    });

    return filtered.sort((a, b) => {
      if (sort === 'highest') return b.rating - a.rating;
      if (sort === 'lowest') return a.rating - b.rating;
      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });
  }, [reviews, query, ratingFilter, sort, withCommentOnly]);

  const distribution = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((rating) => ({
        rating,
        count: reviews.filter((review) => Number(review.rating) === rating)
          .length,
      })),
    [reviews],
  );

  const dateLabel = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(isEnglish ? 'en-GB' : 'pt-PT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  const copy = isEnglish
    ? {
        eyebrow: 'Customer feedback',
        title: 'Reviews',
        intro: `See what customers say about ${barbershopName}.`,
        back: 'Back to barbershop',
        total: 'customer reviews',
        average: 'Average rating',
        distribution: 'Rating breakdown',
        search: 'Search reviews or customer names',
        sort: 'Sort by',
        newest: 'Most recent',
        highest: 'Highest rating',
        lowest: 'Lowest rating',
        all: 'All ratings',
        commentsOnly: 'Reviews with comments only',
        results: 'Showing',
        of: 'of',
        noReviews: 'No reviews yet',
        noReviewsHint: 'When customers share their experience, it will appear here.',
        noMatches: 'No reviews match these filters.',
        noMatchesHint: 'Try changing your search or clearing the filters.',
        clear: 'Clear filters',
        noComment: 'No written comment',
        retry: 'Try again',
        error: 'Could not load reviews.',
        verified: 'Customer review',
      }
    : {
        eyebrow: 'Opiniões dos clientes',
        title: 'Avaliações',
        intro: `Vê o que os clientes dizem sobre ${barbershopName}.`,
        back: 'Voltar à barbearia',
        total: 'avaliações de clientes',
        average: 'Classificação média',
        distribution: 'Distribuição das avaliações',
        search: 'Pesquisar avaliações ou nomes',
        sort: 'Ordenar por',
        newest: 'Mais recentes',
        highest: 'Melhor classificação',
        lowest: 'Pior classificação',
        all: 'Todas as classificações',
        commentsOnly: 'Só avaliações com comentário',
        results: 'A mostrar',
        of: 'de',
        noReviews: 'Ainda não existem avaliações',
        noReviewsHint: 'Quando os clientes partilharem a sua experiência, ela aparecerá aqui.',
        noMatches: 'Não existem avaliações com estes filtros.',
        noMatchesHint: 'Experimenta alterar a pesquisa ou limpar os filtros.',
        clear: 'Limpar filtros',
        noComment: 'Sem comentário escrito',
        retry: 'Tentar novamente',
        error: 'Não foi possível carregar as avaliações.',
        verified: 'Avaliação de cliente',
      };

  return (
    <div className="silentra-page-shell min-h-[100svh] overflow-x-clip text-zinc-50 antialiased">
      <div className="silentra-page-grid" aria-hidden="true" />
      <SiteNavbar />
      <main className="relative z-10 mx-auto w-full max-w-5xl px-3 pb-20 pt-[calc(5rem+env(safe-area-inset-top))] sm:px-6 sm:pt-28 lg:px-8">
        <Link
          href={`/barbershops/${encodeURIComponent(slug)}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm text-zinc-400 transition hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {copy.back}
        </Link>

        <header className="glassmorphism silentra-section-block mt-4 overflow-hidden rounded-3xl p-5 sm:p-8">
          <p className="silentra-eyebrow">{copy.eyebrow}</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="silentra-page-title !text-3xl sm:!text-5xl">
                {copy.title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {barbershopName}{city ? ` · ${city}` : ''}
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                {copy.intro}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <Star className="size-7 fill-amber-300 text-amber-300" aria-hidden="true" />
              <div>
                <p className="text-2xl font-bold tabular-nums">{average.toFixed(1)}<span className="ml-1 text-sm font-medium text-zinc-500">/5</span></p>
                <p className="text-[11px] text-zinc-500">{copy.average}</p>
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-5 border-t border-white/[0.07] pt-5 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="flex flex-col justify-center">
              <p className="text-3xl font-semibold tabular-nums">{reviews.length}</p>
              <p className="mt-1 text-sm text-zinc-400">{copy.total}</p>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">{copy.distribution}</p>
              <div className="space-y-2">
                {distribution.map(({ rating, count }) => (
                  <div key={rating} className="flex items-center gap-2 text-xs">
                    <span className="w-3 text-right tabular-nums text-zinc-400">{rating}</span>
                    <Star className="size-3 fill-amber-300 text-amber-300" aria-hidden="true" />
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className="h-full rounded-full bg-amber-300 transition-[width] duration-500"
                        style={{ width: reviews.length ? `${(count / reviews.length) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="w-7 text-right tabular-nums text-zinc-500">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        <section className="mt-5 rounded-3xl border border-white/[0.08] bg-zinc-950/55 p-4 backdrop-blur-2xl sm:p-5" aria-label={copy.title}>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.search}
                aria-label={copy.search}
                className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-10 pr-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/40 focus:ring-2 focus:ring-emerald-300/10"
              />
            </label>
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3">
              <SlidersHorizontal className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
              <span className="text-xs text-zinc-500">{copy.sort}</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortMode)}
                className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none"
                aria-label={copy.sort}
              >
                <option value="newest" className="bg-zinc-900">{copy.newest}</option>
                <option value="highest" className="bg-zinc-900">{copy.highest}</option>
                <option value="lowest" className="bg-zinc-900">{copy.lowest}</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRatingFilter('all')}
              aria-pressed={ratingFilter === 'all'}
              className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${ratingFilter === 'all' ? 'border-white/30 bg-white text-zinc-950' : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white'}`}
            >
              {copy.all}
            </button>
            {[5, 4, 3, 2, 1].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => setRatingFilter(ratingFilter === rating ? 'all' : rating)}
                aria-pressed={ratingFilter === rating}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${ratingFilter === rating ? 'border-amber-300/40 bg-amber-300/10 text-amber-200' : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white'}`}
              >
                {rating} <Star className="size-3 fill-current" aria-hidden="true" />
              </button>
            ))}
            <label className="ml-0 inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-white/10 px-3 text-xs text-zinc-400 sm:ml-auto">
              <input
                type="checkbox"
                checked={withCommentOnly}
                onChange={(event) => setWithCommentOnly(event.target.checked)}
                className="size-3.5 accent-emerald-400"
              />
              {copy.commentsOnly}
            </label>
          </div>
        </section>

        <div className="mb-3 mt-5 flex items-center justify-between gap-3 px-1 text-xs text-zinc-500">
          <span>{copy.results} <strong className="text-zinc-200">{filteredReviews.length}</strong> {copy.of} {reviews.length}</span>
          {(query || ratingFilter !== 'all' || withCommentOnly) && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setRatingFilter('all');
                setWithCommentOnly(false);
              }}
              className="min-h-9 rounded-lg px-2 font-semibold text-zinc-300 transition hover:bg-white/[0.05] hover:text-white"
            >
              {copy.clear}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="silentra-section-block flex min-h-48 items-center justify-center rounded-2xl text-sm text-zinc-500">
            <span className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-emerald-300" aria-hidden="true" />
            <span className="ml-3">{isEnglish ? 'Loading reviews…' : 'A carregar avaliações…'}</span>
          </div>
        ) : hasError ? (
          <div className="silentra-section-block rounded-2xl p-8 text-center">
            <p className="font-semibold text-zinc-200">{copy.error}</p>
            <button type="button" onClick={() => void loadReviews()} className="mt-4 min-h-10 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950">{copy.retry}</button>
          </div>
        ) : filteredReviews.length ? (
          <div className="grid gap-3">
            {filteredReviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-white/[0.08] bg-zinc-950/55 p-4 backdrop-blur-xl sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-zinc-100">{review.client_name || (isEnglish ? 'Customer' : 'Cliente')}</h2>
                    <p className="mt-1 text-xs text-zinc-500">{dateLabel(review.created_at)}</p>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-lg border border-amber-300/15 bg-amber-300/[0.06] px-2.5 py-1.5 text-xs font-semibold text-amber-200">
                    <Star className="size-3.5 fill-current" aria-hidden="true" />
                    {review.rating}/5
                  </div>
                </div>
                {review.comment?.trim() ? (
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-300">{review.comment}</p>
                ) : (
                  <p className="mt-4 text-sm italic text-zinc-600">{copy.noComment}</p>
                )}
                <div className="mt-4 flex items-center gap-1.5 border-t border-white/[0.06] pt-3 text-[11px] text-zinc-500">
                  <ThumbsUp className="size-3.5 text-emerald-300" aria-hidden="true" />
                  {copy.verified}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="silentra-section-block rounded-2xl p-8 text-center sm:p-12">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-zinc-400">
              <MessageSquareText className="size-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-zinc-200">
              {reviews.length ? copy.noMatches : copy.noReviews}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
              {reviews.length ? copy.noMatchesHint : copy.noReviewsHint}
            </p>
            {reviews.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setRatingFilter('all');
                  setWithCommentOnly(false);
                }}
                className="mt-5 min-h-10 rounded-xl border border-white/10 px-4 text-xs font-semibold text-zinc-200 hover:bg-white/[0.05]"
              >
                {copy.clear}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
