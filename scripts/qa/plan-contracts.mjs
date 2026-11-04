import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const featuresPath = path.join(root, 'lib', 'billing', 'plan-features.ts');
const source = fs.readFileSync(featuresPath, 'utf8');
const sidebarSource = fs.readFileSync(
  path.join(root, 'app', 'dashboard', '_components', 'DashboardSidebar.tsx'),
  'utf8',
);
const dashboardPageSource = fs.readFileSync(
  path.join(root, 'app', 'dashboard', 'page.tsx'),
  'utf8',
);
const waitlistPageSource = fs.readFileSync(
  path.join(root, 'app', 'dashboard', 'espera', 'page.tsx'),
  'utf8',
);
const planComparisonSource = fs.readFileSync(
  path.join(root, 'components', 'billing', 'plan-comparison.tsx'),
  'utf8',
);
const pricingCardsSource = fs.readFileSync(
  path.join(root, 'components', 'hero', 'pricing-section.tsx'),
  'utf8',
);
const directoryDefaultsMigration = fs.readFileSync(
  path.join(
    root,
    'supabase',
    'migrations',
    '20261103202133_directory_visibility_default_free.sql',
  ),
  'utf8',
);
const directoryMigration = fs.readFileSync(
  path.join(
    root,
    'supabase',
    'migrations',
    '20261104120000_plan_override_directory_visibility_and_direct_links.sql',
  ),
  'utf8',
);
const barbershopPlanServiceSource = fs.readFileSync(
  path.join(root, 'services', 'billing', 'barbershop-stripe.service.ts'),
  'utf8',
);
const publicProfileSource = fs.readFileSync(
  path.join(root, 'lib', 'barbershops', 'public-profile.ts'),
  'utf8',
);
const publicProfilePageSource = fs.readFileSync(
  path.join(root, 'app', 'barbershops', '[slug]', 'page.tsx'),
  'utf8',
);
const enterpriseLandingPageSource = fs.readFileSync(
  path.join(root, 'app', 'site', '[slug]', 'page.tsx'),
  'utf8',
);
const sitemapSource = fs.readFileSync(
  path.join(root, 'app', 'sitemap.ts'),
  'utf8',
);
const billingSummarySource = fs.readFileSync(
  path.join(root, 'app', 'api', 'stripe', 'billing-summary', 'route.ts'),
  'utf8',
);
const subscriptionHookSource = fs.readFileSync(
  path.join(root, 'hooks', 'useSubscription.ts'),
  'utf8',
);

function expect(pattern, message) {
  assert.match(source, pattern, message);
}

expect(
  /\[PLANS\.FREE\]: \{ barbers: 1, locations: 1 \}/,
  'Free deve permitir apenas 1 barbeiro.',
);
expect(
  /\[PLANS\.PRO\]: \{ barbers: 5, locations: 1 \}/,
  'Pro deve ter limite de 5 barbeiros.',
);
expect(
  /\[PLANS\.ENTERPRISE\]: \{ barbers: UNLIMITED, locations: UNLIMITED \}/,
  'Enterprise deve ser ilimitado.',
);
expect(
  /team_management/,
  'Gestão de equipa deve permanecer disponível no sistema de features.',
);
expect(
  /messaging/,
  'Mensagens deve permanecer disponível no sistema de features.',
);
expect(
  /directory_visibility/,
  'A opção de ocultar a barbearia do diretório deve permanecer identificada como feature Pro.',
);
expect(
  /manual_mbway_prepayment/,
  'Pré-pagamento MB WAY deve permanecer como feature Pro.',
);
expect(
  /waitlist/,
  'A lista de espera deve estar definida no catálogo de funcionalidades.',
);
assert.match(
  source,
  /waitlist[^\]]*\]/s,
  'A lista de espera deve estar atribuída a um plano.',
);
assert.match(
  planComparisonSource,
  /features: \[[^\]]*'waitlist'/s,
  'A comparação de planos deve apresentar a lista de espera.',
);
assert.match(
  planComparisonSource,
  /features: \['directory_visibility', 'landing_page', 'custom_website'\]/,
  'A comparação deve apresentar a gestão da visibilidade no diretório.',
);
assert.match(
  pricingCardsSource,
  /Lista de espera e recuperação automática de vagas canceladas/,
  'O cartão Enterprise deve anunciar a lista de espera.',
);
assert.match(
  pricingCardsSource,
  /Pré-pagamento manual MB WAY e controlo de visibilidade no diretório/,
  'O cartão Pro deve refletir as funcionalidades Pro atuais.',
);
assert.match(
  waitlistPageSource,
  /hasFeature\('waitlist'\)/,
  'A página de lista de espera deve estar bloqueada para planos inferiores.',
);

