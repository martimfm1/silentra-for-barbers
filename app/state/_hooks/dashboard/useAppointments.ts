import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { appointmentService } from '@/app/dashboard/_services/appointments.service';
import {
  createScheduleBlock,
  deleteScheduleBlock,
} from '@/app/dashboard/_services/schedule-blocks.service';
import { combineDatetime } from '@/app/dashboard/_lib/date-utils';
import { getErrorMessage } from '@/app/dashboard/_lib/error-utils';
import type { BookingRecurrence, BlockFormData } from '@/types';
import { useLanguage } from '@/context/LanguageContext';

const MAX_RECURRING_APPOINTMENTS = 52;

type RecurrenceGenerationError = 'invalid-range' | 'no-repeats' | 'too-many';

function isValidDateValue(value: string) {
  const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function formatUtcDate(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function getRecurringOccurrenceDate(
  startDate: string,
  frequency: Exclude<BookingRecurrence, 'none'>,
  occurrence: number,
) {
  const [year, month, day] = startDate.split('-').map(Number);

  if (frequency === 'monthly') {
    const targetMonth = new Date(Date.UTC(year, month - 1 + occurrence, 1));
    const lastDay = new Date(
      Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0),
    ).getUTCDate();
    targetMonth.setUTCDate(Math.min(day, lastDay));
    return formatUtcDate(targetMonth);
  }

  const intervalDays =
    frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : 21;
  return formatUtcDate(
    new Date(Date.UTC(year, month - 1, day + intervalDays * occurrence)),
  );
}

function generateRecurringBookingDates(
  startDate: string,
  endDate: string,
  frequency: BookingRecurrence,
): { dates: string[]; error: RecurrenceGenerationError | null } {
  if (frequency === 'none') return { dates: [startDate], error: null };
  if (
    !isValidDateValue(startDate) ||
    !isValidDateValue(endDate) ||
    endDate <= startDate
  ) {
    return { dates: [], error: 'invalid-range' };
  }

  const dates = [startDate];
  for (
    let occurrence = 1;
    occurrence <= MAX_RECURRING_APPOINTMENTS;
    occurrence += 1
  ) {
    const nextDate = getRecurringOccurrenceDate(
      startDate,
      frequency,
      occurrence,
    );
    if (nextDate > endDate) break;
    dates.push(nextDate);
    if (dates.length > MAX_RECURRING_APPOINTMENTS) {
      return { dates: [], error: 'too-many' };
    }
  }

  if (dates.length < 2) return { dates: [], error: 'no-repeats' };
  return { dates, error: null };
}

export function useAppointments(
  barbershopId: string | null,
  onRefreshData: () => Promise<void>,
) {
  const { locale, t } = useLanguage();
  const [loadingAppointments, setLoading] = useState(false);
  const [finishingBookingId, setFinishingBookingId] = useState<string | null>(
    null,
  );
  const [addingClientAppointmentId, setAddingClientAppointmentId] = useState<
    string | null
  >(null);
  const [valueProducts, setValueProducts] = useState('');
  const [descriptionProducts, setDescriptionProducts] = useState('');
  const [bookingFormData, setBookingFormData] = useState({
    clientId: '',
    serviceId: '',
    professionalId: '',
    date: '',
    time: '',
    manualName: '',
    manualPhone: '',
    birthDate: '',
  });
  const [blockFormData, setBlockFormData] = useState<BlockFormData>({
    professional_id: '',
    start_date: '',
    start_time: '',
    end_time: '',
    reason: '',
  });

  const addCompletedAppointmentClient = useCallback(
    async (appointmentId: string) => {
      if (!barbershopId) return;
      setAddingClientAppointmentId(appointmentId);
      try {
        const result =
          await appointmentService.addClientFromCompletedAppointment(
            barbershopId,
            appointmentId,
          );
        if (result.error) throw result.error;
        toast.success(
          result.alreadyExists
            ? 'Este cliente já estava na tua lista.'
            : 'Cliente adicionado à lista.',
        );
        await onRefreshData();
      } catch (error) {
        console.error('[Add Client From Appointment Error]:', error);
        toast.error(getErrorMessage(error));
      } finally {
        setAddingClientAppointmentId(null);
      }
    },
    [barbershopId, onRefreshData],
  );

  const handleCreateBooking = useCallback(
    async (
      e?: React.SyntheticEvent,
      recurrenceOptions: {
        frequency?: BookingRecurrence;
        endDate?: string;
      } = {},
    ) => {
      if (e && 'preventDefault' in e) e.preventDefault();
      if (!barbershopId) return false;
      setLoading(true);
      try {
        const {
          clientId,
          serviceId,
          professionalId,
          date,
          time,
          manualName,
          manualPhone,
          birthDate,
        } = bookingFormData;
        if (!manualName?.trim() || !manualPhone?.trim()) {
          toast.error(
            locale === 'en'
              ? 'Enter the customer name and phone number.'
              : 'Indica o nome e o telemóvel do cliente.',
          );
          return false;
        }
        if (!serviceId || !professionalId || !date || !time) {
          toast.error(
            locale === 'en'
              ? 'Choose a service, barber, date and time.'
              : 'Escolhe o serviço, o barbeiro, a data e a hora.',
          );
          return false;
        }
        const recurrence = recurrenceOptions.frequency ?? 'none';
        const generatedDates = generateRecurringBookingDates(
          date,
          recurrenceOptions.endDate ?? '',
          recurrence,
        );
        if (generatedDates.error) {
          const message =
            generatedDates.error === 'too-many'
              ? t('bookingForm.recurringLimit')
              : generatedDates.error === 'no-repeats'
                ? t('bookingForm.recurringAtLeastOne')
                : t('bookingForm.recurringEndAfterStart');
          toast.error(message);
          return false;
        }
        const createPayloads = generatedDates.dates.map((bookingDate) => ({
          barbershop_id: barbershopId,
          date_hour: combineDatetime(bookingDate, time),
          status: 'pending' as const,
          client_id: clientId || null,
          service_id: serviceId,
          professional_id: professionalId,
          manual_name: manualName || null,
          manual_phone: manualPhone || null,
          manual_birth_date: birthDate || null,
        }));
        const result =
          createPayloads.length === 1
            ? await appointmentService.create(createPayloads[0])
            : await appointmentService.createMany(createPayloads);
        if (result.error) {
          const databaseError = result.error as Error & { code?: string };
          if (
            databaseError.code === '23P01' ||
            databaseError.code === '23505' ||
            databaseError.message.includes('BOOKING_CONFLICT')
          ) {
            toast.error(
              recurrence === 'none'
                ? locale === 'en'
                  ? 'This time slot is no longer available.'
                  : 'Este horário já não está disponível.'
                : t('bookingForm.recurringConflict'),
            );
            return false;
          }
          throw result.error;
        }
        toast.success(
          recurrence === 'none'
            ? locale === 'en'
              ? 'Booking created successfully.'
              : 'Marcação criada com sucesso.'
            : t('bookingForm.recurringCreated', {
                count: generatedDates.dates.length,
              }),
        );
        setBookingFormData({
          clientId: '',
          serviceId: '',
          professionalId: '',
          date: '',
          time: '',
          manualName: '',
          manualPhone: '',
          birthDate: '',
        });
        await onRefreshData();
        return true;
      } catch (error) {
        console.error('[Create Booking Hook Error]:', error);
        toast.error(getErrorMessage(error));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [barbershopId, bookingFormData, locale, onRefreshData, t],
  );

  const confirmBooking = useCallback(
    async (appointmentId: string) => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/appointments/${appointmentId}/confirm`,
          { method: 'POST' },
        );
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success)
          throw new Error(
            result?.error || 'Não foi possível confirmar a marcação.',
          );
        if (result.emailSent)
          toast.success('Marcação confirmada e e-mail enviado.');
        else if (result.emailError)
          toast.warning(
            'Marcação confirmada, mas não foi possível enviar o e-mail.',
          );
        else
          toast.success(
            'Marcação confirmada. O cliente não tem e-mail associado.',
          );
        await onRefreshData();
      } catch (error) {
        console.error('[Confirm Booking Hook Error]:', error);
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [onRefreshData],
  );

  const finalizeBooking = useCallback(
    async (appointmentId: string, paymentMethod: string) => {
      setLoading(true);
      try {
        const parsedValue = valueProducts === '' ? 0 : Number(valueProducts);
        if (!Number.isFinite(parsedValue) || parsedValue < 0)
          throw new Error('O valor adicional não é válido.');

        const response = await fetch(
          `/api/appointments/${appointmentId}/complete`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentMethod,
              valueProducts: parsedValue,
              descriptionProducts,
            }),
          },
        );
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success)
          throw new Error(result?.error || 'Erro ao concluir o serviço.');

        const emailMessage = result.reviewEmailSent
          ? ' Foi enviado um e-mail ao cliente com o pedido de avaliação.'
          : '';
        toast.success(`Serviço concluído com sucesso.${emailMessage}`, {
          duration: 10000,
          action: {
            label: 'Adicionar aos clientes',
            onClick: () => void addCompletedAppointmentClient(appointmentId),
          },
        });
        setFinishingBookingId(null);
        setValueProducts('');
        setDescriptionProducts('');
        await onRefreshData();
      } catch (error) {
        console.error('[Finalize Booking Hook Error]:', error);
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [
      valueProducts,
      descriptionProducts,
      addCompletedAppointmentClient,
      onRefreshData,
    ],
  );

  const handleCreateBlock = useCallback(
    async (e?: React.SyntheticEvent) => {
      if (e && 'preventDefault' in e) e.preventDefault();
      if (!barbershopId) return false;
      const { professional_id, start_date, start_time, end_time, reason } =
        blockFormData;
      if (!professional_id || !start_date || !start_time || !end_time) {
        toast.error('Por favor, seleciona uma data válida para o bloqueio.');
        return false;
      }
      setLoading(true);
      try {
        const { error } = await createScheduleBlock({
          professional_id,
          barbershop_id: barbershopId,
          date: start_date,
          start_time,
          end_time,
          reason: reason || 'Bloqueio de Agenda',
        });
        if (error) throw error;
        toast.success('Bloqueio de horário criado com sucesso.');
        setBlockFormData({
          professional_id: '',
          start_date: '',
          start_time: '',
          end_time: '',
          reason: '',
        });
        await onRefreshData();
        return true;
      } catch (error) {
        console.error('[Create Block Hook Error]:', error);
        toast.error(getErrorMessage(error));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [barbershopId, blockFormData, onRefreshData],
  );

  const handleDeleteBlock = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const { error } = await deleteScheduleBlock(id);
        if (error) throw error;
        toast.success('Bloqueio de horário removido.');
        await onRefreshData();
      } catch (error) {
        console.error('[Delete Block Hook Error]:', error);
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [onRefreshData],
  );
  const handleCancelBooking = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const response = await fetch(
          '/api/appointments/' + encodeURIComponent(id) + '/cancel',
          { method: 'DELETE' },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.success !== true) {
          throw new Error(payload.error || 'Não foi possível cancelar a marcação.');
        }

        if (payload.emailSent === true) {
          toast.success(
            locale === 'en'
              ? 'Booking cancelled. The customer was notified by email.'
              : 'Marcação cancelada. O cliente foi avisado por email.',
          );
        } else {
          toast.warning(
            payload.emailError ||
              (locale === 'en'
                ? 'Booking cancelled, but the customer email could not be sent.'
                : 'Marcação cancelada, mas não foi possível enviar o email ao cliente.'),
          );
        }

        await onRefreshData();
      } catch (error) {
        console.error('[Cancel Booking Hook Error]:', error);
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [locale, onRefreshData],
  );

  return {
    loadingAppointments,
    finishingBookingId,
    setFinishingBookingId,
    addingClientAppointmentId,
    valueProducts,
    setValueProducts,
    descriptionProducts,
    setDescriptionProducts,
    bookingFormData,
    setBookingFormData,
    blockFormData,
    setBlockFormData,
    handleCreateBooking,
    confirmBooking,
    finalizeBooking,
    addCompletedAppointmentClient,
    handleCreateBlock,
    handleDeleteBlock,
    handleCancelBooking,
  };
}
