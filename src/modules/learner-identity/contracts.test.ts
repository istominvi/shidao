import assert from "node:assert/strict";
import test from "node:test";
import {
  aiConsentRequestInputSchema,
  childActivationInputSchema,
  connectionRequestInputSchema,
  observerActionInputSchema,
} from "./contracts";

test("connection discovery accepts only one explicit method", () => {
  assert.deepEqual(
    connectionRequestInputSchema.parse({
      method: "share_code",
      shareCode: " ABCDE-23456 ",
      localDisplayName: " Анна ",
    }),
    {
      method: "share_code",
      shareCode: "ABCDE-23456",
      localDisplayName: "Анна",
    },
  );
  assert.throws(() =>
    connectionRequestInputSchema.parse({
      method: "email",
      email: "person@example.com",
      shareCode: "ABCDE-23456",
      localDisplayName: "Анна",
    }),
  );
});

test("account-bound observer decisions use the authenticated relationship and reject browser bearers", () => {
  assert.deepEqual(observerActionInputSchema.parse({ action: "accept" }), {
    action: "accept",
  });
  assert.throws(() =>
    observerActionInputSchema.parse({
      action: "accept",
      token: "1234567890abcdef",
    }),
  );
});

test("child activation keeps PIN bounded and AI permission stays course-specific", () => {
  assert.throws(() =>
    childActivationInputSchema.parse({
      token: "1234567890abcdef",
      learnerLogin: "learner",
      pin: "123",
      requestObserverInvitation: false,
    }),
  );
  assert.throws(() =>
    aiConsentRequestInputSchema.parse({
      learnerProfileId: "00000000-0000-4000-8000-000000000001",
      purpose: "Подготовка курса",
      expiresInDays: 366,
    }),
  );
});
