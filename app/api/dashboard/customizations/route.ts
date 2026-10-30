import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertSameOrigin } from '@/services/billing/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_CONFIG = {
  shortcuts: ['new-booking', 'clients', 'services', 'team', 'analytics'],
  sections: {
    quickActions: true,
    metrics: true,
    nextAppointment: true,
    activityChart: true,
    upcomingAppointments: true,
  },
  accentColor: '#34d399',
} as const;

const SHORTCUT_IDS = new Set([
  'new-booking', 'clients', 'services', 'team', 'analytics',
  'loyalty', 'qr-code', 'automations', 'messages', 'marketing',
  'sales', 'website', 'support',
]);
const SECTION_IDS = new Set([
  'quickActions', 'metrics', 'nextAppointment', 'activityChart',
  'upcomingAppointments',
]);
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

type DashboardConfig = {
  shortcuts: string[];
  sections: Record<string, boolean>;
  accentColor: string;
};

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function getContext() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { response: fail('Tens de iniciar sessão.', 401) } as const;

  const database = createAdminClient();
  const { data: profile, error } = await database
    .from('users')
    .select('id, barbershop_id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[DASHBOARD_CUSTOMIZATION_PROFILE_FAILED]', { code: error.code });
    return { response: fail('Não foi possível validar a tua conta.', 503) } as const;
  }
  if (!profile?.barbershop_id || ['client', 'customer'].includes(String(profile.role).toLowerCase())) {
    return { response: fail('Não tens acesso à personalização da dashboard.', 403) } as const;
  }

  return { user, barbershopId: profile.barbershop_id as string, database } as const;
}

function parseConfig(value: unknown): DashboardConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !['shortcuts', 'sections', 'accentColor'].includes(key))) return null;

  if (!Array.isArray(input.shortcuts) || input.shortcuts.length > SHORTCUT_IDS.size) return null;
  const shortcuts = [...new Set(input.shortcuts)];
  if (shortcuts.some((id) => typeof id !== 'string' || !SHORTCUT_IDS.has(id))) return null;

  if (!input.sections || typeof input.sections !== 'object' || Array.isArray(input.sections)) return null;
  const sectionInput = input.sections as Record<string, unknown>;
  if (Object.keys(sectionInput).some((key) => !SECTION_IDS.has(key))) return null;
  const sections: Record<string, boolean> = {};
  for (const key of SECTION_IDS) {
    const flag = sectionInput[key];
    if (typeof flag !== 'boolean') return null;
    sections[key] = flag;
  }

  if (typeof input.accentColor !== 'string' || !COLOR_PATTERN.test(input.accentColor)) return null;
  return { shortcuts: shortcuts as string[], sections, accentColor: input.accentColor.toLowerCase() };
}

async function ensureDefault(context: { user: { id: string }; barbershopId: string; database: ReturnType<typeof createAdminClient> }) {
  const { data: existing, error: readError } = await context.database
    .from('barbershop_dashboard_customizations')
    .select('id, barbershop_id, user_id, name, config, is_active, created_at, updated_at')
    .eq('barbershop_id', context.barbershopId)
    .eq('user_id', context.user.id)
    .order('created_at', { ascending: true });

  if (readError) throw readError;
  if (existing?.length) {
    if (!existing.some((item) => item.is_active)) {
      const { error } = await context.database
        .from('barbershop_dashboard_customizations')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', existing[0].id);
      if (error) throw error;
      existing[0].is_active = true;
    }
    return existing;
  }

  const { data: created, error } = await context.database
    .from('barbershop_dashboard_customizations')
    .insert({
      barbershop_id: context.barbershopId,
      user_id: context.user.id,
      name: 'A minha dashboard',
      config: DEFAULT_CONFIG,
      is_active: true,
    })
    .select('id, barbershop_id, user_id, name, config, is_active, created_at, updated_at')
    .single();
  if (error) throw error;
  return [created];
}

async function GET__unobserved() {
  try {
    const context = await getContext();
    if ('response' in context) return context.response;
    const data = await ensureDefault(context);
    const active = data.find((item) => item.is_active) ?? data[0];
    return NextResponse.json({ data, activeId: active.id }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[DASHBOARD_CUSTOMIZATION_GET_FAILED]', {
      code: typeof error === 'object' && error && 'code' in error ? error.code : 'UNKNOWN',
    });
    return fail('Não foi possível carregar as personalizações.', 503);
  }
}

async function readBody(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return { response: fail('O pedido tem de usar application/json.', 415) } as const;
  }
  const raw = await request.text();
  if (raw.length > 12_000) return { response: fail('O pedido é demasiado grande.', 413) } as const;
  try {
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { response: fail('Formato de pedido inválido.', 400) } as const;
    }
    return { body: body as Record<string, unknown> } as const;
  } catch {
    return { response: fail('JSON inválido.', 400) } as const;
  }
}

