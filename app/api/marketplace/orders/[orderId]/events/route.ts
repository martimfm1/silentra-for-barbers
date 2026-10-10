import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

async function GETHandler(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { admin, barbershopId } = await requireModuleContext('pos', 'pos');
    const { orderId } = await params;

    const { data: order, error: orderError } = await admin
      .from('marketplace_orders')
      .select('id')
      .eq('id', orderId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();

    if (orderError) {
      console.error(
        '[MARKETPLACE_ORDER_EVENTS_ORDER_ERROR]',
        orderError.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        { error: 'Não foi possível carregar a encomenda.' },
        { status: 503 },
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Encomenda não encontrada.' },
        { status: 404 },
      );
    }

    const { data: events, error } = await admin
      .from('marketplace_order_events')
      .select(
        'id,event_type,previous_status,new_status,message,created_at,actor_user_id',
      )
      .eq('order_id', orderId)
      .eq('barbershop_id', barbershopId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(
        '[MARKETPLACE_ORDER_EVENTS_READ_ERROR]',
        error.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        { error: 'Não foi possível carregar o histórico.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ events: events ?? [] });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Não foi possível carregar o histórico.' },
      { status: 500 },
    );
  }
}


export const GET = withApiLogging('/api/marketplace/orders/[orderId]/events', GETHandler);
