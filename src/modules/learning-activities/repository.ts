import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import { postgresUuidSchema } from "@/lib/postgres-uuid";
import { CourseBuilderRepositoryError } from "@/modules/course-builder/repository";
import {
  finalizedObservationCorrectionResultSchema,
  HISTORY_CORRECTION_RPC_RECORD_IDS_MAX,
  HISTORY_CORRECTIONS_MAX,
  learnerSafeActivityProfileSchema,
  lessonObservationCorrectionHistorySchema,
  learningEvidenceSchema,
  OBSERVATION_OBJECTIVE_TITLE_AT_TIME_MAX_LENGTH,
  observationEntryMethodSchema,
  observationRatingSchema,
  recommendationOverrideResultSchema,
  teacherLearnerActivityProfileSchema,
  type CorrectFinalizedObservationInput,
  type SaveLessonComponentObservationsInput,
  type SetRecommendationOverrideInput,
} from "./contracts";
import type {
  FinalizedObservationCorrectionResult,
  LearnerSafeActivityProfile,
  LearningEvidence,
  LessonObservationCorrection,
  LessonObservationCorrectionHistory,
  LessonComponentObservation,
  ObservationEntryMethod,
  RecommendationOverrideResult,
  TeacherLearnerActivityProfile,
} from "./domain";

type JsonObject = Record<string, unknown>;

type LessonComponentObservationRow = {
  id: string;
  learning_record_id: string;
  corrected_from_observation_id: string | null;
  superseded_by_observation_id: string | null;
  lesson_component_id: string | null;
  source_lesson_component_id_at_time: string;
  learning_objective_id: string | null;
  source_learning_objective_id_at_time: string | null;
  learning_objective_title_at_time: string | null;
  component_position_at_time: number;
  component_type_key_at_time: string;
  component_label_at_time: string;
  observable_criterion_at_time: string;
  rating: string;
  entry_method: string;
  private_note: string | null;
  observed_at: string;
  recorded_by_account_id: string;
  created_at: string;
  updated_at: string;
};

type LearningEvidenceRow = {
  id: string;
  learner_profile_id: string;
  recorded_by_account_id: string;
  learning_record_id: string | null;
  source_observation_id: string | null;
  source_choice_quiz_evaluation_id: string | null;
  source_course_id_at_time: string;
  source_lesson_id_at_time: string;
  source_lesson_run_id_at_time: string;
  source_component_id_at_time: string;
  source_learning_objective_id_at_time: string;
  lesson_component_id: string | null;
  learning_objective_id: string | null;
  course_title_at_time: string;
  lesson_title_at_time: string;
  subject_at_time: string | null;
  component_type_at_time: string;
  component_label_at_time: string;
  objective_title_at_time: string;
  criterion_at_time: string;
  direction: string;
  support: string | null;
  observed_at: string;
  finalized_at: string;
  materialized_at: string;
  evidence_version: number;
  eligibility_policy_version: number;
  reason_code: string;
  supersedes_evidence_id: string | null;
  superseded_by_evidence_id: string | null;
};

export type SaveRunObservationsRepositoryInput = {
  lessonRunId: string;
  lessonComponentId: string;
  componentLabelAtTime: string;
  observableCriterionAtTime: string | null;
  entryMethod: ObservationEntryMethod;
  entries: SaveLessonComponentObservationsInput["entries"];
};

export type CorrectFinalizedObservationRepositoryInput =
  CorrectFinalizedObservationInput & {
    learnerProfileId: string;
    correctedAt: string;
  };

export type SetRecommendationOverrideRepositoryInput =
  SetRecommendationOverrideInput & {
    learnerProfileId: string;
  };

