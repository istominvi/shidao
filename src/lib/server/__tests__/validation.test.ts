import test from "node:test";
import assert from "node:assert/strict";
import {
  changeEmailPayloadSchema,
  invitePayloadSchema,
  loginPayloadSchema,
  validatePin,
  profileSwitchPayloadSchema,
} from "../validation";

test("login payload schema normalizes identifier", () => {
  const result = loginPayloadSchema({
    identifier: "  StudentLogin  ",
    secret: " 1234 ",
  });
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.data.identifier, "studentlogin");
  assert.equal(result.data.secret, "1234");
});

test("email schemas reject malformed emails", () => {
  assert.equal(invitePayloadSchema({ email: "bad-email" }).success, false);
  assert.equal(
    changeEmailPayloadSchema({ newEmail: "bad", currentPassword: "123" }).success,
    false,
  );
});

test("pin schema accepts only 4-8 digits", () => {
  assert.equal(validatePin("1234").success, true);
  assert.equal(validatePin("12345678").success, true);
  assert.equal(validatePin("123").success, false);
  assert.equal(validatePin("12ab").success, false);
});

test("profile switch schema allows only parent or teacher", () => {
  assert.equal(profileSwitchPayloadSchema({ profile: "parent" }).success, true);
  assert.equal(profileSwitchPayloadSchema({ profile: "teacher" }).success, true);
  assert.equal(profileSwitchPayloadSchema({ profile: "student" }).success, false);
});
