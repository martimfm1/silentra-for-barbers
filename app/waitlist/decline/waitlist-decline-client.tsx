'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

type Offer = {
  shopId: string;
  vacancyId: string;
  waitlistId: string;
  expires: string;
  signature: string;
};

export default function WaitlistDeclineClient({ offer }: { offer: Offer | null }) {
  const { locale } = useLanguage();
  const en = locale === 'en';
  const [state, setState] = useState<'ready' | 'submitting' | 'success' | 'error'>(
    offer ? 'ready' : 'error',
  );
  const [message, setMessage] = useState(
    offer
      ? ''
      : en
        ? 'This link is invalid or incomplete.'
        : 'Este link não é válido ou está incompleto.',
  );

  async function decline() {
    if (!offer || state !== 'ready') return;
    setState('submitting');
    setMessage('');
    try {
      const response = await fetch(`/api/shops/${offer.shopId}/waitlist/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vacancyId: offer.vacancyId,
          waitlistId: offer.waitlistId,
          expires: offer.expires,
          signature: offer.signature,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        const messages: Record<string, string> = en
          ? {
              INVALID_LINK: 'This confirmation link is invalid.',
              SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',
              OFFER_EXPIRED: 'This offer has expired.',
              OFFER_UNAVAILABLE: 'This offer is no longer available.',
              OFFER_ALREADY_UPDATED: 'This offer has already been updated or used.',
              RATE_LIMITED: 'Too many attempts. Please try again later.',
            }
          : {
              INVALID_LINK: 'Este link de confirmação não é válido.',
              SERVICE_UNAVAILABLE: 'O serviço está temporariamente indisponível. Tenta novamente mais tarde.',
              OFFER_EXPIRED: 'Esta proposta já expirou.',
              OFFER_UNAVAILABLE: 'Esta proposta já não está disponível.',
              OFFER_ALREADY_UPDATED: 'Esta proposta já foi atualizada ou utilizada.',
              RATE_LIMITED: 'Demasiadas tentativas. Tenta novamente mais tarde.',
            };
        throw new Error(messages[String(payload.code)] || (en ? 'This offer could not be updated.' : 'Não foi possível atualizar esta proposta.'));
      }
      setState('success');
    } catch (error) {
      setState('error');
      setMessage(
        error instanceof Error
          ? error.message
          : en
            ? 'This offer could not be updated.'
            : 'Não foi possível atualizar esta proposta.',
      );
    }
  }

  if (state === 'success') {
    return (
      <section className="mt-6" aria-live="polite">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          {en ? 'Offer declined' : 'Proposta recusada'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          {en
            ? 'You have been removed from this offer. The opening may now be offered to another customer.'
            : 'Foste removido desta proposta. A vaga pode agora ser proposta a outro cliente.'}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {en ? 'Decline this opening?' : 'Recusar esta vaga?'}
      </h1>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        {en
          ? 'We will remove you from this offer so the barbershop can offer the opening to the next customer.'
          : 'Vamos retirar-te desta proposta para que a barbearia possa oferecer a vaga ao próximo cliente.'}
      </p>
      {state === 'error' && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm text-amber-100" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {message}
        </p>
      )}
      <Button
        type="button"
        className="mt-6 min-h-12 w-full"
        disabled={!offer || state === 'submitting'}
        onClick={() => void decline()}
      >
        {state === 'submitting' ? (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
        ) : null}
        {state === 'submitting'
          ? en ? 'Updating…' : 'A atualizar…'
          : en ? 'Yes, decline this offer' : 'Sim, recusar esta vaga'}
      </Button>
      <p className="mt-3 text-xs leading-5 text-zinc-600">
        {en
          ? 'The email link is not activated until you confirm here.'
          : 'O link do email só é ativado depois de confirmares aqui.'}
      </p>
    </section>
  );
}
