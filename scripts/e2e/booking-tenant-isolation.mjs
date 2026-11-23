import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const runId = randomUUID().replaceAll('-', '').slice(0, 12);
const createdAuthUsers = [];
const createdBarbershopIds = new Set();
const browserContexts = [];
const passed = [];

function assertLoopbackUrl(value, label) {
  const parsed = new URL(value);
  assert.ok(
    ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname),
    label + ' must be loopback-only; refusing to run against a remote environment.',
  );
  return parsed;
}

assertLoopbackUrl(baseUrl, 'E2E_BASE_URL');
assertLoopbackUrl(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL');
assert.ok(anonKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required.');
assert.ok(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required.');
assert.ok(serviceRoleKey !== anonKey, 'The service-role key must differ from the public anon key.');

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function report(label) {
  passed.push(label);
  console.log('PASS ' + label);
}

async function api(page, method, path, body) {
  return page.evaluate(async (input) => {
    const response = await fetch(input.path, {
      method: input.method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: input.body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 400) };
    }
    return { status: response.status, data };
  }, { method, path, body });
}

function assertStatus(response, expected, label) {
  assert.equal(
    response.status,
    expected,
    label + ': expected HTTP ' + expected + ', received ' + response.status + '.',
  );
  assert.ok(response.data && typeof response.data === 'object', label + ': expected JSON response.');
  return response.data;
}

async function createIdentity(role, label) {
  const email = label + '-' + runId + '@e2e.invalid';
  const password = 'E2E-' + randomUUID() + '-Aa9!';
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name_complete: 'E2E ' + label + ' ' + runId },
  });
  assert.ifError(error);
  assert.ok(data.user && data.user.id, 'Could not create synthetic ' + label + ' Auth user.');
  createdAuthUsers.push(data.user.id);

  const { error: profileError } = await admin.from('users').upsert({
    id: data.user.id,
    name_complete: 'E2E ' + label + ' ' + runId,
    email,
    role,
    barbershop_id: null,
  }, { onConflict: 'id' });
  assert.ifError(profileError);
  return { id: data.user.id, email, password };
}

async function newPage(browser) {
  const context = await browser.newContext({
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
    viewport: { width: 1440, height: 960 },
  });
  browserContexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', (error) => {
    console.error('E2E_PAGE_ERROR ' + error.message);
  });
  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    if (url.origin === baseUrl && url.pathname.startsWith('/api/auth/')) {
      console.error(
        'E2E_AUTH_REQUEST_FAILED ' +
          request.method() +
          ' ' +
          url.pathname +
          ' ' +
          (request.failure()?.errorText || 'unknown'),
      );
    }
  });
  return page;
}

async function login(page, identity, redirectPath) {
  const query = redirectPath ? '?redirect=' + encodeURIComponent(redirectPath) : '';
  await page.goto(baseUrl + '/login' + query, { waitUntil: 'domcontentloaded' });
  await page.locator('form[data-testid="login-form"][data-login-ready="true"]').waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('#login-email').fill(identity.email);
  await page.locator('#login-password').fill(identity.password);
  const isLoginRequest = (request) =>
    new URL(request.url()).pathname === '/api/auth/login' &&
    request.method() === 'POST';
  const loginRequestPromise = page.waitForRequest(isLoginRequest, { timeout: 15_000 });
  const loginResponsePromise = page.waitForResponse(
    (response) => isLoginRequest(response.request()),
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: 'Iniciar sessão' }).click();
  await loginRequestPromise;

  const loginResponse = await loginResponsePromise;
  let loginResult = null;
  try {
    loginResult = await loginResponse.json();
  } catch {
    loginResult = null;
  }
  assert.equal(
    loginResponse.status(),
    200,
    'Authentication API rejected synthetic account ' +
      identity.email +
      ' (HTTP ' +
      loginResponse.status() +
      ', code=' +
      (loginResult && loginResult.code ? loginResult.code : 'unknown') +
      ').',
  );
  assert.equal(loginResult && loginResult.success, true, 'Authentication API did not confirm a successful login.');

  // Next.js App Router transitions are same-document navigations. Poll the
  // pathname instead of waiting for a full document load event.
  await page.waitForFunction(
    () => window.location.pathname === '/onboarding' || window.location.pathname === '/dashboard',
    undefined,
    { timeout: 30_000 },
  );
}

