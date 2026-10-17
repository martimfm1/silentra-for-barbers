'use client';

import Link from 'next/link';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { StarfieldBackground } from '@/components/ui/starfield';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function EmailConfirmedPage() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <StarfieldBackground>
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg items-center justify-center">
          <section
            aria-labelledby="email-confirmed-title"
            className="glassmorphism w-full rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8"
          >
            <div
              aria-hidden="true"
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <CheckCircle2 className="h-7 w-7" strokeWidth={2} />
            </div>

            <div className="mb-4 flex justify-end">
              <LanguageSwitcher />
            </div>
            <p className="mb-2 text-sm font-medium text-primary">
              {t('auth.emailConfirmedTag')}
            </p>
            <h1
              id="email-confirmed-title"
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              {t('auth.emailConfirmedTitle')}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
              {t('auth.emailConfirmedBody')}
            </p>

            <Link
              href="/login"
              className="mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
            >
              Ir para iniciar sessão
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        </div>
      </StarfieldBackground>
    </main>
  );
}
