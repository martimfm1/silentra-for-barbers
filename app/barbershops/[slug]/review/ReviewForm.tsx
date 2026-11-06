'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

type PublicReviewFormProps = {
  barbershopId: string;
  barbershopName: string;
  slug: string;
  hasReviewAccess: boolean;
};

type ReviewResponse = {
  success?: boolean;
  accepted?: boolean;
  error?: string;
};

export function PublicReviewForm({
  barbershopId,
  barbershopName,
  slug,
  hasReviewAccess,
}: PublicReviewFormProps) {
  const { locale } = useLanguage();
  const isEnglish = locale === 'en';
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const copy = isEnglish
    ? {
        eyebrow: 'Your experience matters',
        title: 'How was your visit?',
        description: `Share how your appointment at ${barbershopName} went. Your feedback helps this barbershop improve.`,
        rating: 'Your rating',
        chooseRating: 'Choose a rating from 1 to 5 stars',
        comment: 'Comment (optional)',
        commentHint: 'Tell us what went well or what could be better.',
        submit: 'Send review',
        sending: 'Sending review…',
        back: 'Back to barbershop',
        secure: 'No account required. Each review link is unique, expires, and can only be used once.',
        thankYou: 'Thank you for your feedback.',
        thankYouDescription: 'Your review has been submitted successfully.',
        noAccessTitle: 'A personal review link is required',
        noAccessDescription:
          'To keep reviews genuine, you can only submit a review using the secure link sent by email after a completed appointment. You do not need an account.',
        stars: (value: number) => `${value} out of 5 stars`,
      }
    : {
        eyebrow: 'A tua experiência importa',
        title: 'Como correu a tua visita?',
        description: `Partilha como correu o teu atendimento na ${barbershopName}. A tua opinião ajuda esta barbearia a melhorar.`,
        rating: 'A tua classificação',
        chooseRating: 'Escolhe uma classificação de 1 a 5 estrelas',
        comment: 'Comentário (opcional)',
        commentHint: 'Conta-nos o que correu bem ou o que podia melhorar.',
        submit: 'Enviar avaliação',
        sending: 'A enviar avaliação…',
        back: 'Voltar à barbearia',
        secure: 'Não precisas de criar conta. Cada ligação é única, expira e só pode ser utilizada uma vez.',
        thankYou: 'Obrigado pela tua opinião.',
        thankYouDescription: 'A tua avaliação foi enviada com sucesso.',
        noAccessTitle: 'É necessária uma ligação pessoal',
        noAccessDescription:
          'Para manter as avaliações genuínas, só podes enviar uma avaliação através da ligação segura recebida por email após um atendimento concluído. Não precisas de criar conta.',
        stars: (value: number) => `${value} de 5 estrelas`,
      };

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!hasReviewAccess) {
      setError(copy.noAccessDescription);
      return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setError(
        isEnglish
          ? 'Choose a rating between 1 and 5 stars.'
          : 'Escolhe uma classificação entre 1 e 5 estrelas.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/public/reviews', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          barbershopId,
          rating,
          comment: comment.trim(),
          website,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ReviewResponse;

      if (!response.ok || (!payload.success && !payload.accepted)) {
        throw new Error(
          payload.error ||
            (isEnglish
              ? 'We could not submit your review. Please try again.'
              : 'Não foi possível enviar a avaliação. Tenta novamente.'),
        );
      }

      setSubmitted(true);
      setRating(0);
      setComment('');
      setWebsite('');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : isEnglish
            ? 'We could not submit your review. Please try again.'
            : 'Não foi possível enviar a avaliação. Tenta novamente.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-4 py-10 text-zinc-100 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-xl">
        <Link
          href={`/barbershops/${encodeURIComponent(slug)}`}
          className="mb-7 inline-flex min-h-10 items-center gap-2 text-sm text-zinc-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {copy.back}
        </Link>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#111114] shadow-2xl shadow-black/30">
          <div className="border-b border-white/[0.07] bg-gradient-to-br from-white/[0.06] to-transparent px-6 py-7 sm:px-8 sm:py-9">
            <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
              <Star className="size-6 fill-current" aria-hidden="true" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
              {copy.eyebrow}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {copy.title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              {copy.description}
            </p>
          </div>

          <div className="px-6 py-7 sm:px-8 sm:py-8">
            {submitted ? (
              <div className="py-5 text-center" role="status" aria-live="polite">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                  <CheckCircle2 className="size-7" aria-hidden="true" />
                </div>
                <h2 className="mt-5 text-xl font-semibold">{copy.thankYou}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {copy.thankYouDescription}
                </p>
              </div>
            ) : !hasReviewAccess ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <h2 className="text-base font-semibold">{copy.noAccessTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {copy.noAccessDescription}
                </p>
                <Link
                  href={`/barbershops/${encodeURIComponent(slug)}`}
                  className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-emerald-200 hover:text-emerald-100"
                >
                  {copy.back}
                </Link>
              </div>
            ) : (
              <form onSubmit={submitReview} className="relative space-y-6">
                <fieldset>
                  <legend className="text-sm font-semibold">{copy.rating}</legend>
                  <div
                    className="mt-3 flex flex-wrap gap-1"
                    aria-label={copy.chooseRating}
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-label={copy.stars(value)}
                        aria-pressed={rating === value}
                        onClick={() => setRating(value)}
                        className="flex size-12 items-center justify-center rounded-xl transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                      >
                        <Star
                          className={`size-7 transition-colors ${value <= rating ? 'fill-amber-300 text-amber-300' : 'text-zinc-600'}`}
                          aria-hidden="true"
                        />
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    {rating > 0
                      ? copy.stars(rating)
                      : copy.chooseRating}
                  </p>
                </fieldset>

                <label className="block">
                  <span className="text-sm font-semibold">{copy.comment}</span>
                  <textarea
                    value={comment}
                    onChange={(event) =>
                      setComment(event.target.value.slice(0, 1000))
                    }
                    maxLength={1000}
                    rows={5}
                    placeholder={copy.commentHint}
                    className="mt-3 min-h-32 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/40 focus:ring-2 focus:ring-emerald-300/15"
                  />
                  <span className="mt-1 block text-right text-[11px] tabular-nums text-zinc-600">
                    {comment.length}/1000
                  </span>
                </label>

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-[10000px] h-px w-px overflow-hidden"
                >
                  <label htmlFor="review-website">Website</label>
                  <input
                    id="review-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                  />
                </div>

                {error ? (
                  <p
                    className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-sm text-red-200"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  disabled={submitting || rating < 1}
                  className="min-h-12 w-full rounded-xl bg-emerald-300 font-semibold text-zinc-950 hover:bg-emerald-200 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                      {copy.sending}
                    </>
                  ) : (
                    copy.submit
                  )}
                </Button>
              </form>
            )}

            <div className="mt-7 flex items-start gap-2 border-t border-white/[0.07] pt-5 text-xs leading-5 text-zinc-500">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300/70" aria-hidden="true" />
              <p>{copy.secure}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