function createWeeklySchedule() {
  const keys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return Object.fromEntries(keys.map((key) => [
    key,
    key === 'sunday'
      ? { day_off: true, work_intervals: [], break_intervals: [] }
      : {
          day_off: false,
          work_intervals: [{ start: '09:00', end: '19:00' }],
          break_intervals: [{ start: '13:00', end: '14:00' }],
        },
  ]));
}

async function createBarbershop(page, owner, suffix) {
  const created = await api(page, 'POST', '/api/onboarding/create', {
    name: 'E2E ' + suffix + ' ' + runId,
    address: 'Rua de Teste ' + suffix,
    city: 'Porto',
    price: 25,
    serviceName: 'Corte E2E ' + suffix,
    serviceDuration: 30,
    tags: ['e2e'],
    weeklySchedule: createWeeklySchedule(),
  });
  const result = assertStatus(created, 200, 'Create barbershop ' + suffix);
  assert.equal(result.success, true);
  assert.equal(result.persisted, true);
  assert.ok(result.barbershopId && result.serviceId && result.professionalId);
  createdBarbershopIds.add(result.barbershopId);

  const assignment = await admin.rpc('set_barbershop_plan_assignment', {
    p_barbershop_id: result.barbershopId,
    p_plan: 'pro',
    p_reason: 'Isolated automated E2E fixture',
    p_assigned_by: owner.id,
    p_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  assert.ifError(assignment.error);

  const { data: shop, error: shopError } = await admin
    .from('shops')
    .select('id,slug,is_active')
    .eq('barbershop_id', result.barbershopId)
    .maybeSingle();
  assert.ifError(shopError);
  assert.ok(shop && shop.id && shop.slug && shop.is_active, 'Public profile for ' + suffix + ' was not persisted.');

  const { data: service, error: serviceError } = await admin
    .from('services')
    .select('id,name,duration,price,is_active')
    .eq('id', result.serviceId)
    .eq('barbershop_id', result.barbershopId)
    .maybeSingle();
  assert.ifError(serviceError);
  assert.ok(service && service.id && service.is_active);

  if (suffix === 'A') {
    const { error: settingsError } = await admin
      .from('barbershops')
      .update({
        phone: '351912345678',
        mbway_enabled: true,
        mbway_phone: '351912345678',
      })
      .eq('id', result.barbershopId);
    assert.ifError(settingsError);
  }

  return {
    id: result.barbershopId,
    shopId: shop.id,
    slug: shop.slug,
    serviceId: service.id,
    professionalId: result.professionalId,
  };
}

async function joinWithInvite(browser, identity, inviteValue, label) {
  const page = await newPage(browser);
  const redirectPath = '/onboarding?invite=' + encodeURIComponent(inviteValue);
  await login(page, identity, redirectPath);
  const current = new URL(page.url());
  assert.equal(current.pathname, '/onboarding', label + ' did not return to onboarding after login.');
  assert.equal(current.searchParams.get('invite'), inviteValue, label + ' invite was not preserved through authentication.');
  await page.waitForFunction(
    () => Boolean(document.querySelector('#invite-code') && document.querySelector('#invite-code').value),
    undefined,
    { timeout: 10_000 },
  );
  const visibleValue = await page.locator('#invite-code').inputValue();
  assert.ok(visibleValue.startsWith('SIL-'), label + ' invite link/QR token was not prefilled.');
  await page.getByRole('button', { name: 'Continuar com convite' }).click();
  await page.waitForFunction(
    () => window.location.pathname === '/dashboard',
    undefined,
    { timeout: 30_000 },
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.location.pathname === '/dashboard',
    undefined,
    { timeout: 30_000 },
  );
  return page;
}

function nextWorkingDate() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + 5);
  while (date.getDay() === 0) date.setDate(date.getDate() + 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

async function createPublicBooking(page, shop, date, slot, label, prepayment) {
  const response = await api(page, 'POST', '/api/bookings', {
    shopId: shop.shopId,
    service: shop.serviceId,
    date,
    slot,
    professionalId: shop.professionalId,
    customerName: 'Cliente E2E ' + label,
    customerPhone: '912345678',
    customerEmail: 'customer-' + label + '-' + runId + '@e2e.invalid',
    customerBirthDate: '1990-02-03',
    ...(prepayment ? { prepayment: true } : {}),
  });
  const result = assertStatus(response, 201, 'Public booking ' + label);
  assert.equal(result.success, true);
  assert.ok(result.booking && result.booking.id, 'Public booking did not return an appointment id.');
  return result;
}

async function assertTenantCannotAccess(page, appointmentId, label) {
  const activity = await api(page, 'GET', '/api/appointments/' + appointmentId + '/activity');
  assertStatus(activity, 404, label + ' activity isolation');

  const reschedule = await api(page, 'PATCH', '/api/appointments/' + appointmentId + '/reschedule', {
    date: nextWorkingDate(),
    time: '12:00',
  });
  assert.ok(
    [404, 409].includes(reschedule.status),
    label + ' reschedule must not expose another tenant appointment.',
  );

  const confirm = await api(page, 'POST', '/api/appointments/' + appointmentId + '/confirm');
  assert.equal(confirm.status, 404, label + ' confirmation isolation');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  let ownerA;
  let ownerB;
  let staffLink;
  let staffQr;
  let pageA;
  let pageB;
  let pageStaffLink;

  try {
    ownerA = await createIdentity('owner', 'owner-a');
    ownerB = await createIdentity('owner', 'owner-b');
    staffLink = await createIdentity('barber', 'staff-link');
    staffQr = await createIdentity('barber', 'staff-qr');

    pageA = await newPage(browser);
    pageB = await newPage(browser);
    await login(pageA, ownerA);
    await login(pageB, ownerB);
    const shopA = await createBarbershop(pageA, ownerA, 'A');
    const shopB = await createBarbershop(pageB, ownerB, 'B');
    report('Two isolated owners completed persisted onboarding.');

    const linkResponse = await api(pageA, 'POST', '/api/team/invite', {
      method: 'link',
      expiresInHours: 24,
    });
    const linkInvite = assertStatus(linkResponse, 200, 'Create link invite');
    assert.ok(/^SIL-[0-9A-F]{32}$/.test(linkInvite.inviteValue || ''));

    const qrResponse = await api(pageA, 'POST', '/api/team/invite', {
      method: 'qr',
      expiresInHours: 24,
    });
    const qrInvite = assertStatus(qrResponse, 200, 'Create QR invite');
    assert.ok(/^SIL-[0-9A-F]{32}$/.test(qrInvite.inviteValue || ''));

    pageStaffLink = await joinWithInvite(browser, staffLink, linkInvite.inviteValue, 'Link');
    await joinWithInvite(browser, staffQr, qrInvite.inviteValue, 'QR');

    for (const identity of [staffLink, staffQr]) {
      const { data: membership, error } = await admin
        .from('users')
        .select('barbershop_id,role')
        .eq('id', identity.id)
        .maybeSingle();
      assert.ifError(error);
      assert.equal(membership && membership.barbershop_id, shopA.id);
      assert.equal(membership && membership.role, 'barber');
    }

    const inviteList = await api(pageA, 'GET', '/api/team/invite');
    const listed = assertStatus(inviteList, 200, 'List active invites');
    assert.equal((listed.invites || []).length, 0, 'Used link and QR invites should no longer be listed as active.');
    report('Synthetic staff accepted link and QR invitations; membership survived refresh.');

    const publicPageResponse = await pageA.goto(baseUrl + '/barbershops/' + encodeURIComponent(shopA.slug), {
      waitUntil: 'domcontentloaded',
    });
    assert.equal(publicPageResponse && publicPageResponse.status(), 200, 'The public barbershop page must render.');
    await pageA.setViewportSize({ width: 390, height: 844 });
    const dimensions = await pageA.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    assert.ok(
      dimensions.document <= dimensions.viewport + 1,
      'Public barbershop page overflows at 390px (' + dimensions.document + 'px > ' + dimensions.viewport + 'px).',
    );
    report('Persisted public page renders without horizontal overflow at 390px.');

    const date = nextWorkingDate();
    const bookingA = await createPublicBooking(pageA, shopA, date, '10:00', 'a-main', false);
    const bookingB = await createPublicBooking(pageB, shopB, date, '10:00', 'b-main', false);
    const appointmentA = bookingA.booking.id;
    const appointmentB = bookingB.booking.id;

    await assertTenantCannotAccess(pageB, appointmentA, 'Tenant B');
    await assertTenantCannotAccess(pageA, appointmentB, 'Tenant A');
    const { data: unchangedA, error: unchangedError } = await admin
      .from('appointments')
      .select('status,date_hour,barbershop_id')
      .eq('id', appointmentA)
      .maybeSingle();
    assert.ifError(unchangedError);
    assert.equal(unchangedA && unchangedA.barbershop_id, shopA.id);
    assert.equal(unchangedA && unchangedA.date_hour.slice(11, 16), '10:00');
    report('Booking records are isolated in both directions across two tenants.');

    const rescheduled = await api(pageA, 'PATCH', '/api/appointments/' + appointmentA + '/reschedule', {
      date,
      time: '11:00',
    });
    const rescheduleResult = assertStatus(rescheduled, 200, 'Owner reschedules pending booking');
    assert.equal(rescheduleResult.success, true);

    const confirmed = await api(pageA, 'POST', '/api/appointments/' + appointmentA + '/confirm');
    const confirmedResult = assertStatus(confirmed, 200, 'Owner confirms booking');
    assert.equal(confirmedResult.success, true);

    const completed = await api(pageA, 'POST', '/api/appointments/' + appointmentA + '/complete', {
      paymentMethod: 'cash',
      descriptionProducts: '',
      valueProducts: 0,
    });
    const completedResult = assertStatus(completed, 200, 'Owner completes appointment');
    assert.equal(completedResult.success, true);

    const { data: finalAppointment, error: finalError } = await admin
      .from('appointments')
      .select('status,date_hour')
      .eq('id', appointmentA)
      .maybeSingle();
    assert.ifError(finalError);
    assert.equal(finalAppointment && finalAppointment.status, 'completed');
    assert.equal(finalAppointment && finalAppointment.date_hour.slice(11, 16), '11:00');

    const activityA = await api(pageStaffLink, 'GET', '/api/appointments/' + appointmentA + '/activity');
    const activityResult = assertStatus(activityA, 200, 'Staff reads own tenant activity');
    assert.ok(Array.isArray(activityResult.events));
    report('Pending booking → reschedule → confirmation → completion passed for owner and staff.');

    const cancellable = await createPublicBooking(pageA, shopA, date, '14:00', 'a-cancel', false);
    const cancelled = await api(pageA, 'DELETE', '/api/appointments/' + cancellable.booking.id + '/cancel');
    const cancelledResult = assertStatus(cancelled, 200, 'Owner cancels another booking');
    assert.equal(cancelledResult.success, true);
    const { data: cancelledRow, error: cancelledError } = await admin
      .from('appointments')
      .select('status')
      .eq('id', cancellable.booking.id)
      .maybeSingle();
    assert.ifError(cancelledError);
    assert.equal(cancelledRow && cancelledRow.status, 'cancelled');
    report('Individual cancellation is persisted and verified.');

    const prepayment = await createPublicBooking(pageA, shopA, date, '16:00', 'a-mbway', true);
    assert.equal(prepayment.payment && prepayment.payment.method, 'mbway');
    assert.ok(Number(prepayment.payment && prepayment.payment.amount) > 0);
    const { data: heldRow, error: heldError } = await admin
      .from('appointments')
      .select('status,payment_status,payment_expires_at')
      .eq('id', prepayment.booking.id)
      .maybeSingle();
    assert.ifError(heldError);
    assert.equal(heldRow && heldRow.status, 'pending');
    assert.equal(heldRow && heldRow.payment_status, 'awaiting_review');
    assert.ok(heldRow && heldRow.payment_expires_at);
    report('MB WAY prepayment creates a pending review hold with expiry.');

    console.log('E2E_RESULT ' + JSON.stringify({ runId, passed }));
  } finally {
    await Promise.allSettled(browserContexts.map((context) => context.close()));
    await browser.close().catch(() => undefined);

    const userIds = [...createdAuthUsers];
    if (userIds.length) {
      const { data: profiles } = await admin
        .from('users')
        .select('barbershop_id')
        .in('id', userIds);
      for (const profile of profiles || []) {
        if (profile.barbershop_id) createdBarbershopIds.add(profile.barbershop_id);
      }
    }

    for (const barbershopId of createdBarbershopIds) {
      const { error } = await admin.from('barbershops').delete().eq('id', barbershopId);
      if (error) console.error('E2E cleanup failed for synthetic barbershop (' + (error.code || 'unknown') + ').');
    }
    for (const userId of userIds) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) console.error('E2E cleanup failed for synthetic Auth user (' + (error.message || 'unknown') + ').');
    }
  }
}

await main();
