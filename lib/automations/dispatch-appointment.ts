import { createAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail } from '@/lib/email/brevo';
import { dispatchMarketingEvent } from '@/lib/marketing/dispatcher';

type Trigger = 'booking_created' | 'booking_completed' | 'booking_cancelled';

type AppointmentEvent = {
  appointmentId: string;
  barbershopId: string;
  clientId?: string | null;
  manualEmail?: string | null;
  manualName?: string | null;
  serviceName?: string | null;
};

function token(value: string, vars: { nome: string; barbearia: string }) {
  return value
    .replaceAll('{{nome}}', vars.nome)
    .replaceAll('{{barbearia}}', vars.barbearia)
    .replaceAll(
      '{{booking_url}}',
      `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://barbers.silentra.me'}/barbershops`,
    );
}

function html(value: string) {
  return value
    .replace(
      /[&<>\"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[char] ?? char,
    )
    .replace(/\n/g, '<br />');
}

export async function dispatchAppointmentAutomations(
  trigger: Trigger,
  event: AppointmentEvent,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const [{ data: rules, error: rulesError }, { data: shop }] =
      await Promise.all([
        admin
          .from('automation_rules')
          .select('id,name,actions,conditions')
          .eq('barbershop_id', event.barbershopId)
          .eq('trigger_type', trigger)
          .eq('active', true),
        admin
          .from('barbershops')
          .select('name')
          .eq('id', event.barbershopId)
          .maybeSingle(),
      ]);
    if (rulesError) throw rulesError;

    let email = event.manualEmail?.trim().toLowerCase() ?? '';
    let name = event.manualName?.trim() ?? 'Cliente';
    let clientId = event.clientId ?? null;

    if (clientId) {
      const { data: client } = await admin
        .from('users')
        .select('email,name_complete')
        .eq('id', clientId)
        .eq('barbershop_id', event.barbershopId)
        .maybeSingle();
      email = email || client?.email?.trim().toLowerCase() || '';
      name = name || client?.name_complete?.trim() || 'Cliente';
    } else {
      const { data: appointment } = await admin
        .from('appointments')
        .select('client_id')
        .eq('id', event.appointmentId)
        .eq('barbershop_id', event.barbershopId)
        .maybeSingle();
      clientId = appointment?.client_id ?? null;
    }

    let hadFailure = false;

    for (const rule of rules ?? []) {
      const action = Array.isArray(rule.actions)
        ? (rule.actions as Array<Record<string, unknown>>).find(
            (item) => item.type === 'email',
          )
        : null;
      if (!action || typeof action.body !== 'string' || !email) continue;

      const { data: existing, error: existingError } = await admin
        .from('automation_runs')
        .select('id,status')
        .eq('rule_id', rule.id)
        .eq('entity_id', event.appointmentId)
        .limit(1)
        .maybeSingle();
      if (existingError) {
        hadFailure = true;
        continue;
      }
      if (existing?.status === 'completed' || existing?.status === 'running') {
        continue;
      }

      const startedAt = new Date().toISOString();
      const runResult = existing
        ? await admin
            .from('automation_runs')
            .update({
              status: 'running',
              started_at: startedAt,
              completed_at: null,
              error_message: null,
            })
            .eq('id', existing.id)
            .select('id')
            .single()
        : await admin
            .from('automation_runs')
            .insert({
              rule_id: rule.id,
              barbershop_id: event.barbershopId,
              entity_id: event.appointmentId,
              status: 'running',
              started_at: startedAt,
            })
            .select('id')
            .single();
      const run = runResult.data;
      if (runResult.error || !run) {
        hadFailure = true;
        continue;
      }

      const variables = {
        nome: name || 'Cliente',
        barbearia: shop?.name?.trim() || 'A tua barbearia',
      };
      const subject =
        typeof action.subject === 'string'
          ? token(action.subject, variables)
          : `${rule.name} — ${variables.barbearia}`;
      const body = token(action.body, variables);
      const result = await sendBrevoEmail({
        to: email,
        toName: name,
        subject,
        htmlContent: `<div style="font-family:Arial,sans-serif;line-height:1.6">${html(body)}</div>`,
      });
      const { error: runUpdateError } = await admin
        .from('automation_runs')
        .update({
          status: result.success ? 'completed' : 'failed',
          error_message: result.success ? null : result.error,
          completed_at: new Date().toISOString(),
        })
        .eq('id', run.id);
      if (!result.success || runUpdateError) hadFailure = true;
    }

    await dispatchMarketingEvent({
      barbershopId: event.barbershopId,
      eventName: trigger,
      clientId,
    });
    return !hadFailure;
  } catch (error) {
    console.error('[AUTOMATION_APPOINTMENT_DISPATCH]', {
      trigger,
      appointmentId: event.appointmentId,
      error,
    });
    return false;
  }
}
