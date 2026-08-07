export type TeacherLearnerStatus = "active" | "archived";

export type LearnerIdentityState = "offline" | "pending" | "claimed" | "merged";

export type IdentityRequestStatus =
  | "pending"
  | "bound"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "revoked"
  | "expired";

export type TeacherLearnerDirectoryItem = {
  learnerProfileId: string;
  teacherAccountId: string;
  displayName: string;
  archivedAt: string | null;
  identityState: LearnerIdentityState;
  pendingRequestCount: number;
  canInvite: boolean;
  canPermanentlyDelete: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LearnerConnectionRequest = {
  id: string;
  direction: "incoming" | "outgoing";
  status: IdentityRequestStatus;
  method: "share_code" | "email";
  counterpartyLabel: string;
  localDisplayName: string | null;
  learnerProfileId: string | null;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
};

export type CreatedIdentityRequest<T> = {
  request: T;
  copyLink: string | null;
  delivery: "delivery_attempted" | "not_applicable";
};

export type LearnerInvitationKind = "claim" | "child_activation";

export type LearnerInvitation = {
  id: string;
  kind: LearnerInvitationKind;
  status: IdentityRequestStatus;
  learnerProfileId: string;
  learnerLabel: string;
  inviterLabel: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
};

export type MergeBlocker = {
  code: string;
  message: string;
  count: number | null;
};

export type MergeConflict = {
  occurredOn: string | null;
  resolution: "keep_target_primary" | "keep_source_primary" | "automatic";
};

export type LearnerMergePreview = {
  operationId: string;
  sourceLearnerProfileId: string;
  targetLearnerProfileId: string;
  previewFingerprint: string;
  finalizedRecordCount: number;
  teacherRelationCount: number;
  groupMembershipCount: number;
  courseAudienceCount: number;
  conflicts: MergeConflict[];
  blockers: MergeBlocker[];
  canConfirm: boolean;
  expiresAt: string;
};

export type SharedComment = {
  text: string;
  sharedAt: string;
};

export type LearnerSafeHistoryItem = {
  /** Opaque projection key; never a learning_record UUID. */
  key: string;
  occurredAt: string;
  courseTitle: string;
  lessonTitle: string;
  subject: string | null;
  wasPresent: boolean;
  needsRepeat: boolean | null;
  actualDurationMinutes: number | null;
  comment: SharedComment | null;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type LearnerProgressSubject = {
  subject: string;
  completedRunCount: number;
  attendedRunCount: number;
  repeatRecommendedCount: number;
  knownActualDurationMinutes: number | null;
};

export type LearnerProgress = {
  finalizedRunCount: number;
  attendedRunCount: number;
  repeatRecommendedCount: number;
  knownActualDurationMinutes: number | null;
  knownActualDurationRunCount: number;
  lastActivityAt: string | null;
  subjects: LearnerProgressSubject[];
};

export type ShareCode = {
  code: string;
  expiresAt: string;
  createdAt: string;
};

export type SelfLearningProfile = {
  learnerProfileId: string;
  displayName: string;
  createdAt: string;
  mergedLineageCount: number;
  canSafeUnlink: boolean;
  pendingConnections: LearnerConnectionRequest[];
};

export type ObserverInvitation = {
  id: string;
  direction: "incoming" | "outgoing";
  status: IdentityRequestStatus;
  subjectLabel: string;
  observerLabel: string;
  relationshipLabel: string | null;
  expiresAt: string;
  createdAt: string;
};

export type ObserverGrant = {
  id: string;
  learnerProfileId: string;
  subjectLabel: string;
  observerLabel: string;
  relationshipLabel: string | null;
  direction: "observing" | "observed_by";
  createdAt: string;
};

export type ObserverOverview = {
  grants: ObserverGrant[];
  invitations: ObserverInvitation[];
};

export type AiConsentStatus =
  "pending" | "active" | "revoked" | "expired" | "invalid";

export type LearnerAiConsent = {
  id: string;
  learnerProfileId: string;
  courseId: string;
  courseTitle: string;
  ownerLabel: string;
  purpose: string;
  status: AiConsentStatus;
  revision: number;
  expiresAt: string;
  createdAt: string;
  grantedAt: string | null;
  revokedAt: string | null;
};

export type ErasurePreview = {
  previewFingerprint: string;
  lineageProfileCount: number;
  learningRecordCount: number;
  teacherRelationCount: number;
  groupMembershipCount: number;
  courseAudienceCount: number;
  invitationCount: number;
  observerGrantCount: number;
  aiConsentCount: number;
  recoveryDelegateCount: number;
  generatedAt: string;
};

export type SafeUnlinkPreview = {
  previewFingerprint: string;
  canUnlink: boolean;
  blockers: MergeBlocker[];
  generatedAt: string;
};

export type InvitationAcceptance = {
  invitation: LearnerInvitation;
  mergePreview: LearnerMergePreview | null;
  completed: boolean;
  childAccountLogin: string | null;
  observerInvitationId: string | null;
  recoveryDelegateId?: string | null;
  recoveryDelegateActive?: boolean;
};

export type LearnerMergeConfirmation = {
  operationId: string;
  targetLearnerProfileId: string;
  completed: true;
};

export type RecipientBoundInvitationPreview = {
  id: string;
  kind: "connection" | "observer";
  title: string;
  inviterLabel: string;
  relationshipLabel: string | null;
  status: IdentityRequestStatus;
  expiresAt: string;
  canAccept: boolean;
};

export type RecoverableLearnerCredential = {
  grantId: string;
  learnerLabel: string;
  childAccountLogin: string | null;
  canReset: boolean;
  grantedAt: string;
};

export type LearnerCredentialRecoveryDelegate = {
  grantId: string;
  delegateLabel: string;
  status: "active" | "revoked";
  grantedAt: string;
  revokedAt: string | null;
};

export type LearnerCredentialRecoveryRevocation = {
  grantId: string;
  status: "revoked";
  revokedAt: string;
};

export type LearnerCredentialRecoveryOverview = {
  recoverableLearners: RecoverableLearnerCredential[];
  myDelegates: LearnerCredentialRecoveryDelegate[];
};

export type LearnerCredentialResetResult = {
  grantId: string;
  learnerLabel: string;
  childAccountLogin: string;
  completed: true;
};
