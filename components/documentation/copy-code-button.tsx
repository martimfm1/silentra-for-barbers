'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyCodeButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copyCode() {
    setFailed(false);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable');
      }
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setFailed(true);
      window.setTimeout(() => setFailed(false), 2400);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copyCode()}
      aria-label={copied ? 'Código copiado' : 'Copiar código'}
      title={
        failed
          ? 'Não foi possível copiar; seleciona o código manualmente.'
          : copied
            ? 'Código copiado'
            : 'Copiar código'
      }
      className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-emerald-300" aria-hidden="true" />
          Copiado
        </>
      ) : (
        <>
          <Copy className="size-3.5" aria-hidden="true" />
          Copiar
        </>
      )}
    </button>
  );
}
