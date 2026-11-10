import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import {
  requireModuleContext,
  moduleErrorResponse,
} from '@/services/modules/authorization';

export const dynamic = 'force-dynamic';

async function GET__unobserved(request: Request) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'messaging',
      'messages',
      request,
    );
    const { count, error } = await admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('barbershop_id', barbershopId)
      .eq('role', 'client')
      .not('email', 'is', null)
      .neq('email', '');
    if (error) throw error;
    return NextResponse.json(
      {
        success: true,
        configured: Boolean(
          process.env.BREVO_API_KEY && process.env.BREVO_FROM_EMAIL,
        ),
        contactsWithEmail: count ?? 0,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[MESSAGES_STATUS_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Não foi possível consultar o estado do email.',
      },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability(
  '/api/messages/status',
  GET__unobserved,
);
