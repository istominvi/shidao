import test from "node:test";
import assert from "node:assert/strict";
import {
  canRenderSessionNavActions,
  resolveLandingAuthCtaHref,
  resolveLandingNavAction,
  resolveTopNavAction,
  shouldRedirectSecuritySettingsToLogin,
} from "../../lib/navigation-contract";
import { ROUTES } from "../../lib/auth";
import type {
  SessionAccountView,
  SessionDegradedView,
  SessionGuestView,
} from "../../lib/session-view";

const guest: SessionGuestView = { kind: "guest", authenticated: false };
const degraded: SessionDegradedView = {
  kind: "degraded",
  authenticated: true,
  reason: "context_unavailable",
};
const account: SessionAccountView = {
  kind: "account",
  authenticated: true,
  hasPin: true,
  locale: "ru",
  timezone: "Asia/Chita",
};

test("TopNav resolves guest actions without exposing them on private routes", () => {
  assert.equal(resolveTopNavAction(ROUTES.login, guest, true), "guest-join");
  assert.equal(resolveTopNavAction(ROUTES.home, guest, true), "guest-login");
  for (const route of [
    ROUTES.settingsSecurity,
    ROUTES.courses,
    ROUTES.schedule,
    ROUTES.students,
    ROUTES.store,
    ROUTES.learningProfile,
    ROUTES.observing,
  ]) {
    assert.equal(resolveTopNavAction(route, guest, true), "skeleton");
  }
});

test("authenticated Account always renders Account session actions", () => {
  assert.equal(
    resolveTopNavAction(ROUTES.home, account, false),
    "session-actions",
  );
  assert.equal(resolveLandingAuthCtaHref(account), ROUTES.courses);
  assert.equal(canRenderSessionNavActions(account), true);
  assert.equal(shouldRedirectSecuritySettingsToLogin(account), false);
});

test("guest and degraded states remain fail-closed", () => {
  assert.equal(resolveLandingNavAction(guest, false), "skeleton");
  assert.equal(resolveLandingNavAction(degraded, true), "guest-cta-pair");
  assert.equal(resolveLandingAuthCtaHref(guest), ROUTES.login);
  assert.equal(shouldRedirectSecuritySettingsToLogin(guest), true);
  assert.equal(shouldRedirectSecuritySettingsToLogin(degraded), true);
  assert.equal(canRenderSessionNavActions(guest), false);
  assert.equal(canRenderSessionNavActions(degraded), false);
});
