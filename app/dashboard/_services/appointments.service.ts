import { createClient } from '@/lib/supabase/client';
import {
  deleteRecord,
  insertRecord,
  listRecords,
  updateRecord,
} from '@/lib/db';
import type { Appointment, Client } from '@/types';

export interface FinalizeBookingPayload {
  payment_method: string;
  value_products: number;
  description_products: string;
}

const supabase = createClient();

export const appointmentService = {
  async getAll(barbershopId: string) {
    const { data, error } = await listRecords<Appointment>(
      supabase,
      'appointments',
      { barbershop_id: barbershopId },
      {
        select:
          '*, users (name_complete, num_phone, email, birth_date, style_notes), services (name, price), professionals (name)',
        orderBy: { column: 'date_hour', ascending: false },
      },
    );
    return { data: (data ?? []) as Appointment[], error };
  },

  async create(payload: {
    barbershop_id: string;
    date_hour: string;
    status: Appointment['status'];
    client_id: string | null;
    service_id: string;
    professional_id: string;
    manual_name: string | null;
    manual_phone: string | null;
    manual_birth_date: string | null;
    manual_email?: string | null;
  }) {
    let clientEmail = payload.manual_email?.trim().toLowerCase() || null;
    if (payload.client_id) {
      const { data: client } = await supabase
        .from('users')
        .select('email')
        .eq('id', payload.client_id)
        .eq('barbershop_id', payload.barbershop_id)
        .eq('role', 'client')
        .maybeSingle();
      if (typeof client?.email === 'string') {
        clientEmail = client.email.trim().toLowerCase() || clientEmail;
      }
    }

    let resolvedClientId = payload.client_id;
    if (!resolvedClientId && clientEmail && payload.manual_phone?.trim()) {
      const { data: possibleClients, error: lookupError } = await supabase
        .from('users')
        .select('id,num_phone')
        .eq('barbershop_id', payload.barbershop_id)
        .eq('role', 'client')
        .eq('email', clientEmail)
        .limit(20);
      if (lookupError) return { data: null, error: lookupError };
      const normalizePhone = (value: string) => {
        let digits = value.replace(/\D/g, '');
        if (digits.startsWith('00')) digits = digits.slice(2);
        if (digits.startsWith('351') && digits.length === 12) digits = digits.slice(3);
        return digits;
      };
      const normalizedPhone = normalizePhone(payload.manual_phone);
      resolvedClientId = (possibleClients ?? []).find(
        (client) => normalizePhone(String(client.num_phone ?? '')) === normalizedPhone,
      )?.id ?? null;
    }

    const normalizedPayload = {
      ...payload,
      client_id: resolvedClientId,
      manual_email: clientEmail,
    };

    const variants = [
      normalizedPayload,
      {
        barbershop_id: payload.barbershop_id,
        date: payload.date_hour,
        status: payload.status,
        service_id: payload.service_id,
        barber_id: payload.professional_id,
        client_name: payload.manual_name ?? '',
        client_phone: payload.manual_phone ?? '',
        manual_email: clientEmail,
        manual_birth_date: payload.manual_birth_date,
      },
    ] as const;

    let lastError: Error | null = null;
    for (const variant of variants) {
      const result = await insertRecord<Appointment>(
        supabase,
        'appointments',
        variant as Partial<Appointment>,
      );
      if (!result.error) return result;
      lastError = result.error;
    }
    return { data: null, error: lastError };
  },

  async update(id: string, updates: Partial<Appointment>) {
    return updateRecord<Appointment>(supabase, 'appointments', id, updates);
  },

  async delete(id: string) {
    return deleteRecord(supabase, 'appointments', id);
  },

  async finalize(id: string, payload: FinalizeBookingPayload) {
    return updateRecord<Appointment>(supabase, 'appointments', id, {
      status: 'completed',
      payment_method: payload.payment_method,
      value_products: payload.value_products,
      description_products: payload.description_products,
    });
  },

  async getClients(barbershopId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let query = supabase
      .from('users')
      .select('id, name_complete, num_phone, email, birth_date, style_notes')
      .eq('barbershop_id', barbershopId)
      .eq('role', 'client')
      .order('name_complete', { ascending: true });
    if (user?.id) query = query.neq('id', user.id);
    const { data, error } = await query;
    return { data: data as Client[], error };
  },

  async createClient(payload: {
    barbershop_id: string;
    name_complete: string;
    num_phone: string;
    email?: string;
    birth_date?: string | null;
    style_notes?: string;
  }) {
    return insertRecord<Client>(supabase, 'users', {
      ...payload,
      role: 'client',
    });
  },

  async updateClient(id: string, updates: Partial<Client>) {
    return updateRecord<Client>(supabase, 'users', id, updates);
  },

  async addClientFromCompletedAppointment(
    barbershopId: string,
    appointmentId: string,
  ) {
    const { data, error } = await supabase.rpc(
      'add_client_from_completed_appointment',
      {
        p_barbershop_id: barbershopId,
        p_appointment_id: appointmentId,
      },
    );

    if (error) return { data: null, alreadyExists: false, error };

    const result = data as {
      already_exists?: boolean;
      client?: Client;
    } | null;

    return {
      data: result?.client ?? null,
      alreadyExists: result?.already_exists ?? false,
      error: null,
    };
  },
} as const;
