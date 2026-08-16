import test from "node:test";
import assert from "node:assert/strict";
import { GUEST_SESSION_VIEW, toSessionView } from "../session-view";

test("toSessionView keeps only the roleless Account contract", () => {
  assert.deepEqual(
    toSessionView({
      kind: "account",
      authenticated: true,
      hasPin: true,
      userId: "must-not-leave-the-server",
      accountId: "must-not-leave-the-server",
      fullName: "Test Account",
      email: "account@example.com",
      initials: "TA",
      locale: "ru",
      timezone: "Asia/Chita",
      avatar: {
        kind: "custom",
        presetKey: null,
        revision: 7,
        deliveryKey: "abcdefghijklmnopqrstuvwx",
        storagePath: "must-not-leave-the-server",
      },
      activeProfile: "teacher",
      ignored: "field",
    }),
    {
      kind: "account",
      authenticated: true,
      hasPin: true,
      fullName: "Test Account",
      email: "account@example.com",
      initials: "TA",
      locale: "ru",
      timezone: "Asia/Chita",
      avatar: {
        kind: "custom",
        presetKey: null,
        revision: 7,
        deliveryKey: "abcdefghijklmnopqrstuvwx",
      },
    },
  );
});

test("legacy role-shaped or incomplete payloads fail closed to guest", () => {
  for (const payload of [
    { kind: "account", authenticated: true, hasPin: false },
    {
      kind: "account",
      authenticated: true,
      hasPin: false,
      locale: "ru",
      timezone: "Asia/Chita",
      avatar: {
        kind: "preset",
        presetKey: "not-a-real-preset",
        revision: 1,
      },
    },
    {
      kind: "account",
      authenticated: true,
      hasPin: false,
      locale: "ru",
      timezone: "Asia/Chita",
      avatar: {
        kind: "preset",
        presetKey: "sd-avatar-v1-01",
        revision: 0,
      },
    },
    {
      kind: "account",
      authenticated: true,
      hasPin: false,
      locale: "ru",
      timezone: "Asia/Chita",
      avatar: {
        kind: "preset",
        presetKey: "sd-avatar-v1-01",
        revision: Number.MAX_SAFE_INTEGER + 1,
      },
    },
    {
      kind: "account",
      authenticated: true,
      hasPin: false,
      locale: "ru",
      timezone: "Asia/Chita",
      avatar: {
        kind: "custom",
        presetKey: "sd-avatar-v1-01",
        revision: 1,
      },
    },
    { kind: "adult", authenticated: true, hasPin: false },
    { kind: "student", authenticated: true, hasPin: true },
    null,
    { kind: "unknown", authenticated: true },
  ]) {
    assert.deepEqual(toSessionView(payload), GUEST_SESSION_VIEW);
  }
});

test("toSessionView keeps degraded identity without security fields", () => {
  assert.deepEqual(
    toSessionView({
      kind: "degraded",
      authenticated: true,
      reason: "context_unavailable",
      hasPin: true,
      email: "degraded@example.com",
    }),
    {
      kind: "degraded",
      authenticated: true,
      reason: "context_unavailable",
      email: "degraded@example.com",
      fullName: undefined,
      initials: undefined,
    },
  );
});
