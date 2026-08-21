import { z, type ZodType } from "zod";
import { getPublicSiteUrl } from "@/lib/server/auth-config";
import type { LearnerIdentityAdminRepository } from "./admin-repository";
import {
  aiConsentActionInputSchema,
  aiConsentRequestInputSchema,
  childActivationInputSchema,
  confirmFingerprintInputSchema,
  connectionRequestInputSchema,
  cursorHistoryQuerySchema,
  learnerInvitationInputSchema,
  learnerCredentialResetInputSchema,
  mergeConfirmInputSchema,
  observerActionInputSchema,
  observerInvitationInputSchema,
  teacherLearnerStatusSchema,
} from "./contracts";
import type { LearnerIdentityRepository } from "./repository";
import { LearnerIdentityRepositoryError } from "./repository";
import {
  digestIdentityEmail,
  digestInvitationToken,
  digestShareCode,
  generateInvitationToken,
  generateShareCode,
} from "./server-secrets";

export type LearnerIdentityActor = {
  authUserId: string;
  supabaseSessionId?: string;
  verifiedEmail: string | null;
};

export class LearnerIdentityApplicationError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "LearnerIdentityApplicationError";
    this.code = code;
    this.status = status;
  }
}

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new LearnerIdentityApplicationError(
    result.error.issues[0]?.message ?? "Проверьте введённые данные.",
    "learner_identity_validation",
    400,
  );
}

const uuidSchema = z.uuid();
const verifiedChildActivationInputSchema = childActivationInputSchema.omit({
  token: true,
});

function mapRepositoryError(error: unknown): never {
  if (error instanceof LearnerIdentityApplicationError) throw error;
  if (error instanceof LearnerIdentityRepositoryError) {
    // A strict output-contract failure is an upstream/server fault. Never
    // misclassify its `_response_invalid` marker as bad browser input.
    if (error.status === 502) {
      throw new LearnerIdentityApplicationError(
        "Сервис учебного профиля временно недоступен.",
        "learner_identity_unavailable",
        503,
      );
    }
    const raw = `${error.databaseCode ?? ""} ${error.message}`;
    if (/session_revoked/i.test(raw)) {
      throw new LearnerIdentityApplicationError(
        "Войдите снова, чтобы продолжить.",
        "learner_identity_reauthentication_required",
        401,
      );
    }
    if (/rate_limit/i.test(raw)) {
      throw new LearnerIdentityApplicationError(
        "Слишком много попыток. Подождите и повторите действие позже.",
        "learner_identity_rate_limited",
        429,
      );
    }
    if (
      /not_found|wrong_recipient|recipient_mismatch|token_invalid/i.test(raw)
    ) {
      throw new LearnerIdentityApplicationError(
        "Запрос недоступен или больше не существует.",
        "learner_identity_not_found",
        404,
      );
    }
    if (/expired/i.test(raw)) {
      throw new LearnerIdentityApplicationError(
        "Срок действия запроса истёк.",
        "learner_identity_expired",
        410,
      );
    }
    if (
      /claimed_to_claimed|merge_blocked|open_run|draft_record|not_empty|not_allowed|subject_unclaimed|scope_invalid|requires_separate_account/i.test(
        raw,
      )
    ) {
      throw new LearnerIdentityApplicationError(
        "Операцию нельзя завершить, пока не устранены указанные ограничения.",
        "learner_identity_merge_blocked",
        409,
      );
    }
    if (/changed|stale|revision|already_consumed|conflict|taken/i.test(raw)) {
      throw new LearnerIdentityApplicationError(
        "Данные уже изменились. Обновите страницу и повторите действие.",
        "learner_identity_changed",
        409,
      );
    }
    if (/learner_recovery_login_unavailable/i.test(raw)) {
      throw new LearnerIdentityApplicationError(
        "Этот логин уже занят. Выберите другой.",
        "learner_recovery_login_unavailable",
        409,
      );
    }
    if (/recovery_acknowledgement_required/i.test(raw)) {
      throw new LearnerIdentityApplicationError(
        "Подтвердите право восстановить логин и PIN учащегося.",
        "learner_activation_recovery_acknowledgement_required",
        409,
      );
    }
    if (/invalid/i.test(raw)) {
      throw new LearnerIdentityApplicationError(
        "Проверьте введённые данные и повторите действие.",
        "learner_identity_validation",
        400,
      );
    }
    if (error.status === 401) {
      throw new LearnerIdentityApplicationError(
        "Войдите снова, чтобы продолжить.",
        "learner_identity_reauthentication_required",
        401,
      );
    }
    if (error.status === 403 || error.status === 404) {
      throw new LearnerIdentityApplicationError(
        "Запрос недоступен или больше не существует.",
        "learner_identity_not_found",
        404,
      );
    }
    if (error.status === 409) {
      throw new LearnerIdentityApplicationError(
        "Данные уже изменились. Обновите страницу и повторите действие.",
        "learner_identity_changed",
        409,
      );
    }
  }
  throw new LearnerIdentityApplicationError(
    "Сервис учебного профиля временно недоступен.",
    "learner_identity_unavailable",
    503,
  );
}

