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
  SessionAdultView,
  SessionDegradedView,
  SessionGuestView,
  SessionStudentView,
} from "../../lib/session-view";

const guest: SessionGuestView = { kind: "guest", authenticated: false };
const degraded: SessionDegradedView = {
  kind: "degraded",
  authenticated: true,
  reason: "context_unavailable",
};
const adult: SessionAdultView = {
  kind: "adult",
  authenticated: true,
  hasPin: false,
  activeProfile: null,
  availableProfiles: [],
};
const student: SessionStudentView = {
  kind: "student",
  authenticated: true,
  hasPin: true,
};

test("TopNav: guest on login sees join CTA after session resolves", () => {
  assert.equal(resolveTopNavAction(ROUTES.login, guest, true), "guest-join");
});

test("TopNav: guest on public page sees login CTA after session resolves", () => {
  assert.equal(resolveTopNavAction(ROUTES.home, guest, true), "guest-login");
});

test("TopNav: protected route keeps guest CTA hidden", () => {
  assert.equal(
    resolveTopNavAction(ROUTES.settingsSecurity, guest, true),
    "skeleton",
  );
  assert.equal(
    resolveTopNavAction(ROUTES.dashboard, degraded, true),
    "skeleton",
  );
});

test("TopNav: authenticated session always renders session actions", () => {
  assert.equal(
    resolveTopNavAction(ROUTES.login, adult, true),
    "session-actions",
  );
  assert.equal(
    resolveTopNavAction(ROUTES.home, student, false),
    "session-actions",
  );
});

test("Landing header: guest/degraded is auth-aware and depends on session resolve", () => {
  assert.equal(resolveLandingNavAction(guest, false), "skeleton");
  assert.equal(resolveLandingNavAction(degraded, true), "guest-cta-pair");
});

test("Landing hero auth CTA points authenticated users to lessons", () => {
  assert.equal(resolveLandingAuthCtaHref(adult), ROUTES.lessons);
  assert.equal(resolveLandingAuthCtaHref(student), ROUTES.lessons);
  assert.equal(resolveLandingAuthCtaHref(guest), ROUTES.login);
});

test("Security settings contract is server-first and redirects unauthenticated states", () => {
  assert.equal(shouldRedirectSecuritySettingsToLogin(guest), true);
  assert.equal(shouldRedirectSecuritySettingsToLogin(degraded), true);
  assert.equal(shouldRedirectSecuritySettingsToLogin(adult), false);
  assert.equal(shouldRedirectSecuritySettingsToLogin(student), false);
});

test("session action guard accepts only authenticated student/adult states", () => {
  assert.equal(canRenderSessionNavActions(guest), false);
  assert.equal(canRenderSessionNavActions(degraded), false);
  assert.equal(canRenderSessionNavActions(adult), true);
});
