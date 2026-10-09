import { FormEvent } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

/**
 * Compatibility handler for Supabase confirmation links that still use the
 * legacy implicit flow and return access/refresh tokens in the URL fragment.
 * Fragments never reach the server, so this must be handled in the browser.
 */
if (typeof window !== 'undefined') {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  const authType = hash.get('type');

  if (accessToken && refreshToken && authType === 'signup') {
    void (async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('[AUTH_CONFIRMATION_HASH_REJECTED]', error);
          window.location.replace(
            '/login?error=Link+inv%C3%A1lido+ou+expirado',
          );
          return;
        }

        window.history.replaceState({}, document.title, '/login');
        window.location.replace('/email-confirmed');
      } catch (error) {
        console.error('[AUTH_CONFIRMATION_HASH_ERROR]', error);
        window.location.replace('/login?error=Link+inv%C3%A1lido+ou+expirado');
      }
    })();
  }
}

interface RouterLike {
  push: (path: string) => void;
}

interface LoginParams {
  event: FormEvent<HTMLFormElement>;
  setIsSubmitting: (loading: boolean) => void;
  setErrorMsg: (msg: string | null) => void;
  router: RouterLike;
}

interface LoginResponse {
  error?: string;
  session?: { access_token: string; refresh_token: string };
  user?: { barbershopId?: string | null };
}

export async function handleLogin({
  event,
  setIsSubmitting,
  setErrorMsg,
  router,
}: LoginParams) {
  event.preventDefault();
  setIsSubmitting(true);
  setErrorMsg(null);

  const supabase = createClient();
  const formData = new FormData(event.currentTarget);
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const requestedNext =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('redirect')
      : null;
  const safeNext =
    requestedNext &&
    requestedNext.startsWith('/') &&
    !requestedNext.startsWith('//')
      ? requestedNext
      : null;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const contentType = res.headers.get('content-type');
    let result: LoginResponse = {};

    if (contentType && contentType.includes('application/json')) {
      result = await res.json();
    } else {
      const fallbackText = await res.text();
      throw new Error(
        fallbackText || `Server responded with status ${res.status}`,
      );
    }

    if (!res.ok) {
      const errorText = result.error || 'Credenciais inválidas.';
      toast.error(errorText);
      setErrorMsg(errorText);
      return;
    }

    if (result.session) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });

      if (sessionError) {
        console.error(
          '❌ Failed to sync session on client:',
          sessionError.message,
        );
      }
    }

    if (safeNext) {
      router.push(safeNext);
    } else if (!result.user?.barbershopId) {
      router.push('/onboarding');
    } else {
      router.push('/dashboard');
    }
  } catch (error: unknown) {
    const targetError =
      error instanceof Error
        ? error.message
        : 'Erro de ligação. Por favor, tenta novamente.';
    toast.error(targetError);
    console.error('❌ Error during login:', error);
    setErrorMsg(targetError);
  } finally {
    setIsSubmitting(false);
  }
}

interface RegisterParams {
  event: FormEvent<HTMLFormElement>;
  setIsSubmitting: (loading: boolean) => void;
  setErrorMsg: (msg: string | null) => void;
  acceptedTerms: boolean;
  termsErrorMessage?: string;
  onSuccess?: () => void;
}

export async function handleRegister({
  event,
  setIsSubmitting,
  setErrorMsg,
  acceptedTerms,
  termsErrorMessage = 'Deves aceitar os termos e condições.',
  onSuccess,
}: RegisterParams) {
  event.preventDefault();

  if (!acceptedTerms) {
    toast.error(termsErrorMessage);
    return;
  }

  setIsSubmitting(true);
  setErrorMsg(null);

  const formData = new FormData(event.currentTarget);
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string;
  const password = formData.get('password') as string;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name_complete: name,
        email,
        num_phone: phone,
        password,
      }),
    });

    const contentType = res.headers.get('content-type');
    let data: { error?: string } = {};

    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const fallbackText = await res.text();
      throw new Error(
        fallbackText || `Server responded with status ${res.status}`,
      );
    }

    if (!res.ok) {
      throw new Error(data.error || 'Falha ao criar conta.');
    }

    toast.success('Conta criada! Confirma o teu e-mail para continuar.');

    if (onSuccess) {
      onSuccess();
    } else {
      throw new Error(
        'Registo concluído, mas não foi definida uma página de confirmação.',
      );
    }
  } catch (error) {
    const targetError =
      error instanceof Error
        ? error.message
        : 'Erro de ligação. Por favor, tenta novamente.';
    toast.error(targetError);
    console.error('❌ Error during registration:', error);
    setErrorMsg(targetError);
  } finally {
    setIsSubmitting(false);
  }
}
