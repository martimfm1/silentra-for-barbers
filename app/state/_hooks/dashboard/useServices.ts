import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { servicesService } from '@/app/dashboard/_services/services.service';
import { getErrorMessage } from '@/app/dashboard/_lib/error-utils';
import { Service } from '@/types';
import { useLanguage } from '@/context/LanguageContext';

export function useServices(
  barbershopId: string | null,
  onRefreshData: () => Promise<void>,
) {
  const { locale } = useLanguage();
  const isPortuguese = locale === 'pt';
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
        newServiceData.price === '' ||
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isInteger(duration) ||
        duration < 1 ||
        duration > 1440
      ) {
        toast.error(isPortuguese ? 'Indica um nome, um preço igual ou superior a 0 € e uma duração entre 1 e 1440 minutos.' : 'Enter a name, a non-negative price and a duration between 1 and 1440 minutes.');
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

        toast.success(isPortuguese ? 'Serviço criado com sucesso!' : 'Service created successfully.');
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
    [barbershopId, isPortuguese, newServiceData, onRefreshData],
  );

  const handleUpdateService = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingService) return;
      const price = Number(editingService.price);
      const duration = Number(editingService.duration ?? editingService.min_duration);
      if (!editingService.name.trim() || !Number.isFinite(price) || price < 0 || !Number.isInteger(duration) || duration < 1 || duration > 1440) {
        toast.error(isPortuguese ? 'Verifica o nome, o preço e a duração do serviço.' : 'Check the service name, price and duration.');
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

        toast.success(isPortuguese ? 'Serviço atualizado com sucesso!' : 'Service updated successfully.');
        setEditingService(null);
        await onRefreshData();
      } catch (error) {
        console.error('❌ [Update Service Hook Error]:', error);
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [editingService, isPortuguese, onRefreshData],
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
            ? (isPortuguese ? 'Serviço ativado com sucesso.' : 'Service activated successfully.')
            : (isPortuguese ? 'Serviço desativado. Continua disponível no histórico.' : 'Service deactivated. It remains available in booking history.'),
        );
        await onRefreshData();
      } catch (error) {
        console.error('[Toggle Service Status Error]:', error);
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [isPortuguese, onRefreshData],
  );

  const handleDeleteService = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const { error } = await servicesService.delete(id);
        if (error) throw error;
        toast.success(isPortuguese ? 'Serviço removido.' : 'Service removed.');
        await onRefreshData();
      } catch (error) {
        console.error('❌ [Delete Service Hook Error]:', error);
        toast.error(
          isPortuguese ? 'Não é possível remover um serviço com marcações associadas. Desativa-o para o retirar do catálogo.' : 'A service linked to bookings cannot be deleted. Deactivate it to remove it from the catalogue.',
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
