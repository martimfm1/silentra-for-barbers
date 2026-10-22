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
      if (!barbershopId) return;

      if (!newServiceData.name.trim() || !newServiceData.price) {
        toast.error('Introduz o nome e o preço do serviço.');
        return false;
      }

      setLoading(true);
      try {
        const { error } = await servicesService.create({
          name: newServiceData.name.trim(),
          price: Number(newServiceData.price),
          duration: Number(newServiceData.duration),
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

      setLoading(true);
      try {
        const { error } = await servicesService.update(editingService.id, {
          name: editingService.name.trim(),
          price: Number(editingService.price),
          duration: Number(
            (editingService as any).duration ?? editingService.duration,
          ),
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
  };
}
