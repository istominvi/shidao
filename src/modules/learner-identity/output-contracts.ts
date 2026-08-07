import { z, type ZodType } from "zod";
import type {
  CreatedIdentityRequest,
  CursorPage,
  ErasurePreview,
  InvitationAcceptance,
  LearnerAiConsent,
  LearnerConnectionRequest,
  LearnerCredentialRecoveryDelegate,
  LearnerCredentialRecoveryOverview,
  LearnerCredentialRecoveryRevocation,
  LearnerCredentialResetResult,
  LearnerInvitation,
  LearnerMergeConfirmation,
  LearnerMergePreview,
  LearnerProgress,
  LearnerProgressSubject,
  LearnerSafeHistoryItem,
  ObserverGrant,
  ObserverInvitation,
  ObserverOverview,
  RecipientBoundInvitationPreview,
  RecoverableLearnerCredential,
  SafeUnlinkPreview,
  SelfLearningProfile,
  ShareCode,
  SharedComment,
  TeacherLearnerDirectoryItem,
} from "./domain";

const timestampSchema = z.string().min(1).max(128);
const nullableTimestampSchema = timestampSchema.nullable();
const labelSchema = z.string().max(4_000);
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const nullableNonNegativeIntegerSchema = nonNegativeIntegerSchema.nullable();
const identityRequestStatusSchema = z.enum([
  "pending",
  "bound",
  "accepted",
  "rejected",
  "cancelled",
  "revoked",
  "expired",
]);

/**
 * RPC output contracts are deliberately strict. A database function returning
 * an undocumented column must fail closed at the server boundary instead of
 * accidentally forwarding an Auth id, digest, internal email, or secret to a
 * browser response.
 */
export const teacherLearnerDirectoryItemSchema: ZodType<TeacherLearnerDirectoryItem> =
  z
    .object({
      learnerProfileId: z.uuid(),
      teacherAccountId: z.uuid(),
      displayName: labelSchema,
      archivedAt: nullableTimestampSchema,
      identityState: z.enum(["offline", "pending", "claimed", "merged"]),
      pendingRequestCount: nonNegativeIntegerSchema,
      canInvite: z.boolean(),
      canPermanentlyDelete: z.boolean(),
      createdAt: timestampSchema,
      updatedAt: timestampSchema,
    })
    .strict();

export const learnerConnectionRequestSchema: ZodType<LearnerConnectionRequest> =
  z
    .object({
      id: z.uuid(),
      direction: z.enum(["incoming", "outgoing"]),
      status: identityRequestStatusSchema,
      method: z.enum(["share_code", "email"]),
      counterpartyLabel: labelSchema,
      localDisplayName: labelSchema.nullable(),
      learnerProfileId: z.uuid().nullable(),
      expiresAt: timestampSchema,
      createdAt: timestampSchema,
      acceptedAt: nullableTimestampSchema,
    })
    .strict();

export const learnerInvitationSchema: ZodType<LearnerInvitation> = z
  .object({
    id: z.uuid(),
    kind: z.enum(["claim", "child_activation"]),
    status: identityRequestStatusSchema,
    learnerProfileId: z.uuid(),
    learnerLabel: labelSchema,
    inviterLabel: labelSchema,
    expiresAt: timestampSchema,
    createdAt: timestampSchema,
    acceptedAt: nullableTimestampSchema,
  })
  .strict();

export const mergeBlockerSchema = z
  .object({
    code: z.string().min(1).max(160),
    message: z.string().min(1).max(1_000),
    count: nullableNonNegativeIntegerSchema,
  })
  .strict();

export const mergeConflictSchema = z
  .object({
    occurredOn: z.string().max(128).nullable(),
    resolution: z.enum([
      "keep_target_primary",
      "keep_source_primary",
      "automatic",
    ]),
  })
  .strict();

export const learnerMergePreviewSchema: ZodType<LearnerMergePreview> = z
  .object({
    operationId: z.uuid(),
    sourceLearnerProfileId: z.uuid(),
    targetLearnerProfileId: z.uuid(),
    previewFingerprint: z.string().regex(/^[a-f0-9]{64}$/i),
    finalizedRecordCount: nonNegativeIntegerSchema,
    teacherRelationCount: nonNegativeIntegerSchema,
    groupMembershipCount: nonNegativeIntegerSchema,
    courseAudienceCount: nonNegativeIntegerSchema,
    conflicts: z.array(mergeConflictSchema).max(10_000),
    blockers: z.array(mergeBlockerSchema).max(100),
    canConfirm: z.boolean(),
    expiresAt: timestampSchema,
  })
  .strict();

