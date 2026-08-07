import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import { z, type ZodType } from "zod";
import type {
  AiConsentActionInput,
  AiConsentRequestInput,
  CursorHistoryQuery,
  MergeConfirmInput,
  ObserverActionInput,
} from "./contracts";
import type {
  CursorPage,
  ErasurePreview,
  LearnerAiConsent,
  LearnerConnectionRequest,
  LearnerCredentialRecoveryDelegate,
  LearnerInvitation,
  LearnerMergeConfirmation,
  LearnerMergePreview,
  LearnerProgress,
  LearnerSafeHistoryItem,
  ObserverGrant,
  ObserverOverview,
  SafeUnlinkPreview,
  SelfLearningProfile,
  TeacherLearnerDirectoryItem,
  TeacherLearnerStatus,
} from "./domain";
import {
  LEARNER_IDENTITY_RPC,
  type LearnerIdentityRpcName,
} from "./rpc-contract";
import {
  cursorPageSchema,
  erasurePreviewSchema,
  learnerAiConsentSchema,
  learnerConnectionRequestSchema,
  learnerCredentialRecoveryDelegateSchema,
  learnerCredentialRecoveryRevocationSchema,
  learnerInvitationSchema,
  learnerMergeConfirmationSchema,
  learnerMergePreviewSchema,
  learnerProgressSchema,
  learnerSafeHistoryItemSchema,
  observerGrantSchema,
  observerOverviewSchema,
  safeUnlinkPreviewSchema,
  selfLearningProfileSchema,
  teacherLearnerDirectoryItemSchema,
} from "./output-contracts";

type JsonObject = Record<string, unknown>;

export class LearnerIdentityRepositoryError extends Error {
  readonly status: number;
  readonly databaseCode: string | null;
  readonly definitelyNotCommitted: boolean;

  constructor(options: {
    message: string;
    status: number;
    databaseCode?: string | null;
    definitelyNotCommitted?: boolean;
  }) {
    super(options.message);
    this.name = "LearnerIdentityRepositoryError";
    this.status = options.status;
    this.databaseCode = options.databaseCode ?? null;
    this.definitelyNotCommitted = options.definitelyNotCommitted ?? false;
  }
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function camelKey(key: string) {
  return key.replace(/_([a-z0-9])/g, (_, character: string) =>
    character.toUpperCase(),
  );
}

/** Postgres functions return snake_case. Keep the mapping deterministic here. */
export function camelizeRpcPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelizeRpcPayload);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      camelKey(key),
      camelizeRpcPayload(nested),
    ]),
  );
}

function unwrapRpcPayload(payload: unknown) {
  const camel = camelizeRpcPayload(payload);
  if (Array.isArray(camel) && camel.length === 1 && isObject(camel[0])) {
    const row = camel[0];
    if ("result" in row) return row.result;
  }
  if (isObject(camel) && "result" in camel) return camel.result;
  return camel;
}

function requireObject(payload: unknown, operation: string): JsonObject {
  const value = unwrapRpcPayload(payload);
  if (!isObject(value)) {
    throw new LearnerIdentityRepositoryError({
      message: `${operation}_response_invalid`,
      status: 502,
    });
  }
  return value;
}

function requireArray(payload: unknown, operation: string): JsonObject[] {
  const value = unwrapRpcPayload(payload);
  const items =
    isObject(value) && Array.isArray(value.items) ? value.items : value;
  if (!Array.isArray(items) || !items.every(isObject)) {
    throw new LearnerIdentityRepositoryError({
      message: `${operation}_response_invalid`,
      status: 502,
    });
  }
  return items;
}

function invalidRpcOutput(operation: string): never {
  throw new LearnerIdentityRepositoryError({
    message: `${operation}_response_invalid`,
    status: 502,
  });
}

function asDomain<T>(
  payload: unknown,
  operation: string,
  schema: ZodType<T>,
): T {
  const result = schema.safeParse(requireObject(payload, operation));
  if (!result.success) invalidRpcOutput(operation);
  return result.data;
}

function asDomainList<T>(
  payload: unknown,
  operation: string,
  schema: ZodType<T>,
): T[] {
  const result = z
    .array(schema)
    .max(10_000)
    .safeParse(requireArray(payload, operation));
  if (!result.success) invalidRpcOutput(operation);
  return result.data;
}

function asCursorPage<T>(
  payload: unknown,
  operation: string,
  itemSchema: ZodType<T>,
): CursorPage<T> {
  const result = cursorPageSchema(itemSchema).safeParse(
    requireObject(payload, operation),
  );
  if (!result.success) invalidRpcOutput(operation);
  return result.data;
}

type RepositoryOptions = {
  fetcher?: typeof fetch;
};

