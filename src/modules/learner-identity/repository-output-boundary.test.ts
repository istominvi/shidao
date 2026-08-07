import assert from "node:assert/strict";
import test from "node:test";
import { createLearnerIdentityAdminRepository } from "./admin-repository";
import {
  createLearnerIdentityRepository,
  LearnerIdentityRepositoryError,
} from "./repository";

const ID_A = "00000000-0000-4000-8000-000000000001";
const ID_B = "00000000-0000-4000-8000-000000000002";
const ID_C = "00000000-0000-4000-8000-000000000003";
const NOW = "2026-08-07T12:00:00.000Z";

function configureEnvironment(t: test.TestContext) {
  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  t.after(() => {
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.anonKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previous.anonKey;
    if (previous.serviceKey === undefined)
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.serviceKey;
  });
}

function assertInvalidRpcOutput(error: unknown) {
  assert.ok(error instanceof LearnerIdentityRepositoryError);
  assert.equal(error.status, 502);
  assert.match(error.message, /_response_invalid$/);
  return true;
}

test("authenticated repository fails closed when an RPC injects an Auth id", async (t) => {
  configureEnvironment(t);
  const repository = createLearnerIdentityRepository("user-jwt", {
    fetcher: async () =>
      Response.json([
        {
          learner_profile_id: ID_A,
          teacher_account_id: ID_B,
          display_name: "Ученик",
          archived_at: null,
          identity_state: "offline",
          pending_request_count: 0,
          can_invite: true,
          can_permanently_delete: true,
          created_at: NOW,
          updated_at: NOW,
          auth_user_id: ID_C,
        },
      ]),
  });

  await assert.rejects(
    repository.listTeacherDirectory("active"),
    assertInvalidRpcOutput,
  );
});

test("service-role invitation RPC cannot forward digest or internal email extras", async (t) => {
  configureEnvironment(t);
  const repository = createLearnerIdentityAdminRepository({
    fetcher: async () =>
      Response.json({
        invitation: {
          id: ID_A,
          kind: "child_activation",
          status: "bound",
          learner_profile_id: ID_B,
          learner_label: "Ученик",
          inviter_label: "Преподаватель",
          expires_at: NOW,
          created_at: NOW,
          accepted_at: null,
          token_digest: "secret-digest",
          internal_auth_email: "child@internal.invalid",
        },
        merge_preview: null,
        completed: false,
        child_account_login: null,
        observer_invitation_id: null,
      }),
  });

  await assert.rejects(
    repository.previewProfileInvitation(
      ID_A,
      ID_B,
      "a".repeat(64),
      "b".repeat(64),
    ),
    assertInvalidRpcOutput,
  );
});

test("service-role reset RPC returns only its exact browser-safe DTO", async (t) => {
  configureEnvironment(t);
  const repository = createLearnerIdentityAdminRepository({
    fetcher: async () =>
      Response.json({
        grant_id: ID_A,
        learner_label: "Ученик",
        child_account_login: "learner_2",
        completed: true,
        recipient_email_digest: "secret-digest",
        raw_pin: "1234",
        session_invalid_before: NOW,
      }),
  });

  await assert.rejects(
    repository.resetRecoverableCredentials(ID_A, ID_B, {
      newLogin: "learner_2",
      pin: "1234",
      reauthenticatedAt: NOW,
      idempotencyKey: ID_C,
    }),
    assertInvalidRpcOutput,
  );
});

test("schema-aware admin parsing preserves a legitimate one-row list", async (t) => {
  configureEnvironment(t);
  const repository = createLearnerIdentityAdminRepository({
    fetcher: async () =>
      Response.json([
        {
          grant_id: ID_A,
          learner_label: "Ученик",
          child_account_login: "learner_1",
          can_reset: true,
          granted_at: NOW,
        },
      ]),
  });

  const result = await repository.listRecoverableCredentials(ID_B);
  assert.deepEqual(result, [
    {
      grantId: ID_A,
      learnerLabel: "Ученик",
      childAccountLogin: "learner_1",
      canReset: true,
      grantedAt: NOW,
    },
  ]);
});
