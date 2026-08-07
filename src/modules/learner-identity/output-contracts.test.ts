import assert from "node:assert/strict";
import test from "node:test";
import type { ZodType } from "zod";
import {
  childActivationAdminResultSchema,
  createdIdentityRequestSchema,
  cursorPageSchema,
  erasurePreviewSchema,
  invitationAcceptanceSchema,
  learnerAiConsentSchema,
  learnerConnectionRequestSchema,
  learnerCredentialRecoveryDelegateSchema,
  learnerCredentialRecoveryOverviewSchema,
  learnerCredentialResetResultSchema,
  learnerInvitationSchema,
  learnerMergeConfirmationSchema,
  learnerMergePreviewSchema,
  learnerProgressSchema,
  learnerProgressSubjectSchema,
  learnerSafeHistoryItemSchema,
  observerGrantSchema,
  observerInvitationSchema,
  observerOverviewSchema,
  recipientBoundInvitationPreviewSchema,
  recoverableLearnerCredentialSchema,
  safeUnlinkPreviewSchema,
  selfLearningProfileSchema,
  shareCodeSchema,
  sharedCommentSchema,
  teacherLearnerDirectoryItemSchema,
} from "./output-contracts";

const ID_A = "00000000-0000-4000-8000-000000000001";
const ID_B = "00000000-0000-4000-8000-000000000002";
const ID_C = "00000000-0000-4000-8000-000000000003";
const NOW = "2026-08-07T12:00:00.000Z";
const FINGERPRINT = "a".repeat(64);

const connection = {
  id: ID_A,
  direction: "incoming",
  status: "pending",
  method: "email",
  counterpartyLabel: "Преподаватель",
  localDisplayName: "Ученик",
  learnerProfileId: ID_B,
  expiresAt: NOW,
  createdAt: NOW,
  acceptedAt: null,
};

const invitation = {
  id: ID_A,
  kind: "child_activation",
  status: "accepted",
  learnerProfileId: ID_B,
  learnerLabel: "Ученик",
  inviterLabel: "Преподаватель",
  expiresAt: NOW,
  createdAt: NOW,
  acceptedAt: NOW,
};

const mergePreview = {
  operationId: ID_A,
  sourceLearnerProfileId: ID_B,
  targetLearnerProfileId: ID_C,
  previewFingerprint: FINGERPRINT,
  finalizedRecordCount: 1,
  teacherRelationCount: 1,
  groupMembershipCount: 0,
  courseAudienceCount: 0,
  conflicts: [],
  blockers: [],
  canConfirm: true,
  expiresAt: NOW,
};

const acceptance = {
  invitation,
  mergePreview,
  completed: true,
  childAccountLogin: "learner_1",
  observerInvitationId: null,
  recoveryDelegateId: ID_C,
  recoveryDelegateActive: true,
};

const historyItem = {
  key: "opaque-cursor-key",
  occurredAt: NOW,
  courseTitle: "Русский язык",
  lessonTitle: "Причастия",
  subject: "Русский язык",
  wasPresent: true,
  needsRepeat: false,
  actualDurationMinutes: 45,
  comment: { text: "Хорошая работа", sharedAt: NOW },
};

const observerGrant = {
  id: ID_A,
  learnerProfileId: ID_B,
  subjectLabel: "Ученик",
  observerLabel: "Родитель",
  relationshipLabel: "родитель",
  direction: "observing",
  createdAt: NOW,
};

const observerInvitation = {
  id: ID_C,
  direction: "incoming",
  status: "pending",
  subjectLabel: "Ученик",
  observerLabel: "Родитель",
  relationshipLabel: "родитель",
  expiresAt: NOW,
  createdAt: NOW,
};

const recoveryCredential = {
  grantId: ID_A,
  learnerLabel: "Ученик",
  childAccountLogin: "learner_1",
  canReset: true,
  grantedAt: NOW,
};

const recoveryDelegate = {
  grantId: ID_A,
  delegateLabel: "Родитель",
  status: "active",
  grantedAt: NOW,
  revokedAt: null,
};

