'use client';

import { useState, useCallback, useEffect } from 'react';
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
import { Scissors, Euro, Clock3 } from 'lucide-react';
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

  const fetchServices = useCallback(async () => {
    if (!barbershopId) return;
    setLoadingInitial(true);
    try {
      const res = await servicesService.getAll(barbershopId);
      if (res.error) throw res.error;
      setServices(res.data ?? []);
    } catch (error) {
      console.error('[Serviços Sync Error]:', error);
      toast.error(t('servicesPage.loadError'));
    } finally {
      setLoadingInitial(false);
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
        ) : (
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
            loading={loadingService}
          />
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
  const { t } = useLanguage();
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

          <DialogFooter className="mt-2">
            <Button
            aria-label={loadingService ? "A guardar serviço" : "Guardar alterações"}
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
