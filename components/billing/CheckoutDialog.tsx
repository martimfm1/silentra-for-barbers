'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { StripeProvider } from '@/components/providers/StripeProvider';
import { PaymentForm } from './PaymentForm';
import { SilentraLoading } from '@/components/ui/silentra-loading';
import { captureProductEvent } from '@/lib/observability/posthog';
import { ShieldCheck } from 'lucide-react';

interface CheckoutDialogProps {
  clientSecret: string;
  planName: string;
  priceAmount: string;
  trigger?: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CheckoutDialog({
  clientSecret,
  planName,
  priceAmount,
  trigger,
  isOpen: externalIsOpen,
  onOpenChange: externalOnOpenChange,
  onSuccess,
}: CheckoutDialogProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalOnOpenChange || setInternalIsOpen;

  const handleSuccess = () => {
    captureProductEvent('subscription_payment_completed', {
      plan_name: planName,
    });
    onSuccess?.();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="max-w-md rounded-3xl border border-white/10 bg-zinc-900/95 p-6 backdrop-blur-2xl sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-emerald-400">
            <ShieldCheck className="size-4" />
            Pagamento Seguro
          </div>
          <DialogTitle className="mt-2 text-2xl font-semibold text-zinc-50">
            Subscrever Plano {planName}
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-400">
            Total a pagar:{' '}
            <span className="font-semibold text-zinc-100">{priceAmount}</span>.
            Cancela a qualquer momento.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {clientSecret ? (
            <StripeProvider clientSecret={clientSecret} mode="dark">
              <PaymentForm
                onSuccess={handleSuccess}
                onCancel={() => setIsOpen(false)}
              />
            </StripeProvider>
          ) : (
            <div className="flex min-h-48 items-center justify-center">
              <SilentraLoading variant="compact" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
