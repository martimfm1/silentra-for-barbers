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

type AppointmentCapacitySnapshot = {
  duration_minutes: number;
  buffer_minutes: number;
};

/**
 * Manual dashboard bookings do not go through the public atomic-booking RPC.
 * Resolve and snapshot the selected service capacity before inserting so
 * recurring occurrences reserve the same duration as their service.
 */
async function getServiceCapacitySnapshots(
  barbershopId: string,
  serviceIds: string[],
) {
  const uniqueServiceIds = [...new Set(serviceIds)];
  const { data: services, error } = await supabase
    .from('services')
    .select('id,duration,buffer_minutes')
    .eq('barbershop_id', barbershopId)
    .in('id', uniqueServiceIds);

  if (error) return { data: null, error };

  const snapshots = new Map<string, AppointmentCapacitySnapshot>();
  for (const service of services ?? []) {
    const rawDuration = Number(service.duration ?? 30);
    const rawBuffer = Number(service.buffer_minutes ?? 0);
    snapshots.set(service.id, {
      duration_minutes: Number.isFinite(rawDuration)
        ? Math.min(Math.max(Math.round(rawDuration), 1), 1440)
        : 30,
      buffer_minutes: Number.isFinite(rawBuffer)
        ? Math.min(Math.max(Math.round(rawBuffer), 0), 120)
        : 0,
    });
  }

  const missingService = uniqueServiceIds.find((id) => !snapshots.has(id));
  if (missingService) {
    return {
      data: null,
      error: new Error('O serviço selecionado não pertence a esta barbearia.'),
    };
  }

  return { data: snapshots, error: null };
}

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
    recurrence_series_id?: string | null;
  }) {
    const capacityResult = await getServiceCapacitySnapshots(
      payload.barbershop_id,
      [payload.service_id],
    );
    if (capacityResult.error || !capacityResult.data) {
      return {
        data: null,
        error: capacityResult.error ?? new Error('Não foi possível validar a duração do serviço.'),
      };
    }
    const capacity = capacityResult.data.get(payload.service_id);
    if (!capacity) {
      return {
        data: null,
        error: new Error('O serviço selecionado não pertence a esta barbearia.'),
      };
    }

    const clientEmail = payload.manual_email?.trim().toLowerCase() || null;

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
        if (digits.startsWith('351') && digits.length === 12)
          digits = digits.slice(3);
        return digits;
      };
      const normalizedPhone = normalizePhone(payload.manual_phone);
      resolvedClientId =
        (possibleClients ?? []).find(
          (client) =>
            normalizePhone(String(client.num_phone ?? '')) === normalizedPhone,
        )?.id ?? null;
    }

    const normalizedPayload = {
      ...payload,
      client_id: resolvedClientId,
      manual_email: clientEmail,
      duration_minutes: capacity.duration_minutes,
      buffer_minutes: capacity.buffer_minutes,
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

  async createMany(
    payloads: Array<{
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
      recurrence_series_id?: string | null;
    }>,
  ) {
    if (payloads.length === 0) {
      return { data: [] as Appointment[], error: null };
    }

    const barbershopId = payloads[0].barbershop_id;
    if (payloads.some((payload) => payload.barbershop_id !== barbershopId)) {
      return {
        data: null,
        error: new Error('Uma série recorrente não pode misturar barbearias.'),
      };
    }
    const capacityResult = await getServiceCapacitySnapshots(
      barbershopId,
      payloads.map((payload) => payload.service_id),
    );
    if (capacityResult.error || !capacityResult.data) {
      return {
        data: null,
        error: capacityResult.error ?? new Error('Não foi possível validar a duração do serviço.'),
      };
    }
    const capacityByService = capacityResult.data;

    // A single INSERT keeps the whole recurring series atomic: either every
    // occurrence is created or none is, including when a slot conflicts.
    const variants = [
      payloads.map((payload) => {
        const capacity = capacityByService.get(payload.service_id)!;
        return {
          ...payload,
          duration_minutes: capacity.duration_minutes,
          buffer_minutes: capacity.buffer_minutes,
          client_id: payload.client_id || null,
          manual_email: payload.manual_email?.trim().toLowerCase() || null,
        };
      }),
      payloads.map((payload) => ({
        barbershop_id: payload.barbershop_id,
        date: payload.date_hour,
        status: payload.status,
        service_id: payload.service_id,
        barber_id: payload.professional_id,
        client_name: payload.manual_name ?? '',
        client_phone: payload.manual_phone ?? '',
        manual_email: payload.manual_email?.trim().toLowerCase() || null,
        manual_birth_date: payload.manual_birth_date,
      })),
    ] as const;

    const [primaryVariant, legacyVariant] = variants;
    const primaryResult = await supabase
      .from('appointments')
      .insert(primaryVariant as never[])
      .select();

    if (!primaryResult.error) {
      return {
        data: (primaryResult.data ?? []) as Appointment[],
        error: null,
      };
    }

    const isSchemaCompatibilityError =
      primaryResult.error.code === '42703' ||
      primaryResult.error.code === 'PGRST204';

    const finalError = isSchemaCompatibilityError
      ? await supabase
          .from('appointments')
          .insert(legacyVariant as never[])
          .select()
      : primaryResult;

    if (!finalError.error) {
      return { data: (finalError.data ?? []) as Appointment[], error: null };
    }

    const error = Object.assign(new Error(finalError.error.message), {
      code: finalError.error.code,
    });
    console.error('[Appointment Series Create Error]:', error.message);
    return { data: null, error };
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
      .select(
        'id, name_complete, num_phone, email, birth_date, style_notes, created_at',
      )
      .eq('barbershop_id', barbershopId)
      .eq('role', 'client')
      .order('name_complete', { ascending: true });
    if (user?.id) query = query.neq('id', user.id);
    const { data, error } = await query;
    return { data: data as Client[], error };
  },

  async getClientHistory(barbershopId: string, clientId: string) {
    const { data, error } = await supabase
      .from('appointments')
      .select(
        'id, date_hour, status, payment_method, payment_status, services(name, price), professionals(name)',
      )
      .eq('barbershop_id', barbershopId)
      .eq('client_id', clientId)
      .order('date_hour', { ascending: false })
      .limit(100);

    return { data: data ?? [], error };
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
