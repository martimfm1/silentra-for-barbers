import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isRecord, normalizeText } from '@/lib/validation';

function validCoordinates(lat: unknown, lng: unknown) {
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}

async function PATCH__unobserved(
  request: Request,
  context: { params: Promise<{ barbershopId: string }> },
) {
  const supabase = await createClient();
  const { barbershopId } = await context.params;

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const body: unknown = await request.json();
    if (
      !isRecord(body) ||
      typeof body.latitude !== 'number' ||
      typeof body.longitude !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Localização inválida.' },
        { status: 400 },
      );
    }

    const address = normalizeText(body.address, 300);
    if (!address || !validCoordinates(body.latitude, body.longitude)) {
      return NextResponse.json(
        { error: 'Indique uma morada e coordenadas válidas.' },
        { status: 400 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('barbershop_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (
      profileError ||
      profile?.barbershop_id !== barbershopId ||
      !['owner', 'admin'].includes(profile.role)
    ) {
      return NextResponse.json(
        {
          error:
            'Não tem permissão para alterar a localização desta barbearia.',
        },
        { status: 403 },
      );
    }

    const { error: barbershopError } = await supabase
      .from('barbershops')
      .update({ address })
      .eq('id', barbershopId);

    if (barbershopError) {
      console.error('[BARBERSHOP_LOCATION_ADDRESS_UPDATE]', barbershopError);
      return NextResponse.json(
        { error: 'Não foi possível atualizar a morada.' },
        { status: 500 },
      );
    }

    const { error: shopError } = await supabase
      .from('shops')
      .update({ lat: body.latitude, lng: body.longitude })
      .eq('barbershop_id', barbershopId);

    if (shopError) {
      console.error('[BARBERSHOP_LOCATION_COORDINATES_UPDATE]', shopError);
      return NextResponse.json(
        {
          error:
            'A morada foi atualizada, mas não foi possível atualizar o ponto no mapa.',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      address,
      latitude: body.latitude,
      longitude: body.longitude,
    });
  } catch (error) {
    console.error('[BARBERSHOP_LOCATION_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro interno ao atualizar a localização.' },
      { status: 500 },
    );
  }
}

export const PATCH = withApiObservability(
  '/api/barbershops/[barbershopId]/location',
  PATCH__unobserved,
);
