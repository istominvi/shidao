import "server-only";

import type { ZodType } from "zod";
import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import {
  choiceQuizTeacherHistorySchema,
  correctChoiceQuizEvaluationResultSchema,
  issuedChoiceQuizProjectionSchema,
  submitChoiceQuizAttemptResultSchema,
  type ChoiceQuizTeacherHistory,
  type CorrectChoiceQuizEvaluationInput,
  type CorrectChoiceQuizEvaluationResult,
  type IssuedChoiceQuizProjection,
  type SubmitChoiceQuizAttemptInput,
  type SubmitChoiceQuizAttemptResult,
} from "./contracts";
import type { ChoiceQuizLearnerActor, ChoiceQuizTeacherActor } from "./domain";
import { ChoiceQuizRepositoryError } from "./errors";

export const CHOICE_QUIZ_RPC = {
  issueDefinition: "issue_choice_quiz_definition_admin",
  submitAttempt: "submit_choice_quiz_attempt_admin",
  getTeacherHistory: "list_choice_quiz_run_history_admin",
  correctEvaluation: "correct_choice_quiz_evaluation_admin",
} as const;

type RepositoryOptions = { fetcher?: typeof fetch };

export type IssueChoiceQuizDefinitionRepositoryInput = {
  actor: ChoiceQuizLearnerActor;
  lessonRunId: string;
  cursorRevision: number;
  componentId: string;
  expectedComponentUpdatedAt: string;
  learnerDefinition: Record<string, unknown>;
  evaluatorConfig: Record<string, unknown>;
};

export interface ChoiceQuizLearnerRepository {
  issueDefinition(
    input: IssueChoiceQuizDefinitionRepositoryInput,
  ): Promise<IssuedChoiceQuizProjection>;
  submitAttempt(
    actor: ChoiceQuizLearnerActor,
    lessonRunId: string,
    issueRef: string,
    input: SubmitChoiceQuizAttemptInput,
  ): Promise<SubmitChoiceQuizAttemptResult>;
}

export interface ChoiceQuizTeacherRepository {
  getHistory(lessonRunId: string): Promise<ChoiceQuizTeacherHistory>;
  correctEvaluation(
    evaluationId: string,
    input: CorrectChoiceQuizEvaluationInput,
  ): Promise<CorrectChoiceQuizEvaluationResult>;
}

type PostgrestErrorPayload = {
  code?: unknown;
  message?: unknown;
  error?: unknown;
};

function errorToken(payload: PostgrestErrorPayload | null) {
  if (typeof payload?.message === "string") return payload.message;
  if (typeof payload?.error === "string") return payload.error;
  return "choice_quiz_rpc_failed";
}

function repositoryFailure(status: number, payload: unknown) {
  const details =
    payload && typeof payload === "object"
      ? (payload as PostgrestErrorPayload)
      : null;
  const token = errorToken(details).toLowerCase();
  const databaseCode = typeof details?.code === "string" ? details.code : null;

  if (status === 408 || status === 425 || status === 429) {
    return new ChoiceQuizRepositoryError(
      "Choice quiz storage is temporarily unavailable.",
      503,
      "choice_quiz_repository_error",
    );
  }

  if (
    token.includes("choice_quiz_session_revoked") ||
    token.includes("live_delivery_session_revoked")
  ) {
    return new ChoiceQuizRepositoryError(
      "Learner session is no longer valid.",
      401,
      "choice_quiz_session_revoked",
    );
  }

  if (/choice_quiz_(?:\w+_)?idempotency_conflict/.test(token)) {
    return new ChoiceQuizRepositoryError(
      "The idempotency key was already used for another response.",
      409,
      "choice_quiz_idempotency_conflict",
    );
  }

  if (
    /choice_quiz_(?:cursor|definition|source|state|issue|attempt|evaluation|correction).*?(?:stale|changed|conflict|limit|superseded|not_allowed)|choice_quiz_(?:attempt_limit|already_superseded)/.test(
      token,
    ) ||
    databaseCode === "40001"
  ) {
    return new ChoiceQuizRepositoryError(
      "Choice quiz state changed before the operation completed.",
      409,
      "choice_quiz_state_conflict",
    );
  }

  if (
    /choice_quiz_(?:not_found|access_denied)|lesson_run_live_not_found|(?:course|lesson_run|component|evaluation)_not_found|owner_mismatch/.test(
      token,
    ) ||
    databaseCode === "P0002"
  ) {
    return new ChoiceQuizRepositoryError(
      "Choice quiz is unavailable.",
      404,
      "choice_quiz_not_found",
    );
  }

  if (
    /choice_quiz_(?:input|response|selection|role|definition|correction).*?(?:invalid|unsupported|required)|invalid.*choice_quiz|requires/.test(
      token,
    ) ||
    databaseCode === "22023"
  ) {
    return new ChoiceQuizRepositoryError(
      "Choice quiz input was rejected.",
      400,
      "choice_quiz_validation_error",
    );
  }

  if (status === 401) {
    return new ChoiceQuizRepositoryError(
      "Choice quiz session requires reauthentication.",
      401,
      "choice_quiz_session_revoked",
    );
  }
  if (status === 403 || status === 404) {
    return new ChoiceQuizRepositoryError(
      "Choice quiz is unavailable.",
      404,
      "choice_quiz_not_found",
    );
  }

  return new ChoiceQuizRepositoryError(
    "Choice quiz storage is unavailable.",
    status >= 500 ? 503 : 400,
    status >= 500
      ? "choice_quiz_repository_error"
      : "choice_quiz_validation_error",
  );
}

