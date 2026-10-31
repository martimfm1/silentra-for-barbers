'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type DashboardConfirmationOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PendingConfirmation = DashboardConfirmationOptions & { id: number };
type ConfirmFunction = (
  options: DashboardConfirmationOptions,
) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFunction | null>(null);

export function DashboardConfirmProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const nextId = useRef(0);

  const settle = useCallback((confirmed: boolean) => {
    const currentResolver = resolver.current;
    resolver.current = null;
    setPending(null);
    currentResolver?.(confirmed);
  }, []);

  const confirm = useCallback<ConfirmFunction>((options) => {
    return new Promise<boolean>((resolve) => {
      if (resolver.current) {
        resolver.current(false);
      }
      resolver.current = resolve;
      nextId.current += 1;
      setPending({ ...options, id: nextId.current });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && resolver.current) settle(false);
        }}
      >
        {pending && (
          <AlertDialogContent
            key={pending.id}
            className="border-white/10 bg-zinc-950 text-zinc-100"
          >
            <AlertDialogHeader>
              <AlertDialogTitle>{pending.title}</AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-400">
                {pending.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="border-white/10 bg-transparent text-zinc-200 hover:bg-white/5"
                onClick={() => settle(false)}
              >
                {pending.cancelLabel ?? 'Cancelar'}
              </AlertDialogCancel>
              <AlertDialogAction
                className={
                  pending.destructive
                    ? 'bg-red-600 text-white hover:bg-red-500'
                    : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                }
                onClick={() => settle(true)}
              >
                {pending.confirmLabel ?? 'Confirmar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useDashboardConfirm(): ConfirmFunction {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error(
      'useDashboardConfirm must be used inside DashboardConfirmProvider.',
    );
  }
  return confirm;
}
