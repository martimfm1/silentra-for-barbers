'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Mail,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getClientAuthCallbackUrl } from '@/lib/auth/email-confirmation';
import { StarfieldBackground } from '@/components/ui/starfield';
import { Button } from '@/components/ui/button';
import { SiteNavbar } from '@/components/site-navbar';
import { useLanguage } from '@/context/LanguageContext';

export default function ConfirmEmailPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const handleResendEmail = async () => {
    if (!email) {
      setResendStatus('error');
      setStatusMessage(t('auth.emailMissing'));
      return;
    }

    setIsResending(true);
    setResendStatus('idle');
    setStatusMessage('');

    try {
      const supabase = createClient();
      const emailRedirectTo = getClientAuthCallbackUrl();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo,
        },
      });

      if (error) {
        console.error('[CONFIRM_EMAIL_RESEND_ERROR]', error);
        setResendStatus('error');
        setStatusMessage(
          t('auth.resendFailed'),
        );
        return;
      }

      setResendStatus('success');
      setStatusMessage(
        t('auth.resendSuccess'),
      );
    } catch (error) {
      console.error('[CONFIRM_EMAIL_RESEND_ERROR]', error);
      setResendStatus('error');
      setStatusMessage(
        t('auth.resendFailed'),
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <main className="min-h-dvh w-full bg-background text-foreground flex flex-col antialiased selection:bg-zinc-50 selection:text-zinc-950">
      <StarfieldBackground>
        <div className="flex flex-col min-h-dvh w-full">
          <SiteNavbar />

          <section className="flex-1 w-full flex items-center justify-center px-4 py-12 sm:px-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-[460px] border border-white/10 bg-zinc-950/85 p-6 sm:p-8 shadow-2xl shadow-black/80 backdrop-blur-xl rounded-2xl text-center"
            >
              <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-inner text-zinc-100">
                <Mail className="size-7" />
              </div>

              <h1 className="font-heading text-2xl font-bold text-zinc-50 tracking-tight">
                {t('auth.confirmEmailTitle')}
              </h1>

              <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                {t('auth.confirmEmailSubtitle')}
              </p>

              {email && (
                <div className="mt-2 inline-block max-w-full break-all rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200">
                  {email}
                </div>
              )}

              <p className="mt-4 text-xs text-zinc-500 leading-relaxed">
                Abre o email e clica no link de confirmação para ativares a tua
                conta. Se não o encontrares, verifica também a pasta de spam.
              </p>

              {resendStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl"
                  role="status"
                >
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>{statusMessage}</span>
                </motion.div>
              )}

              {resendStatus === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl"
                  role="alert"
                >
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{statusMessage}</span>
                </motion.div>
              )}

              <div className="mt-8 flex flex-col gap-3">
                <Button
                  onClick={handleResendEmail}
                  disabled={isResending || !email}
                  variant="outline"
                  className="h-11 w-full rounded-full border-white/10 bg-white/5 text-xs font-semibold text-zinc-200 hover:bg-white/10 hover:text-white transition-all"
                >
                  {isResending ? (
                    <RefreshCw
                      className="size-4 animate-spin text-zinc-300"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="size-3.5" aria-hidden="true" />{' '}
                      Reenviar email de confirmação
                    </span>
                  )}
                </Button>

                <Link href="/login" className="w-full">
                  <Button
                    type="button"
                    className="h-11 w-full rounded-full bg-zinc-50 text-xs font-bold text-zinc-950 hover:bg-white transition-all shadow-md"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <ArrowLeft className="size-4" aria-hidden="true" /> {t('auth.backToLogin')}
                    </span>
                  </Button>
                </Link>
              </div>
            </motion.div>
          </section>
        </div>
      </StarfieldBackground>
    </main>
  );
}
