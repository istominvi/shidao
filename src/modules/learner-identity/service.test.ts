import assert from "node:assert/strict";
import test from "node:test";
import type { LearnerIdentityAdminRepository } from "./admin-repository";
import type { LearnerIdentityRepository } from "./repository";
import {
  createLearnerIdentityService,
  LearnerIdentityApplicationError,
} from "./service";

const actor = {
  authUserId: "00000000-0000-4000-8000-000000000001",
  verifiedEmail: "recipient@example.com",
};
const learnerProfileId = "00000000-0000-4000-8000-000000000002";
const invitationId = "00000000-0000-4000-8000-000000000003";

function configureSecrets(t: test.TestContext) {
  const previousKey = process.env.LEARNER_IDENTITY_DIGEST_KEY;
  const previousUrl = process.env.NEXT_PUBLIC_APP_URL;
  process.env.LEARNER_IDENTITY_DIGEST_KEY =
    "test-only-learner-identity-key-0123456789";
  process.env.NEXT_PUBLIC_APP_URL = "https://v2.shidao.test";
  t.after(() => {
    if (previousKey === undefined)
      delete process.env.LEARNER_IDENTITY_DIGEST_KEY;
    else process.env.LEARNER_IDENTITY_DIGEST_KEY = previousKey;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previousUrl;
  });
}

test("profile invitation creation is actor-scoped, digest-only and gets a bounded expiry", async (t) => {
  configureSecrets(t);
  const createCalls: Array<{
    actorAuthUserId: string;
    learnerProfileId: string;
    input: Record<string, string>;
  }> = [];
  const deliveries: Array<{ invitationId: string; kind: string }> = [];
  const adminRepository = {
    resolveTeacherLearnerAlias: async () => learnerProfileId,
    createProfileInvitation: async (
      actorAuthUserId: string,
      resolvedLearnerProfileId: string,
      input: Record<string, string>,
    ) => {
      createCalls.push({
        actorAuthUserId,
        learnerProfileId: resolvedLearnerProfileId,
        input,
      });
      return {
        id: invitationId,
        kind: "claim" as const,
        status: "pending" as const,
        learnerProfileId,
        learnerLabel: "Анна",
        inviterLabel: "Преподаватель",
        expiresAt: input.expiresAt,
        createdAt: new Date().toISOString(),
        acceptedAt: null,
      };
    },
    deliverIdentityEmail: async (input: {
      invitationId: string;
      kind: string;
    }) => {
      deliveries.push(input);
      return false;
    },
  } as unknown as LearnerIdentityAdminRepository;
  const service = createLearnerIdentityService({
    repository: {} as LearnerIdentityRepository,
    adminRepository,
  });

  const before = Date.now();
  const result = await service.createProfileInvitation(
    actor,
    learnerProfileId,
    {
      kind: "claim",
      recipientEmail: " Recipient@Example.com ",
    },
  );
  const after = Date.now();

  const createCall = createCalls[0]!;
  const delivery = deliveries[0]!;
  assert.equal(createCalls.length, 1);
  assert.equal(createCall.actorAuthUserId, actor.authUserId);
  assert.equal(createCall.learnerProfileId, learnerProfileId);
  assert.match(createCall.input.recipientEmailDigest, /^\\x[0-9a-f]{64}$/);
  assert.match(createCall.input.tokenDigest, /^\\x[0-9a-f]{64}$/);
  assert.doesNotMatch(JSON.stringify(createCall), /recipient@example\.com/i);
  const expiresAt = Date.parse(createCall.input.expiresAt);
  assert.ok(expiresAt >= before + 7 * 24 * 60 * 60 * 1_000);
  assert.ok(expiresAt <= after + 7 * 24 * 60 * 60 * 1_000);
  assert.equal(deliveries.length, 1);
  const copyLink = new URL(result.copyLink!);
  assert.equal(copyLink.search, "");
  assert.match(
    new URLSearchParams(copyLink.hash.slice(1)).get("token") ?? "",
    /^[A-Za-z0-9_-]{43}$/,
  );
  assert.equal(delivery.invitationId, invitationId);
  assert.equal(
    (delivery as typeof delivery & { recipientEmail: string }).recipientEmail,
    "recipient@example.com",
  );
  assert.doesNotMatch(JSON.stringify(delivery), /token|digest/i);
  assert.equal(result.delivery, "delivery_attempted");
});

test("recipient-bound operations fail before admin RPC without a verified email", async () => {
  let called = false;
  const service = createLearnerIdentityService({
    repository: {} as LearnerIdentityRepository,
    adminRepository: {
      previewProfileInvitation: async () => {
        called = true;
        throw new Error("must not run");
      },
    } as unknown as LearnerIdentityAdminRepository,
  });

  await assert.rejects(
    () =>
      service.previewProfileInvitation(
        { ...actor, verifiedEmail: null },
        invitationId,
        "1234567890abcdef",
      ),
    (error: unknown) =>
      error instanceof LearnerIdentityApplicationError &&
      error.code === "verified_email_required" &&
      error.status === 409,
  );
  assert.equal(called, false);
});

