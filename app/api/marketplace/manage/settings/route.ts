import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

export const runtime = 'nodejs';

const MODES = ['physical_only', 'physical_and_online'] as const;
type MarketplaceSalesMode = (typeof MODES)[number];

async function GETHandler() {
  try {
    const { admin, barbershopId } = await requireModuleContext('pos', 'pos');
    const { data, error } = await admin
      .from('barbershops')
      .select('marketplace_sales_mode')
      .eq('id', barbershopId)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({
      marketplaceSalesMode:
        data?.marketplace_sales_mode === 'physical_and_online'
          ? 'physical_and_online'
          : 'physical_only',
    });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Não foi possível carregar as definições de vendas.' },
      { status: 500 },
    );
  }
}

async function PATCHHandler(request: Request) {
  try {
    const { admin, barbershopId } = await requireModuleContext('pos', 'pos');
    const body = (await request.json().catch(() => null)) as {
      marketplaceSalesMode?: unknown;
    } | null;
    const mode = body?.marketplaceSalesMode;
    if (
      typeof mode !== 'string' ||
      !MODES.includes(mode as MarketplaceSalesMode)
    ) {
      return NextResponse.json(
        { error: 'Modo de vendas inválido.' },
        { status: 400 },
      );
    }

    const { data, error } = await admin
      .from('barbershops')
      .update({
        marketplace_sales_mode: mode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', barbershopId)
      .select('marketplace_sales_mode')
      .single();

    if (error) throw error;
    return NextResponse.json({
      marketplaceSalesMode: data.marketplace_sales_mode,
    });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Não foi possível guardar as definições de vendas.' },
      { status: 500 },
    );
  }
}

export const GET = withApiLogging(
  '/api/marketplace/manage/settings',
  GETHandler,
);
export const PATCH = withApiLogging(
  '/api/marketplace/manage/settings',
  PATCHHandler,
);
