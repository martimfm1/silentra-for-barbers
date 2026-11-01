import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  clientsService,
  CreateClientPayload,
} from '@/app/dashboard/_services/clients.service';
import { getErrorMessage } from '@/app/dashboard/_lib/error-utils';
import { Client } from '@/types';

export function useClients(
  barbershopId: string | null,
  onRefreshData: () => Promise<void>,
) {
  const [loadingClients, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [newClientData, setNewClientData] = useState({
    name_complete: '',
    num_phone: '',
    email: '',
  });

  const handleCreateClient = async (
    e?: React.SyntheticEvent,
  ): Promise<boolean> => {
    e?.preventDefault();
    const formattedPhone = newClientData.num_phone.trim();
    if (!newClientData.name_complete.trim() || !formattedPhone) {
      toast.error('Por favor, introduz um nome e um telemóvel.');
      return false;
    }
    setLoading(true);
    try {
      const payload: CreateClientPayload = {
        name_complete: newClientData.name_complete.trim(),
        num_phone: formattedPhone,
        email: newClientData.email.trim()
          ? newClientData.email.trim().toLowerCase()
          : undefined,
        barbershop_id: barbershopId,
        role: 'client',
      };
      const { error } = await clientsService.createClient(payload);
      if (error) throw error;
      toast.success('Cliente adicionado com sucesso!');
      setNewClientData({ name_complete: '', num_phone: '', email: '' });
      await onRefreshData();
      return true;
    } catch (error) {
      console.error('[Create Client Hook Error]:', error);
      toast.error(getErrorMessage(error));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClient = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    if (!editingClient) return;
    setLoading(true);
    try {
      const { error } = await clientsService.updateClient(editingClient.id, {
        name_complete: editingClient.name_complete.trim(),
        num_phone: editingClient.num_phone.trim(),
        email: editingClient.email?.trim() || '',
        birth_date: editingClient.birth_date || null,
        style_notes: editingClient.style_notes?.trim() || null,
      });
      if (error) throw error;
      toast.success('Cliente editado com sucesso!');
      setEditingClient(null);
      await onRefreshData();
    } catch (error) {
      console.error('[Update Client Hook Error]:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await clientsService.deleteClient(id);
      if (error) throw error;
      toast.success('Cliente removido com sucesso.');
      await onRefreshData();
    } catch (error) {
      console.error('[Delete Client Hook Error]:', error);
      toast.error(
        'Impossível remover. O cliente pode conter marcações ativas.',
      );
    } finally {
      setLoading(false);
    }
  };

  const getFilteredClients = useCallback(
    (clients: Client[]) => {
      if (!searchQuery.trim()) return clients;
      const query = searchQuery.toLowerCase();
      return clients.filter(
        (c) =>
          c.name_complete.toLowerCase().includes(query) ||
          c.num_phone.includes(query) ||
          (c.email && c.email.toLowerCase().includes(query)),
      );
    },
    [searchQuery],
  );

  return {
    loadingClients,
    searchQuery,
    setSearchQuery,
    newClientData,
    setNewClientData,
    editingClient,
    setEditingClient,
    handleCreateClient,
    handleUpdateClient,
    handleDeleteClient,
    getFilteredClients,
  };
}