export interface LearningActivitiesRepository {
  listByLearningRecordIds(
    learningRecordIds: string[],
  ): Promise<LessonComponentObservation[]>;
  listEvidenceByLearningRecordIds(
    learningRecordIds: string[],
  ): Promise<LearningEvidence[]>;
  listHistoryCorrections(
    activeLearningRecordIds: string[],
  ): Promise<LessonObservationCorrectionHistory>;
  saveRunObservations(input: SaveRunObservationsRepositoryInput): Promise<void>;
  correctFinalizedObservation(
    input: CorrectFinalizedObservationRepositoryInput,
  ): Promise<FinalizedObservationCorrectionResult>;
  setRecommendationOverride(
    input: SetRecommendationOverrideRepositoryInput,
  ): Promise<RecommendationOverrideResult>;
  getTeacherLearnerActivityProfile(
    learnerProfileId: string,
  ): Promise<TeacherLearnerActivityProfile>;
  getMyLearningActivityProfile(): Promise<LearnerSafeActivityProfile>;
  getObservedLearnerActivityProfile(
    learnerProfileId: string,
  ): Promise<LearnerSafeActivityProfile>;
}

const POSTGREST_IN_FILTER_CHUNK_SIZE = 50;
const POSTGREST_READ_CONCURRENCY = 8;
const POSTGREST_PAGE_SIZE = 500;
const OBSERVATION_SELECT = [
  "id",
  "learning_record_id",
  "corrected_from_observation_id",
  "superseded_by_observation_id",
  "lesson_component_id",
  "source_lesson_component_id_at_time",
  "learning_objective_id",
  "source_learning_objective_id_at_time",
  "learning_objective_title_at_time",
  "component_position_at_time",
  "component_type_key_at_time",
  "component_label_at_time",
  "observable_criterion_at_time",
  "rating",
  "entry_method",
  "private_note",
  "observed_at",
  "recorded_by_account_id",
  "created_at",
  "updated_at",
].join(",");
const LEARNING_EVIDENCE_SELECT = [
  "id",
  "learner_profile_id",
  "recorded_by_account_id",
  "learning_record_id",
  "source_observation_id",
  "source_choice_quiz_evaluation_id",
  "source_course_id_at_time",
  "source_lesson_id_at_time",
  "source_lesson_run_id_at_time",
  "source_component_id_at_time",
  "source_learning_objective_id_at_time",
  "lesson_component_id",
  "learning_objective_id",
  "course_title_at_time",
  "lesson_title_at_time",
  "subject_at_time",
  "component_type_at_time",
  "component_label_at_time",
  "objective_title_at_time",
  "criterion_at_time",
  "direction",
  "support",
  "observed_at",
  "finalized_at",
  "materialized_at",
  "evidence_version",
  "eligibility_policy_version",
  "reason_code",
  "supersedes_evidence_id",
  "superseded_by_evidence_id",
].join(",");

function encodeFilter(value: string) {
  return encodeURIComponent(value);
}

function inFilter(values: string[]) {
  return values.map(encodeFilter).join(",");
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

type ExactContentRange =
  | { empty: true; total: 0 }
  | { empty: false; start: number; end: number; total: number };

function invalidContentRange(
  kind: "observation" | "learning_evidence" = "observation",
): never {
  throw new CourseBuilderRepositoryError(
    kind === "observation"
      ? "Supabase вернул некорректный диапазон наблюдений."
      : "Supabase вернул некорректный диапазон evidence.",
    502,
    `${kind}_content_range_invalid`,
  );
}

function parseExactContentRange(
  value: string | null,
  expectedStart: number,
  expectedEnd: number,
  rowCount: number,
  kind: "observation" | "learning_evidence" = "observation",
): ExactContentRange {
  if (value === "*/0") {
    if (expectedStart !== 0 || rowCount !== 0) invalidContentRange(kind);
    return { empty: true, total: 0 };
  }

  const match = /^(\d+)-(\d+)\/(\d+)$/.exec(value ?? "");
  if (!match) invalidContentRange(kind);

  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    !Number.isSafeInteger(total) ||
    start !== expectedStart ||
    end < start ||
    end > expectedEnd ||
    end - start + 1 !== rowCount ||
    total <= end
  ) {
    invalidContentRange(kind);
  }

  return { empty: false, start, end, total };
}

function compareObservations(
  left: LessonComponentObservation,
  right: LessonComponentObservation,
) {
  return (
    left.componentPositionAtTime - right.componentPositionAtTime ||
    left.learningRecordId.localeCompare(right.learningRecordId) ||
    left.id.localeCompare(right.id)
  );
}

function invalidObservationProjection(): never {
  throw new CourseBuilderRepositoryError(
    "Supabase вернул неподдерживаемое наблюдение.",
    502,
    "observation_projection_invalid",
  );
}

