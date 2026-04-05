import test from 'node:test';
import assert from 'node:assert/strict';
import { afterLogin, onAuthPageWhenAuthenticated } from '../auth-redirects';
import { ROUTES } from '../auth';

test('afterLogin sends users to dashboard by default', () => {
  assert.equal(afterLogin(), ROUTES.dashboard);
});

test('afterLogin keeps safe relative path', () => {
  assert.equal(afterLogin('/settings/profile'), '/settings/profile');
});

test('afterLogin drops unsafe redirect path', () => {
  assert.equal(afterLogin('https://malicious.example/steal-session'), ROUTES.dashboard);
  assert.equal(afterLogin('//malicious.example/steal-session'), ROUTES.dashboard);
});

test('guarded auth route redirect for authenticated users follows access policy', () => {
  assert.equal(onAuthPageWhenAuthenticated({ status: 'adult-without-profile', context: {} as never }), ROUTES.onboarding);
  assert.equal(
    onAuthPageWhenAuthenticated({ status: 'adult-with-profile', context: {} as never, activeProfile: 'parent' }),
    ROUTES.dashboard
  );
  assert.equal(onAuthPageWhenAuthenticated({ status: 'student', context: {} as never }), ROUTES.dashboard);
  assert.equal(onAuthPageWhenAuthenticated({ status: 'guest' }), null);
  assert.equal(onAuthPageWhenAuthenticated({ status: 'degraded', reason: 'test' }), null);
});
