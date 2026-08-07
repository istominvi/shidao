import test from "node:test";
import assert from "node:assert/strict";
import {
  changeEmailPayloadSchema,
  invitePayloadSchema,
  loginPayloadSchema,
  validatePin,
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

test("credential schemas reject oversized secrets and identifiers", () => {
  assert.equal(
    loginPayloadSchema({ identifier: "x".repeat(321), secret: "1234" }).success,
    false,
  );
  assert.equal(
    loginPayloadSchema({ identifier: "learner", secret: "x".repeat(257) })
      .success,
    false,
  );
  assert.equal(
    changeEmailPayloadSchema({
      newEmail: "account@example.test",
      currentPassword: "x".repeat(257),
    }).success,
    false,
  );
});

test("email schemas reject malformed emails", () => {
  assert.equal(invitePayloadSchema({ email: "bad-email" }).success, false);
  assert.equal(
    changeEmailPayloadSchema({ newEmail: "bad", currentPassword: "123" })
      .success,
    false,
  );
});

test("pin schema accepts only 4-8 digits", () => {
  assert.equal(validatePin("1234").success, true);
  assert.equal(validatePin("12345678").success, true);
  assert.equal(validatePin("123").success, false);
  assert.equal(validatePin("12ab").success, false);
});