function mapObjectiveContext(row: LessonComponentObservationRow) {
  const liveId = row.learning_objective_id;
  const sourceId = row.source_learning_objective_id_at_time;
  const title = row.learning_objective_title_at_time;

  if (liveId === null && sourceId === null && title === null) {
    return {
      learningObjectiveId: null,
      sourceLearningObjectiveIdAtTime: null,
      learningObjectiveTitleAtTime: null,
    };
  }

  if (
    sourceId === null ||
    title === null ||
    !postgresUuidSchema.safeParse(sourceId).success ||
    (liveId !== null &&
      (!postgresUuidSchema.safeParse(liveId).success || liveId !== sourceId)) ||
    !title ||
    title !== title.trim() ||
    title.length > OBSERVATION_OBJECTIVE_TITLE_AT_TIME_MAX_LENGTH
  ) {
    invalidObservationProjection();
  }

  return {
    learningObjectiveId: liveId,
    sourceLearningObjectiveIdAtTime: sourceId,
    learningObjectiveTitleAtTime: title,
  };
}

function mapObservation(
  row: LessonComponentObservationRow,
): LessonComponentObservation {
  const rating = observationRatingSchema.safeParse(row.rating);
  const entryMethod = observationEntryMethodSchema.safeParse(row.entry_method);
  if (
    !row.component_type_key_at_time.trim() ||
    row.component_type_key_at_time.length > 80 ||
    (row.corrected_from_observation_id !== null &&
      (!postgresUuidSchema.safeParse(row.corrected_from_observation_id)
        .success ||
        row.corrected_from_observation_id === row.id)) ||
    (row.superseded_by_observation_id !== null &&
      (!postgresUuidSchema.safeParse(row.superseded_by_observation_id)
        .success ||
        row.superseded_by_observation_id === row.id)) ||
    !rating.success ||
    !entryMethod.success
  ) {
    invalidObservationProjection();
  }
  const objectiveContext = mapObjectiveContext(row);
  return {
    id: row.id,
    learningRecordId: row.learning_record_id,
    correctedFromObservationId: row.corrected_from_observation_id,
    supersededByObservationId: row.superseded_by_observation_id,
    lessonComponentId: row.lesson_component_id,
    sourceComponentIdAtTime: row.source_lesson_component_id_at_time,
    ...objectiveContext,
    componentPositionAtTime: row.component_position_at_time,
    componentTypeAtTime: row.component_type_key_at_time,
    componentLabelAtTime: row.component_label_at_time,
    observableCriterionAtTime: row.observable_criterion_at_time,
    rating: rating.data,
    entryMethod: entryMethod.data,
    privateNote: row.private_note,
    observedAt: row.observed_at,
    recordedByAccountId: row.recorded_by_account_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function invalidEvidenceProjection(): never {
  throw new CourseBuilderRepositoryError(
    "Supabase вернул неподдерживаемое учебное evidence.",
    502,
    "learning_evidence_projection_invalid",
  );
}

function mapEvidence(row: LearningEvidenceRow): LearningEvidence {
  const sourceKind =
    row.source_observation_id !== null
      ? "observation"
      : row.source_choice_quiz_evaluation_id !== null
        ? "choice_quiz_evaluation"
        : null;
  const result = learningEvidenceSchema.safeParse({
    id: row.id,
    learnerProfileId: row.learner_profile_id,
    recordedByAccountId: row.recorded_by_account_id,
    learningRecordId: row.learning_record_id,
    sourceKind,
    sourceObservationId: row.source_observation_id,
    sourceChoiceQuizEvaluationId: row.source_choice_quiz_evaluation_id,
    sourceCourseIdAtTime: row.source_course_id_at_time,
    sourceLessonIdAtTime: row.source_lesson_id_at_time,
    sourceLessonRunIdAtTime: row.source_lesson_run_id_at_time,
    sourceComponentIdAtTime: row.source_component_id_at_time,
    sourceLearningObjectiveIdAtTime: row.source_learning_objective_id_at_time,
    lessonComponentId: row.lesson_component_id,
    learningObjectiveId: row.learning_objective_id,
    courseTitleAtTime: row.course_title_at_time,
    lessonTitleAtTime: row.lesson_title_at_time,
    subjectAtTime: row.subject_at_time,
    componentTypeAtTime: row.component_type_at_time,
    componentLabelAtTime: row.component_label_at_time,
    objectiveTitleAtTime: row.objective_title_at_time,
    criterionAtTime: row.criterion_at_time,
    direction: row.direction,
    support: row.support,
    observedAt: row.observed_at,
    finalizedAt: row.finalized_at,
    materializedAt: row.materialized_at,
    evidenceVersion: row.evidence_version,
    eligibilityPolicyVersion: row.eligibility_policy_version,
    reasonCode: row.reason_code,
    supersedesEvidenceId: row.supersedes_evidence_id,
    supersededByEvidenceId: row.superseded_by_evidence_id,
  });
  if (!result.success) invalidEvidenceProjection();
  return result.data;
}

function compareEvidence(left: LearningEvidence, right: LearningEvidence) {
  const leftSourceId =
    left.learningRecordId ??
    left.sourceChoiceQuizEvaluationId ??
    left.sourceObservationId ??
    left.id;
  const rightSourceId =
    right.learningRecordId ??
    right.sourceChoiceQuizEvaluationId ??
    right.sourceObservationId ??
    right.id;
  return (
    left.observedAt.localeCompare(right.observedAt) ||
    leftSourceId.localeCompare(rightSourceId) ||
    left.id.localeCompare(right.id)
  );
}

function compareCorrections(
  left: LessonObservationCorrection,
  right: LessonObservationCorrection,
) {
  return (
    right.correctedAt.localeCompare(left.correctedAt) ||
    left.activeLearningRecordId.localeCompare(right.activeLearningRecordId) ||
    left.learningRecordId.localeCompare(right.learningRecordId) ||
    left.observationId.localeCompare(right.observationId)
  );
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function camelKey(key: string) {
  return key.replace(/_([a-z0-9])/g, (_, character: string) =>
    character.toUpperCase(),
  );
}

function camelizeRpcPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelizeRpcPayload);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      camelKey(key),
      camelizeRpcPayload(nested),
    ]),
  );
}

