import {
  getPublicSiteUrl,
  getSupabasePublicConfig,
} from "@/lib/server/auth-config";
import { z, type ZodType } from "zod";
import type { ChildActivationInput } from "./contracts";
import type { InvitationAcceptance } from "./domain";
import {
  camelizeRpcPayload,
  LearnerIdentityRepositoryError,
} from "./repository";
import {
  LEARNER_IDENTITY_ADMIN_RPC,
  LEARNER_IDENTITY_RPC,
} from "./rpc-contract";
import {
  childActivationAdminResultSchema,
  createdObserverInvitationAdminResultSchema,
  invitationAcceptanceSchema,
  learnerConnectionRequestSchema,
  learnerCredentialResetResultSchema,
  learnerInvitationSchema,
  observerOverviewSchema,
  recipientBoundInvitationPreviewSchema,
  recoverableLearnerCredentialSchema,
  selfLearningProfileSchema,
  shareCodeMetadataSchema,
} from "./output-contracts";
import {
  deriveProvisionalAuthEmail,
  deriveProvisionalAuthPassword,
} from "./server-secrets";

export type ProvisionalLearnerAuthUser = {
  authUserId: string;
  internalAuthEmail: string;
};

export type ChildActivationAdminResult = InvitationAcceptance & {
  provisionalAuthUserConsumed?: boolean;
};

type AuthUserPayload = {
  id?: unknown;
  email?: unknown;
  app_metadata?: unknown;
};

function provisionalAuthUserFromPayload(
  payload: unknown,
  invitationId: string,
  internalAuthEmail: string,
): ProvisionalLearnerAuthUser | null {
  if (!payload || typeof payload !== "object") return null;
  const envelope = payload as { user?: unknown };
  const rawUser =
    envelope.user && typeof envelope.user === "object"
      ? (envelope.user as AuthUserPayload)
      : (payload as AuthUserPayload);
  const metadata =
    rawUser.app_metadata && typeof rawUser.app_metadata === "object"
      ? (rawUser.app_metadata as Record<string, unknown>)
      : null;
  if (
    typeof rawUser.id !== "string" ||
    rawUser.email !== internalAuthEmail ||
    metadata?.identity_status !== "provisional" ||
    metadata.activation_invitation_id !== invitationId
  ) {
    return null;
  }
  return { authUserId: rawUser.id, internalAuthEmail };
}

type AdminOptions = { fetcher?: typeof fetch };

function requireServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Supabase service-role auth is not configured.");
  return key;
}

