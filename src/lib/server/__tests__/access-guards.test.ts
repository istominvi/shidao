import test from "node:test";
import assert from "node:assert/strict";
import { ROUTES } from "../../auth";
import { resolvePrivateLayoutRedirect } from "../access-guards";

test("private layout redirects guest/degraded to login", () => {
  assert.equal(
    resolvePrivateLayoutRedirect("guest", ROUTES.dashboard),
    ROUTES.login,
  );
  assert.equal(
    resolvePrivateLayoutRedirect("degraded", ROUTES.settingsProfile),
    ROUTES.login,
  );
});

test("private layout keeps onboarding accessible for adult-without-profile", () => {
  assert.equal(
    resolvePrivateLayoutRedirect("adult-without-profile", ROUTES.onboarding),
    null,
  );
  assert.equal(
    resolvePrivateLayoutRedirect(
      "adult-without-profile",
      `${ROUTES.onboarding}/step-2`,
    ),
    null,
  );
  assert.equal(
    resolvePrivateLayoutRedirect("adult-without-profile", ROUTES.dashboard),
    ROUTES.onboarding,
  );
});

test("private layout does not redirect student or adult-with-profile", () => {
  assert.equal(resolvePrivateLayoutRedirect("student", ROUTES.dashboard), null);
  assert.equal(
    resolvePrivateLayoutRedirect("adult-with-profile", ROUTES.settingsSecurity),
    null,
  );
});
