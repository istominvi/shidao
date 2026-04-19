import test from "node:test";
import assert from "node:assert/strict";
import { ROUTES } from "../../auth";
import {
  resolveAppLayoutRedirect,
  resolveAuthEntryRedirect,
  resolveOnboardingRedirect,
  resolveProfileRequiredRedirect,
} from "../access-guards";

test("app layout redirects guest/degraded to login", () => {
  assert.equal(resolveAppLayoutRedirect("guest"), ROUTES.login);
  assert.equal(resolveAppLayoutRedirect("degraded"), ROUTES.login);
});

test("profile-required layout redirects adult-without-profile to onboarding", () => {
  assert.equal(
    resolveProfileRequiredRedirect("adult-without-profile"),
    ROUTES.onboarding,
  );
  assert.equal(resolveProfileRequiredRedirect("student"), null);
  assert.equal(resolveProfileRequiredRedirect("adult-with-profile"), null);
});

test("auth entry routes redirect authenticated users deterministically", () => {
  assert.equal(resolveAuthEntryRedirect("adult-without-profile"), ROUTES.onboarding);
  assert.equal(resolveAuthEntryRedirect("adult-with-profile"), ROUTES.dashboard);
  assert.equal(resolveAuthEntryRedirect("student"), ROUTES.dashboard);
  assert.equal(resolveAuthEntryRedirect("guest"), null);
  assert.equal(resolveAuthEntryRedirect("degraded"), null);
});

test("onboarding route blocks guest/degraded/student and preserves add-profile flow", () => {
  assert.equal(resolveOnboardingRedirect("guest"), ROUTES.login);
  assert.equal(resolveOnboardingRedirect("degraded"), ROUTES.login);
  assert.equal(resolveOnboardingRedirect("student"), ROUTES.dashboard);
  assert.equal(resolveOnboardingRedirect("adult-without-profile"), null);
  assert.equal(resolveOnboardingRedirect("adult-with-profile"), ROUTES.dashboard);
  assert.equal(
    resolveOnboardingRedirect("adult-with-profile", { mode: "add-profile" }),
    null,
  );
});
