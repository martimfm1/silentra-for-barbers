'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  LockKeyhole,
  Mail,
  Phone,
  User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StarfieldBackground } from '@/components/ui/starfield';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SiteNavbar } from '@/components/site-navbar';
import { TermsDrawer } from '@/components/legal/terms-drawer';
import { useLanguage } from '@/context/LanguageContext';
import { handleLogin, handleRegister } from './services/auth-handles';

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isUnconfirmed, setIsUnconfirmed] = useState(false);
  const [isInvalidCredentials, setIsInvalidCredentials] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const loginEmailHintId = useId();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get('tab');
    const requestedEmail = params.get('email');
    const status = params.get('status');
    const errorParam = params.get('error');

    if (requestedTab === 'register') setActiveTab('register');
    if (requestedEmail) setLoginEmail(requestedEmail);

    if (status === 'registered') setSuccessMsg(t('auth.registered'));
    if (status === 'confirmed') setSuccessMsg(t('auth.confirmed'));
    if (errorParam === 'unconfirmed_email') {
      setIsUnconfirmed(true);
      setErrorMsg(t('auth.unconfirmed'));
    }
  }, [t]);

  const clearMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsUnconfirmed(false);
    setIsInvalidCredentials(false);
  };

  const switchTab = (tab: 'login' | 'register') => {
    setActiveTab(tab);
    clearMessages();
  };

  return (
    <TooltipProvider delayDuration={300}>
      <main className="min-h-dvh bg-background text-foreground antialiased">
        <StarfieldBackground>
          <div className="flex min-h-dvh flex-col">
            <SiteNavbar />
            <section className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-10 sm:px-8 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-16">
              <div className="hidden space-y-5 lg:block">
                <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300">
                  {t('auth.reservedArea')}
                </Badge>
                <h1 className="max-w-xl font-heading text-4xl font-semibold leading-tight tracking-tight text-zinc-50 xl:text-5xl">
                  {t('auth.manageTitle')}
                </h1>
                <p className="max-w-md text-sm leading-relaxed text-zinc-400">
                  {t('auth.manageSubtitle')}
                </p>
              </div>

              <div className="w-full max-w-[460px] justify-self-center mt-8">
                <Card className="glassmorphism">
                  <CardHeader className="space-y-4 p-4 sm:p-6">
                    <div className="grid grid-cols-2 rounded-full border border-white/10 bg-black/50 p-1">
                      <button
                        type="button"
                        onClick={() => switchTab('login')}
                        className={`min-h-10 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${activeTab === 'login' ? 'bg-zinc-50 text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'}`}
                      >
                        {t('auth.loginTab')}
                      </button>
                      <button
                        type="button"
                        onClick={() => switchTab('register')}
                        className={`min-h-10 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${activeTab === 'register' ? 'bg-zinc-50 text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'}`}
                      >
                        {t('auth.registerTab')}
                      </button>
                    </div>

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                      >
                        <CardTitle className="font-heading text-xl text-zinc-50">
                          {activeTab === 'login'
                            ? t('auth.welcomeBack')
                            : t('auth.createWorkspace')}
                        </CardTitle>
                        <CardDescription className="mt-1 text-zinc-400">
                          {activeTab === 'login'
                            ? t('auth.loginCredentials')
                            : t('auth.createWorkspaceSubtitle')}
                        </CardDescription>
                      </motion.div>
                    </AnimatePresence>
                  </CardHeader>

                  <CardContent className="space-y-4 p-5 pt-0 sm:p-6 sm:pt-0">
                    {successMsg ? (
                      <div
                        className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300"
                        role="status"
                        aria-live="polite"
                      >
                        <CheckCircle2
                          className="mt-0.5 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{successMsg}</span>
                      </div>
                    ) : null}

                    {errorMsg ? (
                      <div
                        className="space-y-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"
                        role="alert"
                        aria-live="assertive"
                      >
                        <p>{errorMsg}</p>
                        {isInvalidCredentials ? (
                          <button
                            type="button"
                            onClick={() => switchTab('register')}
                            className="inline-flex min-h-10 items-center rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-white/10"
                          >
                            {t('auth.registerTab')}
                          </button>
                        ) : null}
                        {isUnconfirmed ? (
                          <Link
                            href={`/confirm-email${loginEmail ? `?email=${encodeURIComponent(loginEmail)}` : ''}`}
                            className="inline-flex min-h-10 items-center rounded-lg border border-red-400/20 bg-red-400/10 px-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-red-400/20"
                          >
                            {t('auth.resendConfirmation')}
                          </Link>
                        ) : null}
                      </div>
                    ) : null}

                    {activeTab === 'login' ? (
                      <form
                        className="grid gap-4"
                        onSubmit={(event) =>
                          handleLogin({
                            event,
                            router,
                            setIsSubmitting,
                            invalidCredentialsMessage: t('auth.invalidCredentials'),
                            unconfirmedEmailMessage: t('auth.unconfirmedLogin'),
                            setErrorMsg: (message) => {
                              setErrorMsg(message);
                              setIsUnconfirmed(message === t('auth.unconfirmedLogin'));
                              setIsInvalidCredentials(message === t('auth.invalidCredentials'));
                            },
                          })
                        }
                      >
                        <div className="space-y-1.5">
                          <Label htmlFor="login-email">
                            {t('auth.emailAddress')}
                          </Label>
                          <div className="relative">
                            <Mail
                              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                              aria-hidden="true"
                            />
                            <Input
                              id="login-email"
                              name="email"
                              type="email"
                              required
                              autoComplete="email"
                              value={loginEmail}
                              onChange={(event) =>
                                setLoginEmail(event.target.value)
                              }
                              placeholder="admin@barbershop.pt"
                              className="pl-10 pr-10"
                            />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  aria-label={t('auth.emailAddress')}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-500 hover:text-zinc-200"
                                >
                                  <Info className="size-4" aria-hidden="true" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent id={loginEmailHintId}>
                                {t('auth.verifiedEmailHint')}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="login-password">
                            {t('auth.password')}
                          </Label>
                          <div className="relative">
                            <LockKeyhole
                              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                              aria-hidden="true"
                            />
                            <Input
                              id="login-password"
                              name="password"
                              type={showLoginPassword ? 'text' : 'password'}
                              required
                              autoComplete="current-password"
                              className="pl-10 pr-12"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowLoginPassword((value) => !value)
                              }
                              aria-label={
                                showLoginPassword
                                  ? t('auth.hidePassword')
                                  : t('auth.showPassword')
                              }
                              className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                            >
                              {showLoginPassword ? (
                                <EyeOff className="size-4" aria-hidden="true" />
                              ) : (
                                <Eye className="size-4" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 text-sm">
                          <label className="flex items-center gap-2 text-zinc-300">
                            <Checkbox id="remember" />
                            {t('auth.rememberMe')}
                          </label>
                          <Link
                            href="/forgot-password"
                            className="text-zinc-400 underline-offset-4 hover:text-zinc-100 hover:underline"
                          >
                            {t('auth.forgotPassword')}
                          </Link>
                        </div>

                        <Button
            aria-label={isSubmitting ? "A iniciar sessão" : "Iniciar sessão"}
                          type="submit"
                          disabled={isSubmitting}
                          className="min-h-11 w-full rounded-full font-semibold"
                        >
                          {isSubmitting ? (
                            <Spinner className="size-4" />
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              {t('auth.signInDashboard')}{' '}
                              <ArrowRight
                                className="size-4"
                                aria-hidden="true"
                              />
                            </span>
                          )}
                        </Button>
                      </form>
                    ) : (
                      <form
                        className="grid gap-4"
                        onSubmit={async (event) => {
                          const formData = new FormData(event.currentTarget);
                          const email = String(formData.get('email') ?? '');
                          await handleRegister({
                            event,
                            setIsSubmitting,
                            setErrorMsg,
                            acceptedTerms,
                            termsErrorMessage: t('legal.acceptRequired'),
                            successMessage: t('auth.registered'),
                            onSuccess: () =>
                              router.push(
                                `/confirm-email${email ? `?email=${encodeURIComponent(email)}` : ''}`,
                              ),
                          });
                        }}
                      >
                        <div className="space-y-1.5">
                          <Label htmlFor="reg-name">{t('auth.fullName')}</Label>
                          <div className="relative">
                            <User
                              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                              aria-hidden="true"
                            />
                            <Input
                              id="reg-name"
                              name="name"
                              required
                              autoComplete="name"
                              placeholder={t('auth.fullNamePlaceholder')}
                              className="pl-10"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="reg-email">
                            {t('auth.emailAddress')}
                          </Label>
                          <div className="relative">
                            <Mail
                              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                              aria-hidden="true"
                            />
                            <Input
                              id="reg-email"
                              name="email"
                              type="email"
                              required
                              autoComplete="email"
                              placeholder="admin@barbershop.pt"
                              className="pl-10"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="reg-phone">
                            {t('auth.mobilePhone')}
                          </Label>
                          <div className="relative">
                            <Phone
                              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                              aria-hidden="true"
                            />
                            <Input
                              id="reg-phone"
                              name="phone"
                              type="tel"
                              inputMode="tel"
                              required
                              autoComplete="tel"
                              defaultValue="+351"
                              className="pl-10"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="reg-password">
                            {t('auth.password')}
                          </Label>
                          <div className="relative">
                            <LockKeyhole
                              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                              aria-hidden="true"
                            />
                            <Input
                              id="reg-password"
                              name="password"
                              type={showRegisterPassword ? 'text' : 'password'}
                              required
                              minLength={12}
                              autoComplete="new-password"
                              className="pl-10 pr-12"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowRegisterPassword((value) => !value)
                              }
                              aria-label={
                                showRegisterPassword
                                  ? t('auth.hidePassword')
                                  : t('auth.showPassword')
                              }
                              className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                            >
                              {showRegisterPassword ? (
                                <EyeOff className="size-4" aria-hidden="true" />
                              ) : (
                                <Eye className="size-4" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </div>

                        <label className="flex items-start gap-3 text-sm leading-relaxed text-zinc-300">
                          <Checkbox
                            id="terms"
                            checked={acceptedTerms}
                            onCheckedChange={(value) =>
                              setAcceptedTerms(Boolean(value))
                            }
                            className="mt-0.5"
                          />
                          <span>
                            {t('legal.agreePrefix')}{' '}
                            <TermsDrawer
                              trigger={
                                <button
                                  type="button"
                                  className="font-semibold text-zinc-100 underline underline-offset-4 hover:text-white"
                                >
                                  {t('legal.termsLink')}
                                </button>
                              }
                            />
                          </span>
                        </label>

                        <Button
            aria-label={isSubmitting ? "A iniciar sessão" : "Continuar"}
                          type="submit"
                          disabled={isSubmitting}
                          className="min-h-11 w-full rounded-full font-semibold"
                        >
                          {isSubmitting ? (
                            <Spinner className="size-4" />
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              {t('auth.createAccountWorkspace')}{' '}
                              <ArrowRight
                                className="size-4"
                                aria-hidden="true"
                              />
                            </span>
                          )}
                        </Button>
                      </form>
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>
          </div>
        </StarfieldBackground>
      </main>
    </TooltipProvider>
  );
}
