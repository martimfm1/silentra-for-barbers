import assert from 'node:assert/strict';
import { PLANS } from '@/lib/stripe/constants';
import {
  PLAN_LIMITS,
  PLAN_FEATURES,
  getPlanLimit,
  isUnlimited,
  hasPlanFeature,
  getPlanFeatures,
  getMinimumPlanForFeature,
} from '@/lib/billing/plan-features';
import { getRequiredPlanForResource } from '@/services/billing/quota.service';

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

console.log('Quota + plan foundation tests\n');

test('PLAN_LIMITS matches the product spec', () => {
  assert.equal(PLAN_LIMITS[PLANS.FREE].barbers, 1);
  assert.equal(PLAN_LIMITS[PLANS.FREE].locations, 1);
  assert.equal(PLAN_LIMITS[PLANS.PRO].barbers, 5);
  assert.equal(PLAN_LIMITS[PLANS.PRO].locations, 1);
  assert.equal(PLAN_LIMITS[PLANS.ENTERPRISE].barbers, Infinity);
  assert.equal(PLAN_LIMITS[PLANS.ENTERPRISE].locations, Infinity);
});

test('getPlanLimit returns the right value per plan', () => {
  assert.equal(getPlanLimit(PLANS.FREE, 'barbers'), 1);
  assert.equal(getPlanLimit(PLANS.PRO, 'barbers'), 5);
  assert.equal(getPlanLimit(PLANS.ENTERPRISE, 'barbers'), Infinity);
  assert.equal(getPlanLimit(PLANS.FREE, 'locations'), 1);
  assert.equal(getPlanLimit(PLANS.ENTERPRISE, 'locations'), Infinity);
});

test('isUnlimited only matches Infinity', () => {
  assert.equal(isUnlimited(Infinity), true);
  assert.equal(isUnlimited(1), false);
  assert.equal(isUnlimited(5), false);
});

test('getRequiredPlanForResource resolves the cheapest plan for barbers', () => {
  assert.equal(getRequiredPlanForResource('barbers', 0), PLANS.FREE);
  assert.equal(getRequiredPlanForResource('barbers', 1), PLANS.FREE);
  assert.equal(getRequiredPlanForResource('barbers', 2), PLANS.PRO);
  assert.equal(getRequiredPlanForResource('barbers', 5), PLANS.PRO);
  assert.equal(getRequiredPlanForResource('barbers', 6), PLANS.ENTERPRISE);
  assert.equal(getRequiredPlanForResource('barbers', 100), PLANS.ENTERPRISE);
});

test('getRequiredPlanForResource resolves the cheapest plan for locations', () => {
  assert.equal(getRequiredPlanForResource('locations', 0), PLANS.FREE);
  assert.equal(getRequiredPlanForResource('locations', 1), PLANS.FREE);
  assert.equal(getRequiredPlanForResource('locations', 2), PLANS.ENTERPRISE);
});

test('Free plan does not include Pro/Enterprise features', () => {
  assert.equal(hasPlanFeature(PLANS.FREE, 'agenda'), true);
  assert.equal(hasPlanFeature(PLANS.FREE, 'appointments'), true);
  assert.equal(hasPlanFeature(PLANS.FREE, 'clients'), true);
  assert.equal(hasPlanFeature(PLANS.FREE, 'services'), true);
  assert.equal(hasPlanFeature(PLANS.FREE, 'online_booking'), true);
  assert.equal(hasPlanFeature(PLANS.FREE, 'basic_dashboard'), true);
  assert.equal(hasPlanFeature(PLANS.FREE, 'advanced_crm'), false);
  assert.equal(hasPlanFeature(PLANS.FREE, 'team_management'), false);
  assert.equal(hasPlanFeature(PLANS.FREE, 'commissions'), false);
  assert.equal(hasPlanFeature(PLANS.FREE, 'multi_location'), false);
  assert.equal(hasPlanFeature(PLANS.FREE, 'waitlist'), false);
});

test('getMinimumPlanForFeature resolves the actual required tier', () => {
  assert.equal(getMinimumPlanForFeature('appointments'), null);
  assert.equal(getMinimumPlanForFeature('messaging'), null);
  assert.equal(getMinimumPlanForFeature('team_management'), 'pro');
  assert.equal(getMinimumPlanForFeature('loyalty'), 'pro');
  assert.equal(getMinimumPlanForFeature('advanced_crm'), 'pro');
  assert.equal(getMinimumPlanForFeature('advanced_analytics'), 'pro');
  assert.equal(getMinimumPlanForFeature('pos'), 'enterprise');
  assert.equal(getMinimumPlanForFeature('multi_location'), 'enterprise');
  assert.equal(getMinimumPlanForFeature('enterprise_reports'), 'enterprise');
  assert.equal(getMinimumPlanForFeature('waitlist'), 'enterprise');
  assert.equal(getMinimumPlanForFeature('professionals'), 'pro');
  assert.equal(getMinimumPlanForFeature('analytics'), 'pro');
});

test('Pro inherits all Free features plus its own', () => {
  const free = PLAN_FEATURES[PLANS.FREE];
  const pro = PLAN_FEATURES[PLANS.PRO];
  for (const feature of free) {
    assert.equal(pro.includes(feature), true, `Pro should inherit ${feature}`);
  }
  assert.equal(pro.includes('advanced_crm'), true);
  assert.equal(pro.includes('team_management'), true);
  assert.equal(pro.includes('commissions'), false);
});

test('Enterprise inherits all Pro features plus its own', () => {
  const pro = PLAN_FEATURES[PLANS.PRO];
  const ent = PLAN_FEATURES[PLANS.ENTERPRISE];
  for (const feature of pro) {
    assert.equal(
      ent.includes(feature),
      true,
      `Enterprise should inherit ${feature}`,
    );
  }
  assert.equal(ent.includes('commissions'), true);
  assert.equal(ent.includes('multi_location'), true);
  assert.equal(ent.includes('pos'), true);
  assert.equal(ent.includes('enterprise_reports'), true);
  assert.equal(ent.includes('waitlist'), true);
  assert.equal(hasPlanFeature(PLANS.PRO, 'waitlist'), false);
  assert.equal(hasPlanFeature(PLANS.ENTERPRISE, 'waitlist'), true);
});

test('Legacy keys still resolve on their original plans', () => {
  assert.equal(hasPlanFeature(PLANS.PRO, 'professionals'), true);
  assert.equal(hasPlanFeature(PLANS.PRO, 'analytics'), true);
  assert.equal(hasPlanFeature(PLANS.FREE, 'professionals'), false);
  assert.equal(hasPlanFeature(PLANS.FREE, 'analytics'), false);
});

test('commissions moved from Pro to Enterprise', () => {
  assert.equal(hasPlanFeature(PLANS.PRO, 'commissions'), false);
  assert.equal(hasPlanFeature(PLANS.ENTERPRISE, 'commissions'), true);
});

test('getPlanFeatures returns the canonical list per plan', () => {
  assert.equal(
    getPlanFeatures(PLANS.FREE).length,
    PLAN_FEATURES[PLANS.FREE].length,
  );
  assert.equal(
    getPlanFeatures(PLANS.PRO).length,
    PLAN_FEATURES[PLANS.PRO].length,
  );
  assert.equal(
    getPlanFeatures(PLANS.ENTERPRISE).length,
    PLAN_FEATURES[PLANS.ENTERPRISE].length,
  );
});

console.log(`\n${passed} tests passed.`);
