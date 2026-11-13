'use client';

import { CalendarX2, Check } from 'lucide-react';
import { AppointmentCompletionDialog } from './appointment-completion-dialog';
import type { Appointment } from '@/types';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type Props = {
  appointment: Appointment;
  finishingBookingId: string | null;
  setFinishingBookingId: (id: string | null) => void;
  valueProducts: string;
  setValueProducts: (value: string) => void;
  descriptionProducts: string;
  setDescriptionProducts: (value: string) => void;
  confirmBooking: (id: string) => void | Promise<void>;
  finalizeBooking: (id: string, paymentMethod: string) => Promise<boolean>;
  addCompletedAppointmentClient: (id: string) => void | Promise<void>;
  addingClientAppointmentId: string | null;
  handleCancelBooking: (id: string) => void | Promise<unknown>;
  compact?: boolean;
  onDetails?: () => void;
  locale?: string;
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
  handleCancelBooking,
  compact = false,
  onDetails,
  locale = 'pt',
}: Props) {
  const isEnglish = locale === 'en';
  const name =
    appointment.users?.name_complete ||
    appointment.manual_name ||
    (isEnglish ? 'Customer' : 'Cliente');
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
          {isEnglish ? 'View details' : 'Ver detalhes'}
        </Button>
      )}

      {appointment.status === 'pending' && (
        <Button
          variant="ghost"
          onClick={() => confirmBooking(appointment.id)}
          className={`${buttonSize} border border-blue-500/20 bg-blue-500/10 text-xs font-medium text-blue-400 hover:bg-blue-500/20`}
        >
          <Check className="mr-1.5 size-4" aria-hidden="true" />
          {appointment.payment_status === 'awaiting_review'
            ? isEnglish
              ? 'Review MB WAY'
              : 'Validar MB WAY'
            : isEnglish
              ? 'Confirm'
              : 'Confirmar'}
        </Button>
      )}

      {appointment.status === 'scheduled' && (
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setFinishingBookingId(appointment.id)}
            className={`${buttonSize} border border-emerald-500/20 bg-emerald-500/10 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20`}
          >
            <Check className="mr-1.5 size-4" aria-hidden="true" />
            {isEnglish ? 'Complete' : 'Concluir'}
          </Button>
          <AppointmentCompletionDialog
            appointment={appointment}
            open={finishingBookingId === appointment.id}
            onOpenChange={(open) => {
              if (!open) setFinishingBookingId(null);
            }}
            valueProducts={valueProducts}
            setValueProducts={setValueProducts}
            descriptionProducts={descriptionProducts}
            setDescriptionProducts={setDescriptionProducts}
            finalizeBooking={finalizeBooking}
            addCompletedAppointmentClient={addCompletedAppointmentClient}
            addingClientAppointmentId={addingClientAppointmentId}
            locale={locale}
          />
        </>
      )}

      {(appointment.status === 'scheduled' ||
        appointment.status === 'pending') && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                appointment.payment_status === 'awaiting_review'
                  ? isEnglish
                    ? 'Reject prepayment from ' + name
                    : 'Rejeitar pré-pagamento de ' + name
                  : isEnglish
                    ? 'Cancel booking for ' + name
                    : 'Cancelar marcação de ' + name
              }
              className={
                compact
                  ? 'h-8 w-8 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : 'min-h-[44px] min-w-[44px] rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20'
              }
            >
              <CalendarX2 className="size-4" aria-hidden="true" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="w-[92vw] max-w-[420px] rounded-xl border-white/10 bg-zinc-950">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {appointment.payment_status === 'awaiting_review'
                  ? isEnglish
                    ? 'Reject this prepayment and cancel the booking?'
                    : 'Rejeitar o pré-pagamento e cancelar a marcação?'
                  : isEnglish
                    ? 'Cancel this booking?'
                    : 'Cancelar esta marcação?'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-6 text-zinc-400">
                {appointment.payment_status === 'awaiting_review'
                  ? isEnglish
                    ? 'The prepayment will be rejected, the booking will be cancelled and the customer will receive an email explaining that the barbershop cancelled it.'
                    : 'O pré-pagamento será rejeitado, a marcação será cancelada e o cliente receberá um email a informar que a barbearia a cancelou.'
                  : isEnglish
                    ? 'The booking will be cancelled and the customer will receive an email explaining that the barbershop cancelled it.'
                    : 'A marcação será cancelada e o cliente receberá um email a informar que a barbearia a cancelou.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row justify-end gap-2">
              <AlertDialogCancel className="m-0 min-h-[44px] flex-1 border-white/10 bg-transparent text-white">
                {isEnglish ? 'Keep booking' : 'Manter marcação'}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleCancelBooking(appointment.id)}
                className="m-0 min-h-[44px] flex-1 bg-red-600 text-white hover:bg-red-500"
              >
                {appointment.payment_status === 'awaiting_review'
                  ? isEnglish
                    ? 'Reject and cancel'
                    : 'Rejeitar e cancelar'
                  : isEnglish
                    ? 'Cancel booking'
                    : 'Cancelar marcação'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
