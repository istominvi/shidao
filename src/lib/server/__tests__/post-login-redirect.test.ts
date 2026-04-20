import assert from "node:assert/strict";
import test from "node:test";
import { ROUTES } from "../../auth";
import { resolvePostLoginRedirectForContext } from "../post-login-redirect";

test("post-login redirect sends student to lessons", () => {
  assert.equal(
    resolvePostLoginRedirectForContext({
      actorKind: "student",
      hasAnyAdultProfile: false,
    }),
    ROUTES.lessons,
  );
});

test("post-login redirect sends teacher profile to lessons", () => {
  assert.equal(
    resolvePostLoginRedirectForContext({
      actorKind: "adult",
      hasAnyAdultProfile: true,
      activeAdultProfile: "teacher",
    }),
    ROUTES.lessons,
  );
});

test("post-login redirect sends parent profile to dashboard", () => {
  assert.equal(
    resolvePostLoginRedirectForContext({
      actorKind: "adult",
      hasAnyAdultProfile: true,
      activeAdultProfile: "parent",
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
