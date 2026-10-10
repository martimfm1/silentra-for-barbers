import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail } from '@/lib/email/brevo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return (
    request.headers.get('authorization') === `Bearer ${expected}` ||
    request.headers.get('x-cron-secret') === expected
  );
}
function replaceTokens(
  value: string,
  vars: { nome: string; barbearia: string },
) {
  return value
    .replaceAll('{{nome}}', vars.nome)
    .replaceAll('{{barbearia}}', vars.barbearia)
    .replaceAll(
      '{{booking_url}}',
      `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://barbers.silentra.me'}/barbershops`,
    );
}

async function GET__unobserved(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();
  const startedAt = new Date();
  let rulesProcessed = 0,
    sent = 0,
    failed = 0,
    skipped = 0;
  try {
    const { data: rules, error: rulesError } = await admin
      .from('automation_rules')
      .select('id,barbershop_id,name,trigger_type,conditions,actions')
      .eq('active', true)
      .eq('trigger_type', 'client_inactive')
      .limit(500);
    if (rulesError) throw rulesError;
    for (const rule of rules ?? []) {
      rulesProcessed += 1;
      const days = Number(
        (rule.conditions as Record<string, unknown> | null)?.inactiveDays ?? 30,
      );
      const threshold = new Date(
        Date.now() - Math.max(7, Math.min(days, 365)) * 86400000,
      ).toISOString();
      const { data: clients } = await admin
        .from('users')
        .select('id,name_complete,email')
        .eq('barbershop_id', rule.barbershop_id)
        .eq('role', 'client')
        .not('email', 'is', null)
        .limit(5000);
      const { data: shop } = await admin
        .from('barbershops')
        .select('name')
        .eq('id', rule.barbershop_id)
        .maybeSingle();
      const clientIds = (clients ?? []).map((client) => client.id);
      if (!clientIds.length) continue;
      const { data: recentAppointments } = await admin
        .from('appointments')
        .select('client_id')
        .eq('barbershop_id', rule.barbershop_id)
        .in('client_id', clientIds)
        .gte('date_hour', threshold)
        .in('status', ['scheduled', 'completed']);
      const recent = new Set(
        (recentAppointments ?? []).map((row) => row.client_id).filter(Boolean),
      );
      const action = Array.isArray(rule.actions)
        ? (rule.actions as Array<Record<string, unknown>>).find(
            (item) => item.type === 'email',
          )
        : null;
      if (!action || typeof action.body !== 'string') {
        skipped += (clients ?? []).length - recent.size;
        continue;
      }
      for (const client of clients ?? []) {
        if (recent.has(client.id) || !client.email) {
          skipped += 1;
          continue;
        }
        const today = new Date().toISOString().slice(0, 10);
        const { data: existing } = await admin
          .from('automation_runs')
          .select('id,status')
          .eq('rule_id', rule.id)
          .eq('entity_id', client.id)
          .gte('created_at', `${today}T00:00:00.000Z`)
          .limit(1)
          .maybeSingle();
        if (existing) {
          skipped += 1;
          continue;
        }
        const { data: run, error: runError } = await admin
          .from('automation_runs')
          .insert({
            rule_id: rule.id,
            barbershop_id: rule.barbershop_id,
            entity_id: client.id,
            status: 'running',
            started_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (runError || !run) {
          failed += 1;
          continue;
        }
        const result = await sendBrevoEmail({
          to: client.email,
          toName: client.name_complete ?? undefined,
          subject:
            typeof action.subject === 'string'
              ? replaceTokens(action.subject, {
                  nome: client.name_complete ?? 'Cliente',
                  barbearia: shop?.name ?? 'A tua barbearia',
                })
              : `Sentimos a tua falta — ${shop?.name ?? 'A tua barbearia'}`,
          htmlContent: `<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap">${replaceTokens(action.body, { nome: client.name_complete ?? 'Cliente', barbearia: shop?.name ?? 'A tua barbearia' }).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c)}</div>`,
        });
        await admin
          .from('automation_runs')
          .update({
            status: result.success ? 'completed' : 'failed',
            error_message: result.success ? null : result.error,
            completed_at: new Date().toISOString(),
          })
          .eq('id', run.id);
        if (result.success) sent += 1;
        else failed += 1;
      }
    }
    return NextResponse.json(
      {
        ok: true,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        rulesProcessed,
        sent,
        failed,
        skipped,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[AUTOMATIONS_CRON]', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Automation worker failed',
        rulesProcessed,
        sent,
        failed,
        skipped,
      },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability(
  '/api/cron/automations',
  GET__unobserved,
);