export const sharedCommentSchema: ZodType<SharedComment> = z
  .object({
    text: z.string().max(10_000),
    sharedAt: timestampSchema,
  })
  .strict();

export const learnerSafeHistoryItemSchema: ZodType<LearnerSafeHistoryItem> = z
  .object({
    key: z.string().min(1).max(512),
    occurredAt: timestampSchema,
    courseTitle: labelSchema,
    lessonTitle: labelSchema,
    subject: labelSchema.nullable(),
    wasPresent: z.boolean(),
    needsRepeat: z.boolean().nullable(),
    actualDurationMinutes: nullableNonNegativeIntegerSchema,
    comment: sharedCommentSchema.nullable(),
  })
  .strict();

export const learnerProgressSubjectSchema: ZodType<LearnerProgressSubject> = z
  .object({
    subject: labelSchema,
    completedRunCount: nonNegativeIntegerSchema,
    attendedRunCount: nonNegativeIntegerSchema,
    repeatRecommendedCount: nonNegativeIntegerSchema,
    knownActualDurationMinutes: nullableNonNegativeIntegerSchema,
  })
  .strict();

export const learnerProgressSchema: ZodType<LearnerProgress> = z
  .object({
    finalizedRunCount: nonNegativeIntegerSchema,
    attendedRunCount: nonNegativeIntegerSchema,
    repeatRecommendedCount: nonNegativeIntegerSchema,
    knownActualDurationMinutes: nullableNonNegativeIntegerSchema,
    knownActualDurationRunCount: nonNegativeIntegerSchema,
    lastActivityAt: nullableTimestampSchema,
    subjects: z.array(learnerProgressSubjectSchema).max(1_000),
  })
  .strict();

export const shareCodeSchema: ZodType<ShareCode> = z
  .object({
    code: z.string().min(1).max(128),
    expiresAt: timestampSchema,
    createdAt: timestampSchema,
  })
  .strict();

export const shareCodeMetadataSchema: ZodType<Omit<ShareCode, "code">> = z
  .object({
    expiresAt: timestampSchema,
    createdAt: timestampSchema,
  })
  .strict();

export const selfLearningProfileSchema: ZodType<SelfLearningProfile> = z
  .object({
    learnerProfileId: z.uuid(),
    displayName: labelSchema,
    createdAt: timestampSchema,
    mergedLineageCount: nonNegativeIntegerSchema,
    canSafeUnlink: z.boolean(),
    pendingConnections: z.array(learnerConnectionRequestSchema).max(1_000),
  })
  .strict();

export const observerInvitationSchema: ZodType<ObserverInvitation> = z
  .object({
    id: z.uuid(),
    direction: z.enum(["incoming", "outgoing"]),
    status: identityRequestStatusSchema,
    subjectLabel: labelSchema,
    observerLabel: labelSchema,
    relationshipLabel: labelSchema.nullable(),
    expiresAt: timestampSchema,
    createdAt: timestampSchema,
  })
  .strict();

export const observerGrantSchema: ZodType<ObserverGrant> = z
  .object({
    id: z.uuid(),
    learnerProfileId: z.uuid(),
    subjectLabel: labelSchema,
    observerLabel: labelSchema,
    relationshipLabel: labelSchema.nullable(),
    direction: z.enum(["observing", "observed_by"]),
    createdAt: timestampSchema,
  })
  .strict();

export const observerOverviewSchema: ZodType<ObserverOverview> = z
  .object({
    grants: z.array(observerGrantSchema).max(10_000),
    invitations: z.array(observerInvitationSchema).max(10_000),
  })
  .strict();

export const createdObserverInvitationAdminResultSchema = z
  .object({
    createdInvitationId: z.uuid(),
    overview: observerOverviewSchema,
  })
  .strict();

export const learnerAiConsentSchema: ZodType<LearnerAiConsent> = z
  .object({
    id: z.uuid(),
    learnerProfileId: z.uuid(),
    courseId: z.uuid(),
    courseTitle: labelSchema,
    ownerLabel: labelSchema,
    purpose: z.string().max(4_000),
    status: z.enum(["pending", "active", "revoked", "expired", "invalid"]),
    revision: z.number().int().positive(),
    expiresAt: timestampSchema,
    createdAt: timestampSchema,
    grantedAt: nullableTimestampSchema,
    revokedAt: nullableTimestampSchema,
  })
  .strict();

