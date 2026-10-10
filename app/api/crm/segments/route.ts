import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_PATTERN } from '@/lib/validation';

export const runtime = 'nodejs';

const MAX_RESULTS = 100;
const DEFAULT_DAYS = 90;

type Segment = 'all' | 'inactive' | 'frequent' | 'high_value' | 'new';

function parseSegment(value: string | null): Segment {
  return value === 'inactive' ||
    value === 'frequent' ||
    value === 'high_value' ||
    value === 'new'
    ? value
    : 'all';
}

function parseDays(value: string | null): number {
  const days = Number(value ?? DEFAULT_DAYS);
  return Number.isInteger(days) && days >= 7 && days <= 3650
    ? days
    : DEFAULT_DAYS;
}

async function GET__unobserved(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado.', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    const admin = createAdminClient();
    const { data: staff, error: staffError } = await admin
      .from('users')
      .select('barbershop_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (
      staffError ||
      !staff?.barbershop_id ||
      !['admin', 'owner', 'staff'].includes(staff.role ?? 'staff')
    ) {
      return NextResponse.json(
        { error: 'Acesso negado.', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const segment = parseSegment(url.searchParams.get('segment'));
    const days = parseDays(url.searchParams.get('days'));
    const search = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';

    const { data: clients, error: clientsError } = await admin
      .from('users')
      .select('id, name_complete, name, email, num_phone, created_at')
      .eq('barbershop_id', staff.barbershop_id)
      .eq('role', 'client')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (clientsError) throw clientsError;

    const clientIds = (clients ?? [])
      .map((client) => client.id)
      .filter((id): id is string => UUID_PATTERN.test(id));
    const { data: appointments, error: appointmentsError } = clientIds.length
      ? await admin
          .from('appointments')
          .select('client_id, date_hour, value_products')
          .eq('barbershop_id', staff.barbershop_id)
          .in('client_id', clientIds)
          .in('status', ['scheduled', 'completed'])
      : { data: [], error: null };

    if (appointmentsError) throw appointmentsError;

    const now = Date.now();
    const cutoff = now - days * 86_400_000;
    const stats = new Map<
      string,
      { visits: number; spent: number; lastVisit: number | null }
    >();

    for (const appointment of appointments ?? []) {
      if (!appointment.client_id) continue;
      const current = stats.get(appointment.client_id) ?? {
        visits: 0,
        spent: 0,
        lastVisit: null,
      };
      const timestamp = Date.parse(appointment.date_hour);
      if (Number.isFinite(timestamp)) {
        current.visits += 1;
        current.lastVisit = Math.max(current.lastVisit ?? 0, timestamp);
      }
      const products = Number(appointment.value_products ?? 0);
      if (Number.isFinite(products) && products > 0) current.spent += products;
      stats.set(appointment.client_id, current);
    }

    const result = (clients ?? [])
      .map((client) => {
        const current = stats.get(client.id) ?? {
          visits: 0,
          spent: 0,
          lastVisit: null,
        };
        return { ...client, ...current };
      })
      .filter((client) => {
        if (search) {
          const haystack = [
            client.name_complete,
            client.name,
            client.email,
            client.num_phone,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(search.toLowerCase())) return false;
        }
        if (segment === 'inactive')
          return !client.lastVisit || client.lastVisit < cutoff;
        if (segment === 'frequent') return client.visits >= 5;
        if (segment === 'high_value') return client.spent >= 250;
        if (segment === 'new') return Date.parse(client.created_at) >= cutoff;
        return true;
      })
      .slice(0, MAX_RESULTS);

    return NextResponse.json({
      data: result,
      meta: { segment, days, total: result.length },
    });
  } catch (error) {
    console.error('[CRM_SEGMENTS_GET]', error);
    return NextResponse.json(
      {
        error: 'Não foi possível carregar os segmentos.',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability('/api/crm/segments', GET__unobserved);
