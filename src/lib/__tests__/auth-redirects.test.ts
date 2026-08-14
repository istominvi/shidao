import test from "node:test";
import assert from "node:assert/strict";
import {
  afterConfirm,
  afterLogin,
  afterSignup,
  resolveClientPostLoginRoute,
  onAuthPageWhenAuthenticated,
} from "../auth-redirects";
import { ROUTES } from "../auth";
import { profileSettingsStatusHref } from "../navigation/profile-nav";

test("post-auth redirects default to Account courses and reject external paths", () => {
  assert.equal(afterLogin(), ROUTES.courses);
  assert.equal(afterLogin(ROUTES.profile), ROUTES.profile);
  assert.equal(afterLogin("https://malicious.example/steal"), ROUTES.courses);
  assert.equal(afterLogin("//malicious.example/steal"), ROUTES.courses);
  assert.equal(afterLogin("/\\malicious.example/steal"), ROUTES.courses);
  assert.equal(
    resolveClientPostLoginRoute(ROUTES.courses, "/courses/course-1"),
    "/courses/course-1",
  );
  assert.equal(
    resolveClientPostLoginRoute(ROUTES.courses, "https://malicious.example"),
    ROUTES.courses,
  );
  assert.equal(
    resolveClientPostLoginRoute(ROUTES.courses, "/\\malicious.example"),
    ROUTES.courses,
  );
});

test("confirmation redirects remain coherent", () => {
  assert.equal(afterConfirm("signup"), ROUTES.courses);
  assert.equal(afterConfirm("email"), ROUTES.courses);
  assert.equal(afterConfirm("invite"), ROUTES.onboarding);
  assert.equal(afterConfirm("recovery"), ROUTES.resetPassword);
  assert.equal(
    afterConfirm("email_change"),
    profileSettingsStatusHref("emailChanged"),
  );
});

test("signup preserves only a safe post-confirmation destination", () => {
  const invitationPath = "/identity/invitations/invitation-1";

  assert.equal(
    afterSignup({
      requiresEmailConfirmation: false,
      email: "user@example.com",
      next: invitationPath,
      hasSession: true,
    }),
    invitationPath,
  );

  const checkEmailPath = afterSignup({
    requiresEmailConfirmation: true,
    email: "user@example.com",
    next: invitationPath,
  });
  const checkEmailUrl = new URL(checkEmailPath, "https://v2.shidao.ru");
  assert.equal(checkEmailUrl.pathname, ROUTES.joinCheckEmail);
  assert.equal(checkEmailUrl.searchParams.get("next"), invitationPath);

  const rejected = afterSignup({
    requiresEmailConfirmation: false,
    email: "user@example.com",
    next: "/\\attacker.example/steal",
    hasSession: true,
  });
  assert.equal(rejected, ROUTES.courses);
});

test("guarded auth route redirects only a resolved Account", () => {
  assert.equal(
    onAuthPageWhenAuthenticated({ status: "account", context: {} as never }),
    ROUTES.courses,
  );
  assert.equal(onAuthPageWhenAuthenticated({ status: "guest" }), null);
  assert.equal(
    onAuthPageWhenAuthenticated({ status: "degraded", reason: "test" }),
    null,
  );
});
