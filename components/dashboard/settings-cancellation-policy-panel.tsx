'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarX2, Check, Clock3 } from 'lucide-react';
import { Input } from '@/components/ui/input';

const PRESETS = [0, 2, 6, 12, 24, 48, 72] as const;

function formatHours(hours: number) {
  if (hours === 0) return 'Sem prazo mínimo';
  if (hours === 1) return '1 hora';
  return `${hours} horas`;
}

function setNativeInputValue(input: HTMLInputElement, value: number) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, String(value));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export function SettingsCancellationPolicyPanel() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [sourceInput, setSourceInput] = useState<HTMLInputElement | null>(null);
  const [hours, setHours] = useState(24);

  useEffect(() => {
    const findTarget = () => {
      const input = document.querySelector<HTMLInputElement>(
        '#settings-hours input[type="number"][min="0"][max="720"]',
      );
      if (!input || !input.parentElement) return false;

      const container = input.parentElement;
      const initialValue = Number(input.value);
      setHours(Number.isFinite(initialValue) ? initialValue : 24);
      setSourceInput(input);
      setTarget(container);

      Array.from(container.children).forEach((child) => {
        if (child instanceof HTMLElement) {
          child.style.display = 'none';
        }
      });
      return true;
    };

    if (findTarget()) return;

    const observer = new MutationObserver(() => {
      if (findTarget()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!sourceInput) return;
    const sync = () => {
      const next = Number(sourceInput.value);
      if (Number.isFinite(next)) setHours(next);
    };
    sourceInput.addEventListener('input', sync);
    sourceInput.addEventListener('change', sync);
    return () => {
      sourceInput.removeEventListener('input', sync);
      sourceInput.removeEventListener('change', sync);
    };
  }, [sourceInput]);

  if (!target || !sourceInput) return null;

  const invalid = !Number.isInteger(hours) || hours < 0 || hours > 720;
  const updateHours = (next: number) => {
    setHours(next);
    setNativeInputValue(sourceInput, next);
  };

  return createPortal(
    <div className="space-y-6" data-cancellation-policy-panel>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-amber-300">
          <CalendarX2 className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-100">
            Prazo de cancelamento
          </p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-600">
            Define com quantas horas de antecedência o cliente pode cancelar ou
            reagendar uma marcação.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="grid gap-2">
          <label
            htmlFor="settings-cancellation-hours-enhanced"
            className="text-sm font-medium text-zinc-300"
          >
            Horas antes da marcação
          </label>
          <Input
            id="settings-cancellation-hours-enhanced"
            type="number"
            min={0}
            max={720}
            step={1}
            value={hours}
            onChange={(event) => updateHours(Number(event.target.value))}
            className="min-h-12 rounded-xl border-white/10 bg-white/[0.04] text-lg tabular-nums"
            aria-invalid={invalid}
          />
          {invalid ? (
            <p className="text-xs text-red-300">
              Usa um número inteiro entre 0 e 720 horas.
            </p>
          ) : (
            <p className="text-xs leading-5 text-zinc-600">
              0 permite cancelar até à hora marcada.
            </p>
          )}
        </div>

        <div className="border-l border-white/10 pl-5 sm:min-w-52">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            <Clock3 className="size-3.5" aria-hidden="true" /> Regra atual
          </p>
          <p className="mt-2 text-lg font-semibold text-white">
            {formatHours(hours)}
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Atalhos
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((preset) => {
            const active = hours === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => updateHours(preset)}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${active ? 'border-amber-400/30 bg-amber-400/10 text-amber-100' : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'}`}
                aria-pressed={active}
              >
                {active ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : null}
                {formatHours(preset)}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    target,
  );
}
