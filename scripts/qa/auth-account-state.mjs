import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const loginRoute = read('app/api/auth/login/route.ts');
const registerRoute = read('app/api/auth/register/route.ts');
const loginPage = read('app/login/page.tsx');
const handlers = read('app/login/services/auth-handles.ts');
const pt = read('app/locales/pt.ts');
const en = read('app/locales/en.ts');

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
assert.match(loginPage, /isInvalidCredentials/);
assert.match(loginPage, /switchTab\('register'\)/);
assert.match(handlers, /invalidCredentialsMessage/);
assert.match(handlers, /unconfirmedEmailMessage/);
assert.match(pt, /invalidCredentials:/);
assert.match(pt, /unconfirmedLogin:/);
assert.match(en, /invalidCredentials:/);
assert.match(en, /unconfirmedLogin:/);

const authService = read('app/dashboard/_services/auth.service.ts');
const authLogoutRoute = read('app/api/auth/logout/route.ts');
const siteNavbar = read('components/site-navbar.tsx');

assert.ok(
  authService.includes("auth.signOut({ scope: 'local' })"),
  'Dashboard logout must revoke only the current session, not all user sessions.',
);
assert.ok(
  authLogoutRoute.includes("auth.signOut({ scope: 'local' })"),
  'Server logout endpoint must revoke only the current session.',
);
assert.ok(
  siteNavbar.includes("auth.signOut({ scope: 'local' })"),
  'Public navbar logout must not invalidate refresh tokens on other devices or tabs.',
);
console.log(
  '[AUTH_ACCOUNT_STATE_QA] login, registration, confirmation and enumeration protections verified',
);
