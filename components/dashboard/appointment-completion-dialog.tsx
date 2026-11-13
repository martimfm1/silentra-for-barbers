'use client';

import { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import type { Appointment } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = {
  appointment: Appointment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  valueProducts: string;
  setValueProducts: (value: string) => void;
  descriptionProducts: string;
  setDescriptionProducts: (value: string) => void;
  finalizeBooking: (
    appointmentId: string,
    paymentMethod: string,
  ) => Promise<boolean>;
  addCompletedAppointmentClient: (appointmentId: string) => void | Promise<void>;
  addingClientAppointmentId: string | null;
  locale?: string;
  onCompleted?: () => void;
};

export function AppointmentCompletionDialog({
  appointment,
  open,
  onOpenChange,
  valueProducts,
  setValueProducts,
  descriptionProducts,
  setDescriptionProducts,
  finalizeBooking,
  addCompletedAppointmentClient,
  addingClientAppointmentId,
  locale = 'pt',
  onCompleted,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEnglish = locale === 'en';
  const name =
    appointment.users?.name_complete ||
    appointment.manual_name ||
    (isEnglish ? 'Customer' : 'Cliente');
  const isAddingClient = addingClientAppointmentId === appointment.id;

  const complete = async (paymentMethod: 'cash' | 'mbway' | 'card') => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    let completed = false;
    try {
      completed = await finalizeBooking(appointment.id, paymentMethod);
    } finally {
      setIsSubmitting(false);
    }
    if (completed) {
      onOpenChange(false);
      onCompleted?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-[420px] rounded-xl border-white/10 bg-zinc-950 p-5 text-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-zinc-100">
            {isEnglish ? 'Complete appointment' : 'Concluir atendimento'}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            {isEnglish ? (
              <>
                Complete the appointment for{' '}
                <strong className="text-zinc-200">{name}</strong> and choose
                how the payment was received.
              </>
            ) : (
              <>
                Finaliza o atendimento de{' '}
                <strong className="text-zinc-200">{name}</strong> e escolhe
                como foi recebido o pagamento.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`prod-desc-${appointment.id}`}
              className="text-xs font-medium text-zinc-300"
            >
              {isEnglish ? 'Extra product ' : 'Produto extra '}{' '}
              <span className="text-zinc-500">
                ({isEnglish ? 'optional' : 'opcional'})
              </span>
            </label>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <input
                id={`prod-desc-${appointment.id}`}
                type="text"
                placeholder={isEnglish ? 'E.g. Styling clay' : 'Ex.: Pomada'}
                className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={descriptionProducts}
                onChange={(event) => setDescriptionProducts(event.target.value)}
                disabled={isSubmitting}
              />
              <input
                id={`prod-val-${appointment.id}`}
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00 €"
                aria-label={
                  isEnglish
                    ? 'Product price in euros'
                    : 'Valor do produto em euros'
                }
                className="min-h-[44px] w-full min-w-0 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:w-28 sm:shrink-0"
                value={valueProducts}
                onChange={(event) =>
                  setValueProducts(
                    event.target.value === '0' ? '' : event.target.value,
                  )
                }
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-200">
                  {isEnglish ? 'Customer' : 'Cliente'}
                </p>
                <p className="text-[11px] leading-5 text-zinc-500">
                  {isEnglish
                    ? 'Save this booking contact to your client list.'
                    : 'Guarda os dados desta marcação na tua lista.'}
                </p>
              </div>
              {appointment.client_id ? (
                <span className="w-fit rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400">
                  {isEnglish ? 'Already a client' : 'Já é cliente'}
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              disabled={Boolean(appointment.client_id) || isAddingClient || isSubmitting}
              onClick={() => addCompletedAppointmentClient(appointment.id)}
              className="min-h-[44px] w-full border border-white/10 bg-white/[0.04] text-xs text-zinc-100 hover:bg-white/[0.08] disabled:opacity-50"
            >
              {isAddingClient ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="mr-2 size-4" aria-hidden="true" />
              )}
              {appointment.client_id
                ? isEnglish
                  ? 'Already in client list'
                  : 'Cliente já está na lista'
                : isEnglish
                  ? 'Add to client list'
                  : 'Adicionar à lista de clientes'}
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-300">
              {isEnglish ? 'How was it paid?' : 'Como foi pago?'}
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting}
                onClick={() => void complete('cash')}
                className="min-h-[44px] border border-white/10 bg-white/5 text-xs text-zinc-100 hover:bg-white/10"
              >
                {isEnglish ? 'Cash' : 'Dinheiro'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting}
                onClick={() => void complete('mbway')}
                className="min-h-[44px] border border-white/10 bg-white/5 text-xs text-zinc-100 hover:bg-white/10"
              >
                MB WAY
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting}
                onClick={() => void complete('card')}
                className="min-h-[44px] border border-white/10 bg-white/5 text-xs text-zinc-100 hover:bg-white/10"
              >
                {isEnglish ? 'Card' : 'Cartão'}
              </Button>
            </div>
            {isSubmitting ? (
              <p className="flex items-center gap-2 text-xs text-zinc-500" role="status">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                {isEnglish ? 'Completing appointment…' : 'A concluir a marcação…'}
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
