import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const dashboardPage = read('app/dashboard/page.tsx');
const automationPage = read('app/dashboard/automations/page.tsx');
const automationSidebar = read(
  'app/dashboard/_components/DashboardSidebar.tsx',
);
const marketingWorkspace = read(
  'app/dashboard/marketing/marketing-workspace.tsx',
);
const stripePricesRoute = read('app/api/stripe/prices/route.ts');
const billingSummaryRoute = read('app/api/stripe/billing-summary/route.ts');
const subscriptionDriftMigration = read(
  'supabase/migrations/20261022181644_restore_subscription_cancellation_requested_at.sql',
);

const websitePage = read('app/[slug]/page.tsx');
const enterpriseWebsitePage = read('app/site/[slug]/page.tsx');
const websiteRequestApi = read('app/api/dashboard/custom-website/route.ts');
const websiteAdminApi = read(
  'app/api/silentra-admin/custom-websites/[requestId]/route.ts',
);
const websiteMigration = read(
  'supabase/migrations/20261017103519_enterprise_custom_website_requests.sql',
);
const sitemap = read('app/sitemap.ts');
const publicApi = read('app/api/v1/public/barbershops/[slug]/route.ts');
const publicApiDocs = read('docs/API_PUBLICA.md');
const birthdayApi = read('app/api/messages/birthdays/route.ts');
const birthdayWorker = read('lib/marketing/birthday-delivery.ts');
const birthdayReconciliation = read(
  'supabase/migrations/20261022161843_reconcile_legacy_birthday_campaigns.sql',
);
const marketingCron = read('app/api/cron/marketing/route.ts');
const bookingApi = read('app/api/bookings/route.ts');
const mbwayBookingDrawer = read(
  'app/barbershops/components/booking-drawer-canonical.tsx',
);
const mbwayConfirmationApi = read(
  'app/api/appointments/[appointmentId]/confirm/route.ts',
);
const mbwayMigration = read(
  'supabase/migrations/20261031112123_manual_mbway_prepayment.sql',
);
const mbwayRpcRepairMigration = read(
  'supabase/migrations/20261113174136_restore_mbway_prepayment_booking_rpc.sql',
);
const bookingSettings = read(
  'components/dashboard/settings-automatic-booking-panel.tsx',
);
const bookingSettingsMigration = read(
  'supabase/migrations/20260827133000_automatic_booking_settings.sql',
);
const bookingRpcMigration = read(
  'supabase/migrations/20260905150000_finalize_atomic_booking_contract.sql',
);
const completionMigration = read(
  'supabase/migrations/20260827134500_enable_booking_completion_worker.sql',
);
const completionSchedule = read(
  'supabase/migrations/20260827180000_schedule_booking_completion_with_pg_cron.sql',
);
const completionCronApi = read('app/api/cron/booking-completion/route.ts');
const bookingOutboxSchedule = read(
  'supabase/migrations/20261022165654_schedule_booking_automation_outbox.sql',
);
const bookingOutboxTimeout = read(
  'supabase/migrations/20261022170213_increase_booking_outbox_http_timeout.sql',
);
const bookingOutboxMigration = read(
  'supabase/migrations/20261022165242_booking_automation_outbox.sql',
);
const bookingOutboxWorker = read(
  'app/api/cron/booking-automation-outbox/route.ts',
);
const appointmentReminderMigration = read(
  'supabase/migrations/20261103012145_automatic_appointment_reminders.sql',
);
const appointmentReminderSchedule = read(
  'supabase/migrations/20261103012147_schedule_appointment_reminders.sql',
);
const appointmentReminderWorker = read(
  'app/api/cron/appointment-reminders/route.ts',
);
const bookingLifecycleCron = read('app/api/cron/booking-lifecycle/route.ts');
const appointmentCompleteApi = read(
  'app/api/appointments/[appointmentId]/complete/route.ts',
);
const adminReportsPage = read('app/silentra-admin/reports/page.tsx');
const adminReportsUi = read('app/_silentra-admin/reports-page.tsx');
const adminReportsApi = read('app/api/silentra-admin/reports/route.ts');
const adminReportsMigration = read(
  'supabase/migrations/20261022165246_platform_admin_reports.sql',
);
const marketingCronWorkflow = read('.github/workflows/marketing-cron.yml');

