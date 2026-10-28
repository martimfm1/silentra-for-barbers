'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

export type AnimatedTab = {
  href: string;
  label: string;
  description?: string;
  icon?: ReactNode;
};

export type AnimatedTabOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
};

const springTransition = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 36,
  mass: 0.75,
};

function ActiveBackground({ layoutId }: { layoutId: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      aria-hidden="true"
      layoutId={layoutId}
      transition={reduceMotion ? { duration: 0 } : springTransition}
      className="pointer-events-none absolute inset-0 rounded-xl border border-white/[0.1] bg-white/[0.08] shadow-[0_8px_30px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]"
    />
  );
}

function TabContent({
  label,
  description,
  icon,
  active,
}: {
  label: string;
  description?: string;
  icon?: ReactNode;
  active: boolean;
}) {
  return (
    <span className="relative z-10 flex min-w-0 items-center gap-2.5">
      {icon ? (
        <span
          className={cn(
            'shrink-0 transition-colors duration-200',
            active
              ? 'text-emerald-300'
              : 'text-zinc-500 group-hover:text-zinc-300',
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 text-left">
        <span className="block truncate text-sm font-medium">{label}</span>
        {description ? (
          <span
            className={cn(
              'mt-0.5 block truncate text-[11px] transition-colors duration-200',
              active
                ? 'text-zinc-400'
                : 'text-zinc-600 group-hover:text-zinc-500',
            )}
          >
            {description}
          </span>
        ) : null}
      </span>
    </span>
  );
}

const containerClasses =
  'flex w-full min-w-0 flex-wrap gap-1 rounded-2xl border border-white/10 bg-white/[0.025] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] backdrop-blur-xl';

const tabClasses =
  'group relative min-h-11 min-w-0 flex-1 basis-[calc(50%-0.25rem)] overflow-hidden rounded-xl px-3 py-2 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 motion-reduce:transition-none sm:basis-auto sm:px-4';

export function AnimatedTabs({
  tabs,
  activeHref,
  className,
  layoutId = 'dashboard-link-tab-indicator',
}: {
  tabs: AnimatedTab[];
  activeHref: string;
  className?: string;
  layoutId?: string;
}) {
  return (
    <nav aria-label="Secções" className={cn(containerClasses, className)}>
      {tabs.map((tab) => {
        const active = activeHref === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              tabClasses,
              active
                ? 'text-zinc-50'
                : 'text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-200',
            )}
          >
            {active ? <ActiveBackground layoutId={layoutId} /> : null}
            <TabContent
              label={tab.label}
              description={tab.description}
              icon={tab.icon}
              active={active}
            />
          </Link>
        );
      })}
    </nav>
  );
}

export function AnimatedTabList<T extends string>({
  tabs,
  value,
  onValueChange,
  className,
  tabClassName,
  ariaLabel = 'Secções',
  layoutId = 'dashboard-controlled-tab-indicator',
}: {
  tabs: AnimatedTabOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
  tabClassName?: string;
  ariaLabel?: string;
  layoutId?: string;
}) {
  return (
    <div
      role="tablist"
      data-dashboard-tab-motion="native"
      aria-label={ariaLabel}
      className={cn(containerClasses, className)}
    >
      {tabs.map((tab) => {
        const active = value === tab.value;

        return (
          <button
            aria-label="Selecionar separador"
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(tab.value)}
            className={cn(
              tabClasses,
              active
                ? 'text-zinc-50'
                : 'text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-200',
              tabClassName,
            )}
          >
            {active ? <ActiveBackground layoutId={layoutId} /> : null}
            <TabContent
              label={tab.label}
              description={tab.description}
              icon={tab.icon}
              active={active}
            />
          </button>
        );
      })}
    </div>
  );
}
