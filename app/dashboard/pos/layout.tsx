'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, ClipboardList, Package, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/dashboard/pos', label: 'Ponto de venda', icon: ShoppingCart },
  { href: '/dashboard/pos/produtos', label: 'Produtos', icon: Package },
  { href: '/dashboard/pos/pedidos', label: 'Encomendas', icon: ClipboardList },
  { href: '/dashboard/pos/overview', label: 'Relatórios', icon: BarChart3 },
];

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-w-0 mt-12">
      <nav
        aria-label="Área de vendas"
        className="sticky top-2 z-30 mb-5 rounded-2xl bg-zinc-950/10 p-1.5 shadow-[0_14px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl"
      >
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active =
              pathname === tab.href ||
              (tab.href !== '/dashboard/pos' &&
                pathname.startsWith(`${tab.href}/`));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-2.5 text-center text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80',
                  active
                    ? 'bg-white/[0.09] text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200',
                )}
              >
                <Icon
                  className={cn('size-4', active && 'text-emerald-300')}
                  aria-hidden="true"
                />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </div>
  );
}
