import test from "node:test";
import assert from "node:assert/strict";
import { ROUTES } from "../../auth";
import {
  resolveAppLayoutRedirect,
  resolveAuthEntryRedirect,
  resolveOnboardingRedirect,
  resolveProfileRequiredRedirect,
  resolveTeacherRequiredRedirect,
} from "../access-guards";

test("all existing private route groups enforce only Account authentication", () => {
  for (const status of ["guest", "degraded"] as const) {
    assert.equal(resolveAppLayoutRedirect(status), ROUTES.login);
    assert.equal(resolveProfileRequiredRedirect(status), ROUTES.login);
    assert.equal(resolveTeacherRequiredRedirect({ status }), ROUTES.login);
    assert.equal(resolveOnboardingRedirect(status), ROUTES.login);
  }

  assert.equal(resolveAppLayoutRedirect("account"), null);
  assert.equal(resolveProfileRequiredRedirect("account"), null);
  assert.equal(resolveTeacherRequiredRedirect({ status: "account" }), null);
  assert.equal(resolveOnboardingRedirect("account"), null);
});

test("auth entry routes redirect a resolved Account to courses", () => {
  assert.equal(resolveAuthEntryRedirect({ status: "account" }), ROUTES.courses);
  assert.equal(resolveAuthEntryRedirect({ status: "guest" }), null);
  assert.equal(resolveAuthEntryRedirect({ status: "degraded" }), null);
});
