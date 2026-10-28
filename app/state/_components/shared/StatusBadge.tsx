'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

const statusConfig = {
  pending: {
    label: 'pending',
    className: 'border-amber-400/20 bg-amber-400/[0.08] text-amber-200',
    dot: 'bg-amber-300',
  },
  scheduled: {
    label: 'scheduled',
    className: 'border-sky-400/20 bg-sky-400/[0.08] text-sky-200',
    dot: 'bg-sky-300',
  },
  completed: {
    label: 'completed',
    className: 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200',
    dot: 'bg-emerald-300',
  },
  cancelled: {
    label: 'cancelled',
    className: 'border-rose-400/20 bg-rose-400/[0.08] text-rose-200',
    dot: 'bg-rose-300',
  },
} as const;

export function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const config = statusConfig[status as keyof typeof statusConfig];

  return (
    <Badge
      variant="ghost"
      className={cn(
        'inline-flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-semibold',
        config?.className ?? 'border-white/10 bg-white/[0.04] text-zinc-300',
      )}
      aria-label={`${t('statusBadge.label')}: ${config ? t(`statusBadge.${config.label}`) : status}`}
    >
      <span
        className={cn('size-1.5 rounded-full', config?.dot ?? 'bg-zinc-500')}
        aria-hidden="true"
      />
      {config ? t(`statusBadge.${config.label}`) : status}
    </Badge>
  );
}
