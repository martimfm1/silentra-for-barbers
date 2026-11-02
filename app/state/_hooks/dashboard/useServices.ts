import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { servicesService } from '@/app/dashboard/_services/services.service';
import { getErrorMessage } from '@/app/dashboard/_lib/error-utils';
import { Service } from '@/types';

export function useServices(
  barbershopId: string | null,
  onRefreshData: () => Promise<void>,
) {
  const [loadingService, setLoading] = useState<boolean>(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [newServiceData, setNewServiceData] = useState<{
    name: string;
    price: string | number;
    duration: string | number;
  }>({
    name: '',
    price: '',
    duration: '30',
  });

  const handleCreateService = useCallback(
    async (e: React.FormEvent): Promise<boolean> => {
      e.preventDefault();
      if (!barbershopId) return false;

      const price = Number(newServiceData.price);
      const duration = Number(newServiceData.duration);
      if (
        !newServiceData.name.trim() ||
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isInteger(duration) ||
        duration < 1 ||
        duration > 1440
      ) {
        toast.error('Indica um nome, um preço igual ou superior a 0 € e uma duração entre 1 e 1440 minutos.');
        return false;
      }

      setLoading(true);
      try {
        const { error } = await servicesService.create({
          name: newServiceData.name.trim(),
          price,
          duration,
          barbershop_id: barbershopId,
        });

        if (error) throw error;

        toast.success('Serviço criado com sucesso!');
        setNewServiceData({ name: '', price: '', duration: '30' });
        await onRefreshData();
        return true;
      } catch (error) {
        console.error('❌ [Create Service Hook Error]:', error);
        toast.error(getErrorMessage(error));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [barbershopId, newServiceData, onRefreshData],
  );

  const handleUpdateService = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingService) return;
      const price = Number(editingService.price);
      const duration = Number(editingService.duration ?? editingService.min_duration);
      if (!editingService.name.trim() || !Number.isFinite(price) || price < 0 || !Number.isInteger(duration) || duration < 1 || duration > 1440) {
        toast.error('Verifica o nome, o preço e a duração do serviço.');
        return;
      }

      setLoading(true);
      try {
        const { error } = await servicesService.update(editingService.id, {
          name: editingService.name.trim(),
          price,
          duration,
        });

        if (error) throw error;

        toast.success('Serviço atualizado com sucesso!');
        setEditingService(null);
        await onRefreshData();
      } catch (error) {
        console.error('❌ [Update Service Hook Error]:', error);
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [editingService, onRefreshData],
  );

  const handleToggleServiceActive = useCallback(
    async (service: Service) => {
      setLoading(true);
      try {
        const { error } = await servicesService.update(service.id, {
          is_active: service.is_active === false,
        });
        if (error) throw error;
        toast.success(
          service.is_active === false
            ? 'Serviço ativado com sucesso.'
            : 'Serviço desativado. Continua disponível no histórico.',
        );
        await onRefreshData();
      } catch (error) {
        console.error('[Toggle Service Status Error]:', error);
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [onRefreshData],
  );

  const handleDeleteService = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const { error } = await servicesService.delete(id);
        if (error) throw error;
        toast.success('Serviço removido.');
        await onRefreshData();
      } catch (error) {
        console.error('❌ [Delete Service Hook Error]:', error);
        toast.error(
          'Erro ao remover. Este serviço possui agendamentos vinculados.',
        );
      } finally {
        setLoading(false);
      }
    },
    [onRefreshData],
  );

  return {
    loadingService,
    editingService,
    setEditingService,
    newServiceData,
    setNewServiceData,
    handleCreateService,
    handleUpdateService,
    handleDeleteService,
    handleToggleServiceActive,
  };
}