export function createLearnerIdentityRepository(
  accessToken: string,
  options: RepositoryOptions = {},
) {
  const fetcher = options.fetcher ?? fetch;

  async function rpc(
    name: LearnerIdentityRpcName,
    args: JsonObject = {},
  ): Promise<unknown> {
    const { url, anonKey } = getSupabasePublicConfig();
    let response: Response;
    try {
      response = await fetcher(
        `${url.replace(/\/+$/, "")}/rest/v1/rpc/${name}`,
        {
          method: "POST",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(args),
          cache: "no-store",
        },
      );
    } catch {
      throw new LearnerIdentityRepositoryError({
        message: "learner_identity_network_error",
        status: 503,
      });
    }

    const payload = (await response.json().catch(() => null)) as
      { message?: unknown; code?: unknown } | unknown;
    if (!response.ok) {
      const details = isObject(payload) ? payload : {};
      const message =
        typeof details.message === "string"
          ? details.message
          : `learner_identity_rpc_failed_${response.status}`;
      throw new LearnerIdentityRepositoryError({
        message,
        status: response.status,
        databaseCode: typeof details.code === "string" ? details.code : null,
        // A PostgREST error response means its transaction was rolled back.
        definitelyNotCommitted: true,
      });
    }
    return payload;
  }

  return {
    listTeacherDirectory(status: TeacherLearnerStatus) {
      return rpc(LEARNER_IDENTITY_RPC.listTeacherDirectory, {
        p_status: status,
      }).then((payload) =>
        asDomainList<TeacherLearnerDirectoryItem>(
          payload,
          "list_teacher_directory",
          teacherLearnerDirectoryItemSchema,
        ),
      );
    },

    restoreTeacherLearner(learnerProfileId: string) {
      return rpc(LEARNER_IDENTITY_RPC.restoreTeacherLearner, {
        p_learner_profile_id: learnerProfileId,
      }).then((payload) =>
        asDomain<TeacherLearnerDirectoryItem>(
          payload,
          "restore_teacher_learner",
          teacherLearnerDirectoryItemSchema,
        ),
      );
    },

    permanentlyDeleteOfflineLearner(learnerProfileId: string) {
      return rpc(LEARNER_IDENTITY_RPC.permanentlyDeleteOfflineLearner, {
        p_learner_profile_id: learnerProfileId,
      }).then(() => undefined);
    },

    listConnections() {
      return rpc(LEARNER_IDENTITY_RPC.listConnections).then((payload) =>
        asDomainList<LearnerConnectionRequest>(
          payload,
          "list_connections",
          learnerConnectionRequestSchema,
        ),
      );
    },

    actOnConnection(
      connectionId: string,
      action: "accept" | "reject" | "cancel",
    ) {
      return rpc(LEARNER_IDENTITY_RPC.actOnConnection, {
        p_connection_request_id: connectionId,
        p_action: action,
      }).then((payload) =>
        asDomain<LearnerConnectionRequest>(
          payload,
          "act_on_connection",
          learnerConnectionRequestSchema,
        ),
      );
    },

    listProfileInvitations(learnerProfileId: string) {
      return rpc(LEARNER_IDENTITY_RPC.listProfileInvitations, {
        p_learner_profile_id: learnerProfileId,
      }).then((payload) =>
        asDomainList<LearnerInvitation>(
          payload,
          "list_profile_invitations",
          learnerInvitationSchema,
        ),
      );
    },

    revokeProfileInvitation(invitationId: string) {
      return rpc(LEARNER_IDENTITY_RPC.revokeProfileInvitation, {
        p_invitation_id: invitationId,
      }).then((payload) =>
        asDomain<LearnerInvitation>(
          payload,
          "revoke_profile_invitation",
          learnerInvitationSchema,
        ),
      );
    },

    previewMerge(mergeOperationId: string) {
      return rpc(LEARNER_IDENTITY_RPC.previewMerge, {
        p_merge_operation_id: mergeOperationId,
      }).then((payload) =>
        asDomain<LearnerMergePreview>(
          payload,
          "preview_merge",
          learnerMergePreviewSchema,
        ),
      );
    },

    confirmMerge(input: MergeConfirmInput) {
      return rpc(LEARNER_IDENTITY_RPC.confirmMerge, {
        p_merge_operation_id: input.mergeOperationId,
        p_preview_fingerprint: input.previewFingerprint,
      }).then((payload) =>
        asDomain<LearnerMergeConfirmation>(
          payload,
          "confirm_merge",
          learnerMergeConfirmationSchema,
        ),
      );
    },

    cancelMerge(operationId: string) {
      return rpc(LEARNER_IDENTITY_RPC.cancelMerge, {
        p_merge_operation_id: operationId,
      }).then(() => undefined);
    },

    getSelfProfile() {
      return rpc(LEARNER_IDENTITY_RPC.getSelfProfile).then((payload) =>
        asDomain<SelfLearningProfile>(
          payload,
          "get_self_profile",
          selfLearningProfileSchema,
        ),
      );
    },

    getSelfHistory(query: CursorHistoryQuery) {
      return rpc(LEARNER_IDENTITY_RPC.getSelfHistory, {
        p_cursor: query.cursor,
        p_limit: query.limit,
      }).then((payload) =>
        asCursorPage<LearnerSafeHistoryItem>(
          payload,
          "get_self_history",
          learnerSafeHistoryItemSchema,
        ),
      );
    },

    getSelfProgress() {
      return rpc(LEARNER_IDENTITY_RPC.getSelfProgress).then((payload) =>
        asDomain<LearnerProgress>(
          payload,
          "get_self_progress",
          learnerProgressSchema,
        ),
      );
    },

    previewSafeUnlink() {
      return rpc(LEARNER_IDENTITY_RPC.previewSafeUnlink).then((payload) =>
        asDomain<SafeUnlinkPreview>(
          payload,
          "preview_safe_unlink",
          safeUnlinkPreviewSchema,
        ),
      );
    },

    previewErasure() {
      return rpc(LEARNER_IDENTITY_RPC.previewErasure).then((payload) =>
        asDomain<ErasurePreview>(
          payload,
          "preview_erasure",
          erasurePreviewSchema,
        ),
      );
    },

    listMyRecoveryDelegates() {
      return rpc(LEARNER_IDENTITY_RPC.listMyRecoveryDelegates).then((payload) =>
        asDomainList<LearnerCredentialRecoveryDelegate>(
          payload,
          "list_my_recovery_delegates",
          learnerCredentialRecoveryDelegateSchema,
        ),
      );
    },

    revokeMyRecoveryDelegate(grantId: string) {
      return rpc(LEARNER_IDENTITY_RPC.revokeMyRecoveryDelegate, {
        p_grant_id: grantId,
      }).then((payload) =>
        asDomain(
          payload,
          "revoke_my_recovery_delegate",
          learnerCredentialRecoveryRevocationSchema,
        ),
      );
    },

    listObserverOverview() {
      return rpc(LEARNER_IDENTITY_RPC.listObserverOverview).then((payload) =>
        asDomain<ObserverOverview>(
          payload,
          "list_observer_overview",
          observerOverviewSchema,
        ),
      );
    },

    actOnObserverRelationship(
      relationshipId: string,
      input: ObserverActionInput,
    ) {
      return rpc(LEARNER_IDENTITY_RPC.actOnObserverRelationship, {
        p_relationship_id: relationshipId,
        p_action: input.action,
        p_relationship_label:
          input.action === "rename" ? input.relationshipLabel : null,
      }).then((payload) =>
        asDomain<ObserverOverview>(
          payload,
          "act_on_observer_relationship",
          observerOverviewSchema,
        ),
      );
    },

    listObservedProfiles() {
      return rpc(LEARNER_IDENTITY_RPC.listObservedProfiles).then((payload) =>
        asDomainList<ObserverGrant>(
          payload,
          "list_observed_profiles",
          observerGrantSchema,
        ),
      );
    },

    getObservedHistory(learnerProfileId: string, query: CursorHistoryQuery) {
      return rpc(LEARNER_IDENTITY_RPC.getObservedHistory, {
        p_learner_profile_id: learnerProfileId,
        p_cursor: query.cursor,
        p_limit: query.limit,
      }).then((payload) =>
        asCursorPage<LearnerSafeHistoryItem>(
          payload,
          "get_observed_history",
          learnerSafeHistoryItemSchema,
        ),
      );
    },

    getObservedProgress(learnerProfileId: string) {
      return rpc(LEARNER_IDENTITY_RPC.getObservedProgress, {
        p_learner_profile_id: learnerProfileId,
      }).then((payload) =>
        asDomain<LearnerProgress>(
          payload,
          "get_observed_progress",
          learnerProgressSchema,
        ),
      );
    },

    requestAiConsent(courseId: string, input: AiConsentRequestInput) {
      return rpc(LEARNER_IDENTITY_RPC.requestAiConsent, {
        p_course_id: courseId,
        p_learner_profile_id: input.learnerProfileId,
        p_purpose: input.purpose,
        p_expires_in_days: input.expiresInDays,
      }).then((payload) =>
        asDomain<LearnerAiConsent>(
          payload,
          "request_ai_consent",
          learnerAiConsentSchema,
        ),
      );
    },

    listAiConsents() {
      return rpc(LEARNER_IDENTITY_RPC.listAiConsents).then((payload) =>
        asDomainList<LearnerAiConsent>(
          payload,
          "list_ai_consents",
          learnerAiConsentSchema,
        ),
      );
    },

    actOnAiConsent(consentId: string, input: AiConsentActionInput) {
      return rpc(LEARNER_IDENTITY_RPC.actOnAiConsent, {
        p_consent_id: consentId,
        p_action: input.action,
        p_expected_revision: input.expectedRevision,
        p_expires_in_days: input.expiresInDays ?? null,
      }).then((payload) =>
        asDomain<LearnerAiConsent>(
          payload,
          "act_on_ai_consent",
          learnerAiConsentSchema,
        ),
      );
    },
  };
}

export type LearnerIdentityRepository = ReturnType<
  typeof createLearnerIdentityRepository
>;
