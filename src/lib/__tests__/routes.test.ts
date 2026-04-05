import test from 'node:test';
import assert from 'node:assert/strict';
import { isGuardedAuthRoute, isProtectedAppRoute, isRouteWithin } from '../routes';

test('isRouteWithin matches exact route and nested route', () => {
  assert.equal(isRouteWithin('/settings', '/settings'), true);
  assert.equal(isRouteWithin('/settings/security', '/settings'), true);
  assert.equal(isRouteWithin('/settings-security', '/settings'), false);
});

test('isProtectedAppRoute covers dashboard, onboarding, and settings tree', () => {
  assert.equal(isProtectedAppRoute('/dashboard'), true);
  assert.equal(isProtectedAppRoute('/onboarding/step-2'), true);
  assert.equal(isProtectedAppRoute('/settings/team'), true);
  assert.equal(isProtectedAppRoute('/login'), false);
});

test('isGuardedAuthRoute includes only login and join routes', () => {
  assert.equal(isGuardedAuthRoute('/login'), true);
  assert.equal(isGuardedAuthRoute('/join'), true);
  assert.equal(isGuardedAuthRoute('/join/check-email'), false);
  assert.equal(isGuardedAuthRoute('/dashboard'), false);
});
