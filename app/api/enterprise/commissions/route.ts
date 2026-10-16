import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/security/request-validation';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

export const runtime = 'nodejs';

async function GET__unobserved() {
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

async function POST__unobserved(request: Request) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'commissions',
      'commissions',
    );
    const bodyResult = await readJsonObject(request, {
      maxBytes: 4 * 1024,
      allowedKeys: [
        'professionalId',
        'grossAmount',
        'commissionPercentage',
        'appointmentId',
      ],
    });
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.value;
    const professionalId =
      typeof body.professionalId === 'string' ? body.professionalId.trim() : '';
    const grossAmount =
      typeof body.grossAmount === 'number' ? body.grossAmount : NaN;
    const percentage =
      typeof body.commissionPercentage === 'number'
        ? body.commissionPercentage
        : NaN;
    const appointmentId =
      body.appointmentId === undefined || body.appointmentId === null
        ? null
        : typeof body.appointmentId === 'string' &&
            body.appointmentId.length <= 80
          ? body.appointmentId
          : '';
    if (
      !professionalId ||
      professionalId.length > 80 ||
      appointmentId === '' ||
      !Number.isFinite(grossAmount) ||
      grossAmount < 0 ||
      grossAmount > 1_000_000_000 ||
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
        appointment_id: appointmentId,
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

export const GET = withApiObservability(
  '/api/enterprise/commissions',
  GET__unobserved,
);
export const POST = withApiObservability(
  '/api/enterprise/commissions',
  POST__unobserved,
);
