import test from "node:test";
import assert from "node:assert/strict";
import { GUEST_SESSION_VIEW, toSessionView } from "../session-view";

test("toSessionView keeps student hasPin and identity fields", () => {
  const actual = toSessionView({
    kind: "student",
    authenticated: true,
    hasPin: true,
    userId: "user-1",
    fullName: "Test Student",
    email: "student@example.com",
    initials: "TS",
    ignored: "field",
  });

  assert.deepEqual(actual, {
    kind: "student",
    authenticated: true,
    hasPin: true,
    userId: "user-1",
    fullName: "Test Student",
    email: "student@example.com",
    initials: "TS",
  });
});

test("toSessionView keeps adult profile contract strict", () => {
  const actual = toSessionView({
    kind: "adult",
    authenticated: true,
    hasPin: false,
    activeProfile: "teacher",
    availableProfiles: ["teacher", "invalid"],
  });

  assert.deepEqual(actual, {
    kind: "adult",
    authenticated: true,
    hasPin: false,
    activeProfile: "teacher",
    availableProfiles: ["teacher"],
    userId: undefined,
    fullName: undefined,
    email: undefined,
    initials: undefined,
  });
});

test("toSessionView falls back to guest on invalid payload", () => {
  assert.deepEqual(
    toSessionView({ kind: "adult", authenticated: true }),
    GUEST_SESSION_VIEW,
  );
  assert.deepEqual(
    toSessionView({ kind: "student", authenticated: true, userId: "u-1" }),
    GUEST_SESSION_VIEW,
  );
  assert.deepEqual(toSessionView(null), GUEST_SESSION_VIEW);
  assert.deepEqual(
    toSessionView({ kind: "unknown", authenticated: true }),
    GUEST_SESSION_VIEW,
  );
});

test("toSessionView keeps degraded contract without introducing hasPin", () => {
  const actual = toSessionView({
    kind: "degraded",
    authenticated: true,
    reason: "context_unavailable",
    hasPin: true,
    email: "degraded@example.com",
  });

  assert.deepEqual(actual, {
    kind: "degraded",
    authenticated: true,
    reason: "context_unavailable",
    email: "degraded@example.com",
    userId: undefined,
    fullName: undefined,
    initials: undefined,
  });
});
