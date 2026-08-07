import assert from "node:assert/strict";
import test from "node:test";
import { ROUTES } from "../auth";
import {
  resolveTopNavAction,
  shouldRedirectSecuritySettingsToLogin,
} from "../navigation-contract";
import {
  resolveAppLayoutRedirect,
  resolveAuthEntryRedirect,
} from "../server/access-guards";
import type { SessionAccountView, SessionGuestView } from "../session-view";

const guest: SessionGuestView = { kind: "guest", authenticated: false };
const account: SessionAccountView = {
  kind: "account",
  authenticated: true,
  hasPin: true,
  locale: "ru",
  timezone: "Asia/Chita",
};

test("smoke: guest and Account header contracts are deterministic", () => {
  assert.equal(resolveTopNavAction(ROUTES.home, guest, true), "guest-login");
  assert.equal(
    resolveTopNavAction(ROUTES.home, account, true),
    "session-actions",
  );
});

test("smoke: only Account authentication gates private and auth-entry routes", () => {
  assert.equal(resolveAppLayoutRedirect("guest"), ROUTES.login);
  assert.equal(resolveAppLayoutRedirect("account"), null);
  assert.equal(resolveAuthEntryRedirect({ status: "account" }), ROUTES.courses);
  assert.equal(resolveAuthEntryRedirect({ status: "guest" }), null);
});

test("smoke: security settings use the Account session", () => {
  assert.equal(shouldRedirectSecuritySettingsToLogin(guest), true);
  assert.equal(shouldRedirectSecuritySettingsToLogin(account), false);
});