function unwrapRpcResult(value: unknown) {
  const camel = camelizeRpcPayload(value);
  if (Array.isArray(camel) && camel.length === 1 && isObject(camel[0])) {
    return "result" in camel[0] ? camel[0].result : camel[0];
  }
  if (isObject(camel) && "result" in camel) return camel.result;
  return camel;
}

function invalidRpcProjection(operation: string): never {
  throw new CourseBuilderRepositoryError(
    `Supabase вернул неподдерживаемый ответ ${operation}.`,
    502,
    `${operation}_projection_invalid`,
  );
}

export function createLearningActivitiesRepository(
  accessToken: string,
): LearningActivitiesRepository {
  const { url, anonKey } = getSupabasePublicConfig();

  async function request<T>(
    path: string,
    init: {
      method?: "GET" | "POST";
      body?: JsonObject;
      allowEmpty?: boolean;
      headers?: Record<string, string>;
      inspectResponse?: (response: Response, value: T) => void;
    } = {},
  ): Promise<T> {
    const method = init.method ?? "GET";
    let response: Response;
    try {
      response = await fetch(`${url}${path}`, {
        method,
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...(method === "GET" ? {} : { Prefer: "return=minimal" }),
          ...init.headers,
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        cache: "no-store",
      });
    } catch {
      throw new CourseBuilderRepositoryError(
        "Не удалось связаться с Supabase.",
        503,
        "repository_network_error",
      );
    }

    if (!response.ok) {
      const details = (await response.json().catch(() => null)) as {
        message?: string;
        error?: string;
        code?: string;
      } | null;
      throw new CourseBuilderRepositoryError(
        details?.message ??
          details?.error ??
          "Supabase отклонил операцию с наблюдением.",
        response.status,
        details?.code ?? null,
      );
    }

    const text = await response.text();
    if (!text) {
      if (init.allowEmpty) return undefined as T;
      throw new CourseBuilderRepositoryError(
        "Supabase вернул пустой ответ.",
        502,
        "repository_empty_response",
      );
    }
    const value = JSON.parse(text) as T;
    init.inspectResponse?.(response, value);
    return value;
  }

  async function listBatch(batch: string[]) {
    const rows: LessonComponentObservationRow[] = [];
    const path = `/rest/v1/lesson_component_observation?select=${OBSERVATION_SELECT}&learning_record_id=in.(${inFilter(batch)})&order=component_position_at_time.asc,learning_record_id.asc,id.asc`;
    let expectedStart = 0;
    let exactTotal: number | null = null;

    while (exactTotal === null || expectedStart < exactTotal) {
      const expectedEnd = expectedStart + POSTGREST_PAGE_SIZE - 1;
      const contentRanges: ExactContentRange[] = [];
      const page = await request<LessonComponentObservationRow[]>(path, {
        headers: {
          Prefer: "count=exact",
          Range: `${expectedStart}-${expectedEnd}`,
          "Range-Unit": "items",
        },
        inspectResponse(response, value) {
          if (!Array.isArray(value)) invalidContentRange();
          contentRanges.push(
            parseExactContentRange(
              response.headers.get("content-range"),
              expectedStart,
              expectedEnd,
              value.length,
            ),
          );
        },
      });

      const contentRange = contentRanges[0];
      if (!contentRange) invalidContentRange();
      if (exactTotal !== null && contentRange.total !== exactTotal) {
        invalidContentRange();
      }
      exactTotal = contentRange.total;

      if (contentRange.empty) return rows;
      rows.push(...page);
      expectedStart = contentRange.end + 1;
    }

    if (rows.length !== exactTotal) invalidContentRange();
    return rows;
  }

  async function listEvidenceBatch(batch: string[]) {
    const rows: LearningEvidenceRow[] = [];
    const path = `/rest/v1/learning_evidence?select=${LEARNING_EVIDENCE_SELECT}&learning_record_id=in.(${inFilter(batch)})&order=observed_at.asc,learning_record_id.asc,id.asc`;
    let expectedStart = 0;
    let exactTotal: number | null = null;

    while (exactTotal === null || expectedStart < exactTotal) {
      const expectedEnd = expectedStart + POSTGREST_PAGE_SIZE - 1;
      const contentRanges: ExactContentRange[] = [];
      const page = await request<LearningEvidenceRow[]>(path, {
        headers: {
          Prefer: "count=exact",
          Range: `${expectedStart}-${expectedEnd}`,
          "Range-Unit": "items",
        },
        inspectResponse(response, value) {
          if (!Array.isArray(value)) invalidContentRange("learning_evidence");
          contentRanges.push(
            parseExactContentRange(
              response.headers.get("content-range"),
              expectedStart,
              expectedEnd,
              value.length,
              "learning_evidence",
            ),
          );
        },
      });

      const contentRange = contentRanges[0];
      if (!contentRange) invalidContentRange("learning_evidence");
      if (exactTotal !== null && contentRange.total !== exactTotal) {
        invalidContentRange("learning_evidence");
      }
      exactTotal = contentRange.total;
      if (contentRange.empty) return rows;
      rows.push(...page);
      expectedStart = contentRange.end + 1;
    }

    if (rows.length !== exactTotal) invalidContentRange("learning_evidence");
    return rows;
  }

  async function listObservationsByRecordIds(learningRecordIds: string[]) {
    const uniqueIds = [...new Set(learningRecordIds)];
    if (uniqueIds.length === 0) return [];
    const rows: LessonComponentObservationRow[] = [];
    const batches = chunks(uniqueIds, POSTGREST_IN_FILTER_CHUNK_SIZE);
    for (const window of chunks(batches, POSTGREST_READ_CONCURRENCY)) {
      rows.push(
        ...(await Promise.all(window.map((batch) => listBatch(batch)))).flat(),
      );
    }
    return rows.map(mapObservation).sort(compareObservations);
  }

  async function rpcProjection<T>(
    name: string,
    body: JsonObject,
    schema: {
      safeParse(
        value: unknown,
      ): { success: true; data: T } | { success: false };
    },
  ): Promise<T> {
    const payload = await request<unknown>(`/rest/v1/rpc/${name}`, {
      method: "POST",
      body,
      headers: { Prefer: "return=representation" },
    });
    const result = schema.safeParse(unwrapRpcResult(payload));
    if (!result.success) invalidRpcProjection(name);
    return result.data;
  }

  return {
    async listByLearningRecordIds(learningRecordIds) {
      return listObservationsByRecordIds(learningRecordIds);
    },

    async listEvidenceByLearningRecordIds(learningRecordIds) {
      const uniqueIds = [...new Set(learningRecordIds)];
      if (uniqueIds.length === 0) return [];
      const rows: LearningEvidenceRow[] = [];
      const batches = chunks(uniqueIds, POSTGREST_IN_FILTER_CHUNK_SIZE);
      for (const window of chunks(batches, POSTGREST_READ_CONCURRENCY)) {
        rows.push(
          ...(
            await Promise.all(window.map((batch) => listEvidenceBatch(batch)))
          ).flat(),
        );
      }
      return rows.map(mapEvidence).sort(compareEvidence);
    },

    async listHistoryCorrections(activeLearningRecordIds) {
      const uniqueIds = [...new Set(activeLearningRecordIds)].sort();
      if (uniqueIds.length === 0) return { items: [], truncated: false };
      const projections = await Promise.all(
        chunks(uniqueIds, HISTORY_CORRECTION_RPC_RECORD_IDS_MAX).map((batch) =>
          rpcProjection(
            "get_teacher_learning_record_correction_history",
            { p_active_learning_record_ids: batch },
            lessonObservationCorrectionHistorySchema,
          ),
        ),
      );
      const items = projections
        .flatMap((projection) => projection.items)
        .sort(compareCorrections);
      return {
        items: items.slice(0, HISTORY_CORRECTIONS_MAX),
        truncated:
          projections.some((projection) => projection.truncated) ||
          items.length > HISTORY_CORRECTIONS_MAX,
      };
    },

    async saveRunObservations(input) {
      await request<undefined>(
        "/rest/v1/rpc/save_lesson_component_observations",
        {
          method: "POST",
          body: {
            p_lesson_run_id: input.lessonRunId,
            p_lesson_component_id: input.lessonComponentId,
            p_component_label_at_time: input.componentLabelAtTime,
            p_observable_criterion_at_time: input.observableCriterionAtTime,
            p_entry_method: input.entryMethod,
            p_observations: input.entries.map((entry) => ({
              learningRecordId: entry.learningRecordId,
              rating: entry.rating,
              privateNote: entry.privateNote,
            })),
          },
          allowEmpty: true,
        },
      );
    },

    correctFinalizedObservation(input) {
      return rpcProjection(
        "correct_finalized_lesson_component_observation",
        {
          p_observation_id: input.observationId,
          p_learner_profile_id: input.learnerProfileId,
          p_expected_learning_record_id: input.expectedLearningRecordId,
          p_rating: input.rating,
          p_private_note: input.privateNote,
          p_correction_reason: input.correctionReason,
          p_idempotency_key: input.idempotencyKey,
          p_corrected_at: input.correctedAt,
        },
        finalizedObservationCorrectionResultSchema,
      );
    },

    setRecommendationOverride(input) {
      return rpcProjection(
        "set_learner_recommendation_override",
        {
          p_learner_profile_id: input.learnerProfileId,
          p_source_learning_objective_id_at_time:
            input.sourceLearningObjectiveIdAtTime,
          p_action: input.action,
          p_recommendation_type: input.recommendationType,
          p_private_reason: input.privateReason,
          p_expected_state_updated_at: input.expectedStateUpdatedAt,
        },
        recommendationOverrideResultSchema,
      );
    },

    getTeacherLearnerActivityProfile(learnerProfileId) {
      return rpcProjection(
        "get_teacher_learner_activity_profile_v2",
        { p_learner_profile_id: learnerProfileId },
        teacherLearnerActivityProfileSchema,
      );
    },

    getMyLearningActivityProfile() {
      return rpcProjection(
        "get_my_learning_activity_profile",
        {},
        learnerSafeActivityProfileSchema,
      );
    },

    getObservedLearnerActivityProfile(learnerProfileId) {
      return rpcProjection(
        "get_observed_learner_activity_profile",
        { p_learner_profile_id: learnerProfileId },
        learnerSafeActivityProfileSchema,
      );
    },
  };
}
