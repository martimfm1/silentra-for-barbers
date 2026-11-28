import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const loginRoute = read('app/api/auth/login/route.ts');
const registerRoute = read('app/api/auth/register/route.ts');
const loginPage = read('app/login/page.tsx');
const handlers = read('app/login/services/auth-handles.ts');
const pt = read('app/locales/pt.ts');
const en = read('app/locales/en.ts');
const otpRequest = read('app/api/customer-portal/request-code/route.ts');
const otpVerify = read('app/api/customer-portal/verify-code/route.ts');
const portalSecurity = read('lib/customer-booking-portal.ts');
const passwordPolicy = read('lib/security/password-policy.ts');
const resetPassword = read('app/api/auth/reset-password/route.ts');
const supabaseConfig = read('supabase/config.toml');
const otpMigration = read('supabase/migrations/20261128150000_harden_customer_portal_otp_attempts.sql');
const supabaseProxy = read('lib/supabase/proxy.ts');
const tenantGuard = read('lib/security/tenant-guard.ts');

assert.match(loginRoute, /EMAIL_NOT_CONFIRMED/);
assert.match(loginRoute, /INVALID_CREDENTIALS/);
assert.match(loginRoute, /barbershopId: profile\.barbershop_id/);
assert.match(
  loginRoute,
  /Keep unknown accounts and incorrect passwords indistinguishable/,
);
assert.match(registerRoute, /auth\.signUp\(/);
assert.match(registerRoute, /REGISTRATION_NEXT_STEPS/);
assert.match(registerRoute, /Do not reveal whether an account already exists/);
assert.match(registerRoute, /isStrongPassword\(password\)/);
assert.match(resetPassword, /isStrongPassword\(password\)/);
assert.match(passwordPolicy, /\?=.*\[a-z\]/);
assert.match(passwordPolicy, /\?=.*\[A-Z\]/);
assert.match(passwordPolicy, /\?=.*\\d/);
assert.match(passwordPolicy, /\?=.*\[\^A-Za-z0-9\\s\]/);
assert.match(supabaseConfig, /minimum_password_length = 12/);
assert.match(supabaseConfig, /password_requirements = "lower_upper_letters_digits_symbols"/);
assert.match(loginPage, /isInvalidCredentials/);
assert.match(loginRoute, /consumePublicRateLimit/);
assert.match(loginRoute, /LOGIN_EMAIL_LIMIT = 5/);
assert.match(loginRoute, /LOGIN_IP_LIMIT = 30/);
assert.match(loginPage, /switchTab\('register'\)/);
assert.match(handlers, /invalidCredentialsMessage/);
assert.match(handlers, /unconfirmedEmailMessage/);
assert.match(pt, /invalidCredentials:/);
assert.match(pt, /unconfirmedLogin:/);
assert.match(en, /invalidCredentials:/);
assert.match(en, /unconfirmedLogin:/);
assert.match(portalSecurity, /randomInt\(100000, 1000000\)/);
assert.match(portalSecurity, /CODE_TTL_MS = 10 \* 60 \* 1000/);
assert.match(portalSecurity, /httpOnly: true/);
assert.match(portalSecurity, /sameSite: 'lax'/);
assert.match(otpRequest, /customer-portal-request-email/);
assert.match(otpRequest, /customer-portal-request-ip/);
assert.match(otpRequest, /customer-portal-request-cooldown/);
assert.match(otpVerify, /VERIFY_EMAIL_LIMIT = 5/);
assert.match(otpVerify, /VERIFY_IP_LIMIT = 30/);
assert.match(otpVerify, /Código inválido ou expirado/);
assert.match(otpMigration, /attempts <= 3/);
assert.match(otpMigration, /for update/);
assert.match(otpMigration, /consumed_at = now\(\)/);
assert.match(supabaseProxy, /profile\?\.role === 'client'/);
assert.match(tenantGuard, /profile\.role === 'client'/);

const authService = read('app/dashboard/_services/auth.service.ts');
const authLogoutRoute = read('app/api/auth/logout/route.ts');
const siteNavbar = read('components/site-navbar.tsx');

assert.match(
  authService,
  /auth\.signOut\(\{ scope: 'local' \}\)/,
  'Dashboard logout must revoke only the current session, not all user sessions.',
);
assert.match(
  authLogoutRoute,
  /auth\.signOut\(\{ scope: 'local' \}\)/,
  'Server logout endpoint must revoke only the current session.',
);
assert.match(
  siteNavbar,
  /auth\.signOut\(\{ scope: 'local' \}\)/,
  'Public navbar logout must not invalidate refresh tokens on other devices or tabs.',
);
console.log(
  '[AUTH_ACCOUNT_STATE_QA] login, registration, confirmation and enumeration protections verified',
);