assert.match(
  source,
  /export function getMinimumPlanForFeature/,
  'Os requisitos mínimos de plano devem ser resolvidos a partir do catálogo central.',
);
assert.doesNotMatch(
  sidebarSource,
  /FeaturePlanBadge/,
  'A navegação deve apresentar apenas secções; as badges pertencem às funcionalidades.',
);
assert.doesNotMatch(
  dashboardPageSource,
  /FeaturePlanBadge/,
  'Os atalhos da página inicial não devem apresentar badges de plano.',
);
assert.match(
  source,
  /if \(\(FREE_FEATURES as readonly string\[\]\)\.includes\(canonicalFeature\)\) \{\s*return null;/,
  'Funcionalidades gratuitas não devem receber badges de upgrade.',
);
assert.match(
  directoryDefaultsMigration,
  /alter column is_public_in_directory set default true/i,
  'A presença no diretório deve estar ativa por defeito.',
);
assert.match(
  directoryMigration,
  /get_effective_billing_plan_for_barbershop\(p_barbershop_id\)/i,
  'A visibilidade deve utilizar o resolver comum que reconhece os overrides Pro e Enterprise.',
);
assert.match(
  directoryMigration,
  /restore_directory_visibility_after_plan_assignment/i,
  'As alterações aos overrides administrativos devem sincronizar a visibilidade.',
);
assert.match(
  directoryMigration,
  /grant execute on function public\.set_barbershop_directory_visibility\(uuid, uuid, boolean\)\s+to authenticated, service_role/i,
  'A atualização autenticada da visibilidade deve continuar permitida.',
);
assert.match(
  directoryMigration,
  /auth\.uid\(\) <> p_actor_user_id/,
  'A RPC da visibilidade deve validar o utilizador autenticado.',
);
assert.match(
  barbershopPlanServiceSource,
  /rpc\(\s*'get_effective_billing_plan_for_barbershop'/,
  'As permissões da dashboard devem usar o mesmo plano efetivo da base de dados.',
);
assert.match(
  billingSummarySource,
  /const subscriptionOverride = subscription\?\.plan_override \?\? null/,
  'O resumo de faturação deve respeitar todos os overrides explícitos, incluindo Free.',
);
assert.match(
  subscriptionHookSource,
  /planSource === 'admin' \|\| planSource === 'subscription_override'/,
  'Os flags isPro/isBusiness devem reconhecer overrides de subscrição como direitos administrativos.',
);
assert.match(
  publicProfileSource,
  /public_profile_enabled: shop\?\.public_profile_enabled !== false/,
  'A disponibilidade do link direto deve ser independente da presença no diretório.',
);
assert.match(
  publicProfileSource,
  /is_public_in_directory: barbershop\.is_public_in_directory !== false/,
  'O perfil deve expor separadamente o estado da visibilidade no diretório.',
);
assert.doesNotMatch(
  publicProfileSource,
  /barbershop\.is_public_in_directory === false\) return null/,
  'Ocultar a barbearia do diretório não pode quebrar o link direto.',
);
assert.match(
  publicProfilePageSource,
  /index: profile\.is_public_in_directory !== false/,
  'Páginas privadas continuam acessíveis, mas não são indexadas.',
);
assert.match(
  enterpriseLandingPageSource,
  /index: data\.profile\.is_public_in_directory !== false/,
  'Landing pages privadas continuam acessíveis, mas não são indexadas.',
);
assert.match(
  sitemapSource,
  /profile\.is_public_in_directory === false/,
  'Landing pages privadas não devem aparecer no sitemap.',
);

console.log('✓ Plan limits, feature badges e directory visibility contracts OK');