export const erasurePreviewSchema: ZodType<ErasurePreview> = z
  .object({
    previewFingerprint: z.string().regex(/^[a-f0-9]{64}$/i),
    lineageProfileCount: nonNegativeIntegerSchema,
    learningRecordCount: nonNegativeIntegerSchema,
    teacherRelationCount: nonNegativeIntegerSchema,
    groupMembershipCount: nonNegativeIntegerSchema,
    courseAudienceCount: nonNegativeIntegerSchema,
    invitationCount: nonNegativeIntegerSchema,
    observerGrantCount: nonNegativeIntegerSchema,
    aiConsentCount: nonNegativeIntegerSchema,
    recoveryDelegateCount: nonNegativeIntegerSchema,
    generatedAt: timestampSchema,
  })
  .strict();

export const safeUnlinkPreviewSchema: ZodType<SafeUnlinkPreview> = z
  .object({
    previewFingerprint: z.string().regex(/^[a-f0-9]{64}$/i),
    canUnlink: z.boolean(),
    blockers: z.array(mergeBlockerSchema).max(100),
    generatedAt: timestampSchema,
  })
  .strict();

const invitationAcceptanceObjectSchema = z
  .object({
    invitation: learnerInvitationSchema,
    mergePreview: learnerMergePreviewSchema.nullable(),
    completed: z.boolean(),
    childAccountLogin: z.string().min(3).max(80).nullable(),
    observerInvitationId: z.uuid().nullable(),
    recoveryDelegateId: z.uuid().nullable().optional(),
    recoveryDelegateActive: z.boolean().optional(),
  })
  .strict();

export const invitationAcceptanceSchema: ZodType<InvitationAcceptance> =
  invitationAcceptanceObjectSchema;

export const childActivationAdminResultSchema = invitationAcceptanceObjectSchema
  .extend({
    provisionalAuthUserConsumed: z.boolean(),
    recoveryDelegateId: z.uuid(),
    recoveryDelegateActive: z.boolean(),
  })
  .strict();

export const learnerMergeConfirmationSchema: ZodType<LearnerMergeConfirmation> =
  z
    .object({
      operationId: z.uuid(),
      targetLearnerProfileId: z.uuid(),
      completed: z.literal(true),
    })
    .strict();

export const recipientBoundInvitationPreviewSchema: ZodType<RecipientBoundInvitationPreview> =
  z
    .object({
      id: z.uuid(),
      kind: z.enum(["connection", "observer"]),
      title: labelSchema,
      inviterLabel: labelSchema,
      relationshipLabel: labelSchema.nullable(),
      status: identityRequestStatusSchema,
      expiresAt: timestampSchema,
      canAccept: z.boolean(),
    })
    .strict();

export const recoverableLearnerCredentialSchema: ZodType<RecoverableLearnerCredential> =
  z
    .object({
      grantId: z.uuid(),
      learnerLabel: labelSchema,
      childAccountLogin: z.string().min(3).max(80).nullable(),
      canReset: z.boolean(),
      grantedAt: timestampSchema,
    })
    .strict();

export const learnerCredentialRecoveryDelegateSchema: ZodType<LearnerCredentialRecoveryDelegate> =
  z
    .object({
      grantId: z.uuid(),
      delegateLabel: labelSchema,
      status: z.enum(["active", "revoked"]),
      grantedAt: timestampSchema,
      revokedAt: nullableTimestampSchema,
    })
    .strict();

export const learnerCredentialRecoveryRevocationSchema: ZodType<LearnerCredentialRecoveryRevocation> =
  z
    .object({
      grantId: z.uuid(),
      status: z.literal("revoked"),
      revokedAt: timestampSchema,
    })
    .strict();

export const learnerCredentialRecoveryOverviewSchema: ZodType<LearnerCredentialRecoveryOverview> =
  z
    .object({
      recoverableLearners: z
        .array(recoverableLearnerCredentialSchema)
        .max(10_000),
      myDelegates: z.array(learnerCredentialRecoveryDelegateSchema).max(10_000),
    })
    .strict();

export const learnerCredentialResetResultSchema: ZodType<LearnerCredentialResetResult> =
  z
    .object({
      grantId: z.uuid(),
      learnerLabel: labelSchema,
      childAccountLogin: z.string().min(3).max(80),
      completed: z.literal(true),
    })
    .strict();

export function cursorPageSchema<T>(
  itemSchema: ZodType<T>,
): ZodType<CursorPage<T>> {
  return z
    .object({
      items: z.array(itemSchema).max(10_000),
      nextCursor: z.string().min(1).max(2_048).nullable(),
    })
    .strict() as ZodType<CursorPage<T>>;
}

export function createdIdentityRequestSchema<T>(
  requestSchema: ZodType<T>,
): ZodType<CreatedIdentityRequest<T>> {
  return z
    .object({
      request: requestSchema,
      copyLink: z.string().url().nullable(),
      delivery: z.enum(["delivery_attempted", "not_applicable"]),
    })
    .strict() as ZodType<CreatedIdentityRequest<T>>;
}
