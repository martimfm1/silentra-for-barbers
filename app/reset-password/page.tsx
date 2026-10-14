'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, Eye, EyeOff, ArrowRight } from 'lucide-react';
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

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push('/login?tab=login&reset=success');
    } catch (err: any) {
      setErrorMsg(err.message || t('auth.invalidResetLink'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col antialiased selection:bg-zinc-50 selection:text-zinc-950">
      <StarfieldBackground>
        <SiteNavbar />
        <section className="flex flex-1 items-center justify-center px-4 pt-24 pb-12 max-w-lg mx-auto w-full min-h-screen">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full border border-white/10 bg-zinc-950/60 shadow-2xl backdrop-blur-xl rounded-2xl overflow-hidden"
          >
            <CardHeader className="gap-2 pb-2 px-6 pt-6">
              <Badge className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-zinc-300">
                New Credentials
              </Badge>
              <CardTitle className="font-heading text-xl text-zinc-50 tracking-tight">
                Set new password
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Enter your new password below to secure your workspace.
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 pb-6 pt-3">
              <AnimatePresence mode="wait">
                {errorMsg && (
                  <motion.div
                    role="alert"
                    aria-live="assertive"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 text-xs bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl mb-4 text-center font-medium"
                  >
                    {errorMsg}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="grid gap-4">
                <Field>
                  <FieldGroup className="grid gap-1.5">
                    <FieldLabel>
                      <Label
                        htmlFor="new-password"
                        className="text-xs font-medium text-zinc-300"
                      >
                        New Password
                      </Label>
                    </FieldLabel>
                    <FieldContent>
                      <div className="relative group">
                        <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                        <Input
                          id="new-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={12}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="h-12 text-base sm:text-xs border-white/10 bg-white/5 pl-10 pr-12 text-zinc-50 focus-visible:ring-white/20 rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={
                            showPassword
                              ? 'Ocultar palavra-passe'
                              : 'Mostrar palavra-passe'
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center text-zinc-400 hover:text-zinc-100"
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                    </FieldContent>
                  </FieldGroup>
                </Field>

                <Button
                  type="submit"
                  disabled={isSubmitting || password.length < 12}
                  className="h-12 w-full rounded-full bg-zinc-50 text-xs font-bold text-zinc-950 hover:bg-white transition-all shadow-md mt-1"
                >
                  {isSubmitting ? (
                    <Spinner className="size-4 text-zinc-950" />
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Update Password <ArrowRight className="size-4" />
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
          </motion.div>
        </section>
      </StarfieldBackground>
    </main>
  );
}
