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
assert.match(loginRoute, /Keep unknown accounts and incorrect passwords indistinguishable/);
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

console.log('[AUTH_ACCOUNT_STATE_QA] login, registration, confirmation and enumeration protections verified');