assert.match(
  websiteRequestApi,
  /require\(['"]@\/services\/billing\/barbershop-stripe\.service|BarbershopStripeService/,
);
assert.match(websiteRequestApi, /custom_website_requests/);
assert.match(websiteRequestApi, /assertSameOrigin/);
assert.match(websiteAdminApi, /requirePlatformAdmin/);
assert.match(websiteAdminApi, /update\.status/);
assert.match(websiteAdminApi, /nextStatus === 'published'/);
assert.match(websitePage, /getPublishedWebsite/);
assert.match(websitePage, /eq\('status', 'published'\)/);
assert.match(websitePage, /notFound\(\)/);
assert.match(enterpriseWebsitePage, /barbershop_landing_pages/);
assert.match(websiteMigration, /custom_website_requests_one_active_per_shop/);
assert.match(websiteMigration, /enable row level security/i);
assert.match(
  sitemap,
  /customWebsiteRoutes\.push\([\s\S]*url: `\$\{SITE_URL\}\/\$\{encodeURIComponent\(slug\)\}`/,
);

assert.match(publicApi, /const PUBLIC_API_ENABLED = false/);
assert.match(publicApi, /if \(!PUBLIC_API_ENABLED\)/);
assert.match(publicApi, /consumePublicRateLimit/);
assert.match(publicApi, /Access-Control-Allow-Origin/);
assert.match(publicApi, /if-none-match/);
assert.match(publicApi, /ETag: etag/);
assert.match(publicApi, /'Cache-Control': PUBLIC_CACHE/);
assert.match(publicApiDocs, /temporariamente desativada/);

assert.match(birthdayApi, /trigger_type: 'birthday'/);
assert.match(birthdayApi, /active: enabled/);
assert.match(birthdayWorker, /\.eq\('trigger_type', 'birthday'\)/);
assert.match(birthdayWorker, /claimCampaign\(campaign, today\)/);
assert.match(birthdayWorker, /birthday:\$\{birthdayDate\}/);
assert.match(birthdayWorker, /status === 'sent'/);
assert.match(birthdayReconciliation, /birthday_email_automations/);
assert.match(birthdayReconciliation, /legacy.enabled = true/);
assert.match(
  birthdayReconciliation,
  /not exists \([\s\S]*campaign.trigger_type = 'birthday'/,
);
assert.match(marketingCron, /processBirthdayCampaignDelivery/);
assert.match(marketingCron, /CRON_SECRET/);
assert.match(marketingCronWorkflow, /cron: '\*\/5 \* \* \* \*'/);
assert.match(marketingCronWorkflow, /\/api\/cron\/marketing/);

assert.match(bookingApi, /'create_booking_atomic'/);
assert.match(
  bookingApi,
  /p_status: isPrepayment \? 'prepayment_pending' : 'pending'/,
);
assert.match(bookingApi, /appointment\.status === 'scheduled'/);
assert.match(
  mbwayMigration,
  /payment_status[\s\S]*payment_amount[\s\S]*payment_expires_at/,
);
assert.match(bookingApi, /prepaymentReview/);
assert.match(mbwayBookingDrawer, /prepaymentSelected/);
assert.match(mbwayBookingDrawer, /whatsappProofUrl/);
assert.match(mbwayBookingDrawer, /prepaymentEmailNotice/);
assert.match(mbwayBookingDrawer, /loadingBookingData/);
assert.match(mbwayBookingDrawer, /A carregar barbeiros e serviços/);
assert.match(mbwayBookingDrawer, /A consultar horários para este serviço/);
assert.match(mbwayBookingDrawer, /animate-pulse/);
assert.match(mbwayBookingDrawer, /Service summary/);
assert.match(mbwayBookingDrawer, /service\.durationMinutes/);
assert.match(mbwayBookingDrawer, /Number\(service\.price\)\.toFixed\(2\)/);
assert.match(mbwayBookingDrawer, /finally\(\(\) => \{/);
assert.match(mbwayConfirmationApi, /payment_status: 'confirmed'/);
assert.match(mbwayMigration, /MBWAY_PREPAYMENT_PRO_REQUIRED/);
assert.match(mbwayMigration, /expire_manual_mbway_prepayments/);
assert.match(mbwayMigration, /silentra-mbway-prepayment-expiry/);
assert.match(mbwayMigration, /<> 'prepayment_pending'/);
assert.match(mbwayMigration, /notify pgrst, 'reload schema'/);
assert.match(mbwayRpcRepairMigration, /create or replace function public\.create_booking_atomic/);
assert.match(mbwayRpcRepairMigration, /v_is_prepayment boolean/);
assert.match(mbwayRpcRepairMigration, /in \('pending', 'prepayment_pending'\)/);
assert.match(mbwayRpcRepairMigration, /payment_method[\s\S]*payment_status[\s\S]*payment_amount[\s\S]*payment_expires_at/);
assert.match(mbwayRpcRepairMigration, /interval '15 minutes'/);
assert.match(mbwayRpcRepairMigration, /v_auto_confirm_manual/);
assert.match(mbwayRpcRepairMigration, /not v_is_prepayment/);
assert.match(mbwayRpcRepairMigration, /payment_status = 'awaiting_review'[\s\S]*payment_expires_at <= now\(\)/);
assert.match(mbwayRpcRepairMigration, /set search_path = ''/);
assert.match(bookingApi, /appointment\.status !== 'pending'/);
assert.match(bookingApi, /\.in\('status', \['pending', 'scheduled'\]\)/);
assert.match(bookingApi, /payment_status: 'rejected'/);
assert.match(bookingSettings, /auto_confirm_bookings/);
assert.match(bookingSettings, /auto_complete_bookings/);
assert.match(bookingSettings, /barbershopService\.updateConfig/);
assert.match(
  bookingSettingsMigration,
  /auto_confirm_bookings boolean not null default false/,
);
assert.match(
  bookingSettingsMigration,
  /auto_complete_bookings boolean not null default false/,
);
assert.match(
  bookingRpcMigration,
  /coalesce\(b\.auto_confirm_bookings, false\)/,
);
assert.match(bookingRpcMigration, /if v_auto_confirm then/);
assert.match(bookingRpcMigration, /v_status := 'scheduled'/);

assert.match(completionMigration, /process_automatic_booking_completion/);
assert.match(completionMigration, /auto_complete_bookings/);
assert.match(completionMigration, /a\.status = 'scheduled'/);
assert.match(completionMigration, /a\.date_hour[\s\S]*<= now\(\)/);
assert.match(completionSchedule, /cron\.schedule\(/);
assert.match(completionSchedule, /silentra-booking-completion/);
assert.match(completionSchedule, /\*\/10 \* \* \* \*/);
assert.match(completionCronApi, /CRON_SECRET/);
assert.match(completionCronApi, /process_automatic_booking_completion/);

assert.match(bookingOutboxMigration, /booking_automation_outbox/);
assert.match(bookingOutboxMigration, /for update skip locked/i);
assert.match(bookingOutboxMigration, /unique \(appointment_id, event_type\)/);
assert.match(bookingOutboxWorker, /claim_booking_automation_events/);
assert.match(bookingOutboxWorker, /export const POST/);
assert.match(bookingLifecycleCron, /process_automatic_booking_completion/);
assert.doesNotMatch(bookingLifecycleCron, /dispatchAppointmentAutomations/);
assert.doesNotMatch(appointmentCompleteApi, /dispatchAppointmentAutomations/);
assert.match(bookingOutboxWorker, /BOOKING_OUTBOX_CRON_SECRET/);
assert.match(bookingOutboxWorker, /createHmac/);
assert.match(bookingOutboxWorker, /timingSafeEqual/);
assert.match(bookingOutboxWorker, /x-booking-timestamp/);
assert.match(bookingOutboxSchedule, /silentra-booking-automation-outbox/);
assert.match(bookingOutboxSchedule, /\*\/10 \* \* \* \*/);
assert.match(bookingOutboxSchedule, /vault\.decrypted_secrets/);
assert.match(appointmentReminderMigration, /appointment_reminder_outbox/);
assert.match(appointmentReminderMigration, /for update skip locked/i);
assert.match(
  appointmentReminderMigration,
  /create unique index[\s\S]*?on public\.appointment_reminder_outbox \(appointment_id, scheduled_for\)/,
);
assert.match(appointmentReminderMigration, /AUTOMATED_REMINDERS_PRO_REQUIRED/);
assert.match(appointmentReminderMigration, /interval '24 hours'/);
assert.match(appointmentReminderWorker, /claim_appointment_reminder_events/);
assert.match(appointmentReminderWorker, /sendBrevoEmail/);
assert.match(appointmentReminderWorker, /x-reminder-signature/);
assert.match(appointmentReminderSchedule, /silentra-appointment-reminders/);
assert.match(appointmentReminderSchedule, /\*\/10 \* \* \* \*/);
assert.match(bookingSettings, /auto_reminders/);
assert.match(bookingSettings, /autoRemindersTitle/);
assert.match(bookingOutboxTimeout, /timeout_milliseconds := 15000/);
assert.match(adminReportsPage, /getPlatformAdminContext/);
assert.match(adminReportsUi, /Relatórios da plataforma/);
assert.match(adminReportsUi, /Exportar CSV/);
assert.match(adminReportsApi, /requirePlatformAdmin/);
assert.match(adminReportsApi, /get_platform_admin_reports/);
assert.match(adminReportsMigration, /get_platform_admin_reports/);
assert.match(
  adminReportsMigration,
  /revoke all on function public\.get_platform_admin_reports/,
);

assert.ok(
  subscriptionDriftMigration.includes(
    'add column if not exists cancellation_requested_at timestamptz',
  ),
  'Billing schema repair must add the cancellation timestamp queried by billing-summary.',
);
assert.ok(
  billingSummaryRoute.includes(
    'canceled_by_user_id, cancellation_requested_at, updated_at',
  ),
  'Billing summary must keep the cancellation data contract covered by a migration.',
);
assert.ok(
  stripePricesRoute.includes('{ mode: paymentMode, data: prices }'),
  'The public prices endpoint must return the payment mode for the pricing UI.',
);
assert.ok(
  dashboardPage.includes("t('dashboard.weeklyActivity')") &&
    dashboardPage.includes('role="img"') &&
    dashboardPage.includes('grid h-full min-w-0 grid-cols-7') &&
    dashboardPage.includes('hasChartActivity') &&
    dashboardPage.includes("appointment.status !== 'cancelled'") &&
    dashboardPage.includes('point.bookings / maxBookings') &&
    !dashboardPage.includes('maxRevenue'),
  'Dashboard overview must render a clear single-metric weekday booking chart with an empty state.',
);
assert.ok(
  automationPage.includes('MarketingWorkspace initialView="automation"') &&
    automationSidebar.includes("href: '/dashboard/automations'") &&
    !automationSidebar.includes("label: 'Aniversários'") &&
    !automationSidebar.includes("href: '/dashboard/mensagens/birthdays'"),
  'Birthday automation must live inside the dedicated Automations navigation, not a separate birthday tab.',
);
assert.ok(
  marketingWorkspace.includes('async function createBirthdayAutomation()') &&
    marketingWorkspace.includes("triggerType: 'birthday'") &&
    marketingWorkspace.includes('Adicionar automaticamente') &&
    marketingWorkspace.includes('birthdayCampaign'),
  'Automations must provide an idempotent one-click birthday automation setup.',
);


const appointmentActivityMigration = read(
  'supabase/migrations/20261118173900_appointment_activity_timeline.sql',
);
const appointmentActivityApi = read(
  'app/api/appointments/[appointmentId]/activity/route.ts',
);
const appointmentNotificationRetryApi = read(
  'app/api/appointments/[appointmentId]/notifications/retry/route.ts',
);
const appointmentCancellationApi = read(
  'app/api/appointments/[appointmentId]/cancel/route.ts',
);
const appointmentActivityWriter = read('lib/appointments/activity.ts');
const appointmentDetailDialog = read(
  'components/dashboard/appointment-detail-dialog.tsx',
);
assert.ok(appointmentActivityMigration.includes("'appointment.created'"));
assert.ok(appointmentActivityMigration.includes("'appointment.cancelled'"));
assert.ok(!appointmentActivityMigration.includes('appointment.updated_at'));
assert.ok(appointmentActivityMigration.includes('barbershop_id uuid references public.barbershops'));
assert.ok(appointmentActivityMigration.includes('revoke all on table public.audit_logs from public, anon, authenticated'));
assert.ok(appointmentActivityApi.includes(".eq('barbershop_id', tenant.barbershopId)"));
assert.ok(appointmentActivityApi.includes('safeMetadata'));
assert.ok(!appointmentActivityApi.includes('metadata.email'));
assert.ok(appointmentActivityWriter.includes('actor_id: input.actorId'));
assert.ok(appointmentActivityWriter.includes('action: `appointment.${input.event}`'));
assert.ok(appointmentDetailDialog.includes('Histórico de atividade'));
assert.ok(appointmentDetailDialog.includes('Activity history'));
assert.ok(appointmentNotificationRetryApi.includes("latestActivity.actor_type !== 'staff'"));
assert.ok(appointmentNotificationRetryApi.includes("metadata.notificationSent === true"));
assert.ok(appointmentNotificationRetryApi.includes("metadata.notificationSkipped === true"));
assert.ok(appointmentNotificationRetryApi.includes('sendCustomerAppointmentRescheduledEmail'));
assert.ok(appointmentNotificationRetryApi.includes('sendAppointmentCancellationEmail'));
assert.ok(appointmentNotificationRetryApi.includes("'claim_appointment_notification_retry'"));
assert.ok(appointmentNotificationRetryApi.includes("'complete_appointment_notification_retry'"));
assert.ok(appointmentNotificationRetryApi.includes('randomUUID()'));
assert.ok(appointmentNotificationRetryApi.includes("errorCode === 'BREVO_NETWORK_ERROR'"));
assert.ok(appointmentNotificationRetryApi.includes('BREVO_HTTP_'));
assert.ok(appointmentNotificationRetryApi.includes('deliveryOutcomeUnknown = true'));
assert.ok(appointmentNotificationRetryApi.includes('retryPending: true'));
assert.ok(appointmentNotificationRetryApi.includes('O reenvio ficará temporariamente bloqueado'));
assert.ok(appointmentDetailDialog.includes('A confirmar o resultado do envio do email'));
assert.ok(appointmentDetailDialog.includes('Confirming email…'));
assert.ok(appointmentNotificationRetryApi.includes('notificationRetryToken') === false);
assert.ok(!appointmentNotificationRetryApi.includes(".from('audit_logs')\n      .update("));
assert.ok(appointmentNotificationRetryApi.includes('status: 409'));
assert.ok(appointmentCancellationApi.includes('notificationRetryCount: 0'));
assert.ok(appointmentActivityApi.includes('notificationRetryCount'));
assert.ok(appointmentActivityApi.includes('notificationRetryInProgress'));
assert.ok(appointmentActivityApi.includes('notificationRetryLeaseUntil'));
assert.ok(appointmentActivityApi.includes('Date.now()'));
assert.ok(appointmentDetailDialog.includes('Reenviar email'));
assert.ok(appointmentDetailDialog.includes('/notifications/retry'));
assert.ok(appointmentDetailDialog.includes("cache: 'no-store'"));
assert.ok(appointmentDetailDialog.includes('notificationRetryInProgress'));
assert.ok(appointmentDetailDialog.includes('Confirming email…'));
assert.ok(appointmentDetailDialog.includes('window.setInterval'));
assert.ok(appointmentDetailDialog.includes('window.clearInterval'));
assert.ok(appointmentActivityApi.includes('notificationSkipped'));

const appointmentRescheduleApi = read(
  'app/api/appointments/[appointmentId]/reschedule/route.ts',
);
const customerPortalAppointmentsApi = read(
  'app/api/customer-portal/appointments/[appointmentId]/route.ts',
);
for (const [name, source] of [
  ['reschedule', appointmentRescheduleApi],
  ['cancel', appointmentCancellationApi],
  ['notification retry', appointmentNotificationRetryApi],
  ['activity', appointmentActivityApi],
]) {
  assert.ok(
    source.includes('requireTenantAuthorization'),
    `Staff appointment ${name} endpoint must authorize the active tenant`,
  );
  assert.ok(
    source.includes(".eq('barbershop_id', tenant.barbershopId)"),
    `Staff appointment ${name} queries must be scoped to the active barbershop`,
  );
}
assert.ok(customerPortalAppointmentsApi.includes('getPortalSession(request)'));
assert.ok(customerPortalAppointmentsApi.includes('ownsAppointment'));
assert.ok(customerPortalAppointmentsApi.includes('appointment.manual_email?.trim().toLowerCase() === session.email'));
assert.ok(customerPortalAppointmentsApi.includes('client?.email?.trim().toLowerCase() === session.email'));
assert.ok(customerPortalAppointmentsApi.includes(".eq('id', appointmentId)"));
console.log('[APPOINTMENT_TENANT_ISOLATION_QA] Staff routes enforce active-tenant scoping; customer portal access requires matching verified email ownership.');

// Keep the selected service, duration and price visible while availability is checked.

// Keep the selected service, duration and price visible while availability is checked.
const bookingDrawerAvailabilityContext = read(
  'app/barbershops/components/booking-drawer-canonical.tsx',
);
assert.ok(bookingDrawerAvailabilityContext.includes('new Intl.NumberFormat'));
assert.ok(bookingDrawerAvailabilityContext.includes('service.durationMinutes'));
assert.ok(bookingDrawerAvailabilityContext.includes('service.price'));
assert.ok(bookingDrawerAvailabilityContext.includes('aria-live="polite"'));
assert.ok(bookingDrawerAvailabilityContext.includes('Checking times for this service'));

// Public booking completion must show the API-confirmed state before dismissing the drawer.
const publicBookingDrawer = read(
  'app/barbershops/components/booking-drawer-canonical.tsx',
);
const publicBookingApi = read('app/api/bookings/route.ts');
const publicBookingSubmitStart = publicBookingDrawer.indexOf('async function submit()');
const publicBookingSubmitEnd = publicBookingDrawer.indexOf('if (!shop) return null;', publicBookingSubmitStart);
assert.ok(publicBookingSubmitStart >= 0 && publicBookingSubmitEnd > publicBookingSubmitStart);
const publicBookingSubmit = publicBookingDrawer.slice(
  publicBookingSubmitStart,
  publicBookingSubmitEnd,
);
assert.ok(publicBookingSubmit.includes('setBookingReceipt({'));
assert.ok(publicBookingSubmit.includes("bookingData?.status === 'scheduled' ? 'scheduled' : 'pending'"));
assert.ok(!publicBookingSubmit.includes('onSuccess?.('), 'The drawer must not close before the receipt is shown.');
assert.ok(publicBookingApi.includes('status: appointment.status,'));
assert.ok(publicBookingDrawer.includes('Request received — awaiting confirmation'));
assert.ok(publicBookingDrawer.includes('Pedido recebido — aguarda confirmação'));
assert.ok(publicBookingDrawer.includes('Booking request received. Waiting for the barbershop to confirm.'));
assert.ok(publicBookingDrawer.includes('Pedido de marcação recebido. Aguarda a confirmação da barbearia.'));
assert.ok(publicBookingDrawer.includes('A marcação ainda não está confirmada.'));
assert.ok(publicBookingDrawer.includes('bookingReceipt?.id'));
assert.ok(publicBookingDrawer.includes('Booking reference'));
assert.ok(publicBookingDrawer.includes('Referência da marcação'));
assert.ok(publicBookingDrawer.includes('/my-bookings?email='));
assert.ok(publicBookingDrawer.includes('service?.durationMinutes'));
assert.ok(publicBookingDrawer.includes('service?.price'));
assert.match(
  publicBookingDrawer,
  /onClick=\{\(\) => \{\s*if \(!waitlistOnly\) \{\s*onSuccess\?\.\(/,
);
console.log('[PUBLIC_BOOKING_RECEIPT_QA] Server-driven confirmation, receipt summary and customer-area handoff passed.');

const onboardingPage = read('app/onboarding/page.tsx');
const onboardingCreateApi = read('app/api/onboarding/create/route.ts');
const onboardingDraftApi = read('app/api/onboarding/draft/route.ts');
const onboardingDraftMigration = read('supabase/migrations/20261119214223_onboarding_save_and_resume_draft.sql');
const onboardingPersistenceMigration = read('supabase/migrations/20261118200006_onboarding_persist_initial_service_professional.sql');
const onboardingWeeklyScheduleMigration = read('supabase/migrations/20261119212133_onboarding_persist_weekly_schedule.sql');

assert.ok(onboardingPage.includes('firstServiceName'));
assert.ok(onboardingPage.includes('firstServiceDuration'));
assert.ok(onboardingPage.includes('serviceName: firstServiceName.trim()'));
assert.ok(onboardingPage.includes('serviceDuration,'));
assert.ok(onboardingPage.includes("fetch('/api/onboarding/draft'"));
assert.ok(onboardingPage.includes("method: 'PUT'"));
assert.ok(onboardingPage.includes("method: 'DELETE'"));
assert.ok(onboardingPage.includes('draftWasRestored'));
assert.ok(onboardingPage.includes('draftSaveQueueRef'));
assert.ok(onboardingPage.includes('draftCompletedRef.current'));
assert.ok(onboardingPage.includes('Rascunho guardado automaticamente'));
assert.ok(onboardingPage.includes('Draft saved automatically'));
assert.ok(onboardingDraftApi.includes("assertSameOrigin(request)"));
assert.ok(onboardingDraftApi.includes("from('onboarding_drafts')"));
assert.ok(onboardingDraftApi.includes("eq('user_id', user.id)"));
assert.ok(onboardingDraftApi.includes('normalizeDraft'));
assert.ok(onboardingDraftApi.includes('readJsonObject'));
assert.ok(onboardingDraftApi.includes('30 * 24 * 60 * 60 * 1000'));
assert.ok(!onboardingDraftApi.includes('createAdminClient'));
assert.ok(onboardingDraftMigration.includes('references auth.users(id) on delete cascade'));
assert.ok(onboardingDraftMigration.includes('enable row level security'));
assert.ok(onboardingDraftMigration.includes('revoke all on table public.onboarding_drafts from public, anon'));
assert.ok(onboardingDraftMigration.includes('to authenticated'));
assert.ok(onboardingDraftMigration.includes('auth.uid()) = user_id'));
assert.ok(onboardingDraftMigration.includes("interval '30 days'"));
assert.ok(onboardingPage.includes('weeklySchedule'));
assert.ok(onboardingPage.includes('WEEKDAY_KEYS.map'));
assert.ok(onboardingPage.includes('updateDayOff'));
assert.ok(onboardingPage.includes('updateWorkingTime'));
assert.ok(onboardingPage.includes('validateWeeklySchedule'));
assert.ok(onboardingCreateApi.includes('isWeeklySchedule'));
assert.ok(onboardingCreateApi.includes('validateWeeklySchedule'));
assert.ok(onboardingCreateApi.includes('create_barbershop_onboarding_with_weekly_schedule'));
assert.ok(onboardingCreateApi.includes('p_service_name: serviceName'));
assert.ok(onboardingCreateApi.includes('p_service_duration: serviceDuration'));
assert.ok(onboardingCreateApi.includes('p_weekly_schedule: weeklySchedule'));
assert.ok(onboardingCreateApi.includes('weekly_schedule_persisted !== true'));
assert.ok(onboardingWeeklyScheduleMigration.includes('public.is_valid_weekly_schedule(p_weekly_schedule)'));
assert.ok(onboardingWeeklyScheduleMigration.includes('public.create_barbershop_onboarding_with_defaults('));
assert.ok(onboardingWeeklyScheduleMigration.includes('set weekly_schedule = p_weekly_schedule'));
assert.ok(onboardingWeeklyScheduleMigration.includes('revoke all on function public.create_barbershop_onboarding_with_weekly_schedule'));
assert.ok(onboardingWeeklyScheduleMigration.includes('to authenticated'));
assert.ok(onboardingCreateApi.includes("typeof serviceId !== 'string'"));
assert.ok(onboardingPersistenceMigration.includes('public.create_barbershop_onboarding('));
assert.ok(onboardingPersistenceMigration.includes('p_opening_time >= p_closing_time'));
assert.ok(onboardingPersistenceMigration.includes('p_price > 10000'));
assert.ok(onboardingPersistenceMigration.includes('(p_lat is null) <> (p_lng is null)'));
assert.ok(onboardingPersistenceMigration.includes('insert into public.services'));
assert.ok(onboardingPersistenceMigration.includes('insert into public.professionals'));
assert.ok(onboardingPersistenceMigration.includes('user_id,\n    name,'));
assert.ok(onboardingPersistenceMigration.includes('auth.uid(),'));
assert.ok(onboardingPersistenceMigration.includes('popular_service_id = v_service_id'));
assert.ok(onboardingPersistenceMigration.includes("'barbershop_id', v_barbershop_id"));
assert.ok(onboardingPersistenceMigration.includes("'service_id', v_service_id"));
assert.ok(onboardingPersistenceMigration.includes("'professional_id', v_professional_id"));
console.log('[ONBOARDING_PERSISTENCE_QA] Owner, first service, primary professional and public popular service are persisted atomically.');

// Law 13 activation checklist must reflect values saved in the database,
// not the values that happened to be typed into the initial onboarding form.
const onboardingDashboard = read('app/dashboard/page.tsx');
const onboardingConfigService = read(
  'app/dashboard/_services/barbershop.service.ts',
);
const onboardingPublicProfileApi = read(
  'app/api/barbershops/public-profile/route.ts',
);
const onboardingPortuguese = read('app/locales/pt.ts');
const onboardingEnglish = read('app/locales/en.ts');
const onboardingTeamPage = read('app/dashboard/equipa/page.tsx');
const onboardingInviteCard = read('app/dashboard/_components/team/InviteCodeCard.tsx');
const onboardingInviteApi = read('app/api/team/invite/route.ts');
const onboardingPublicPageApi = read('app/api/public/barbershops/[slug]/route.ts');

assert.ok(onboardingDashboard.includes('getBarbershopConfig(currentBarbershopId)'));
assert.ok(onboardingDashboard.includes("fetch('/api/barbershops/public-profile'"));
assert.ok(onboardingDashboard.includes('function hasConfiguredWorkingHours'));
assert.ok(onboardingDashboard.includes('config.weekly_schedule'));
assert.ok(onboardingDashboard.includes('config.opening_time'));
assert.ok(onboardingDashboard.includes('setupBarbershopConfig?.name.trim()'));
assert.ok(onboardingDashboard.includes('setupBarbershopConfig.address?.trim()'));
assert.ok(onboardingDashboard.includes('setupPublicProfile?.city?.trim()'));
assert.ok(onboardingDashboard.includes('setupPublicProfile?.slug'));
assert.ok(onboardingDashboard.includes('setupPublicProfile.public_profile_enabled === true'));
assert.ok(onboardingDashboard.includes('services.some((service) => service.is_active !== false)'));
assert.ok(onboardingDashboard.includes('professionals.some((professional) => professional.active !== false)'));
assert.ok(onboardingDashboard.includes("appointment.status !== 'cancelled'"));
assert.ok(onboardingDashboard.includes('!loadingSetupData && nextSetupStep'));
assert.ok(onboardingConfigService.includes('weekly_schedule'));
assert.ok(onboardingConfigService.includes('opening_time, closing_time'));
assert.ok(onboardingPublicProfileApi.includes("'id, slug, custom_slug, city, price, tags, public_profile_enabled"));
for (const key of ['setupBusinessProfile', 'setupWorkingHours', 'setupPublicPage']) {
  assert.ok(onboardingPortuguese.includes(`${key}:`), `Missing pt-PT ${key}`);
  assert.ok(onboardingEnglish.includes(`${key}:`), `Missing en-GB ${key}`);
}
console.log('[LAW13_ONBOARDING_PROGRESS_QA] Profile, working hours, public page, services, team and first booking are derived from saved records.');

assert.ok(onboardingPage.includes("'/dashboard/equipa?tab=invite'"));
assert.ok(onboardingTeamPage.includes("new URLSearchParams(window.location.search).get('tab')"));
assert.ok(onboardingTeamPage.includes("url.searchParams.set('tab', nextTab)"));
assert.ok(onboardingTeamPage.includes('window.history.replaceState'));
assert.ok(onboardingTeamPage.includes('onValueChange={selectTab}'));
assert.ok(onboardingInviteCard.includes("fetch('/api/team/invite'"));
assert.ok(onboardingInviteCard.includes('Active invitations are restored from the server after refresh'));
assert.ok(onboardingInviteCard.includes('Os convites ativos são recuperados do servidor'));
assert.ok(!onboardingInviteCard.includes('localStorage'));
assert.ok(onboardingInviteApi.includes(".from('barbershop_invite_codes')"));
assert.ok(onboardingInviteApi.includes(".is('used_at', null)"));
assert.ok(onboardingInviteApi.includes(".is('revoked_at', null)"));
assert.ok(onboardingInviteApi.includes(".gt('expires_at', new Date().toISOString())"));
assert.ok(onboardingDashboard.includes('/api/public/barbershops/'));
assert.ok(onboardingDashboard.includes('publicPageReachable'));
assert.ok(onboardingDashboard.includes('setupPublicProfile.publicPageReachable'));
assert.ok(onboardingDashboard.includes('setupPublicProfile.public_profile_enabled === true'));
assert.ok(onboardingPublicProfileApi.includes("from('shops')"));
assert.ok(onboardingPublicProfileApi.includes('.update(updates)'));
assert.ok(onboardingPublicProfileApi.includes('public_profile_updated_at'));
assert.ok(onboardingPublicPageApi.includes('getPublicProfileBySlug(slug)'));
assert.ok(onboardingPublicPageApi.includes("status: 404"));
console.log('[LAW13_ONBOARDING_RESUME_QA] Team invite tab survives refresh; active invites restore from server; public page activation requires a persisted and reachable public profile.');

const notificationRetryMigration = read(
  'supabase/migrations/20261118203046_atomic_appointment_notification_retry_claims.sql',
);
assert.ok(notificationRetryMigration.includes('public.claim_appointment_notification_retry'));
assert.ok(notificationRetryMigration.includes('public.complete_appointment_notification_retry'));
assert.ok(notificationRetryMigration.includes('security invoker'));
assert.ok(notificationRetryMigration.includes("from public, anon, authenticated"));
assert.ok(notificationRetryMigration.includes('to service_role'));
assert.ok(notificationRetryMigration.includes('notificationRetryLeaseUntil'));
assert.ok(notificationRetryMigration.includes('notificationRetryToken'));

const barberNotificationRetryMigration = read(
  'supabase/migrations/20261120170000_retry_failed_barber_notifications.sql',
);
assert.ok(barberNotificationRetryMigration.includes('public.claim_appointment_barber_notification_retry'));
assert.ok(barberNotificationRetryMigration.includes('public.complete_appointment_barber_notification_retry'));
assert.ok(barberNotificationRetryMigration.includes("event.actor_type = 'customer'"));
assert.ok(barberNotificationRetryMigration.includes("event.metadata ->> 'barberPushStatus' = 'failed'"));
assert.ok(barberNotificationRetryMigration.includes("interval '10 minutes'"));
assert.ok(barberNotificationRetryMigration.includes('Partial delivery is deliberately not retried'));
assert.ok(barberNotificationRetryMigration.includes('to service_role'));
assert.ok(barberNotificationRetryMigration.includes('Rollback: drop complete_appointment_barber_notification_retry'));
assert.ok(appointmentNotificationRetryApi.includes("audience === 'barbershop'"));
assert.ok(appointmentNotificationRetryApi.includes("'claim_appointment_barber_notification_retry'"));
assert.ok(appointmentNotificationRetryApi.includes("'complete_appointment_barber_notification_retry'"));
assert.ok(appointmentNotificationRetryApi.includes('channels: { email: false, push: true }'));
assert.ok(barberNotificationHelper.includes('channels?: { email?: boolean; push?: boolean }'));
assert.ok(barberNotificationHelper.includes('input.channels?.push === false'));
assert.ok(appointmentActivityApi.includes('barberNotificationRetryLeaseUntil'));
assert.ok(appointmentDetailDialog.includes('barberNotificationRetryInProgress'));
assert.ok(appointmentDetailDialog.includes('Repetir notificação push'));
assert.ok(appointmentDetailDialog.includes('Retry push notification'));
console.log('[BARBER_NOTIFICATION_RETRY_QA] Fully failed push deliveries can be retried under an atomic lease; partial delivery is never replayed.');

const barberNotificationHelper = read('lib/brevo/appointment-change-notifications.ts');
const customerPortalAppointmentApi = read(
  'app/api/customer-portal/appointments/[appointmentId]/route.ts',
);
assert.ok(barberNotificationHelper.includes('emailsAttempted: number'));
assert.ok(barberNotificationHelper.includes('emailsFailed: number'));
assert.ok(barberNotificationHelper.includes('pushTargets: number'));
assert.ok(barberNotificationHelper.includes('pushFailed: number'));
assert.ok(barberNotificationHelper.includes('emailsFailed: emailResults.filter((success) => !success).length'));
assert.ok(barberNotificationHelper.includes('pushFailed: push.failed'));
assert.ok(customerPortalAppointmentApi.includes('barberEmailsFailed: barberNotification.emailsFailed'));
assert.ok(customerPortalAppointmentApi.includes('barberPushFailed: barberNotification.pushFailed'));
assert.ok(customerPortalAppointmentApi.includes(".eq('date_hour', appointment.date_hour)"));
assert.ok(customerPortalAppointmentApi.includes('A marcação já está neste horário.'));
assert.ok(appointmentActivityApi.includes('barberEmailStatus'));
assert.ok(appointmentActivityApi.includes('barberPushStatus'));
assert.ok(appointmentDetailDialog.includes('barberEmailsFailed'));
assert.ok(appointmentDetailDialog.includes('barberPushFailed'));
assert.ok(appointmentDetailDialog.includes('Email:'));
assert.ok(appointmentDetailDialog.includes('Push:'));
console.log('[APPOINTMENT_NOTIFICATION_RETRY_QA] Atomic tenant-scoped claim, lease ownership and provider result persistence are enforced.');


console.log(
  'Custom websites, public API, birthday automation, booking outbox, admin reports, booking lifecycle, dashboard dialogs, visible chart and billing regression contracts passed.',
);
