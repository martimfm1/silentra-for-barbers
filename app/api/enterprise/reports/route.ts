import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

export const runtime = 'nodejs';
const REPORT_TYPES = [
  'revenue',
  'appointments',
  'clients',
  'services',
  'professionals',
  'inventory',
  'commissions',
] as const;

async function GETHandler() {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'advanced_reports',
      'analytics',
    );
    const { data, error } = await admin
      .from('advanced_report_configs')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ reports: data ?? [] });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Unable to load report configurations' },
      { status: 500 },
    );
  }
}

async function POSTHandler(request: Request) {
  try {
    const { admin, barbershopId, userId } = await requireModuleContext(
      'advanced_reports',
      'analytics',
    );
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const reportType =
      typeof body?.reportType === 'string' ? body.reportType : '';
    if (
      name.length < 1 ||
      name.length > 120 ||
      !REPORT_TYPES.includes(reportType as (typeof REPORT_TYPES)[number])
    )
      return NextResponse.json(
        { error: 'Invalid report configuration' },
        { status: 400 },
      );
    const filters =
      body?.filters &&
      typeof body.filters === 'object' &&
      !Array.isArray(body.filters)
        ? body.filters
        : {};
    const { data, error } = await admin
      .from('advanced_report_configs')
      .insert({
        barbershop_id: barbershopId,
        created_by: userId,
        name,
        report_type: reportType,
        filters,
      })
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ report: data }, { status: 201 });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Unable to create report configuration' },
      { status: 500 },
    );
  }
}


export const GET = withApiLogging('/api/enterprise/reports', GETHandler);
export const POST = withApiLogging('/api/enterprise/reports', POSTHandler);
