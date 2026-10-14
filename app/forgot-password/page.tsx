'use client';

import { useState, useId } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Mail, Info, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StarfieldBackground } from '@/components/ui/starfield';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/spinner';
import {
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SiteNavbar } from '@/components/site-navbar';
import { useLanguage } from '@/context/LanguageContext';

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const emailHintId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      if (!response.ok) {
        throw new Error(t('auth.resendFailed'));
      }

      setIsSent(true);
    } catch {
      setErrorMsg(t('auth.resendFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <main className="min-h-dvh w-full bg-background text-foreground flex flex-col antialiased selection:bg-zinc-50 selection:text-zinc-950">
        <StarfieldBackground>
          <div className="flex flex-col min-h-dvh w-full">
            <SiteNavbar />
            <section className="flex-1 w-full flex flex-col items-center justify-center px-4 pt-10 pb-12 sm:px-8 max-w-lg mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="glassmorphism w-full border border-white/10 bg-zinc-950/85 shadow-2xl shadow-black/80 backdrop-blur-xl rounded-2xl focus-within:border-white/20 transition-colors"
              >
                <CardHeader className="gap-2 pb-2 px-5 sm:px-6 pt-6 sm:pt-7">
                  <div className="flex justify-start">
                    <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-zinc-300 select-none">
                      {t('auth.accountSecurity')}
                    </Badge>
                  </div>
                  <CardTitle className="font-heading text-xl sm:text-2xl text-zinc-50 tracking-tight mt-1">
                    {isSent
                      ? 'Verifica o teu email'
                      : 'Redefinir palavra-passe'}
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-400 leading-relaxed">
                    {isSent
                      ? t('auth.resetEmailSent')
                      : t('auth.resetPasswordSubtitle')}
                  </CardDescription>
                </CardHeader>

                <CardContent className="px-5 sm:px-6 pb-6 pt-3">
                  <AnimatePresence mode="wait">
                    {errorMsg && (
                      <motion.div
                        role="alert"
                        aria-live="assertive"
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        className="p-3 text-xs bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl font-medium mb-4 text-center"
                      >
                        {errorMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence mode="wait">
                    {!isSent ? (
                      <motion.form
                        key="reset-form"
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        transition={{ duration: 0.2 }}
                        className="grid gap-4"
                        onSubmit={handleSubmit}
                      >
                        <Field>
                          <FieldGroup className="grid gap-1.5">
                            <FieldLabel>
                              <Label
                                htmlFor="reset-email"
                                className="text-xs font-medium text-zinc-300"
                              >
                                {t('auth.email')}
                              </Label>
                            </FieldLabel>
                            <FieldContent>
                              <div className="relative group">
                                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-100 transition-colors" />
                                <Input
                                  id="reset-email"
                                  name="email"
                                  type="email"
                                  required
                                  autoComplete="email"
                                  value={email}
                                  aria-describedby={emailHintId}
                                  onChange={(e) => setEmail(e.target.value)}
                                  placeholder="ola@barbearia.pt"
                                  className="h-11 text-base sm:text-xs border-white/10 bg-white/5 pl-10 pr-10 text-zinc-50 placeholder:text-zinc-500 focus-visible:border-white/40 focus-visible:ring-2 focus-visible:ring-white/20 transition-all rounded-xl"
                                />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      tabIndex={-1}
                                      aria-label={t('auth.emailAddress')}
                                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
                                    >
                                      <Info className="size-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent id={emailHintId} side="top">
                                    {t('auth.useAccountEmail')}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </FieldContent>
                          </FieldGroup>
                        </Field>

                        <Button
                          type="submit"
                          disabled={isSubmitting || !email.trim()}
                          className="h-11 w-full rounded-full bg-zinc-50 text-xs font-bold text-zinc-950 hover:bg-white active:scale-[0.98] transition-all shadow-md mt-1 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-30 disabled:pointer-events-none"
                        >
                          {isSubmitting ? (
                            <Spinner className="size-4 text-zinc-950" />
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              {t('auth.sendResetLink')}{' '}
                              <ArrowRight className="size-4" />
                            </span>
                          )}
                        </Button>

                        <div className="pt-2 text-center">
                          <Link
                            href="/login"
                            className="inline-flex items-center justify-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors min-h-[44px] px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-md"
                          >
                            <ArrowLeft className="size-3.5" />{' '}
                            {t('auth.backToLogin')}
                          </Link>
                        </div>
                      </motion.form>
                    ) : (
                      <motion.div
                        key="success-state"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col items-center text-center py-4 space-y-5"
                      >
                        <div className="size-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <CheckCircle2 className="size-6" />
                        </div>
                        <p className="text-xs text-zinc-300">
                          {t('auth.resendNotReceived')}
                        </p>
                        <div className="w-full space-y-3 pt-2">
                          <Button
                            type="button"
                            onClick={() => setIsSent(false)}
                            variant="outline"
                            className="h-11 w-full rounded-full border-white/10 bg-white/5 text-xs font-semibold text-zinc-200 hover:bg-white/10 hover:text-white transition-all"
                          >
                            Tentar novamente
                          </Button>
                          <Link
                            href="/login"
                            className="inline-flex items-center justify-center gap-2 w-full text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors min-h-[44px] px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-md"
                          >
                            <ArrowLeft className="size-3.5" /> Voltar ao login
                          </Link>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </motion.div>
            </section>
          </div>
        </StarfieldBackground>
      </main>
    </TooltipProvider>
  );
}