export function createLearnerIdentityService(dependencies: {
  repository: LearnerIdentityRepository;
  adminRepository: LearnerIdentityAdminRepository;
}) {
  const { repository, adminRepository } = dependencies;

  async function operation<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      return mapRepositoryError(error);
    }
  }

  function id(value: string) {
    return parse(uuidSchema, value);
  }

  function recipientEmailDigest(actor: LearnerIdentityActor) {
    if (!actor.verifiedEmail) {
      throw new LearnerIdentityApplicationError(
        "Подтвердите email этого аккаунта и повторите действие.",
        "verified_email_required",
        409,
      );
    }
    return digestIdentityEmail(actor.verifiedEmail);
  }

  async function finishChildActivation(
    result: Awaited<
      ReturnType<LearnerIdentityAdminRepository["activateChildAccount"]>
    >,
    provisional: Awaited<
      ReturnType<
        LearnerIdentityAdminRepository["createProvisionalLearnerAuthUser"]
      >
    >,
  ) {
    const { provisionalAuthUserConsumed, ...acceptance } = result;
    if (typeof provisionalAuthUserConsumed !== "boolean") {
      throw new LearnerIdentityApplicationError(
        "Не удалось подтвердить создание отдельного аккаунта.",
        "learner_activation_result_invalid",
        503,
      );
    }
    if (!provisionalAuthUserConsumed) {
      try {
        await adminRepository.deleteProvisionalLearnerAuthUser(
          provisional.authUserId,
        );
      } catch {
        throw new LearnerIdentityApplicationError(
          "Не удалось завершить очистку отдельного аккаунта.",
          "learner_activation_cleanup_failed",
          503,
        );
      }
    }
    return acceptance;
  }

  function invitationLink(
    invitationId: string,
    token: string,
    kind: "connection" | "profile" | "observer",
  ) {
    const url = new URL(
      `/identity/invitations/${encodeURIComponent(invitationId)}`,
      getPublicSiteUrl(),
    );
    url.hash = new URLSearchParams({ kind, token }).toString();
    return url.toString();
  }

  return {
    resolveTeacherLearnerAlias(
      actor: LearnerIdentityActor,
      learnerProfileId: string,
    ) {
      return operation(() =>
        adminRepository.resolveTeacherLearnerAlias(
          actor.authUserId,
          id(learnerProfileId),
        ),
      );
    },

    listTeacherDirectory(_actor: LearnerIdentityActor, status: unknown) {
      return operation(() =>
        repository.listTeacherDirectory(
          parse(teacherLearnerStatusSchema, status),
        ),
      );
    },

    restoreTeacherLearner(
      _actor: LearnerIdentityActor,
      learnerProfileId: string,
    ) {
      return operation(() =>
        repository.restoreTeacherLearner(id(learnerProfileId)),
      );
    },

    permanentlyDeleteOfflineLearner(
      actor: LearnerIdentityActor,
      learnerProfileId: string,
    ) {
      return operation(async () => {
        const resolved = await adminRepository.resolveTeacherLearnerAlias(
          actor.authUserId,
          id(learnerProfileId),
        );
        return repository.permanentlyDeleteOfflineLearner(resolved);
      });
    },

    listConnections(_actor: LearnerIdentityActor) {
      return operation(() => repository.listConnections());
    },

    async createConnection(actor: LearnerIdentityActor, input: unknown) {
      const parsed = parse(connectionRequestInputSchema, input);
      const token =
        parsed.method === "email" ? generateInvitationToken() : null;
      const request = await operation(() =>
        adminRepository.createConnection(actor.authUserId, {
          method: parsed.method,
          localDisplayName: parsed.localDisplayName,
          codeOrEmailDigest:
            parsed.method === "share_code"
              ? digestShareCode(parsed.shareCode)
              : digestIdentityEmail(parsed.email),
          tokenDigest: token ? digestInvitationToken(token) : null,
          expiresAt: new Date(
            Date.now() +
              (parsed.method === "share_code" ? 48 : 7 * 24) * 60 * 60 * 1_000,
          ).toISOString(),
        }),
      );
      if (parsed.method === "share_code" || !token) {
        return { request, copyLink: null, delivery: "not_applicable" as const };
      }
      await adminRepository.deliverIdentityEmail({
        recipientEmail: parsed.email,
        invitationId: request.id,
        kind: "connection",
      });
      return {
        request,
        copyLink: invitationLink(request.id, token, "connection"),
        delivery: "delivery_attempted" as const,
      };
    },

    actOnConnection(
      _actor: LearnerIdentityActor,
      connectionId: string,
      action: unknown,
    ) {
      const parsedAction = parse(
        z.enum(["accept", "reject", "cancel"]),
        action,
      );
      return operation(() =>
        repository.actOnConnection(id(connectionId), parsedAction),
      );
    },

    previewEmailConnection(
      actor: LearnerIdentityActor,
      connectionId: string,
      rawToken: unknown,
    ) {
      const token = parse(z.string().trim().min(16).max(2_048), rawToken);
      return operation(() => {
        const emailDigest = recipientEmailDigest(actor);
        return adminRepository.previewEmailConnection(
          actor.authUserId,
          id(connectionId),
          digestInvitationToken(token),
          emailDigest,
        );
      });
    },

    previewVerifiedEmailConnection(
      actor: LearnerIdentityActor,
      connectionId: string,
    ) {
      return operation(() =>
        adminRepository.previewVerifiedEmailConnection(
          actor.authUserId,
          id(connectionId),
          recipientEmailDigest(actor),
        ),
      );
    },

    actOnEmailConnection(
      actor: LearnerIdentityActor,
      connectionId: string,
      action: unknown,
      rawToken: unknown,
    ) {
      const parsedAction = parse(z.enum(["accept", "reject"]), action);
      const token = parse(z.string().trim().min(16).max(2_048), rawToken);
      return operation(() => {
        const emailDigest = recipientEmailDigest(actor);
        return adminRepository.actOnEmailConnection(
          actor.authUserId,
          id(connectionId),
          parsedAction,
          digestInvitationToken(token),
          emailDigest,
        );
      });
    },

    actOnVerifiedEmailConnection(
      actor: LearnerIdentityActor,
      connectionId: string,
      action: unknown,
    ) {
      const parsedAction = parse(z.enum(["accept", "reject"]), action);
      return operation(() =>
        adminRepository.actOnVerifiedEmailConnection(
          actor.authUserId,
          id(connectionId),
          parsedAction,
          recipientEmailDigest(actor),
        ),
      );
    },

    listProfileInvitations(
      actor: LearnerIdentityActor,
      learnerProfileId: string,
    ) {
      return operation(async () => {
        const resolved = await adminRepository.resolveTeacherLearnerAlias(
          actor.authUserId,
          id(learnerProfileId),
        );
        return repository.listProfileInvitations(resolved);
      });
    },

    async createProfileInvitation(
      actor: LearnerIdentityActor,
      learnerProfileId: string,
      input: unknown,
    ) {
      const parsed = parse(learnerInvitationInputSchema, input);
      const token = generateInvitationToken();
      const invitation = await operation(async () => {
        const resolved = await adminRepository.resolveTeacherLearnerAlias(
          actor.authUserId,
          id(learnerProfileId),
        );
        return adminRepository.createProfileInvitation(
          actor.authUserId,
          resolved,
          {
            kind: parsed.kind,
            recipientEmailDigest: digestIdentityEmail(parsed.recipientEmail),
            tokenDigest: digestInvitationToken(token),
            expiresAt: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1_000,
            ).toISOString(),
          },
        );
      });
      await adminRepository.deliverIdentityEmail({
        recipientEmail: parsed.recipientEmail,
        invitationId: invitation.id,
        kind: "profile",
      });
      return {
        request: invitation,
        copyLink: invitationLink(invitation.id, token, "profile"),
        delivery: "delivery_attempted" as const,
      };
    },

    revokeProfileInvitation(
      _actor: LearnerIdentityActor,
      invitationId: string,
    ) {
      return operation(() =>
        repository.revokeProfileInvitation(id(invitationId)),
      );
    },

    previewProfileInvitation(
      actor: LearnerIdentityActor,
      invitationId: string,
      rawToken: unknown,
    ) {
      const token = parse(z.string().trim().min(16).max(2_048), rawToken);
      return operation(() => {
        const emailDigest = recipientEmailDigest(actor);
        return adminRepository.previewProfileInvitation(
          actor.authUserId,
          id(invitationId),
          digestInvitationToken(token),
          emailDigest,
        );
      });
    },

    previewVerifiedProfileInvitation(
      actor: LearnerIdentityActor,
      invitationId: string,
    ) {
      return operation(() =>
        adminRepository.previewVerifiedProfileInvitation(
          actor.authUserId,
          id(invitationId),
          recipientEmailDigest(actor),
        ),
      );
    },

    actOnProfileInvitation(
      actor: LearnerIdentityActor,
      invitationId: string,
      raw: unknown,
    ) {
      const input = parse(
        z
          .object({
            token: z.string().trim().min(16).max(2_048),
            action: z.enum(["accept", "reject"]),
          })
          .strict(),
        raw,
      );
      return operation(() => {
        const emailDigest = recipientEmailDigest(actor);
        return adminRepository.actOnProfileInvitation(
          actor.authUserId,
          id(invitationId),
          digestInvitationToken(input.token),
          emailDigest,
          input.action,
        );
      });
    },

    actOnVerifiedProfileInvitation(
      actor: LearnerIdentityActor,
      invitationId: string,
      action: unknown,
    ) {
      const parsedAction = parse(z.enum(["accept", "reject"]), action);
      return operation(() =>
        adminRepository.actOnVerifiedProfileInvitation(
          actor.authUserId,
          id(invitationId),
          recipientEmailDigest(actor),
          parsedAction,
        ),
      );
    },

    async activateChildAccount(
      actor: LearnerIdentityActor,
      invitationIdValue: string,
      raw: unknown,
      options: { recentlyReauthenticated: boolean },
    ) {
      if (!options.recentlyReauthenticated) {
        throw new LearnerIdentityApplicationError(
          "Подтвердите вход ещё раз перед созданием отдельного аккаунта учащегося.",
          "recent_reauthentication_required",
          401,
        );
      }
      const invitationId = id(invitationIdValue);
      const input = parse(childActivationInputSchema, raw);
      const emailDigest = recipientEmailDigest(actor);
      const tokenDigest = digestInvitationToken(input.token);
      const preview = await operation(() =>
        adminRepository.previewProfileInvitation(
          actor.authUserId,
          invitationId,
          tokenDigest,
          emailDigest,
        ),
      );
      if (preview.completed) return preview;
      if (preview.invitation.kind !== "child_activation") {
        throw new LearnerIdentityApplicationError(
          "Это приглашение не предназначено для отдельного аккаунта учащегося.",
          "learner_activation_kind_mismatch",
          409,
        );
      }

      const provisional =
        await adminRepository.createProvisionalLearnerAuthUser(
          invitationId,
          preview.invitation.learnerLabel,
        );
      const activate = () =>
        adminRepository.activateChildAccount(
          actor.authUserId,
          invitationId,
          {
            learnerLogin: input.learnerLogin,
            pin: input.pin,
            acknowledgeRecoveryDelegate: input.acknowledgeRecoveryDelegate,
            requestObserverInvitation: input.requestObserverInvitation,
            tokenDigest,
            recipientEmailDigest: emailDigest,
          },
          provisional,
        );
      try {
        return await finishChildActivation(
          await operation(activate),
          provisional,
        );
      } catch (activationError) {
        // Retry the same deterministic Auth/RPC identity first. When the first
        // response was lost, the terminal fast path reports whether this exact
        // provisional user was consumed, allowing safe orphan cleanup.
        try {
          return await finishChildActivation(
            await operation(activate),
            provisional,
          );
        } catch (retryError) {
          if (
            retryError instanceof LearnerIdentityApplicationError &&
            (retryError.code === "learner_activation_cleanup_failed" ||
              retryError.code === "learner_activation_result_invalid")
          ) {
            throw retryError;
          }
        }
        // Resolve an ambiguous network result before deleting the exact Auth user
        // created in this operation. A completed accept must never be compensated.
        const resolved = await adminRepository
          .previewProfileInvitation(
            actor.authUserId,
            invitationId,
            tokenDigest,
            emailDigest,
          )
          .catch(() => null);
        if (resolved?.completed) return resolved;
        if (resolved) {
          await adminRepository
            .deleteProvisionalLearnerAuthUser(provisional.authUserId)
            .catch(() => null);
        }
        throw activationError;
      }
    },

    async activateVerifiedChildAccount(
      actor: LearnerIdentityActor,
      invitationIdValue: string,
      raw: unknown,
      options: { recentlyReauthenticated: boolean },
    ) {
      if (!options.recentlyReauthenticated) {
        throw new LearnerIdentityApplicationError(
          "Подтвердите вход ещё раз перед созданием отдельного аккаунта учащегося.",
          "recent_reauthentication_required",
          401,
        );
      }
      const invitationId = id(invitationIdValue);
      const input = parse(verifiedChildActivationInputSchema, raw);
      const emailDigest = recipientEmailDigest(actor);
      const preview = await operation(() =>
        adminRepository.previewVerifiedProfileInvitation(
          actor.authUserId,
          invitationId,
          emailDigest,
        ),
      );
      if (preview.completed) return preview;
      if (preview.invitation.kind !== "child_activation") {
        throw new LearnerIdentityApplicationError(
          "Это приглашение не предназначено для отдельного аккаунта учащегося.",
          "learner_activation_kind_mismatch",
          409,
        );
      }

      const provisional =
        await adminRepository.createProvisionalLearnerAuthUser(
          invitationId,
          preview.invitation.learnerLabel,
        );
      const activate = () =>
        adminRepository.activateVerifiedChildAccount(
          actor.authUserId,
          invitationId,
          {
            learnerLogin: input.learnerLogin,
            pin: input.pin,
            acknowledgeRecoveryDelegate: input.acknowledgeRecoveryDelegate,
            requestObserverInvitation: input.requestObserverInvitation,
            recipientEmailDigest: emailDigest,
          },
          provisional,
        );
      try {
        return await finishChildActivation(
          await operation(activate),
          provisional,
        );
      } catch (activationError) {
        try {
          return await finishChildActivation(
            await operation(activate),
            provisional,
          );
        } catch (retryError) {
          if (
            retryError instanceof LearnerIdentityApplicationError &&
            (retryError.code === "learner_activation_cleanup_failed" ||
              retryError.code === "learner_activation_result_invalid")
          ) {
            throw retryError;
          }
        }
        const resolved = await adminRepository
          .previewVerifiedProfileInvitation(
            actor.authUserId,
            invitationId,
            emailDigest,
          )
          .catch(() => null);
        if (resolved?.completed) return resolved;
        if (resolved) {
          await adminRepository
            .deleteProvisionalLearnerAuthUser(provisional.authUserId)
            .catch(() => null);
        }
        throw activationError;
      }
    },

    previewMerge(_actor: LearnerIdentityActor, mergeOperationId: string) {
      return operation(() => repository.previewMerge(id(mergeOperationId)));
    },

    confirmMerge(_actor: LearnerIdentityActor, raw: unknown) {
      return operation(() =>
        repository.confirmMerge(parse(mergeConfirmInputSchema, raw)),
      );
    },

    cancelMerge(_actor: LearnerIdentityActor, operationId: string) {
      return operation(() => repository.cancelMerge(id(operationId)));
    },

    getSelfProfile(_actor: LearnerIdentityActor) {
      return operation(() => repository.getSelfProfile());
    },

    getSelfHistory(_actor: LearnerIdentityActor, raw: unknown) {
      return operation(() =>
        repository.getSelfHistory(parse(cursorHistoryQuerySchema, raw)),
      );
    },

    getSelfProgress(_actor: LearnerIdentityActor) {
      return operation(() => repository.getSelfProgress());
    },

    async rotateShareCode(actor: LearnerIdentityActor) {
      const code = generateShareCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1_000).toISOString();
      const stored = await operation(() =>
        adminRepository.rotateShareCode(
          actor.authUserId,
          digestShareCode(code),
          expiresAt,
        ),
      );
      return { ...stored, code, expiresAt: stored.expiresAt ?? expiresAt };
    },

    previewSafeUnlink(_actor: LearnerIdentityActor) {
      return operation(() => repository.previewSafeUnlink());
    },

    confirmSafeUnlink(
      actor: LearnerIdentityActor,
      raw: unknown,
      options: { recentlyReauthenticated: boolean },
    ) {
      if (!options.recentlyReauthenticated) {
        throw new LearnerIdentityApplicationError(
          "Подтвердите вход ещё раз перед отвязкой профиля.",
          "recent_reauthentication_required",
          401,
        );
      }
      const input = parse(confirmFingerprintInputSchema, raw);
      return operation(() =>
        adminRepository.confirmSafeUnlink(
          actor.authUserId,
          input.previewFingerprint,
        ),
      );
    },

    previewErasure(_actor: LearnerIdentityActor) {
      return operation(() => repository.previewErasure());
    },

    async listCredentialRecovery(actor: LearnerIdentityActor) {
      const [recoverableLearners, myDelegates] = await Promise.all([
        operation(() =>
          adminRepository.listRecoverableCredentials(actor.authUserId),
        ),
        operation(() => repository.listMyRecoveryDelegates()),
      ]);
      return { recoverableLearners, myDelegates };
    },

    resetRecoverableCredentials(
      actor: LearnerIdentityActor,
      grantIdValue: string,
      raw: unknown,
      options: { reauthenticatedAt: string | null },
    ) {
      if (!options.reauthenticatedAt) {
        throw new LearnerIdentityApplicationError(
          "Подтвердите вход ещё раз перед сменой логина и PIN учащегося.",
          "recent_reauthentication_required",
          401,
        );
      }
      const input = parse(learnerCredentialResetInputSchema, raw);
      return operation(() =>
        adminRepository.resetRecoverableCredentials(
          actor.authUserId,
          id(grantIdValue),
          {
            newLogin: input.newLogin,
            pin: input.pin,
            reauthenticatedAt: options.reauthenticatedAt!,
            idempotencyKey: input.idempotencyKey,
          },
        ),
      );
    },

    revokeMyRecoveryDelegate(
      _actor: LearnerIdentityActor,
      grantIdValue: string,
    ) {
      return operation(() =>
        repository.revokeMyRecoveryDelegate(id(grantIdValue)),
      );
    },

    confirmErasure(
      actor: LearnerIdentityActor,
      raw: unknown,
      options: { recentlyReauthenticated: boolean },
    ) {
      if (!options.recentlyReauthenticated) {
        throw new LearnerIdentityApplicationError(
          "Подтвердите вход ещё раз перед удалением учебных данных.",
          "recent_reauthentication_required",
          401,
        );
      }
      const supabaseSessionId = actor.supabaseSessionId;
      if (!supabaseSessionId) {
        throw new LearnerIdentityApplicationError(
          "Войдите снова, чтобы продолжить.",
          "learner_identity_reauthentication_required",
          401,
        );
      }
      const input = parse(confirmFingerprintInputSchema, raw);
      return operation(() =>
        adminRepository.confirmErasure(
          actor.authUserId,
          supabaseSessionId,
          input.previewFingerprint,
        ),
      );
    },

    listObserverOverview(_actor: LearnerIdentityActor) {
      return operation(() => repository.listObserverOverview());
    },

    async createObserverInvitation(actor: LearnerIdentityActor, raw: unknown) {
      const input = parse(observerInvitationInputSchema, raw);
      const token = generateInvitationToken();
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1_000,
      ).toISOString();
      const created = await operation(() =>
        adminRepository.createObserverInvitation(actor.authUserId, {
          relationshipLabel: input.relationshipLabel,
          recipientEmailDigest: digestIdentityEmail(input.recipientEmail),
          tokenDigest: digestInvitationToken(token),
          expiresAt,
        }),
      );
      const overview = created.overview;
      const invitationId = created.createdInvitationId;
      await adminRepository.deliverIdentityEmail({
        recipientEmail: input.recipientEmail,
        invitationId,
        kind: "observer",
      });
      return {
        overview,
        copyLink: invitationLink(invitationId, token, "observer"),
        delivery: "delivery_attempted" as const,
      };
    },

    actOnObserverRelationship(
      _actor: LearnerIdentityActor,
      relationshipIdValue: string,
      raw: unknown,
    ) {
      const relationshipId = id(relationshipIdValue);
      const input = parse(observerActionInputSchema, raw);
      return operation(() =>
        repository.actOnObserverRelationship(relationshipId, input),
      );
    },

    actOnEmailObserverInvitation(
      actor: LearnerIdentityActor,
      relationshipIdValue: string,
      action: unknown,
      rawToken: unknown,
    ) {
      const parsedAction = parse(z.enum(["accept", "reject"]), action);
      const token = parse(z.string().trim().min(16).max(2_048), rawToken);
      return operation(() => {
        const emailDigest = recipientEmailDigest(actor);
        return adminRepository.actOnEmailObserverInvitation(
          actor.authUserId,
          id(relationshipIdValue),
          {
            action: parsedAction,
            tokenDigest: digestInvitationToken(token),
            recipientEmailDigest: emailDigest,
          },
        );
      });
    },

    actOnVerifiedEmailObserverInvitation(
      actor: LearnerIdentityActor,
      relationshipIdValue: string,
      action: unknown,
    ) {
      const parsedAction = parse(z.enum(["accept", "reject"]), action);
      return operation(() =>
        adminRepository.actOnVerifiedEmailObserverInvitation(
          actor.authUserId,
          id(relationshipIdValue),
          {
            action: parsedAction,
            recipientEmailDigest: recipientEmailDigest(actor),
          },
        ),
      );
    },

    previewEmailObserverInvitation(
      actor: LearnerIdentityActor,
      relationshipId: string,
      rawToken: unknown,
    ) {
      const token = parse(z.string().trim().min(16).max(2_048), rawToken);
      return operation(() => {
        const emailDigest = recipientEmailDigest(actor);
        return adminRepository.previewEmailObserverInvitation(
          actor.authUserId,
          id(relationshipId),
          digestInvitationToken(token),
          emailDigest,
        );
      });
    },

    previewVerifiedEmailObserverInvitation(
      actor: LearnerIdentityActor,
      relationshipId: string,
    ) {
      return operation(() =>
        adminRepository.previewVerifiedEmailObserverInvitation(
          actor.authUserId,
          id(relationshipId),
          recipientEmailDigest(actor),
        ),
      );
    },

    listObservedProfiles(_actor: LearnerIdentityActor) {
      return operation(() => repository.listObservedProfiles());
    },

    getObservedHistory(
      _actor: LearnerIdentityActor,
      learnerProfileId: string,
      raw: unknown,
    ) {
      return operation(() =>
        repository.getObservedHistory(
          id(learnerProfileId),
          parse(cursorHistoryQuerySchema, raw),
        ),
      );
    },

    getObservedProgress(
      _actor: LearnerIdentityActor,
      learnerProfileId: string,
    ) {
      return operation(() =>
        repository.getObservedProgress(id(learnerProfileId)),
      );
    },

    requestAiConsent(
      _actor: LearnerIdentityActor,
      courseId: string,
      raw: unknown,
    ) {
      return operation(() =>
        repository.requestAiConsent(
          id(courseId),
          parse(aiConsentRequestInputSchema, raw),
        ),
      );
    },

    listAiConsents(_actor: LearnerIdentityActor) {
      return operation(() => repository.listAiConsents());
    },

    actOnAiConsent(
      _actor: LearnerIdentityActor,
      consentId: string,
      raw: unknown,
    ) {
      return operation(() =>
        repository.actOnAiConsent(
          id(consentId),
          parse(aiConsentActionInputSchema, raw),
        ),
      );
    },
  };
}

export type LearnerIdentityApplicationService = ReturnType<
  typeof createLearnerIdentityService
>;
