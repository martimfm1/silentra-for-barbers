import { createHash, randomBytes } from 'node:crypto';
import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { sendBookingReviewRequestEmail } from '@/lib/brevo/review-email';
import { UUID_PATTERN } from '@/lib/validation';
import { readJsonObject } from '@/lib/security/request-validation';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';
import { hasPlanFeature } from '@/lib/billing/plan-features';
import { resolveAccessPlanForUser } from '@/services/billing/plan-access.guard';

const COMPLETION_ROLES = [
  'owner',
  'admin',
  'manager',
  'barber',
  'receptionist',
  'staff',
] as const;
const PAYMENT_METHODS = new Set(['cash', 'mbway', 'card']);

function hasAgendaGrant(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const permissions = value as Record<string, unknown>;
  return permissions.agenda === true || permissions.appointments === true;
}

async function POST__unobserved(
  request: Request,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const { appointmentId } = await params;
    if (!UUID_PATTERN.test(appointmentId)) {
      return NextResponse.json(
        { success: false, error: 'Identificador de marcação inválido.' },
        { status: 400 },
      );
    }

    const bodyResult = await readJsonObject(request, {
      maxBytes: 8 * 1024,
      allowedKeys: ['paymentMethod', 'descriptionProducts', 'valueProducts'],
    });
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.value;

    const paymentMethod =
      typeof body.paymentMethod === 'string'
        ? body.paymentMethod.trim().toLowerCase()
        : '';
    if (!PAYMENT_METHODS.has(paymentMethod)) {
      return NextResponse.json(
        { success: false, error: 'Seleciona um método de pagamento válido.' },
        { status: 400 },
      );
    }

    const rawDescription = body.descriptionProducts ?? '';
    if (typeof rawDescription !== 'string') {
      return NextResponse.json(
        { success: false, error: 'A descrição do produto não é válida.' },
        { status: 400 },
      );
    }
    const descriptionProducts = rawDescription.trim().slice(0, 500);

    const rawValue =
      body.valueProducts === undefined || body.valueProducts === ''
        ? 0
        : typeof body.valueProducts === 'number' ||
            typeof body.valueProducts === 'string'
          ? Number(body.valueProducts)
          : Number.NaN;
    if (
      !Number.isFinite(rawValue) ||
      rawValue < 0 ||
      !Number.isSafeInteger(Math.round(rawValue * 100))
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'O valor adicional tem de ser um número válido e não negativo.',
        },
        { status: 400 },
      );
    }
    const valueProducts = Math.round(rawValue * 100) / 100;

    const tenant = await requireTenantAuthorization(request, COMPLETION_ROLES);
    if (!tenant.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            tenant.status === 401
              ? 'Não autorizado.'
              : 'Sem permissão para concluir esta marcação.',
        },
        { status: tenant.status },
      );
    }
    const { admin, barbershopId } = tenant;

    if (tenant.role !== 'owner') {
      const { data: grant, error: grantError } = await admin
        .from('barbershop_member_permissions')
        .select('permissions')
        .eq('barbershop_id', barbershopId)
        .eq('user_id', tenant.userId)
        .maybeSingle();

      if (grantError) {
        console.error(
          '[APPOINTMENT_COMPLETE_PERMISSION_ERROR]',
          grantError.code ?? 'UNKNOWN',
        );
        return NextResponse.json(
          {
            success: false,
            error: 'Não foi possível validar as permissões do atendimento.',
          },
          { status: 503 },
        );
      }

      let allowed = false;
      if (grant) {
        allowed = hasAgendaGrant(grant.permissions);
      } else {
        const { data: legacyGrant, error: legacyError } = await admin
          .from('staff_permissions')
          .select('allowed')
          .eq('barbershop_id', barbershopId)
          .eq('user_id', tenant.userId)
          .in('permission', ['agenda', 'appointments'])
          .eq('allowed', true)
          .limit(1)
          .maybeSingle();

        if (legacyError) {
          console.error(
            '[APPOINTMENT_COMPLETE_LEGACY_PERMISSION_ERROR]',
            legacyError.code ?? 'UNKNOWN',
          );
          return NextResponse.json(
            {
              success: false,
              error: 'Não foi possível validar as permissões do atendimento.',
            },
            { status: 503 },
          );
        }
        allowed = legacyGrant?.allowed === true;
      }

      if (!allowed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Sem permissão para concluir atendimentos.',
          },
          { status: 403 },
        );
      }
    }

    const plan = await resolveAccessPlanForUser(tenant.userId);
    if (!hasPlanFeature(plan, 'appointments')) {
      return NextResponse.json(
        {
          success: false,
          error: 'A agenda não está incluída no plano desta barbearia.',
        },
        { status: 403 },
      );
    }

    const { data: appointment, error: appointmentError } = await admin
      .from('appointments')
      .select(
        'id,status,barbershop_id,client_id,manual_name,manual_email,date_hour,services(name)',
      )
      .eq('id', appointmentId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();
    if (appointmentError || !appointment)
      return NextResponse.json(
        { success: false, error: 'Marcação não encontrada.' },
        { status: 404 },
      );
    if (appointment.status === 'completed')
      return NextResponse.json(
        { success: false, error: 'Este atendimento já foi concluído.' },
        { status: 409 },
      );
    if (appointment.status !== 'scheduled')
      return NextResponse.json(
        { success: false, error: 'Só podes concluir uma marcação confirmada.' },
        { status: 409 },
      );

    const { data: updated, error: updateError } = await admin
      .from('appointments')
      .update({
        status: 'completed',
        payment_method: paymentMethod,
        value_products: valueProducts,
        description_products: descriptionProducts,
      })
      .eq('id', appointmentId)
      .eq('barbershop_id', barbershopId)
      .eq('status', 'scheduled')
      .select(
        'id,status,date_hour,barbershop_id,client_id,manual_name,manual_email,services(name)',
      )
      .maybeSingle();
    if (updateError) {
      console.error(
        '[APPOINTMENT_COMPLETE_UPDATE_ERROR]',
        updateError.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        { success: false, error: 'Não foi possível concluir o atendimento.' },
        { status: 500 },
      );
    }
    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          error:
            'A marcação já foi alterada. Atualiza a agenda e tenta novamente.',
        },
        { status: 409 },
      );
    }

    const { data: shop } = await admin
      .from('shops')
      .select('id,slug,name')
      .eq('barbershop_id', barbershopId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    let customerEmail = appointment.manual_email?.trim().toLowerCase() || '';
    let customerName = appointment.manual_name?.trim() || 'Cliente';
    if (!customerEmail && appointment.client_id) {
      const { data: client } = await admin
        .from('users')
        .select('email,name_complete')
        .eq('id', appointment.client_id)
        .eq('barbershop_id', barbershopId)
        .maybeSingle();
      customerEmail = client?.email?.trim().toLowerCase() || '';
      customerName = client?.name_complete?.trim() || customerName;
    }

    const serviceRelation = Array.isArray(appointment.services)
      ? appointment.services[0]
      : appointment.services;
    let reviewEmailSent = false;
    if (customerEmail && shop?.slug && shop.id) {
      let reviewToken: string | null = null;
      try {
        const rawToken = randomBytes(32).toString('base64url');
        const tokenHash = createHash('sha256').update(rawToken).digest('hex');
        const { error: tokenError } = await admin
          .from('review_submission_tokens')
          .insert({
            appointment_id: appointment.id,
            shop_id: shop.id,
            token_hash: tokenHash,
            expires_at: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          });
        if (tokenError) {
          console.error(
            '[BOOKING_REVIEW_TOKEN_CREATE_ERROR]',
            tokenError.code ?? 'UNKNOWN',
          );
        } else {
          reviewToken = rawToken;
        }
      } catch (error) {
        console.error(
          '[BOOKING_REVIEW_TOKEN_CREATE_UNEXPECTED_ERROR]',
          error instanceof Error ? error.name : 'UNKNOWN',
        );
      }

      if (reviewToken) {
        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
          new URL(request.url).origin;
        const reviewUrlObject = new URL(
          `/barbershops/${encodeURIComponent(shop.slug)}`,
          siteUrl,
        );
        reviewUrlObject.searchParams.set('review_token', reviewToken);
        const serviceName = serviceRelation?.name || 'o teu atendimento';
        try {
          const emailResult = await sendBookingReviewRequestEmail({
            to: customerEmail,
            clientName: customerName,
            serviceName,
            barbershopName: shop.name || 'a barbearia',
            reviewUrl: reviewUrlObject.toString(),
          });
          reviewEmailSent = emailResult.success;
          if (!emailResult.success)
            console.error(
              '[BOOKING_REVIEW_EMAIL_ERROR]',
              emailResult.error ?? 'UNKNOWN',
            );
        } catch (error) {
          console.error(
            '[BOOKING_REVIEW_EMAIL_UNEXPECTED_ERROR]',
            error instanceof Error ? error.name : 'UNKNOWN',
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      booking: updated,
      reviewEmailSent,
    });
  } catch (error) {
    console.error(
      '[APPOINTMENT_COMPLETE_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { success: false, error: 'Erro interno no servidor.' },
      { status: 500 },
    );
  }
}

export const POST = withApiObservability(
  '/api/appointments/[appointmentId]/complete',
  POST__unobserved,
);
