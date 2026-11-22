import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function GET__unobserved() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('barbershop_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile?.barbershop_id ||
      !['owner', 'admin'].includes(profile.role)
    ) {
      return NextResponse.json(
        { error: 'Não tens permissão para consultar os dados MB WAY.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('barbershops')
      .select('mbway_enabled, mbway_phone')
      .eq('id', profile.barbershop_id)
      .maybeSingle();

    if (error || !data) {
      console.error('[BARBERSHOP_MBWAY_SETTINGS_READ]', error?.code ?? 'NOT_FOUND');
      return NextResponse.json(
        { error: 'Não foi possível carregar as configurações MB WAY.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      {
        data: {
          mbway_enabled: data.mbway_enabled === true,
          mbway_phone: data.mbway_phone ?? '',
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[BARBERSHOP_MBWAY_SETTINGS_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro interno ao carregar as configurações MB WAY.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = withApiObservability(
  '/api/barbershops/mbway-settings',
  GET__unobserved,
);