export function createLearnerIdentityAdminRepository(
  options: AdminOptions = {},
) {
  const fetcher = options.fetcher ?? fetch;

  function config() {
    const { url } = getSupabasePublicConfig();
    return {
      url: url.replace(/\/+$/, ""),
      serviceRoleKey: requireServiceRoleKey(),
    };
  }

  async function adminRpc<T>(
    functionName: string,
    args: Record<string, unknown>,
    schema: ZodType<T>,
  ): Promise<T> {
    const { url, serviceRoleKey } = config();
    let response: Response;
    try {
      response = await fetcher(`${url}/rest/v1/rpc/${functionName}`, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
        cache: "no-store",
      });
    } catch {
      throw new LearnerIdentityRepositoryError({
        message: "learner_identity_network_error",
        status: 503,
      });
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        payload &&
        typeof payload === "object" &&
        "message" in payload &&
        typeof payload.message === "string"
          ? payload.message
          : `identity_admin_rpc_failed_${response.status}`;
      throw new LearnerIdentityRepositoryError({
        message,
        status: response.status,
        databaseCode:
          payload &&
          typeof payload === "object" &&
          "code" in payload &&
          typeof payload.code === "string"
            ? payload.code
            : null,
        definitelyNotCommitted: true,
      });
    }
    const camel = camelizeRpcPayload(payload);
    const candidates: unknown[] = [camel];
    if (Array.isArray(camel) && camel.length === 1) {
      candidates.push(camel[0]);
      if (
        camel[0] &&
        typeof camel[0] === "object" &&
        !Array.isArray(camel[0]) &&
        "result" in camel[0]
      ) {
        candidates.push((camel[0] as Record<string, unknown>).result);
      }
    }
    if (
      camel &&
      typeof camel === "object" &&
      !Array.isArray(camel) &&
      "result" in camel
    ) {
      candidates.push((camel as Record<string, unknown>).result);
    }
    for (const candidate of candidates) {
      const parsed = schema.safeParse(candidate);
      if (parsed.success) return parsed.data;
    }
    throw new LearnerIdentityRepositoryError({
      message: `${functionName}_response_invalid`,
      status: 502,
    });
  }

  return {
    resolveTeacherLearnerAlias(
      actorAuthUserId: string,
      learnerProfileId: string,
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.resolveTeacherLearnerAlias,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_learner_profile_id: learnerProfileId,
        },
        z.uuid(),
      );
    },

    createProfileInvitation(
      actorAuthUserId: string,
      learnerProfileId: string,
      input: {
        kind: "claim" | "child_activation";
        recipientEmailDigest: string;
        tokenDigest: string;
        expiresAt: string;
      },
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.createProfileInvitation,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_learner_profile_id: learnerProfileId,
          p_kind: input.kind,
          p_recipient_email_digest: input.recipientEmailDigest,
          p_token_digest: input.tokenDigest,
          p_expires_at: input.expiresAt,
        },
        learnerInvitationSchema,
      );
    },

    async createProvisionalLearnerAuthUser(
      invitationId: string,
      displayName: string,
    ): Promise<ProvisionalLearnerAuthUser> {
      const { url, serviceRoleKey } = config();
      const internalAuthEmail = deriveProvisionalAuthEmail(invitationId);
      const requestBody = JSON.stringify({
        email: internalAuthEmail,
        password: deriveProvisionalAuthPassword(invitationId),
        email_confirm: true,
        app_metadata: {
          identity_status: "provisional",
          activation_invitation_id: invitationId,
        },
        user_metadata: { full_name: displayName },
      });
      const headers = {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      };

      async function createOnce() {
        try {
          const response = await fetcher(`${url}/auth/v1/admin/users`, {
            method: "POST",
            headers,
            body: requestBody,
            cache: "no-store",
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok) return { kind: "rejected" as const };
          const provisional = provisionalAuthUserFromPayload(
            payload,
            invitationId,
            internalAuthEmail,
          );
          if (!provisional) {
            throw new Error("Provisional Auth response failed validation.");
          }
          return { kind: "created" as const, provisional };
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "Provisional Auth response failed validation."
          ) {
            throw error;
          }
          return { kind: "ambiguous" as const };
        }
      }

      async function recoverExisting() {
        const response = await fetcher(`${url}/auth/v1/admin/generate_link`, {
          method: "POST",
          headers,
          body: JSON.stringify({ type: "magiclink", email: internalAuthEmail }),
          cache: "no-store",
        }).catch(() => null);
        if (!response?.ok) return null;
        const payload = await response.json().catch(() => null);
        const provisional = provisionalAuthUserFromPayload(
          payload,
          invitationId,
          internalAuthEmail,
        );
        if (!provisional) {
          throw new Error("Recovered provisional Auth user failed validation.");
        }
        return provisional;
      }

      const first = await createOnce();
      if (first.kind === "created") return first.provisional;

      // A lost response may still have committed inside GoTrue. Retry the exact
      // deterministic create once; a uniqueness response is then resolved to
      // the already-created, invitation-marked user.
      if (first.kind === "ambiguous") {
        const retry = await createOnce();
        if (retry.kind === "created") return retry.provisional;
      }

      const recovered = await recoverExisting();
      if (recovered) return recovered;
      throw new Error("Не удалось подготовить отдельный аккаунт учащегося.");
    },

    async deleteProvisionalLearnerAuthUser(authUserId: string) {
      const { url, serviceRoleKey } = config();
      const response = await fetcher(
        `${url}/auth/v1/admin/users/${encodeURIComponent(authUserId)}`,
        {
          method: "DELETE",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          cache: "no-store",
        },
      );
      if (!response.ok && response.status !== 404) {
        throw new Error("Не удалось удалить незавершённый временный аккаунт.");
      }
    },

    previewProfileInvitation(
      actorAuthUserId: string,
      invitationId: string,
      tokenDigest: string,
      recipientEmailDigest: string,
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.previewProfileInvitation,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_invitation_id: invitationId,
          p_token_digest: tokenDigest,
          p_recipient_email_digest: recipientEmailDigest,
        },
        invitationAcceptanceSchema,
      );
    },

    previewVerifiedProfileInvitation(
      actorAuthUserId: string,
      invitationId: string,
      recipientEmailDigest: string,
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.previewVerifiedProfileInvitation,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_invitation_id: invitationId,
          p_recipient_email_digest: recipientEmailDigest,
        },
        invitationAcceptanceSchema,
      );
    },

    actOnProfileInvitation(
      actorAuthUserId: string,
      invitationId: string,
      tokenDigest: string,
      recipientEmailDigest: string,
      action: "accept" | "reject",
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.actOnProfileInvitation,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_invitation_id: invitationId,
          p_token_digest: tokenDigest,
          p_recipient_email_digest: recipientEmailDigest,
          p_action: action,
        },
        invitationAcceptanceSchema,
      );
    },

    actOnVerifiedProfileInvitation(
      actorAuthUserId: string,
      invitationId: string,
      recipientEmailDigest: string,
      action: "accept" | "reject",
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.actOnVerifiedProfileInvitation,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_invitation_id: invitationId,
          p_recipient_email_digest: recipientEmailDigest,
          p_action: action,
        },
        invitationAcceptanceSchema,
      );
    },

    activateChildAccount(
      actorAuthUserId: string,
      invitationId: string,
      input: Omit<ChildActivationInput, "token"> & {
        tokenDigest: string;
        recipientEmailDigest: string;
      },
      provisional: ProvisionalLearnerAuthUser,
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.activateChildAccount,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_invitation_id: invitationId,
          p_token_digest: input.tokenDigest,
          p_recipient_email_digest: input.recipientEmailDigest,
          p_learner_login: input.learnerLogin,
          p_raw_pin: input.pin,
          p_provisional_auth_user_id: provisional.authUserId,
          p_acknowledge_recovery_delegate: input.acknowledgeRecoveryDelegate,
          p_request_observer_invitation: input.requestObserverInvitation,
        },
        childActivationAdminResultSchema,
      );
    },

    activateVerifiedChildAccount(
      actorAuthUserId: string,
      invitationId: string,
      input: Omit<ChildActivationInput, "token"> & {
        recipientEmailDigest: string;
      },
      provisional: ProvisionalLearnerAuthUser,
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.activateVerifiedChildAccount,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_invitation_id: invitationId,
          p_recipient_email_digest: input.recipientEmailDigest,
          p_child_login: input.learnerLogin,
          p_raw_pin: input.pin,
          p_provisional_auth_user_id: provisional.authUserId,
          p_acknowledge_recovery_delegate: input.acknowledgeRecoveryDelegate,
          p_request_observer_invitation: input.requestObserverInvitation,
        },
        childActivationAdminResultSchema,
      );
    },

    actOnEmailObserverInvitation(
      actorAuthUserId: string,
      relationshipId: string,
      input: {
        action: "accept" | "reject";
        tokenDigest: string;
        recipientEmailDigest: string;
        relationshipLabel?: string;
      },
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.actOnEmailObserverInvitation,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_invitation_id: relationshipId,
          p_action: input.action,
          p_token_digest: input.tokenDigest,
          p_recipient_email_digest: input.recipientEmailDigest,
          p_relationship_label: input.relationshipLabel ?? null,
        },
        observerOverviewSchema,
      );
    },

    actOnVerifiedEmailObserverInvitation(
      actorAuthUserId: string,
      relationshipId: string,
      input: {
        action: "accept" | "reject";
        recipientEmailDigest: string;
        relationshipLabel?: string;
      },
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.actOnVerifiedEmailObserverInvitation,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_invitation_id: relationshipId,
          p_action: input.action,
          p_recipient_email_digest: input.recipientEmailDigest,
          p_relationship_label: input.relationshipLabel ?? null,
        },
        observerOverviewSchema,
      );
    },

    confirmErasure(
      actorAuthUserId: string,
      supabaseSessionId: string,
      previewFingerprint: string,
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.confirmErasure,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_session_id: supabaseSessionId,
          p_preview_fingerprint: previewFingerprint,
        },
        selfLearningProfileSchema,
      );
    },

    confirmSafeUnlink(actorAuthUserId: string, previewFingerprint: string) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.confirmSafeUnlink,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_preview_fingerprint: previewFingerprint,
        },
        selfLearningProfileSchema,
      );
    },

    createConnection(
      actorAuthUserId: string,
      input: {
        method: "share_code" | "email";
        localDisplayName: string;
        codeOrEmailDigest: string;
        tokenDigest: string | null;
        expiresAt: string;
      },
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.createConnection,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_method: input.method,
          p_code_or_email_digest: input.codeOrEmailDigest,
          p_token_digest: input.tokenDigest,
          p_target_learner_profile_id: null,
          p_local_display_name: input.localDisplayName,
          p_expires_at: input.expiresAt,
        },
        learnerConnectionRequestSchema,
      );
    },

    actOnEmailConnection(
      actorAuthUserId: string,
      connectionRequestId: string,
      action: "accept" | "reject",
      tokenDigest: string,
      recipientEmailDigest: string,
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.actOnEmailConnection,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_connection_request_id: connectionRequestId,
          p_action: action,
          p_token_digest: tokenDigest,
          p_recipient_email_digest: recipientEmailDigest,
        },
        recipientBoundInvitationPreviewSchema,
      );
    },

    actOnVerifiedEmailConnection(
      actorAuthUserId: string,
      connectionRequestId: string,
      action: "accept" | "reject",
      recipientEmailDigest: string,
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.actOnVerifiedEmailConnection,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_request_id: connectionRequestId,
          p_action: action,
          p_recipient_email_digest: recipientEmailDigest,
        },
        recipientBoundInvitationPreviewSchema,
      );
    },

    previewEmailConnection(
      actorAuthUserId: string,
      connectionRequestId: string,
      tokenDigest: string,
      recipientEmailDigest: string,
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.previewEmailConnection,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_connection_request_id: connectionRequestId,
          p_token_digest: tokenDigest,
          p_recipient_email_digest: recipientEmailDigest,
        },
        recipientBoundInvitationPreviewSchema,
      );
    },

    previewVerifiedEmailConnection(
      actorAuthUserId: string,
      connectionRequestId: string,
      recipientEmailDigest: string,
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.previewVerifiedEmailConnection,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_request_id: connectionRequestId,
          p_recipient_email_digest: recipientEmailDigest,
        },
        recipientBoundInvitationPreviewSchema,
      );
    },

    previewEmailObserverInvitation(
      actorAuthUserId: string,
      relationshipId: string,
      tokenDigest: string,
      recipientEmailDigest: string,
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.previewEmailObserverInvitation,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_invitation_id: relationshipId,
          p_token_digest: tokenDigest,
          p_recipient_email_digest: recipientEmailDigest,
        },
        recipientBoundInvitationPreviewSchema,
      );
    },

    previewVerifiedEmailObserverInvitation(
      actorAuthUserId: string,
      relationshipId: string,
      recipientEmailDigest: string,
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.previewVerifiedEmailObserverInvitation,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_invitation_id: relationshipId,
          p_recipient_email_digest: recipientEmailDigest,
        },
        recipientBoundInvitationPreviewSchema,
      );
    },

    listRecoverableCredentials(actorAuthUserId: string) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.listRecoverableCredentials,
        { p_actor_auth_user_id: actorAuthUserId },
        z.array(recoverableLearnerCredentialSchema).max(10_000),
      );
    },

    resetRecoverableCredentials(
      actorAuthUserId: string,
      grantId: string,
      input: {
        newLogin: string;
        pin: string;
        reauthenticatedAt: string;
        idempotencyKey: string;
      },
    ) {
      return adminRpc(
        LEARNER_IDENTITY_ADMIN_RPC.resetRecoverableCredentials,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_grant_id: grantId,
          p_new_child_login: input.newLogin,
          p_raw_pin: input.pin,
          p_reauthenticated_at: input.reauthenticatedAt,
          p_idempotency_key: input.idempotencyKey,
        },
        learnerCredentialResetResultSchema,
      );
    },

    rotateShareCode(
      actorAuthUserId: string,
      codeDigest: string,
      expiresAt: string,
    ) {
      return adminRpc(
        LEARNER_IDENTITY_RPC.rotateShareCode,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_code_digest: codeDigest,
          p_expires_at: expiresAt,
        },
        shareCodeMetadataSchema,
      );
    },

    createObserverInvitation(
      actorAuthUserId: string,
      input: {
        relationshipLabel: string;
        recipientEmailDigest: string;
        tokenDigest: string;
        expiresAt: string;
      },
    ) {
      return adminRpc(
        LEARNER_IDENTITY_RPC.createObserverInvitation,
        {
          p_actor_auth_user_id: actorAuthUserId,
          p_recipient_email_digest: input.recipientEmailDigest,
          p_token_digest: input.tokenDigest,
          p_relationship_label: input.relationshipLabel || null,
          p_expires_at: input.expiresAt,
        },
        createdObserverInvitationAdminResultSchema,
      );
    },

    async deliverIdentityEmail(input: {
      recipientEmail: string;
      invitationId: string;
      kind: "connection" | "profile" | "observer";
    }) {
      const { url, anonKey } = getSupabasePublicConfig();
      const identityPath = `/identity/invitations/${encodeURIComponent(input.invitationId)}`;
      const redirect = new URL("/auth/confirm", getPublicSiteUrl());
      redirect.searchParams.set("next", identityPath);
      redirect.searchParams.set("identity_invitation", input.invitationId);
      redirect.searchParams.set("identity_kind", input.kind);
      const endpoint = new URL(`${url.replace(/\/+$/, "")}/auth/v1/otp`);
      endpoint.searchParams.set("redirect_to", redirect.toString());

      const response = await fetcher(endpoint, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: input.recipientEmail,
          data: { identity_invitation: true },
          create_user: true,
        }),
        cache: "no-store",
      }).catch(() => null);
      return Boolean(response?.ok);
    },
  };
}

export type LearnerIdentityAdminRepository = ReturnType<
  typeof createLearnerIdentityAdminRepository
>;
