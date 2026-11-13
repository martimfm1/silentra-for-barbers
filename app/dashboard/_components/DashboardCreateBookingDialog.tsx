'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useBarbershop } from '@/context/BarbershopContext';
import { useLanguage } from '@/context/LanguageContext';
import type {
  BookingFormData,
  BookingRecurrence,
  Client,
  Professional,
  Service,
} from '@/types';
import { appointmentService } from '@/app/dashboard/_services/appointments.service';
import { servicesService } from '@/app/dashboard/_services/services.service';
import { professionalService } from '@/app/dashboard/_services/professionals.service';
import { useAppointments } from '@/app/state/_hooks/dashboard/useAppointments';
import { BookingForm } from '@/app/dashboard/_components/cards/BookingFormCard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

const OPEN_CREATE_EVENT = 'silentra:open-create-booking';

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addMonthsToDateValue(value: string, months: number) {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const targetMonth = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  targetMonth.setUTCDate(Math.min(day, lastDay));
  return [
    targetMonth.getUTCFullYear(),
    String(targetMonth.getUTCMonth() + 1).padStart(2, '0'),
    String(targetMonth.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

const EMPTY_FORM: BookingFormData = {
  clientId: undefined,
  name_complete: '',
  num_phone: '',
  email: '',
  service_id: '',
  birth_date: '',
};

export function DashboardCreateBookingDialog() {
  const { barbershopId, loading: barbershopLoading } = useBarbershop();
  const { locale, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState<BookingFormData>(EMPTY_FORM);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('');
  const [selectedDate, setSelectedDate] = useState(getLocalDateInputValue);
  const [selectedTime, setSelectedTime] = useState('');
  const [recurrence, setRecurrence] = useState<BookingRecurrence>('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  const refreshBookingData = useCallback(async () => {
    if (!barbershopId) return;
    setLoadingData(true);
    try {
      const [servicesResult, professionalsResult, clientsResult] =
        await Promise.all([
          servicesService.getAll(barbershopId),
          professionalService.getAll(barbershopId),
          appointmentService.getClients(barbershopId),
        ]);
      if (servicesResult.error) throw servicesResult.error;
      if (professionalsResult.error) throw professionalsResult.error;
      if (clientsResult.error) throw clientsResult.error;
      setServices(servicesResult.data ?? []);
      setProfessionals(professionalsResult.data ?? []);
      setClients(clientsResult.data ?? []);
    } catch (error) {
      console.error('[Dashboard Create Booking Data Error]', error);
      toast.error(
        locale === 'en'
          ? 'Could not load the information needed to create a booking.'
          : 'Não foi possível carregar os dados necessários para criar a marcação.',
      );
    } finally {
      setLoadingData(false);
    }
  }, [barbershopId, locale]);

  const {
    loadingAppointments,
    setBookingFormData,
    handleCreateBooking,
  } = useAppointments(barbershopId, refreshBookingData);

  useEffect(() => {
    const openCreateBooking = () => setOpen(true);
    window.addEventListener(OPEN_CREATE_EVENT, openCreateBooking);
    return () =>
      window.removeEventListener(OPEN_CREATE_EVENT, openCreateBooking);
  }, []);

  useEffect(() => {
    if (open && !barbershopLoading && barbershopId) {
      void refreshBookingData();
    }
  }, [open, barbershopId, barbershopLoading, refreshBookingData]);

  useEffect(() => {
    setBookingFormData((previous) => {
      const next = {
        ...previous,
        clientId: formData.clientId || '',
        serviceId: formData.service_id,
        professionalId: selectedProfessionalId,
        date: selectedDate,
        time: selectedTime,
        manualName: formData.name_complete,
        manualPhone: formData.num_phone,
        manualEmail: formData.email.trim().toLowerCase(),
        birthDate: formData.birth_date ?? '',
      };
      const changed = Object.keys(next).some(
        (key) =>
          previous[key as keyof typeof previous] !==
          next[key as keyof typeof next],
      );
      return changed ? next : previous;
    });
  }, [
    formData,
    selectedProfessionalId,
    selectedDate,
    selectedTime,
    setBookingFormData,
  ]);

  const changeRecurrence = (frequency: BookingRecurrence) => {
    setRecurrence(frequency);
    if (frequency === 'none') {
      setRecurrenceEndDate('');
      return;
    }
    setRecurrenceEndDate((current) =>
      current > selectedDate ? current : addMonthsToDateValue(selectedDate, 6),
    );
  };

  useEffect(() => {
    if (recurrence === 'none') return;
    if (!recurrenceEndDate || recurrenceEndDate <= selectedDate) {
      setRecurrenceEndDate(addMonthsToDateValue(selectedDate, 6));
    }
  }, [recurrence, recurrenceEndDate, selectedDate]);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setBookingFormData({
      clientId: '',
      serviceId: '',
      professionalId: '',
      date: '',
      time: '',
      manualName: '',
      manualPhone: '',
      manualEmail: '',
      birthDate: '',
    });
    setSelectedProfessionalId('');
    setSelectedDate(getLocalDateInputValue());
    setSelectedTime('');
    setRecurrence('none');
    setRecurrenceEndDate('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) resetForm();
  };

  const handleSubmit = async (event: React.SyntheticEvent) => {
    const created = await handleCreateBooking(event, {
      frequency: recurrence,
      endDate: recurrenceEndDate,
    });
    if (!created) return;
    window.dispatchEvent(new Event('silentra:appointments-updated'));
    resetForm();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-zinc-950 p-0 sm:h-auto sm:max-h-[min(92dvh,900px)] sm:w-[calc(100%-2rem)] sm:max-w-4xl sm:rounded-3xl sm:border sm:border-white/10"
      >
        <DialogTitle className="sr-only">{t('bookingForm.title')}</DialogTitle>
        <DialogDescription className="sr-only">
          {t('bookingForm.description')}
        </DialogDescription>
        <BookingForm
          clients={clients}
          services={services}
          professionals={professionals}
          loading={loadingData || loadingAppointments}
          formData={formData}
          setFormData={setFormData}
          selectedProfessionalId={selectedProfessionalId}
          setSelectedProfessionalId={setSelectedProfessionalId}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedTime={selectedTime}
          setSelectedTime={setSelectedTime}
          recurrence={recurrence}
          setRecurrence={changeRecurrence}
          recurrenceEndDate={recurrenceEndDate}
          setRecurrenceEndDate={setRecurrenceEndDate}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
