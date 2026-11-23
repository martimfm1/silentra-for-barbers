'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useBarbershop } from '@/context/BarbershopContext';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import { Service } from '@/types';
import { servicesService } from '@/app/dashboard/_services/services.service';
import { useServices } from '@/app/state/_hooks/dashboard/useServices';
import { ServicesListCard } from '@/app/dashboard/_components/cards/ServicesListCard';
import { ManagementPageHeader } from '@/app/dashboard/_components/shared/ManagementPageHeader';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock3, Euro, RefreshCw, Scissors } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function ServicosPage() {
  const { t } = useLanguage();
  const { barbershopId, loading: isLoadingBarbershop } = useBarbershop();
  const [services, setServices] = useState<Service[]>([]);
  const [showAddServiceForm, setShowAddServiceForm] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasLoadedServices = useRef(false);

  const fetchServices = useCallback(async () => {
    if (!barbershopId) return;
    const isInitialLoad = !hasLoadedServices.current;
    if (isInitialLoad) setLoadingInitial(true);
    setLoadError(null);
    try {
      const res = await servicesService.getAll(barbershopId);
      if (res.error) throw res.error;
      setServices(res.data ?? []);
      hasLoadedServices.current = true;
    } catch (error) {
      console.error('[Serviços Sync Error]:', error);
      setLoadError(t('servicesPage.loadError'));
      toast.error(t('servicesPage.loadError'));
    } finally {
      if (isInitialLoad) setLoadingInitial(false);
    }
  }, [barbershopId, t]);

  useEffect(() => {
    if (!isLoadingBarbershop && barbershopId) {
      queueMicrotask(() => void fetchServices());
    }
  }, [barbershopId, fetchServices, isLoadingBarbershop]);

  const {
    loadingService,
    editingService,
    setEditingService,
    newServiceData,
    setNewServiceData,
    handleCreateService,
    handleUpdateService,
    handleDeleteService,
    handleToggleServiceActive,
  } = useServices(barbershopId, fetchServices);

  return (
    <main className="min-h-screen bg-zinc-950 p-4 pt-16 text-zinc-100 sm:p-6 sm:pt-16 lg:p-8 lg:pt-16">
      <div className="mx-auto max-w-7xl space-y-6">
        <ManagementPageHeader
          icon={Scissors}
          eyebrow={t('servicesPage.eyebrow')}
          title={t('servicesPage.title')}
          description={t('servicesPage.description')}
          accentClassName="border-amber-500/20 bg-amber-500/10 text-amber-400"
        />

        {loadingInitial ? (
          <ServicesSkeletonGrid />
        ) : loadError && !hasLoadedServices.current ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] px-5 py-12 text-center">
            <div role="alert" className="flex flex-col items-center gap-2">
              <AlertTriangle className="size-7 text-amber-200" aria-hidden="true" />
              <h2 className="font-medium">{t('servicesPage.loadError')}</h2>
              <p className="max-w-lg text-sm text-muted-foreground">{loadError}</p>
            </div>
            <Button variant="outline" onClick={() => void fetchServices()}>
              <RefreshCw className="mr-2 size-4" aria-hidden="true" />
              {t('common.retry')}
            </Button>
          </div>
        ) : (
          <>
            {loadError && (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm text-muted-foreground">{loadError} Os serviços já carregados continuam visíveis.</p>
                <Button variant="outline" onClick={() => void fetchServices()} className="shrink-0">
                  <RefreshCw className="mr-2 size-4" aria-hidden="true" />
                  {t('common.retry')}
                </Button>
              </div>
            )}
            <ServicesListCard
              servicesCount={services.length}
              services={services}
              showAddServiceForm={showAddServiceForm}
              setShowAddServiceForm={setShowAddServiceForm}
              newServiceData={newServiceData}
              setNewServiceData={setNewServiceData}
              handleCreateService={handleCreateService}
              setEditingService={setEditingService}
              handleDeleteService={handleDeleteService}
              handleToggleServiceActive={handleToggleServiceActive}
              loading={loadingService}
            />
          </>
        )}

        <EditServiceDialog
          editingService={editingService}
          setEditingService={setEditingService}
          handleUpdateService={handleUpdateService}
          loadingService={loadingService}
        />
      </div>
    </main>
  );
}

