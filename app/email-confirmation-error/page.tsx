'use client';

import Link from 'next/link';
import { AlertCircle, ArrowLeft, Mail } from 'lucide-react';
import { StarfieldBackground } from '@/components/ui/starfield';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function EmailConfirmationErrorPage() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <StarfieldBackground>
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg items-center justify-center">
          <section
            aria-labelledby="confirmation-error-title"
            className="glassmorphism w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl sm:p-8"
          >
            <div
              className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400"
              aria-hidden="true"
            >
              <AlertCircle className="h-6 w-6" />
            </div>

            <div className="mb-4 flex justify-end">
              <LanguageSwitcher />
            </div>
            <h1
              id="confirmation-error-title"
              className="text-2xl font-semibold tracking-tight"
            >
              {t('auth.emailConfirmationErrorTitle')}
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              {t('auth.emailConfirmationErrorBody')}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-zinc-900"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar ao login
              </Link>
              <Link
                href="/register"
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-zinc-900"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Criar conta
              </Link>
            </div>

            <p className="mt-6 text-center text-xs leading-5 text-zinc-500">
              Se continuares com problemas, verifica se estás a utilizar o
              e-mail de confirmação mais recente.
            </p>
          </section>
        </div>
      </StarfieldBackground>
    </main>
  );
}
