import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { findPublicBookingCustomer } from '@/lib/bookings/public-customer-profile';
import { isRecord, normalizeText, UUID_PATTERN } from '@/lib/validation';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function POST__unobserved(request: Request) {
  try {
    const payload: unknown = await request.json().catch(() => null);
    if (!isRecord(payload)) {
      return NextResponse.json(
        { success: false, error: 'Pedido inválido.' },
        { status: 400 },
      );
    }

    const shopId = typeof payload.shopId === 'string' ? payload.shopId : '';
    const email = normalizeText(payload.email, 254)?.toLowerCase() ?? '';
    const phone = normalizeText(payload.phone, 30) ?? '';

    if (
      !UUID_PATTERN.test(shopId) ||
      !email ||
      !EMAIL_PATTERN.test(email) ||
      phone.replace(/\D/g, '').length < 7
    ) {
      return NextResponse.json(
        { success: false, error: 'Email ou telefone inválido.' },
        { status: 400 },
      );
    }

    const customer = await findPublicBookingCustomer({
      barbershopId: shopId,
      email,
      phone,
    });

    return NextResponse.json(
      {
        success: true,
        matched: Boolean(customer),
        hasBirthDate: Boolean(customer?.birthDate),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[API_BOOKING_CUSTOMER_PROFILE_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Não foi possível verificar os dados do cliente.',
      },
      { status: 500 },
    );
  }
}

export const POST = withApiObservability(
  '/api/bookings/customer-profile',
  POST__unobserved,
);