// --- SUB-COMPONENTES PARA ORGANIZAÇÃO E MANTENABILIDADE ---

function ServicesSkeletonGrid() {
  const { t } = useLanguage();
  return (
    <div
      role="status"
      aria-label={t('servicesPage.loading')}
      className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-2xl border border-white/5 bg-white/[0.04]"
        />
      ))}
    </div>
  );
}

interface EditServiceDialogProps {
  editingService: Service | null;
  setEditingService: (service: Service | null) => void;
  handleUpdateService: (e: React.FormEvent) => void;
  loadingService: boolean;
}

function EditServiceDialog({
  editingService,
  setEditingService,
  handleUpdateService,
  loadingService,
}: EditServiceDialogProps) {
  const { t, locale } = useLanguage();
  if (!editingService) return null;

  return (
    <Dialog
      open={!!editingService}
      onOpenChange={(open) => !open && setEditingService(null)}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-white/10 bg-zinc-950 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('servicesPage.editTitle')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleUpdateService} className="grid gap-4 py-4">
          <div className="grid gap-1.5">
            <label
              htmlFor="edit-service-name"
              className="text-xs font-medium text-zinc-400"
            >
              {t('servicesPage.name')}
            </label>
            <Input
              id="edit-service-name"
              required
              disabled={loadingService}
              className="min-h-11 bg-zinc-900/80"
              value={editingService.name}
              onChange={(e) =>
                setEditingService({
                  ...editingService,
                  name: e.target.value,
                })
              }
            />
          </div>

          <div className="grid gap-1.5">
            <label
              htmlFor="edit-service-price"
              className="text-xs font-medium text-zinc-400"
            >
              {t('servicesPage.price')}
            </label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
              <Input
                id="edit-service-price"
                required
                disabled={loadingService}
                type="number"
                min="0"
                step="0.01"
                className="min-h-11 bg-zinc-900/80 pl-9"
                value={editingService.price}
                onChange={(e) =>
                  setEditingService({
                    ...editingService,
                    price: e.target.value as any,
                  })
                }
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label
              htmlFor="edit-service-duration"
              className="text-xs font-medium text-zinc-400"
            >
              {t('servicesPage.duration')}
            </label>
            <div className="relative">
              <Clock3 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
              <Input
                id="edit-service-duration"
                required
                disabled={loadingService}
                type="number"
                min="1"
                className="min-h-11 bg-zinc-900/80 pl-9 pr-12"
                value={editingService.duration ?? ''}
                onChange={(e) =>
                  setEditingService({
                    ...editingService,
                    duration: e.target.value as any,
                  })
                }
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                min
              </span>
            </div>
          </div>

          <div className="grid gap-1.5">
            <label
              htmlFor="edit-service-buffer"
              className="text-xs font-medium text-zinc-400"
            >
              {locale === 'pt' ? 'Buffer após o serviço' : 'Buffer after service'}
            </label>
            <div className="relative">
              <Clock3 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
              <Input
                id="edit-service-buffer"
                disabled={loadingService}
                type="number"
                min="0"
                max="120"
                step="5"
                className="min-h-11 bg-zinc-900/80 pl-9 pr-12"
                value={editingService.buffer_minutes ?? 0}
                onChange={(e) =>
                  setEditingService({
                    ...editingService,
                    buffer_minutes: e.target.value === '' ? 0 : Number(e.target.value),
                  })
                }
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                min
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              {locale === 'pt'
                ? 'Tempo adicional reservado depois da marcação.'
                : 'Extra time reserved after the appointment.'}
            </p>
          </div>

          <DialogFooter className="mt-2">
            <Button
              aria-label={
                loadingService ? 'A guardar serviço' : 'Guardar alterações'
              }
              type="submit"
              disabled={loadingService}
              className="min-h-11 w-full bg-amber-600 text-white hover:bg-amber-500"
            >
              {loadingService ? (
                <Spinner className="size-4" />
              ) : (
                t('servicesPage.saveChanges')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
