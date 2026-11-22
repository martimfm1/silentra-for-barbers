import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

const [dialogHook, loyaltyStore, customerBookings, marketingWorkspace, cookieManager, siteNavbar, dashboardSidebar] =
  await Promise.all([
    read('hooks/useAccessibleDialog.ts'),
    read('app/barbershops/[slug]/loyalty/loyalty-store.tsx'),
    read('components/customer-portal/my-bookings-page.tsx'),
    read('app/dashboard/marketing/marketing-workspace.tsx'),
    read('components/privacy/cookie-consent-manager.tsx'),
    read('components/site-navbar.tsx'),
    read('app/dashboard/_components/DashboardSidebar.tsx'),
  ]);

assert.match(dialogHook, /FOCUSABLE_SELECTOR/);
assert.match(dialogHook, /lockBodyScroll\(\)/);
assert.match(dialogHook, /window\.requestAnimationFrame\(focusInitialElement\)/);
assert.match(dialogHook, /data-dialog-initial-focus/);
assert.match(dialogHook, /event\.key === 'Escape'/);
assert.match(dialogHook, /event\.key !== 'Tab'/);
assert.match(dialogHook, /event\.shiftKey/);
assert.match(dialogHook, /document\.addEventListener\('keydown', handleKeyDown, true\)/);
assert.match(dialogHook, /document\.removeEventListener\('keydown', handleKeyDown, true\)/);
assert.match(dialogHook, /getClientRects\(\)\.length > 0/);
assert.match(dialogHook, /aria-hidden/);
assert.match(dialogHook, /previouslyFocused\?\.isConnected/);
assert.match(dialogHook, /restoreFocusRef\?\.current/);
assert.match(dialogHook, /unlockBodyScroll\(\)/);

assert.equal(
  (loyaltyStore.match(/useAccessibleDialog\(/g) ?? []).length,
  2,
  'Both voucher display and reward confirmation dialogs must use the shared behaviour.',
);
assert.match(loyaltyStore, /ref=\{activeRedemptionDialogRef\}[\s\S]*?tabIndex=\{-1\}[\s\S]*?role="dialog"[\s\S]*?aria-labelledby="loyalty-active-voucher-title"/);
assert.match(loyaltyStore, /ref=\{selectedRewardDialogRef\}[\s\S]*?tabIndex=\{-1\}[\s\S]*?role="dialog"[\s\S]*?aria-labelledby="loyalty-reward-confirmation-title"/);
assert.match(loyaltyStore, /id="loyalty-active-voucher-title"/);
assert.match(loyaltyStore, /id="loyalty-reward-confirmation-title"/);

assert.equal(
  (customerBookings.match(/useAccessibleDialog\(/g) ?? []).length,
  2,
  'Customer appointment details and rescheduling dialogs must use the shared behaviour.',
);
assert.match(customerBookings, /ref=\{detailsDialogRef\}[\s\S]*?role="dialog"[\s\S]*?aria-labelledby="customer-appointment-details"/);
assert.match(customerBookings, /ref=\{rescheduleDialogRef\}[\s\S]*?role="dialog"[\s\S]*?aria-labelledby="customer-reschedule-title"/);
assert.match(customerBookings, /id="customer-reschedule-title"/);
assert.match(customerBookings, /data-dialog-initial-focus/);
assert.match(customerBookings, /restoreFocusRef: bookingsHeadingRef/);
assert.match(customerBookings, /ref=\{bookingsHeadingRef\}[\s\S]*?tabIndex=\{-1\}/);

assert.equal(
  (marketingWorkspace.match(/useAccessibleDialog\(/g) ?? []).length,
  2,
  'Campaign details and delete confirmation dialogs must use the shared behaviour.',
);
assert.match(marketingWorkspace, /ref=\{detailsDialogRef\}[\s\S]*?role="dialog"[\s\S]*?aria-labelledby="campaign-details-title"/);
assert.match(marketingWorkspace, /ref=\{deleteDialogRef\}[\s\S]*?role="dialog"[\s\S]*?aria-labelledby="delete-campaign-title"/);

assert.equal(
  (cookieManager.match(/useAccessibleDialog\(/g) ?? []).length,
  1,
  'Cookie preferences must use the shared behaviour.',
);
assert.match(cookieManager, /ref=\{preferencesDialogRef\}[\s\S]*?role="dialog"[\s\S]*?aria-labelledby="cookie-preferences-title"/);
assert.match(cookieManager, /ref=\{configureButtonRef\}/);
assert.match(cookieManager, /restoreFocusRef: configureButtonRef/);

assert.match(siteNavbar, /keepFocusInside/);
assert.match(siteNavbar, /event\.key === 'Escape'/);
assert.match(dashboardSidebar, /handleDialogKeys/);
assert.match(dashboardSidebar, /event\.key === 'Escape'/);

console.log(
  '[DIALOG_ACCESSIBILITY_QA] Custom modal dialogs provide accessible names, initial focus, Escape close, contained Tab navigation, focus restoration and background scroll lock.',
);