function assertRejectsSensitiveExtras(
  schema: ZodType,
  valid: Record<string, unknown>,
) {
  for (const [key, value] of Object.entries({
    authUserId: ID_A,
    recipientEmailDigest: "digest",
    tokenDigest: "digest",
    internalAuthEmail: "internal@example.invalid",
    rawPin: "1234",
  })) {
    assert.equal(
      schema.safeParse({ ...valid, [key]: value }).success,
      false,
      `${key} must fail the strict output contract`,
    );
  }
}

test("every browser domain DTO rejects undocumented sensitive root fields", () => {
  const cases: Array<[ZodType, Record<string, unknown>]> = [
    [
      teacherLearnerDirectoryItemSchema,
      {
        learnerProfileId: ID_A,
        teacherAccountId: ID_B,
        displayName: "Ученик",
        archivedAt: null,
        identityState: "offline",
        pendingRequestCount: 0,
        canInvite: true,
        canPermanentlyDelete: true,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    [learnerConnectionRequestSchema, connection],
    [learnerInvitationSchema, invitation],
    [learnerMergePreviewSchema, mergePreview],
    [sharedCommentSchema, historyItem.comment],
    [learnerSafeHistoryItemSchema, historyItem],
    [
      learnerProgressSubjectSchema,
      {
        subject: "Русский язык",
        completedRunCount: 1,
        attendedRunCount: 1,
        repeatRecommendedCount: 0,
        knownActualDurationMinutes: 45,
      },
    ],
    [
      learnerProgressSchema,
      {
        finalizedRunCount: 1,
        attendedRunCount: 1,
        repeatRecommendedCount: 0,
        knownActualDurationMinutes: 45,
        knownActualDurationRunCount: 1,
        lastActivityAt: NOW,
        subjects: [],
      },
    ],
    [shareCodeSchema, { code: "ABCDEF12", expiresAt: NOW, createdAt: NOW }],
    [
      selfLearningProfileSchema,
      {
        learnerProfileId: ID_A,
        displayName: "Ученик",
        createdAt: NOW,
        mergedLineageCount: 0,
        canSafeUnlink: true,
        pendingConnections: [],
      },
    ],
    [observerInvitationSchema, observerInvitation],
    [observerGrantSchema, observerGrant],
    [observerOverviewSchema, { grants: [], invitations: [] }],
    [
      learnerAiConsentSchema,
      {
        id: ID_A,
        learnerProfileId: ID_B,
        courseId: ID_C,
        courseTitle: "Курс",
        ownerLabel: "Преподаватель",
        purpose: "Персонализировать урок",
        status: "active",
        revision: 1,
        expiresAt: NOW,
        createdAt: NOW,
        grantedAt: NOW,
        revokedAt: null,
      },
    ],
    [
      erasurePreviewSchema,
      {
        previewFingerprint: FINGERPRINT,
        lineageProfileCount: 1,
        learningRecordCount: 2,
        teacherRelationCount: 1,
        groupMembershipCount: 0,
        courseAudienceCount: 0,
        invitationCount: 0,
        observerGrantCount: 0,
        aiConsentCount: 0,
        recoveryDelegateCount: 0,
        generatedAt: NOW,
      },
    ],
    [
      safeUnlinkPreviewSchema,
      {
        previewFingerprint: FINGERPRINT,
        canUnlink: true,
        blockers: [],
        generatedAt: NOW,
      },
    ],
    [invitationAcceptanceSchema, acceptance],
    [
      learnerMergeConfirmationSchema,
      { operationId: ID_A, targetLearnerProfileId: ID_B, completed: true },
    ],
    [
      recipientBoundInvitationPreviewSchema,
      {
        id: ID_A,
        kind: "connection",
        title: "Добавление в список",
        inviterLabel: "Преподаватель",
        relationshipLabel: null,
        status: "pending",
        expiresAt: NOW,
        canAccept: true,
      },
    ],
    [recoverableLearnerCredentialSchema, recoveryCredential],
    [learnerCredentialRecoveryDelegateSchema, recoveryDelegate],
    [
      learnerCredentialRecoveryOverviewSchema,
      {
        recoverableLearners: [recoveryCredential],
        myDelegates: [recoveryDelegate],
      },
    ],
    [
      learnerCredentialResetResultSchema,
      {
        grantId: ID_A,
        learnerLabel: "Ученик",
        childAccountLogin: "learner_2",
        completed: true,
      },
    ],
  ];

  for (const [schema, fixture] of cases) {
    assert.equal(schema.safeParse(fixture).success, true);
    assertRejectsSensitiveExtras(schema, fixture);
  }
});

test("nested RPC rows cannot smuggle internal identity fields into browser DTOs", () => {
  assert.equal(
    cursorPageSchema(learnerSafeHistoryItemSchema).safeParse({
      items: [{ ...historyItem, authUserId: ID_A }],
      nextCursor: null,
    }).success,
    false,
  );
  assert.equal(
    invitationAcceptanceSchema.safeParse({
      ...acceptance,
      invitation: { ...invitation, tokenDigest: "secret-digest" },
    }).success,
    false,
  );
  assert.equal(
    observerOverviewSchema.safeParse({
      grants: [{ ...observerGrant, recipientEmailDigest: "email-digest" }],
      invitations: [observerInvitation],
    }).success,
    false,
  );
  assert.equal(
    selfLearningProfileSchema.safeParse({
      learnerProfileId: ID_A,
      displayName: "Ученик",
      createdAt: NOW,
      mergedLineageCount: 0,
      canSafeUnlink: false,
      pendingConnections: [{ ...connection, internalAuthEmail: "x@y.invalid" }],
    }).success,
    false,
  );
  assert.equal(
    learnerCredentialRecoveryOverviewSchema.safeParse({
      recoverableLearners: [
        { ...recoveryCredential, internalAuthEmail: "child@internal.invalid" },
      ],
      myDelegates: [recoveryDelegate],
    }).success,
    false,
  );
});

test("child activation permits its one server-only commit marker only at the admin boundary", () => {
  const adminResult = {
    ...acceptance,
    provisionalAuthUserConsumed: true,
  };
  assert.equal(
    childActivationAdminResultSchema.safeParse(adminResult).success,
    true,
  );
  assert.equal(
    invitationAcceptanceSchema.safeParse(adminResult).success,
    false,
  );
  const {
    recoveryDelegateId: _recoveryDelegateId,
    recoveryDelegateActive: _recoveryDelegateActive,
    ...missingRecoveryBoundary
  } = adminResult;
  assert.equal(
    childActivationAdminResultSchema.safeParse(missingRecoveryBoundary).success,
    false,
  );
  assert.equal(
    childActivationAdminResultSchema.safeParse({
      ...adminResult,
      provisionalAuthUserId: ID_A,
    }).success,
    false,
  );
});

test("credential reset output is the exact documented browser DTO", () => {
  const result = learnerCredentialResetResultSchema.parse({
    grantId: ID_A,
    learnerLabel: "Ученик",
    childAccountLogin: "learner_2",
    completed: true,
  });
  assert.deepEqual(Object.keys(result).sort(), [
    "childAccountLogin",
    "completed",
    "grantId",
    "learnerLabel",
  ]);
  assert.equal(
    learnerCredentialResetResultSchema.safeParse({
      ...result,
      subjectAccountId: ID_B,
      internalAuthEmail: "child@internal.invalid",
      pin: "1234",
      sessionInvalidBefore: NOW,
    }).success,
    false,
  );
});

test("service-created request envelopes stay strict through their nested RPC DTO", () => {
  const schema = createdIdentityRequestSchema(learnerInvitationSchema);
  const valid = {
    request: invitation,
    copyLink: "https://v2.shidao.test/identity/invitations/example#token=x",
    delivery: "delivery_attempted",
  };
  assert.equal(schema.safeParse(valid).success, true);
  assert.equal(
    schema.safeParse({
      ...valid,
      request: { ...invitation, recipientEmailDigest: "email-digest" },
    }).success,
    false,
  );
});