test("observer delivery uses the exact concurrently created invitation id", async (t) => {
  configureSecrets(t);
  const olderInvitationId = "00000000-0000-4000-8000-000000000010";
  const createdInvitationId = "00000000-0000-4000-8000-000000000011";
  const deliveredIds: string[] = [];
  const overview = {
    grants: [],
    invitations: [
      {
        id: olderInvitationId,
        direction: "outgoing" as const,
        status: "pending" as const,
        subjectLabel: "Анна",
        observerLabel: "Первый получатель",
        relationshipLabel: null,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        createdAt: new Date().toISOString(),
      },
      {
        id: createdInvitationId,
        direction: "outgoing" as const,
        status: "pending" as const,
        subjectLabel: "Анна",
        observerLabel: "Новый получатель",
        relationshipLabel: "тренер",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        createdAt: new Date().toISOString(),
      },
    ],
  };
  const service = createLearnerIdentityService({
    repository: {} as LearnerIdentityRepository,
    adminRepository: {
      createObserverInvitation: async () => ({
        createdInvitationId,
        overview,
      }),
      deliverIdentityEmail: async (input: { invitationId: string }) => {
        deliveredIds.push(input.invitationId);
        return true;
      },
    } as unknown as LearnerIdentityAdminRepository,
  });

  const result = await service.createObserverInvitation(actor, {
    recipientEmail: "observer@example.com",
    relationshipLabel: "тренер",
  });

  assert.deepEqual(deliveredIds, [createdInvitationId]);
  assert.deepEqual(result.overview, overview);
  assert.match(result.copyLink!, new RegExp(createdInvitationId));
  assert.doesNotMatch(result.copyLink!, new RegExp(olderInvitationId));
});

function childActivationPreview() {
  return {
    invitation: {
      id: invitationId,
      kind: "child_activation" as const,
      status: "bound" as const,
      learnerProfileId,
      learnerLabel: "Миша",
      inviterLabel: "Преподаватель",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      createdAt: new Date().toISOString(),
      acceptedAt: null,
    },
    mergePreview: null,
    completed: false,
    childAccountLogin: null,
    observerInvitationId: null,
  };
}

test("copied-token child activation forwards explicit recovery delegation acknowledgement", async (t) => {
  configureSecrets(t);
  const activationInputs: Array<Record<string, unknown>> = [];
  let verifiedActivationCalled = false;
  const preview = childActivationPreview();
  const service = createLearnerIdentityService({
    repository: {} as LearnerIdentityRepository,
    adminRepository: {
      previewProfileInvitation: async () => preview,
      createProvisionalLearnerAuthUser: async () => ({
        authUserId: "00000000-0000-4000-8000-000000000020",
        internalAuthEmail: "provisional@example.invalid",
      }),
      activateChildAccount: async (
        _actorId: string,
        _invitationId: string,
        input: Record<string, unknown>,
      ) => {
        activationInputs.push(input);
        return {
          ...preview,
          completed: true,
          childAccountLogin: "misha-child",
          recoveryDelegateId: "00000000-0000-4000-8000-000000000021",
          recoveryDelegateActive: true,
          provisionalAuthUserConsumed: true,
        };
      },
      activateVerifiedChildAccount: async () => {
        verifiedActivationCalled = true;
        throw new Error("wrong activation boundary");
      },
    } as unknown as LearnerIdentityAdminRepository,
  });

  const result = await service.activateChildAccount(
    actor,
    invitationId,
    {
      token: "copied-invitation-token-123456",
      learnerLogin: "misha-child",
      pin: "4321",
      acknowledgeRecoveryDelegate: true,
      requestObserverInvitation: false,
    },
    { recentlyReauthenticated: true },
  );

  assert.equal(activationInputs[0]?.acknowledgeRecoveryDelegate, true);
  assert.match(String(activationInputs[0]?.tokenDigest), /^\\x[0-9a-f]{64}$/);
  assert.equal(verifiedActivationCalled, false);
  assert.equal(result.recoveryDelegateActive, true);
  assert.equal("provisionalAuthUserConsumed" in result, false);
});

test("verified-email child activation forwards explicit recovery delegation acknowledgement without a bearer", async (t) => {
  configureSecrets(t);
  const activationInputs: Array<Record<string, unknown>> = [];
  let tokenActivationCalled = false;
  const preview = childActivationPreview();
  const service = createLearnerIdentityService({
    repository: {} as LearnerIdentityRepository,
    adminRepository: {
      previewVerifiedProfileInvitation: async () => preview,
      createProvisionalLearnerAuthUser: async () => ({
        authUserId: "00000000-0000-4000-8000-000000000022",
        internalAuthEmail: "provisional@example.invalid",
      }),
      activateVerifiedChildAccount: async (
        _actorId: string,
        _invitationId: string,
        input: Record<string, unknown>,
      ) => {
        activationInputs.push(input);
        return {
          ...preview,
          completed: true,
          childAccountLogin: "misha-child",
          recoveryDelegateId: "00000000-0000-4000-8000-000000000023",
          recoveryDelegateActive: true,
          provisionalAuthUserConsumed: true,
        };
      },
      activateChildAccount: async () => {
        tokenActivationCalled = true;
        throw new Error("wrong activation boundary");
      },
    } as unknown as LearnerIdentityAdminRepository,
  });

  const result = await service.activateVerifiedChildAccount(
    actor,
    invitationId,
    {
      learnerLogin: "misha-child",
      pin: "4321",
      acknowledgeRecoveryDelegate: true,
      requestObserverInvitation: true,
    },
    { recentlyReauthenticated: true },
  );

  assert.equal(activationInputs[0]?.acknowledgeRecoveryDelegate, true);
  assert.equal("token" in (activationInputs[0] ?? {}), false);
  assert.equal("tokenDigest" in (activationInputs[0] ?? {}), false);
  assert.equal(tokenActivationCalled, false);
  assert.equal(result.recoveryDelegateActive, true);
  assert.equal("provisionalAuthUserConsumed" in result, false);
});
