import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

export const runtime = 'nodejs';

async function GETHandler() {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'commissions',
      'commissions',
    );
    const { data, error } = await admin
      .from('commissions')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ commissions: data ?? [] });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Unable to load commissions' },
      { status: 500 },
    );
  }
}

async function POSTHandler(request: Request) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'commissions',
      'commissions',
    );
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const professionalId =
      typeof body?.professionalId === 'string' ? body.professionalId : '';
    const grossAmount =
      typeof body?.grossAmount === 'number' ? body.grossAmount : NaN;
    const percentage =
      typeof body?.commissionPercentage === 'number'
        ? body.commissionPercentage
        : NaN;
    if (
      !professionalId ||
      !Number.isFinite(grossAmount) ||
      grossAmount < 0 ||
      !Number.isFinite(percentage) ||
      percentage < 0 ||
      percentage > 100
    )
      return NextResponse.json(
        { error: 'Invalid commission' },
        { status: 400 },
      );
    const { data: professional } = await admin
      .from('professionals')
      .select('id')
      .eq('id', professionalId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();
    if (!professional)
      return NextResponse.json(
        { error: 'Professional not found' },
        { status: 404 },
      );
    const { data, error } = await admin
      .from('commissions')
      .insert({
        barbershop_id: barbershopId,
        professional_id: professionalId,
        appointment_id:
          typeof body?.appointmentId === 'string' ? body.appointmentId : null,
        gross_amount: grossAmount,
        commission_percentage: percentage,
      })
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ commission: data }, { status: 201 });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Unable to create commission' },
      { status: 500 },
    );
  }
}


export const GET = withApiLogging('/api/enterprise/commissions', GETHandler);
export const POST = withApiLogging('/api/enterprise/commissions', POSTHandler);
