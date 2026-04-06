import assert from "node:assert/strict";
import test from "node:test";

import { ROUTES } from "../auth";
import {
  resolveAddProfileHref,
  resolveTopNavAction,
  shouldRedirectSecuritySettingsToLogin,
} from "../navigation-contract";
import { resolveAppLayoutRedirect, resolveAuthEntryRedirect } from "../server/access-guards";
import type {
  SessionAdultView,
  SessionGuestView,
  SessionStudentView,
} from "../session-view";

const guest: SessionGuestView = { kind: "guest", authenticated: false };
const student: SessionStudentView = {
  kind: "student",
  authenticated: true,
  hasPin: true,
};
const adult: SessionAdultView = {
  kind: "adult",
  authenticated: true,
  hasPin: true,
  activeProfile: "parent",
  availableProfiles: ["parent", "teacher"],
};

test("smoke: guest opens / and sees guest CTA contract in header", () => {
  assert.equal(resolveTopNavAction(ROUTES.home, guest, true), "guest-login");
});

test("smoke: authenticated user opens / and sees auth-aware header contract", () => {
  assert.equal(
    resolveTopNavAction(ROUTES.home, adult, true),
    "session-actions",
  );
  assert.equal(
    resolveTopNavAction(ROUTES.home, student, true),
    "session-actions",
  );
});

test("smoke: guest on protected route is redirected to /login by server guard", () => {
  assert.equal(
    resolveAppLayoutRedirect("guest"),
    ROUTES.login,
  );
});

test("smoke: authenticated user on /login is redirected by access policy", () => {
  assert.equal(resolveAuthEntryRedirect("adult-with-profile"), ROUTES.dashboard);
  assert.equal(resolveAuthEntryRedirect("adult-without-profile"), ROUTES.onboarding);
});

test("smoke: /settings/security follows server-first contract (no extra client fetch needed)", () => {
  assert.equal(shouldRedirectSecuritySettingsToLogin(guest), true);
  assert.equal(shouldRedirectSecuritySettingsToLogin(adult), false);
});

test("smoke: profile switching flow exposes canonical add-profile redirect contract", () => {
  assert.equal(
    resolveAddProfileHref(),
    `${ROUTES.onboarding}?mode=add-profile`,
  );
});
