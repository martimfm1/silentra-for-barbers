import { Skeleton } from '@/components/ui/skeleton';
import { SilentraLoading } from '@/components/ui/silentra-loading';

export type DashboardSkeletonVariant =
  | 'overview'
  | 'table'
  | 'calendar'
  | 'analytics'
  | 'settings'
  | 'billing'
  | 'marketing'
  | 'crm'
  | 'messages'
  | 'pos';

const VARIANT_CONFIG: Record<
  DashboardSkeletonVariant,
  { columns: string; rows: number }
> = {
  overview: { columns: 'lg:grid-cols-4', rows: 5 },
  table: { columns: 'lg:grid-cols-1', rows: 8 },
  calendar: { columns: 'lg:grid-cols-[1.3fr_0.7fr]', rows: 6 },
  analytics: { columns: 'lg:grid-cols-3', rows: 6 },
  settings: { columns: 'lg:grid-cols-[220px_1fr]', rows: 7 },
  billing: { columns: 'lg:grid-cols-[1.1fr_0.9fr]', rows: 6 },
  marketing: { columns: 'lg:grid-cols-2', rows: 6 },
  crm: { columns: 'lg:grid-cols-[1.1fr_0.9fr]', rows: 7 },
  messages: { columns: 'lg:grid-cols-2', rows: 7 },
  pos: { columns: 'lg:grid-cols-[1.2fr_0.8fr]', rows: 7 },
};

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <Skeleton className={`bg-white/[0.055] ${className}`} />;
}

function HeaderSkeleton() {
  return (
    <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-3">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-9 w-64 max-w-[80vw] sm:w-80" />
        <SkeletonBlock className="h-4 w-80 max-w-[90vw]" />
      </div>
      <div className="flex gap-2">
        <SkeletonBlock className="h-10 w-24 rounded-xl" />
        <SkeletonBlock className="h-10 w-36 rounded-xl" />
      </div>
    </header>
  );
}

function MetricsSkeleton() {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-7 w-24" />
            </div>
            <SkeletonBlock className="size-9 rounded-xl" />
          </div>
          <SkeletonBlock className="mt-4 h-2.5 w-28" />
        </div>
      ))}
    </section>
  );
}

function ContentSkeleton({ variant }: { variant: DashboardSkeletonVariant }) {
  const config = VARIANT_CONFIG[variant];

  if (variant === 'table') {
    return (
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="border-b border-white/10 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SkeletonBlock className="h-10 w-full max-w-sm rounded-xl" />
            <div className="flex gap-2">
              <SkeletonBlock className="h-10 w-24 rounded-xl" />
              <SkeletonBlock className="h-10 w-28 rounded-xl" />
            </div>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {Array.from({ length: config.rows }).map((_, index) => (
            <div
              key={index}
              className="grid gap-3 p-4 sm:grid-cols-[1.5fr_0.8fr_0.8fr_auto] sm:items-center sm:p-5"
            >
              <div className="flex items-center gap-3">
                <SkeletonBlock className="size-10 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonBlock className="h-4 w-40 max-w-full" />
                  <SkeletonBlock className="h-3 w-28" />
                </div>
              </div>
              <SkeletonBlock className="h-4 w-20" />
              <SkeletonBlock className="h-7 w-20 rounded-full" />
              <SkeletonBlock className="h-9 w-9 rounded-lg" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (variant === 'calendar') {
    return (
      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="space-y-2">
              <SkeletonBlock className="h-5 w-36" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
            <div className="flex gap-2">
              <SkeletonBlock className="h-9 w-9 rounded-lg" />
              <SkeletonBlock className="h-9 w-9 rounded-lg" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, index) => (
              <SkeletonBlock key={index} className="aspect-square rounded-xl" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
          <SkeletonBlock className="h-5 w-32" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: config.rows }).map((_, index) => (
              <div
                key={index}
                className="rounded-xl border border-white/10 p-3"
              >
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="mt-2 h-4 w-40 max-w-full" />
                <SkeletonBlock className="mt-3 h-2.5 w-28" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'settings') {
    return (
      <section className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="mb-2 rounded-xl px-3 py-2.5">
              <SkeletonBlock className="h-4 w-28" />
            </div>
          ))}
        </aside>
        <div className="space-y-4">
          {Array.from({ length: config.rows }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
            >
              <SkeletonBlock className="h-5 w-48" />
              <SkeletonBlock className="mt-2 h-3 w-80 max-w-full" />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <SkeletonBlock className="h-10 w-full rounded-xl" />
                <SkeletonBlock className="h-10 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={`grid gap-4 ${config.columns}`}>
      {Array.from({ length: config.rows }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-5 w-40 max-w-full" />
              <SkeletonBlock className="h-3 w-64 max-w-full" />
            </div>
            <SkeletonBlock className="size-9 rounded-xl" />
          </div>
          <SkeletonBlock className="mt-5 h-24 w-full rounded-xl" />
          <div className="mt-4 flex gap-2">
            <SkeletonBlock className="h-9 w-24 rounded-lg" />
            <SkeletonBlock className="h-9 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </section>
  );
}

export function DashboardSkeleton({
  variant = 'overview',
}: {
  variant?: DashboardSkeletonVariant;
}) {
  return (
    <main
      className="min-h-screen bg-background px-3 pb-10 pt-6 text-foreground sm:px-5 md:px-8 md:pt-8"
      aria-busy="true"
      aria-label="A carregar a dashboard"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex justify-center sm:justify-start">
          <SilentraLoading variant="compact" />
        </div>
        <HeaderSkeleton />
        <MetricsSkeleton />
        <ContentSkeleton variant={variant} />
      </div>
    </main>
  );
}
