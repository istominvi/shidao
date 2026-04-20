import test from "node:test";
import assert from "node:assert/strict";
import {
  afterConfirm,
  afterLogin,
  onAuthPageWhenAuthenticated,
} from "../auth-redirects";
import { ROUTES } from "../auth";

test("afterLogin sends users to lessons by default", () => {
  assert.equal(afterLogin(), ROUTES.lessons);
});

test("afterLogin keeps safe relative path", () => {
  assert.equal(afterLogin(ROUTES.settingsProfile), ROUTES.settingsProfile);
});

test("afterLogin drops unsafe redirect path", () => {
  assert.equal(
    afterLogin("https://malicious.example/steal-session"),
    ROUTES.lessons,
  );
  assert.equal(
    afterLogin("//malicious.example/steal-session"),
    ROUTES.lessons,
  );
});

test("confirmation redirects stay coherent with session-authenticated flow", () => {
  assert.equal(afterConfirm("signup"), ROUTES.lessons);
  assert.equal(afterConfirm("email"), ROUTES.lessons);
  assert.equal(afterConfirm("invite"), ROUTES.onboarding);
  assert.equal(afterConfirm("recovery"), ROUTES.resetPassword);
  assert.equal(afterConfirm("email_change"), `${ROUTES.settingsProfile}?emailChanged=1`);
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
    ROUTES.lessons,
  );
  assert.equal(
    onAuthPageWhenAuthenticated({ status: "student", context: {} as never }),
    ROUTES.lessons,
  );
  assert.equal(onAuthPageWhenAuthenticated({ status: "guest" }), null);
  assert.equal(
    onAuthPageWhenAuthenticated({ status: "degraded", reason: "test" }),
    null,
  );
});
