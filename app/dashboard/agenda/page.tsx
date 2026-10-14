'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CalendarOff,
  CheckCircle2,
  Clock3,
  Plus,
  Search,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import { useBarbershop } from '@/context/BarbershopContext';
import type { Appointment, Client, Professional, Service } from '@/types';
import { appointmentService } from '@/app/dashboard/_services/appointments.service';
import { servicesService } from '@/app/dashboard/_services/services.service';
import { professionalService } from '@/app/dashboard/_services/professionals.service';
import { useAppointments } from '@/app/state/_hooks/dashboard/useAppointments';
import { BookingForm } from '@/app/dashboard/_components/cards/BookingFormCard';
import { BlockScheduleForm } from '@/app/dashboard/_components/cards/BlockFormCard';
import { Button } from '@/components/ui/button';
import { AppointmentDetailDialog } from '@/components/dashboard/appointment-detail-dialog';
import { AppointmentMobileCard } from '@/components/dashboard/appointment-mobile-card';
import { AppointmentsTable } from '@/components/dashboard/appointments-table';
import { AgendaLinesSkeleton } from './agenda-view-skeletons';

const STATUS_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'pending', label: 'Por confirmar' },
  { id: 'scheduled', label: 'Confirmadas' },
  { id: 'completed', label: t('agenda.completed') },
  { id: 'cancelled', label: 'Canceladas' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['id'];

function sameLocalDay(value: string, reference: Date) {
  const date = new Date(value);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

export default function AgendaPage() {
  const { locale, t } = useLanguage();
  const { barbershopId, loading: isLoadingBarbershop } = useBarbershop();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddBlockForm, setShowAddBlockForm] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [todayOnly, setTodayOnly] = useState(false);

  const fetchInitialData = useCallback(async () => {
    if (!barbershopId) return;
    setLoadingInitial(true);
    try {
      const [appointmentsRes, servicesRes, professionalsRes, clientsRes] =
        await Promise.all([
          appointmentService.getAll(barbershopId),
          servicesService.getAll(barbershopId),
          professionalService.getAll(barbershopId),
          appointmentService.getClients(barbershopId),
        ]);
      if (appointmentsRes.error) throw appointmentsRes.error;
      if (servicesRes.error) throw servicesRes.error;
      if (professionalsRes.error) throw professionalsRes.error;
      if (clientsRes.error) throw clientsRes.error;
      setAppointments(appointmentsRes.data ?? []);
      setServices(servicesRes.data ?? []);
      setProfessionals(professionalsRes.data ?? []);
      setClients(clientsRes.data ?? []);
    } catch (error) {
      console.error('[Agenda Sync Error]:', error);
      toast.error(t('agenda.loadingError'));
    } finally {
      setLoadingInitial(false);
    }
  }, [barbershopId]);

  useEffect(() => {
    if (isLoadingBarbershop) return;
    if (barbershopId) void fetchInitialData();
  }, [barbershopId, fetchInitialData, isLoadingBarbershop]);

  const {
    loadingAppointments,
    finishingBookingId,
    setFinishingBookingId,
    addingClientAppointmentId,
    valueProducts,
    setValueProducts,
    descriptionProducts,
    setDescriptionProducts,
    setBookingFormData,
    blockFormData,
    setBlockFormData,
    handleCreateBooking,
    confirmBooking,
    finalizeBooking,
    addCompletedAppointmentClient,
    handleCreateBlock,
    handleDeleteBooking,
  } = useAppointments(barbershopId, fetchInitialData);

  const [formData, setFormData] = useState({
    clientId: undefined as string | undefined,
    name_complete: '',
    num_phone: '',
    email: '',
    service_id: '',
  });
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  useEffect(() => {
    setBookingFormData((prev) => {
      const next = {
        ...prev,
        clientId: formData.clientId || '',
        serviceId: formData.service_id,
        professionalId: selectedProfessionalId,
        date: selectedDate,
        time: selectedTime,
        manualName: formData.name_complete,
        manualPhone: formData.num_phone,
      };
      const changed =
        prev.clientId !== next.clientId ||
        prev.serviceId !== next.serviceId ||
        prev.professionalId !== next.professionalId ||
        prev.date !== next.date ||
        prev.time !== next.time ||
        prev.manualName !== next.manualName ||
        prev.manualPhone !== next.manualPhone;
      return changed ? next : prev;
    });
  }, [
    formData.clientId,
    formData.name_complete,
    formData.num_phone,
    formData.service_id,
    selectedProfessionalId,
    selectedDate,
    selectedTime,
    setBookingFormData,
  ]);

  const now = useMemo(() => new Date(), []);
  const todayAppointments = useMemo(
    () =>
      appointments.filter((appointment) =>
        sameLocalDay(appointment.date_hour, now),
      ),
    [appointments, now],
  );
  const metrics = useMemo(() => {
    const upcomingToday = todayAppointments.filter(
      (appointment) =>
        new Date(appointment.date_hour).getTime() >= Date.now() &&
        appointment.status !== 'cancelled' &&
        appointment.status !== 'completed',
    ).length;
    return {
      today: todayAppointments.length,
      pending: appointments.filter((item) => item.status === 'pending').length,
      scheduled: appointments.filter((item) => item.status === 'scheduled')
        .length,
      completed: appointments.filter((item) => item.status === 'completed')
        .length,
      cancelled: appointments.filter((item) => item.status === 'cancelled')
        .length,
      upcomingToday,
    };
  }, [appointments, todayAppointments]);

  const orderedAppointments = useMemo(
    () =>
      [...appointments]
        .filter((appointment) => {
          if (todayOnly && !sameLocalDay(appointment.date_hour, now))
            return false;
          if (statusFilter !== 'all' && appointment.status !== statusFilter)
            return false;
          const term = search.trim().toLocaleLowerCase('pt-PT');
          if (!term) return true;
          const values = [
            appointment.manual_name,
            appointment.manual_phone,
            appointment.manual_email,
            appointment.users?.name_complete,
            appointment.users?.num_phone,
            appointment.users?.email,
            appointment.services?.name,
            appointment.professionals?.name,
          ];
          return values.some((value) => value?.toLowerCase().includes(term));
        })
        .sort(
          (a, b) =>
            new Date(a.date_hour).getTime() - new Date(b.date_hour).getTime(),
        ),
    [appointments, now, search, statusFilter, todayOnly],
  );

  const actionProps = {
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
  };

  return (
    <main className="silentra-page-shell dashboard-page">
      <div className="silentra-page-grid" aria-hidden="true" />
      <div className="relative z-10 mx-auto w-full max-w-[100rem] px-0 py-6 sm:py-8 lg:py-10">
        <header className="silentra-page-header">
          <div className="min-w-0">
            {!loadingInitial && (
              <p className="mt-3 text-xs text-zinc-500">
                <span className="font-semibold text-zinc-200">
                  {metrics.today}
                </span>{' '}
                {metrics.today === 1 ? t('agenda.bookingTodayOne') : t('agenda.bookingTodayMany')} ·{' '}
                <span className="font-semibold text-amber-200">
                  {metrics.pending}
                </span>{' '}
                por confirmar
              </p>
            )}
          </div>
          <div className="silentra-page-actions w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => setShowAddForm((value) => !value)}
              className="border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200 hover:border-emerald-400/30 hover:bg-emerald-400/[0.1]"
            >
              <Plus className="size-4" aria-hidden="true" />
              {showAddForm ? t('agenda.closeBooking') : t('agenda.newBooking')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAddBlockForm((value) => !value)}
            >
              <CalendarOff className="size-4" aria-hidden="true" />
              {showAddBlockForm ? t('agenda.closeBlock') : t('agenda.blockTime')}
            </Button>
          </div>
        </header>

        {loadingInitial ? (
          <div className="mt-5">
            <AgendaLinesSkeleton />
          </div>
        ) : (
          <>
            <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ['Hoje', metrics.today, CalendarDays, 'text-emerald-300'],
                [
                  t('agenda.upcomingToday'),
                  metrics.upcomingToday,
                  Clock3,
                  'text-sky-300',
                ],
                ['Por confirmar', metrics.pending, Clock3, 'text-amber-300'],
                [
                  'Concluídas',
                  metrics.completed,
                  CheckCircle2,
                  'text-violet-300',
                ],
                ['Canceladas', metrics.cancelled, XCircle, 'text-rose-300'],
              ].map(([label, value, Icon, iconClass]) => {
                const MetricIcon = Icon as typeof CalendarDays;
                return (
                  <div
                    key={label as string}
                    className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 backdrop-blur-md"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`flex size-9 items-center justify-center rounded-xl bg-white/[0.04] ${iconClass}`}
                      >
                        <MetricIcon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="text-2xl font-semibold tracking-tight text-zinc-50">
                        {value as number}
                      </span>
                    </div>
                    <p className="mt-3 text-xs font-medium text-zinc-400">
                      {label as string}
                    </p>
                  </div>
                );
              })}
            </section>
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/[0.075] bg-black/20 p-3 backdrop-blur-xl lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600"
                  aria-hidden="true"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('agenda.searchPlaceholder')}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 text-sm text-zinc-100 outline-none focus:border-emerald-400/30"
                  aria-label="Pesquisar na agenda"
                />
              </div>
              <div
                className="flex gap-2 overflow-x-auto pb-0.5"
                role="tablist"
                aria-label={t('agenda.filterStatus')}
              >
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === filter.id}
                    onClick={() => setStatusFilter(filter.id)}
                    className={`min-h-10 shrink-0 rounded-xl border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${statusFilter === filter.id ? 'border-emerald-400/30 bg-emerald-400/[0.1] text-emerald-200' : 'border-white/10 bg-white/[0.02] text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300'}`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setTodayOnly((value) => !value)}
                aria-pressed={todayOnly}
                className={`min-h-10 shrink-0 rounded-xl border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${todayOnly ? 'border-sky-400/30 bg-sky-400/[0.08] text-sky-200' : 'border-white/10 bg-white/[0.02] text-zinc-500 hover:bg-white/[0.05]'}`}
              >
                Apenas hoje
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {showAddForm && (
                <section className="silentra-section-block p-4 sm:p-6">
                  <BookingForm
                    clients={clients}
                    services={services}
                    professionals={professionals}
                    loading={loadingAppointments}
                    formData={formData}
                    setFormData={setFormData}
                    selectedProfessionalId={selectedProfessionalId}
                    setSelectedProfessionalId={setSelectedProfessionalId}
                    selectedDate={selectedDate}
                    setSelectedDate={setSelectedDate}
                    selectedTime={selectedTime}
                    setSelectedTime={setSelectedTime}
                    onSubmit={handleCreateBooking}
                  />
                </section>
              )}
              {showAddBlockForm && (
                <section className="silentra-section-block p-4 sm:p-6">
                  <BlockScheduleForm
                    professionals={professionals}
                    loading={loadingAppointments}
                    blockFormData={blockFormData}
                    setBlockFormData={setBlockFormData}
                    onSubmit={handleCreateBlock}
                  />
                </section>
              )}
              <section
                className="silentra-section-block overflow-hidden"
                aria-labelledby="agenda-list-title"
              >
                <div className="flex flex-col gap-3 border-b border-white/[0.075] p-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
                  <div>
                    <p className="silentra-eyebrow mb-0">{t('agenda.eyebrow')}</p>
                    <h2
                      id="agenda-list-title"
                      className="mt-1 text-xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-2xl"
                    >
                      {t('agenda.title')}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-zinc-500">
                      Pesquisa, filtra e abre rapidamente a marcação que precisa
                      da tua atenção.
                    </p>
                  </div>
                  <span className="silentra-pill w-fit border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-zinc-400">
                    {orderedAppointments.length} resultado
                    {orderedAppointments.length === 1 ? '' : 's'}
                  </span>
                </div>
                {orderedAppointments.length === 0 ? (
                  <div className="m-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.015] px-5 py-12 text-center sm:m-6">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300">
                      <Sparkles className="size-5" aria-hidden="true" />
                    </div>
                    <h2 className="mt-4 text-base font-semibold text-zinc-100">
                      {search || statusFilter !== 'all' || todayOnly
                        ? t('agenda.noMatches')
                        : t('agenda.emptyTitle')}
                    </h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                      {search || statusFilter !== 'all' || todayOnly
                        ? 'Experimenta limpar a pesquisa ou escolher outro estado.'
                        : t('agenda.emptySubtitle')}
                    </p>
                    {search || statusFilter !== 'all' || todayOnly ? (
                      <Button
                        variant="outline"
                        className="mt-5"
                        onClick={() => {
                          setSearch('');
                          setStatusFilter('all');
                          setTodayOnly(false);
                        }}
                      >
                        Limpar filtros
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setShowAddForm(true)}
                        className="mt-5 bg-zinc-50 text-zinc-950 hover:bg-white"
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        {t('agenda.createFirst')}
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-white/[0.055] px-4 pb-4 md:hidden">
                      {orderedAppointments.map((appointment) => (
                        <AppointmentMobileCard
                          key={appointment.id}
                          appointment={appointment}
                          onDetails={() => setSelectedAppointment(appointment)}
                          {...actionProps}
                        />
                      ))}
                    </div>
                    <div className="hidden md:block">
                      <AppointmentsTable
                        appointments={orderedAppointments}
                        onDetails={setSelectedAppointment}
                        {...actionProps}
                      />
                    </div>
                  </>
                )}
              </section>
              {appointments.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-zinc-600">
                  <Users className="size-3.5" aria-hidden="true" />
                  {clients.length} {t('agenda.clientsAvailable')} · {services.length}{' '}
                  {t('agenda.servicesAvailable')} · {professionals.length} {t('agenda.barbersAvailable')}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <AppointmentDetailDialog
        appointment={selectedAppointment}
        open={Boolean(selectedAppointment)}
        onOpenChange={(open) => {
          if (!open) setSelectedAppointment(null);
        }}
      />
    </main>
  );
}
