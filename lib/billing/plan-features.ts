import { PLANS, type BillingPlan } from '@/lib/stripe/constants';

export type FreeFeatureKey =
  | 'agenda'
  | 'appointments'
  | 'clients'
  | 'services'
  | 'online_booking'
  | 'booking_page'
  | 'qr_booking'
  | 'basic_dashboard'
  | 'basic_revenue'
  | 'basic_client_history'
  | 'basic_notifications'
  | 'team_management'
  | 'messaging';

export type ProFeatureKey =
  | 'advanced_crm'
  | 'advanced_analytics'
  | 'automated_reminders'
  | 'automated_followups'
  | 'marketing_campaigns'
  | 'customer_segments'
  | 'loyalty'
  | 'advanced_reports'
  | 'advanced_notifications'
  | 'directory_visibility';

export type EnterpriseFeatureKey =
  | 'multi_location'
  | 'global_dashboard'
  | 'advanced_permissions'
  | 'commissions'
  | 'inventory'
  | 'pos'
  | 'enterprise_reports'
  | 'landing_page';

export type LegacyFeatureKey = 'professionals' | 'analytics';
export type FeatureKey =
  FreeFeatureKey | ProFeatureKey | EnterpriseFeatureKey | LegacyFeatureKey;

const FREE_FEATURES: readonly (
  FreeFeatureKey | ProFeatureKey | EnterpriseFeatureKey
)[] = [
  'agenda',
  'appointments',
  'clients',
  'services',
  'online_booking',
  'booking_page',
  'qr_booking',
  'basic_dashboard',
  'basic_revenue',
  'basic_client_history',
  'basic_notifications',
  'team_management',
  'messaging',
];

const PRO_FEATURES: readonly (
  FreeFeatureKey | ProFeatureKey | EnterpriseFeatureKey
)[] = [
  ...FREE_FEATURES,
  'advanced_crm',
  'advanced_analytics',
  'automated_reminders',
  'automated_followups',
  'marketing_campaigns',
  'customer_segments',
  'loyalty',
  'advanced_reports',
  'advanced_notifications',
  'directory_visibility',
];

const ENTERPRISE_FEATURES: readonly (
  FreeFeatureKey | ProFeatureKey | EnterpriseFeatureKey
)[] = [
  ...PRO_FEATURES,
  'multi_location',
  'global_dashboard',
  'advanced_permissions',
  'commissions',
  'inventory',
  'pos',
  'enterprise_reports',
  'landing_page',
];

export const PLAN_FEATURES: Record<
  BillingPlan,
  readonly (FreeFeatureKey | ProFeatureKey | EnterpriseFeatureKey)[]
> = {
  [PLANS.FREE]: FREE_FEATURES,
  [PLANS.PRO]: PRO_FEATURES,
  [PLANS.ENTERPRISE]: ENTERPRISE_FEATURES,
};

const LEGACY_FEATURE_ALIASES: Record<
  LegacyFeatureKey,
  FreeFeatureKey | ProFeatureKey | EnterpriseFeatureKey
> = {
  professionals: 'team_management',
  analytics: 'advanced_analytics',
};

export const UNLIMITED = Infinity;
export interface PlanLimits {
  barbers: number;
  locations: number;
}
export type PlanLimitKey = keyof PlanLimits;

export const PLAN_LIMITS: Record<BillingPlan, PlanLimits> = {
  [PLANS.FREE]: { barbers: 1, locations: 1 },
  [PLANS.PRO]: { barbers: 5, locations: 1 },
  [PLANS.ENTERPRISE]: { barbers: UNLIMITED, locations: UNLIMITED },
};

export function getPlanLimit(plan: BillingPlan, limit: PlanLimitKey): number {
  return PLAN_LIMITS[plan][limit];
}
export function isUnlimited(value: number): boolean {
  return value === UNLIMITED;
}
export function getPlanFeatures(plan: BillingPlan) {
  return PLAN_FEATURES[plan];
}

export function hasPlanFeature(
  plan: BillingPlan,
  feature: FeatureKey,
): boolean {
  const canonicalFeature =
    feature in LEGACY_FEATURE_ALIASES
      ? LEGACY_FEATURE_ALIASES[feature as LegacyFeatureKey]
      : (feature as FreeFeatureKey | ProFeatureKey | EnterpriseFeatureKey);
  return PLAN_FEATURES[plan].includes(canonicalFeature);
}

export const PLAN_DESCRIPTIONS: Record<BillingPlan, string> = {
  free: 'Para uma barbearia pequena começar a gerir tudo gratuitamente.',
  pro: 'Para equipas em crescimento que querem automatizar e fazer crescer o negócio.',
  enterprise:
    'Para operações com várias localizações, gestão avançada e uma landing page profissional incluída.',
};

export const PLAN_NAMES: Record<BillingPlan, string> = {
  free: 'Barbers Free',
  pro: 'Barbers Pro',
  enterprise: 'Barbers Enterprise',
};

export const FEATURE_LABELS: Record<
  FreeFeatureKey | ProFeatureKey | EnterpriseFeatureKey,
  string
> = {
  agenda: 'Agenda completa',
  appointments: 'Marcações ilimitadas',
  clients: 'Clientes ilimitados',
  services: 'Serviços ilimitados',
  online_booking: 'Reservas online',
  booking_page: 'Página de reservas',
  qr_booking: 'Reservas por QR code',
  basic_dashboard: 'Dashboard básico',
  basic_revenue: 'Receita básica',
  basic_client_history: 'Histórico do cliente',
  basic_notifications: 'Notificações essenciais',
  team_management: 'Gestão de equipa',
  messaging: 'Mensagens por email',
  directory_visibility: 'Visibilidade no diretório',
  advanced_crm: 'CRM avançado',
  advanced_analytics: 'Analytics avançado',
  automated_reminders: 'Lembretes automáticos',
  automated_followups: 'Follow-ups automáticos',
  marketing_campaigns: 'Campanhas de marketing',
  customer_segments: 'Segmentos de clientes',
  loyalty: 'Programa de fidelização',
  advanced_reports: 'Relatórios avançados',
  advanced_notifications: 'Notificações avançadas',
  multi_location: 'Multi-localização',
  global_dashboard: 'Dashboard global',
  advanced_permissions: 'Permissões avançadas',
  commissions: 'Comissões',
  inventory: 'Gestão de stock',
  pos: 'Ponto de venda (POS)',
  enterprise_reports: 'Relatórios empresariais',
  landing_page: 'Landing page profissional incluída',
};
