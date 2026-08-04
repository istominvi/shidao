import test from "node:test";
import assert from "node:assert/strict";
import {
  afterConfirm,
  afterLogin,
  resolveClientPostLoginRoute,
  onAuthPageWhenAuthenticated,
} from "../auth-redirects";
import { ROUTES } from "../auth";

test("afterLogin sends users to courses by default", () => {
  assert.equal(afterLogin(), ROUTES.courses);
});

test("afterLogin keeps safe relative path", () => {
  assert.equal(afterLogin(ROUTES.settingsProfile), ROUTES.settingsProfile);
});

test("afterLogin drops unsafe redirect path", () => {
  assert.equal(
    afterLogin("https://malicious.example/steal-session"),
    ROUTES.courses,
  );
  assert.equal(afterLogin("//malicious.example/steal-session"), ROUTES.courses);
});

test("client login honors only a safe requested route", () => {
  assert.equal(
    resolveClientPostLoginRoute(ROUTES.courses, "/courses/course-1"),
    "/courses/course-1",
  );
  assert.equal(
    resolveClientPostLoginRoute(
      ROUTES.courses,
      "https://malicious.example/steal-session",
    ),
    ROUTES.courses,
  );
});

test("confirmation redirects stay coherent with session-authenticated flow", () => {
  assert.equal(afterConfirm("signup"), ROUTES.courses);
  assert.equal(afterConfirm("email"), ROUTES.courses);
  assert.equal(afterConfirm("invite"), ROUTES.onboarding);
  assert.equal(afterConfirm("recovery"), ROUTES.resetPassword);
  assert.equal(
    afterConfirm("email_change"),
    `${ROUTES.settingsProfile}?emailChanged=1`,
  );
});

test("guarded auth route redirect for authenticated users follows access policy", () => {
  assert.equal(
    onAuthPageWhenAuthenticated({
      status: "adult-without-profile",
      context: {} as never,
    }),
    ROUTES.onboarding,
  );
  assert.equal(
    onAuthPageWhenAuthenticated({
      status: "adult-with-profile",
      context: {} as never,
      activeProfile: "parent",
    }),
    ROUTES.courses,
  );
  assert.equal(
    onAuthPageWhenAuthenticated({ status: "student", context: {} as never }),
    ROUTES.courses,
  );
  assert.equal(onAuthPageWhenAuthenticated({ status: "guest" }), null);
  assert.equal(
    onAuthPageWhenAuthenticated({ status: "degraded", reason: "test" }),
    null,
  );
});
