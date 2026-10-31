'use client';

import { Check, Loader2, Trash2, UserPlus } from 'lucide-react';
import type { Appointment } from '@/types';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Props = {
  appointment: Appointment;
  finishingBookingId: string | null;
  setFinishingBookingId: (id: string | null) => void;
  valueProducts: string;
  setValueProducts: (value: string) => void;
  descriptionProducts: string;
  setDescriptionProducts: (value: string) => void;
  confirmBooking: (id: string) => void | Promise<void>;
  finalizeBooking: (id: string, paymentMethod: string) => void | Promise<void>;
  addCompletedAppointmentClient: (id: string) => void | Promise<void>;
  addingClientAppointmentId: string | null;
  handleDeleteBooking: (id: string, rejectPrepayment?: boolean) => void | Promise<void>;
  compact?: boolean;
  onDetails?: () => void;
};

export function AppointmentActions({
  appointment,
  finishingBookingId,
  setFinishingBookingId,
  valueProducts,
  setValueProducts,
  descriptionProducts,
  setDescriptionProducts,
  confirmBooking,
  finalizeBooking,
  addCompletedAppointmentClient,
  addingClientAppointmentId,
  handleDeleteBooking,
  compact = false,
  onDetails,
}: Props) {
  const name =
    appointment.users?.name_complete || appointment.manual_name || 'Cliente';
  const isAddingClient = addingClientAppointmentId === appointment.id;
  const buttonSize = compact ? 'h-8 px-3' : 'min-h-[44px] w-full';

  return (
    <div
      className={compact ? 'flex justify-end gap-1.5' : 'space-y-2 pt-1'}
      onClick={(event) => event.stopPropagation()}
    >
      {onDetails && (
        <Button
          type="button"
          variant="ghost"
          onClick={onDetails}
          className={`${compact ? 'h-8 px-3' : 'min-h-[44px] w-full'} border border-white/10 bg-white/[0.03] text-xs font-medium text-zinc-300 hover:bg-white/[0.08]`}
        >
          Ver detalhes
        </Button>
      )}

      {appointment.status === 'pending' && (
        <Button
          variant="ghost"
          onClick={() => confirmBooking(appointment.id)}
          className={`${buttonSize} border border-blue-500/20 bg-blue-500/10 text-xs font-medium text-blue-400 hover:bg-blue-500/20`}
        >
          <Check className="mr-1.5 size-4" aria-hidden="true" />
          {appointment.payment_status === 'awaiting_review' ? 'Validar MB WAY' : 'Confirmar'}
        </Button>
      )}

      {appointment.status === 'scheduled' && (
        <Dialog
          open={finishingBookingId === appointment.id}
          onOpenChange={(open) => !open && setFinishingBookingId(null)}
        >
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              onClick={() => setFinishingBookingId(appointment.id)}
              className={`${buttonSize} border border-emerald-500/20 bg-emerald-500/10 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20`}
            >
              <Check className="mr-1.5 size-4" aria-hidden="true" />
              Concluir
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[92vw] max-w-[420px] rounded-xl border-white/10 bg-zinc-950 p-5 text-white">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-zinc-100">
                Concluir atendimento
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Finaliza o atendimento de{' '}
                <strong className="text-zinc-200">{name}</strong> e escolhe como
                foi recebido o pagamento.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`prod-desc-${appointment.id}`}
                  className="text-xs font-medium text-zinc-300"
                >
                  Produto extra{' '}
                  <span className="text-zinc-500">(opcional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id={`prod-desc-${appointment.id}`}
                    type="text"
                    placeholder="Ex.: Pomada"
                    className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={descriptionProducts}
                    onChange={(event) =>
                      setDescriptionProducts(event.target.value)
                    }
                  />
                  <input
                    id={`prod-val-${appointment.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00 €"
                    aria-label="Valor do produto em euros"
                    className="min-h-[44px] w-24 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={valueProducts}
                    onChange={(event) =>
                      setValueProducts(
                        event.target.value === '0' ? '' : event.target.value,
                      )
                    }
                  />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-zinc-200">
                      Cliente
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Guarda os dados desta marcação na tua lista.
                    </p>
                  </div>
                  {appointment.client_id ? (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400">
                      Já é cliente
                    </span>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={Boolean(appointment.client_id) || isAddingClient}
                  onClick={() => addCompletedAppointmentClient(appointment.id)}
                  className="min-h-[44px] w-full border border-white/10 bg-white/[0.04] text-xs text-zinc-100 hover:bg-white/[0.08] disabled:opacity-50"
                >
                  {isAddingClient ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 size-4" />
                  )}
                  {appointment.client_id
                    ? 'Cliente já está na lista'
                    : 'Adicionar à lista de clientes'}
                </Button>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-zinc-300">
                  Como foi pago?
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => finalizeBooking(appointment.id, 'cash')}
                    className="min-h-[44px] border border-white/10 bg-white/5 text-xs text-zinc-100 hover:bg-white/10"
                  >
                    Dinheiro
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => finalizeBooking(appointment.id, 'mbway')}
                    className="min-h-[44px] border border-white/10 bg-white/5 text-xs text-zinc-100 hover:bg-white/10"
                  >
                    MB WAY
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => finalizeBooking(appointment.id, 'card')}
                    className="min-h-[44px] border border-white/10 bg-white/5 text-xs text-zinc-100 hover:bg-white/10"
                  >
                    Cartão
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {(appointment.status === 'scheduled' ||
        appointment.status === 'pending') && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={appointment.payment_status === 'awaiting_review' ? `Rejeitar pré-pagamento de ${name}` : `Eliminar agendamento de ${name}`}
              className={`${compact ? 'h-8 w-8' : 'min-h-[44px] min-w-[44px]'} rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="w-[92vw] max-w-[400px] rounded-xl border-white/10 bg-zinc-950">
            <AlertDialogHeader>
              <AlertDialogTitle>{appointment.payment_status === 'awaiting_review' ? 'Rejeitar este pré-pagamento?' : 'Eliminar esta marcação?'}</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row justify-end gap-2">
              <AlertDialogCancel className="m-0 min-h-[44px] flex-1 border-white/10 bg-transparent text-white">
                Manter
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDeleteBooking(appointment.id, appointment.payment_status === 'awaiting_review')}
                className="m-0 min-h-[44px] flex-1 bg-red-600 text-white hover:bg-red-500"
              >
                {appointment.payment_status === 'awaiting_review' ? 'Rejeitar pedido' : 'Eliminar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
