import assert from "node:assert/strict";
import test from "node:test";
import type { AccountAuthContext } from "../account-auth";
import { reconcileProfileAvatarCustomSwitch } from "../profile-avatar-reconciliation";

const ACCOUNT_ID = "22222222-2222-4222-8222-22222222222a";
const AUTH_USER_ID = "11111111-1111-4111-8111-11111111111a";
const STORAGE_PATH = `${ACCOUNT_ID}/44444444-4444-4444-8444-44444444444c.webp`;

function accountContext(
  avatar: AccountAuthContext["avatar"],
): AccountAuthContext {
  return {
    accountId: ACCOUNT_ID,
    authUserId: AUTH_USER_ID,
    verifiedEmail: "account@example.test",
    displayName: "Account",
    locale: "ru",
    timezone: "Asia/Chita",
    hasPin: false,
    canAuthorEducatorCourses: false,
    sessionsInvalidBefore: null,
    avatar,
  };
}

const input = {
  accessToken: "user-jwt",
  accountId: ACCOUNT_ID,
  authUserId: AUTH_USER_ID,
  sessionIssuedAt: Date.parse("2026-08-14T00:00:00.000Z"),
  storagePath: STORAGE_PATH,
};

test("avatar reconciliation proves a committed custom pointer", async () => {
  const outcome = await reconcileProfileAvatarCustomSwitch(input, {
    readAccount: async () =>
      accountContext({
        kind: "custom",
        presetKey: null,
        storagePath: STORAGE_PATH,
        revision: 2,
        updatedAt: "2026-08-14T00:01:00.000Z",
      }),
  });
  assert.equal(outcome.status, "committed");
  if (outcome.status === "committed") {
    assert.equal(outcome.avatar.storagePath, STORAGE_PATH);
    assert.equal(outcome.avatar.revision, 2);
  }
});

test("avatar reconciliation proves non-commit only from a valid current pointer", async () => {
  const outcome = await reconcileProfileAvatarCustomSwitch(input, {
    readAccount: async () =>
      accountContext({
        kind: "preset",
        presetKey: "sd-avatar-v1-01",
        storagePath: null,
        revision: 1,
        updatedAt: "2026-08-14T00:00:00.000Z",
      }),
  });
  assert.deepEqual(outcome, { status: "not_committed" });
});

test("avatar reconciliation stays ambiguous on reread failure or identity mismatch", async () => {
  const failed = await reconcileProfileAvatarCustomSwitch(input, {
    readAccount: async () => {
      throw new Error("provider unavailable");
    },
  });
  assert.deepEqual(failed, { status: "ambiguous" });

  const mismatched = await reconcileProfileAvatarCustomSwitch(input, {
    readAccount: async () => ({
      ...accountContext({
        kind: "preset",
        presetKey: "sd-avatar-v1-01",
        storagePath: null,
        revision: 1,
        updatedAt: "2026-08-14T00:00:00.000Z",
      }),
      authUserId: "99999999-9999-4999-8999-999999999999",
    }),
  });
  assert.deepEqual(mismatched, { status: "ambiguous" });

  const revoked = await reconcileProfileAvatarCustomSwitch(input, {
    readAccount: async () => ({
      ...accountContext({
        kind: "preset",
        presetKey: "sd-avatar-v1-01",
        storagePath: null,
        revision: 1,
        updatedAt: "2026-08-14T00:00:00.000Z",
      }),
      sessionsInvalidBefore: "2026-08-14T00:00:01.000Z",
    }),
  });
  assert.deepEqual(revoked, { status: "ambiguous" });
});
