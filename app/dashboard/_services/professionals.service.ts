import { createClient } from '@/lib/supabase/client';
import { Professional } from '@/types';
import type { WeeklySchedule } from '@/lib/scheduling/weekly-schedule';

const supabase = createClient();

export interface CreateProfessionalPayload {
  name: string;
  commission_percentage?: number;
  active?: boolean;
  barbershop_id: string;
}

export interface UpdateProfessionalPayload {
  name: string;
  active?: boolean;
  commission_percentage?: number;
  weekly_schedule?: WeeklySchedule | null;
}

export const professionalService = {
  async getAll(barbershopId: string) {
    const { data, error } = await supabase
      .from('professionals')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .order('name', { ascending: true });

    return { data: data as Professional[], error };
  },

  async create(payload: CreateProfessionalPayload) {
    // Creation is routed through a server-side API so the plan quota is
    // enforced (the browser can no longer bypass the limit by writing to
    // `professionals` directly).
    const res = await fetch(
      `/api/barbershops/${payload.barbershop_id}/professionals`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payload.name,
          commission_percentage: payload.commission_percentage,
          active: payload.active,
        }),
      },
    );

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(
        body.error || 'Não foi possível criar o barbeiro.',
      );
      return { data: null as Professional | null, error };
    }
    return { data: body.data as Professional | null, error: null };
  },

  async update(id: string, updates: UpdateProfessionalPayload) {
    const { data, error } = await supabase
      .from('professionals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    return { data: data as Professional | null, error };
  },

  async updateWeeklySchedule(
    id: string,
    weeklySchedule: WeeklySchedule | null,
  ) {
    const { error } = await supabase.rpc('set_professional_weekly_schedule', {
      p_professional_id: id,
      p_weekly_schedule: weeklySchedule,
    });
    return { error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('professionals')
      .delete()
      .eq('id', id);
    return { error };
  },

  async createBlock(payload: {
    barbershop_id: string;
    professional_id: string;
    start_time: string;
    end_time: string;
    reason: string;
  }) {
    const { data, error } = await supabase
      .from('schedule_blocks')
      .insert([
        {
          barbershop_id: payload.barbershop_id,
          professional_id: payload.professional_id,
          start_at: payload.start_time,
          end_at: payload.end_time,
          reason: payload.reason,
        },
      ])
      .select();

    return { data, error };
  },

  async deleteBlock(id: string) {
    const { error } = await supabase
      .from('schedule_blocks')
      .delete()
      .eq('id', id);

    return { error };
  },
} as const;
