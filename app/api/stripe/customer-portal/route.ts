import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import { billingErrorResponse } from '@/services/billing/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const url = await BarbershopStripeService.createCustomerPortal(
      user.id,
      request.url,
    );
    if (!url)
      return NextResponse.json(
        {
          error: 'A Stripe não devolveu um URL válido para o Customer Portal.',
        },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      );

    return NextResponse.json(
      { url },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[STRIPE_CUSTOMER_PORTAL_ERROR]', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      userAction: 'open_customer_portal',
    });
    return billingErrorResponse(error);
  }
}