function unwrapRpcPayload(payload: unknown) {
  if (Array.isArray(payload)) {
    if (payload.length !== 1) return payload;
    const first = payload[0];
    if (
      first &&
      typeof first === "object" &&
      !Array.isArray(first) &&
      "result" in first
    ) {
      return (first as { result: unknown }).result;
    }
    return first;
  }
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "result" in payload
  ) {
    return (payload as { result: unknown }).result;
  }
  return payload;
}

function parseRpcResult<T>(
  functionName: string,
  schema: ZodType<T>,
  payload: unknown,
) {
  const parsed = schema.safeParse(unwrapRpcPayload(payload));
  if (parsed.success) return parsed.data;
  throw new ChoiceQuizRepositoryError(
    `${functionName} returned an invalid projection.`,
    502,
    "choice_quiz_response_invalid",
  );
}

async function postRpc(input: {
  functionName: string;
  args: Record<string, unknown>;
  bearer: string;
  apiKey: string;
  fetcher: typeof fetch;
}) {
  const { url } = getSupabasePublicConfig();
  let response: Response;
  try {
    response = await input.fetcher(
      `${url.replace(/\/+$/, "")}/rest/v1/rpc/${input.functionName}`,
      {
        method: "POST",
        headers: {
          apikey: input.apiKey,
          Authorization: `Bearer ${input.bearer}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input.args),
        cache: "no-store",
      },
    );
  } catch {
    throw new ChoiceQuizRepositoryError(
      "Could not reach choice quiz storage.",
      503,
      "choice_quiz_network_error",
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw repositoryFailure(response.status, payload);
  if (payload === null) {
    throw new ChoiceQuizRepositoryError(
      `${input.functionName} returned an empty projection.`,
      502,
      "choice_quiz_response_invalid",
    );
  }
  return payload;
}

function requireServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Supabase service-role auth is not configured.");
  return key;
}

export function createChoiceQuizLearnerRepository(
  options: RepositoryOptions = {},
): ChoiceQuizLearnerRepository {
  const fetcher = options.fetcher ?? fetch;

  async function rpc<T>(
    functionName: string,
    args: Record<string, unknown>,
    schema: ZodType<T>,
  ) {
    const serviceRoleKey = requireServiceRoleKey();
    return parseRpcResult(
      functionName,
      schema,
      await postRpc({
        functionName,
        args,
        bearer: serviceRoleKey,
        apiKey: serviceRoleKey,
        fetcher,
      }),
    );
  }

  return {
    issueDefinition(input) {
      return rpc(
        CHOICE_QUIZ_RPC.issueDefinition,
        {
          p_auth_user_id: input.actor.authUserId,
          p_session_id: input.actor.supabaseSessionId,
          p_lesson_run_id: input.lessonRunId,
          p_cursor_revision: input.cursorRevision,
          p_component_id: input.componentId,
          p_expected_component_updated_at: input.expectedComponentUpdatedAt,
          p_learner_definition: input.learnerDefinition,
          p_evaluator_config: input.evaluatorConfig,
        },
        issuedChoiceQuizProjectionSchema,
      );
    },

    submitAttempt(actor, lessonRunId, issueRef, input) {
      return rpc(
        CHOICE_QUIZ_RPC.submitAttempt,
        {
          p_auth_user_id: actor.authUserId,
          p_session_id: actor.supabaseSessionId,
          p_lesson_run_id: lessonRunId,
          p_issue_ref: issueRef,
          p_cursor_revision: input.cursorRevision,
          p_idempotency_key: input.idempotencyKey,
          p_selected_option_ids: input.selectedOptionIds,
        },
        submitChoiceQuizAttemptResultSchema,
      );
    },
  };
}

export function createChoiceQuizTeacherRepository(
  actor: ChoiceQuizTeacherActor,
  options: RepositoryOptions = {},
): ChoiceQuizTeacherRepository {
  const fetcher = options.fetcher ?? fetch;

  async function rpc<T>(
    functionName: string,
    args: Record<string, unknown>,
    schema: ZodType<T>,
  ) {
    const serviceRoleKey = requireServiceRoleKey();
    return parseRpcResult(
      functionName,
      schema,
      await postRpc({
        functionName,
        args,
        bearer: serviceRoleKey,
        apiKey: serviceRoleKey,
        fetcher,
      }),
    );
  }

  return {
    getHistory(lessonRunId) {
      return rpc(
        CHOICE_QUIZ_RPC.getTeacherHistory,
        {
          p_actor_auth_user_id: actor.authUserId,
          p_session_id: actor.supabaseSessionId,
          p_lesson_run_id: lessonRunId,
        },
        choiceQuizTeacherHistorySchema,
      );
    },

    correctEvaluation(evaluationId, input) {
      return rpc(
        CHOICE_QUIZ_RPC.correctEvaluation,
        {
          p_actor_auth_user_id: actor.authUserId,
          p_session_id: actor.supabaseSessionId,
          p_evaluation_id: evaluationId,
          p_is_correct: input.isCorrect,
          p_reason: input.reason,
          p_idempotency_key: input.idempotencyKey,
        },
        correctChoiceQuizEvaluationResultSchema,
      );
    },
  };
}