async function POST__unobserved(request: Request) {
  try {
    try { assertSameOrigin(request); } catch { return fail('A origem do pedido não pôde ser validada.', 403); }
    const context = await getContext();
    if ('response' in context) return context.response;
    const parsed = await readBody(request);
    if ('response' in parsed) return parsed.response;

    if (Object.keys(parsed.body).some((key) => !['name', 'config'].includes(key))) return fail('O pedido contém campos não permitidos.', 400);
    const { name, config } = parsed.body;
    const cleanName = typeof name === 'string' ? name.trim().slice(0, 48) : '';
    const validConfig = parseConfig(config);
    if (!cleanName || !validConfig) return fail('Nome ou personalização inválida.', 400);

    const { data: existing, error: listError } = await context.database
      .from('barbershop_dashboard_customizations')
      .select('id')
      .eq('barbershop_id', context.barbershopId)
      .eq('user_id', context.user.id);
    if (listError) throw listError;
    if ((existing?.length ?? 0) >= 10) return fail('Podes guardar até 10 personalizações.', 409);

    const { data, error } = await context.database
      .from('barbershop_dashboard_customizations')
      .insert({
        barbershop_id: context.barbershopId,
        user_id: context.user.id,
        name: cleanName,
        config: validConfig,
        is_active: false,
      })
      .select('id, barbershop_id, user_id, name, config, is_active, created_at, updated_at')
      .single();
    if (error?.code === '23505') return fail('Já existe uma personalização com esse nome.', 409);
    if (error || !data) throw error ?? new Error('Insert failed');
    return NextResponse.json({ data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[DASHBOARD_CUSTOMIZATION_POST_FAILED]', {
      code: typeof error === 'object' && error && 'code' in error ? error.code : 'UNKNOWN',
    });
    return fail('Não foi possível guardar a personalização.', 503);
  }
}

async function PATCH__unobserved(request: Request) {
  try {
    try { assertSameOrigin(request); } catch { return fail('A origem do pedido não pôde ser validada.', 403); }
    const context = await getContext();
    if ('response' in context) return context.response;
    const parsed = await readBody(request);
    if ('response' in parsed) return parsed.response;

    if (Object.keys(parsed.body).some((key) => !['id', 'name', 'config', 'activate'].includes(key))) return fail('O pedido contém campos não permitidos.', 400);
    const { id, name, config, activate } = parsed.body;
    if (typeof id !== 'string') return fail('Personalização inválida.', 400);
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) {
      const cleanName = typeof name === 'string' ? name.trim().slice(0, 48) : '';
      if (!cleanName) return fail('O nome é obrigatório.', 400);
      updates.name = cleanName;
    }
    if (config !== undefined) {
      const validConfig = parseConfig(config);
      if (!validConfig) return fail('As opções de personalização são inválidas.', 400);
      updates.config = validConfig;
    }

    const { data: owned, error: ownedError } = await context.database
      .from('barbershop_dashboard_customizations')
      .select('id')
      .eq('id', id)
      .eq('barbershop_id', context.barbershopId)
      .eq('user_id', context.user.id)
      .maybeSingle();
    if (ownedError) throw ownedError;
    if (!owned) return fail('Personalização não encontrada.', 404);

    if (activate === true) {
      const { error: deactivateError } = await context.database
        .from('barbershop_dashboard_customizations')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('barbershop_id', context.barbershopId)
        .eq('user_id', context.user.id)
        .eq('is_active', true);
      if (deactivateError) throw deactivateError;
      updates.is_active = true;
    }

    const { data, error } = await context.database
      .from('barbershop_dashboard_customizations')
      .update(updates)
      .eq('id', id)
      .eq('barbershop_id', context.barbershopId)
      .eq('user_id', context.user.id)
      .select('id, barbershop_id, user_id, name, config, is_active, created_at, updated_at')
      .single();
    if (error?.code === '23505') return fail('Já existe uma personalização com esse nome.', 409);
    if (error || !data) throw error ?? new Error('Update failed');
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[DASHBOARD_CUSTOMIZATION_PATCH_FAILED]', {
      code: typeof error === 'object' && error && 'code' in error ? error.code : 'UNKNOWN',
    });
    return fail('Não foi possível atualizar a personalização.', 503);
  }
}

async function DELETE__unobserved(request: Request) {
  try {
    try { assertSameOrigin(request); } catch { return fail('A origem do pedido não pôde ser validada.', 403); }
    const context = await getContext();
    if ('response' in context) return context.response;
    const parsed = await readBody(request);
    if ('response' in parsed) return parsed.response;
    if (Object.keys(parsed.body).some((key) => key !== 'id')) return fail('O pedido contém campos não permitidos.', 400);
    const id = parsed.body.id;
    if (typeof id !== 'string') return fail('Personalização inválida.', 400);

    const { data: rows, error: listError } = await context.database
      .from('barbershop_dashboard_customizations')
      .select('id, is_active')
      .eq('barbershop_id', context.barbershopId)
      .eq('user_id', context.user.id);
    if (listError) throw listError;
    if (!rows?.some((row) => row.id === id)) return fail('Personalização não encontrada.', 404);
    if (rows.length <= 1) return fail('Mantém pelo menos uma personalização.', 409);

    const { error } = await context.database
      .from('barbershop_dashboard_customizations')
      .delete()
      .eq('id', id)
      .eq('barbershop_id', context.barbershopId)
      .eq('user_id', context.user.id);
    if (error) throw error;

    if (rows.find((row) => row.id === id)?.is_active) {
      const fallback = rows.find((row) => row.id !== id);
      if (fallback) {
        const { error: activateError } = await context.database
          .from('barbershop_dashboard_customizations')
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq('id', fallback.id);
        if (activateError) throw activateError;
      }
    }
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[DASHBOARD_CUSTOMIZATION_DELETE_FAILED]', {
      code: typeof error === 'object' && error && 'code' in error ? error.code : 'UNKNOWN',
    });
    return fail('Não foi possível eliminar a personalização.', 503);
  }
}

export const GET = withApiObservability('/api/dashboard/customizations', GET__unobserved);
export const POST = withApiObservability('/api/dashboard/customizations', POST__unobserved);
export const PATCH = withApiObservability('/api/dashboard/customizations', PATCH__unobserved);
export const DELETE = withApiObservability('/api/dashboard/customizations', DELETE__unobserved);
