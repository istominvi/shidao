import assert from "node:assert/strict";
import test from "node:test";
import { ROUTES } from "../../auth";
import { resolvePostLoginRedirectForContext } from "../post-login-redirect";

test("post-login redirect sends student to schedule", () => {
  assert.equal(
    resolvePostLoginRedirectForContext({
      actorKind: "student",
      hasAnyAdultProfile: false,
    }),
    ROUTES.schedule,
  );
});

test("post-login redirect sends adult with profile to dashboard", () => {
  assert.equal(
    resolvePostLoginRedirectForContext({
      actorKind: "adult",
      hasAnyAdultProfile: true,
    }),
    ROUTES.dashboard,
  );
});

test("post-login redirect sends adult without profile to onboarding", () => {
  assert.equal(
    resolvePostLoginRedirectForContext({
      actorKind: "adult",
      hasAnyAdultProfile: false,
    }),
    ROUTES.onboarding,
  );
});
