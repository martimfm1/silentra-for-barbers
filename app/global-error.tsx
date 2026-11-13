'use client';

import { useEffect } from 'react';
import { captureException } from '@/lib/observability/sentry';
import { capturePostHogException } from '@/lib/observability/posthog';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, {
      area: 'nextjs',
      action: 'global_error_boundary',
    });
    capturePostHogException(error);
  }, [error]);

  return (
    <html lang="pt-PT">
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-2xl font-semibold">Ocorreu um erro inesperado</h1>
          <p className="text-sm text-zinc-400">
            A aplicação encontrou um problema. Podes tentar carregar novamente.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/15"
          >
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
