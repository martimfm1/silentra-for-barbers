import { createClient } from '@/lib/supabase/client';
import { Service } from '@/types';

const supabase = createClient();

export interface CreateServicePayload {
  name: string;
  price: number;
  duration: number;
  barbershop_id: string;
}

export interface UpdateServicePayload {
  name?: string;
  price?: number;
  duration?: number;
  is_active?: boolean;
}

export const servicesService = {
  async getAll(barbershopId: string) {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .order('name', { ascending: true });

    return { data: data as Service[], error };
  },

  async create(payload: CreateServicePayload) {
    const { data, error } = await supabase
      .from('services')
      .insert([payload])
      .select()
      .single();

    return { data: data as Service | null, error };
  },

  async update(id: string, updates: UpdateServicePayload) {
    const { data, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    return { data: data as Service | null, error };
  },

  async delete(id: string) {
    const { error } = await supabase.from('services').delete().eq('id', id);
    return { error };
  },
} as const;
