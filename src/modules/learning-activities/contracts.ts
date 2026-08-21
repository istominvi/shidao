import { z } from "zod";
import { CourseBuilderValidationError } from "@/modules/course-builder/contracts";
import type {
  FinalizedObservationCorrectionResult,
  LearnerSafeActivityProfile,
  LearnerSafeEvidenceReference,
  LearnerSafeObjectiveState,
  LearnerSafeRecommendation,
  LearningEvidence,
  LessonObservationCorrection,
  LessonObservationCorrectionHistory,
  RecommendationOverrideResult,
  TeacherLearnerActivityProfile,
  TeacherLearnerObjectiveState,
  TeacherLearningRecommendation,
  TeacherRecommendationOverride,
} from "./domain";

export const OBSERVABLE_CRITERION_MAX_LENGTH = 500;
export const OBSERVATION_PRIVATE_NOTE_MAX_LENGTH = 500;
export const OBSERVATION_COMPONENT_LABEL_MAX_LENGTH = 500;
export const OBSERVATION_COMPONENT_PROMPT_MAX_LENGTH = 240;
export const OBSERVATION_OBJECTIVE_TITLE_AT_TIME_MAX_LENGTH = 240;
export const ACTIVITY_PROFILE_STATES_MAX = 200;
export const OBJECTIVE_STATE_EVIDENCE_MAX = 20;
export const LEARNER_SAFE_EVIDENCE_REFERENCES_MAX = 5;
export const EVIDENCE_LABEL_MAX_LENGTH = 500;
export const EVIDENCE_CONTEXT_TITLE_MAX_LENGTH = 240;
export const ACTIVITY_PROFILE_REASON_TEXT_MAX_LENGTH = 1_000;
export const RECOMMENDATION_OVERRIDE_PRIVATE_REASON_MAX_LENGTH = 500;
// One history response can contain at most 100 Runs with the existing
// 200-learner Run audience bound.
export const HISTORY_OBSERVATION_LEARNING_RECORD_IDS_MAX = 20_000;
export const HISTORY_CORRECTION_RPC_RECORD_IDS_MAX = 200;
export const HISTORY_CORRECTIONS_MAX = 200;

export const observationRatingSchema = z.enum([
  "independent",
  "with_support",
  "not_yet",
]);

export const observationEntryMethodSchema = z.enum([
  "direct",
  "bulk_confirmed",
]);

export const lessonObservationCorrectionSchema: z.ZodType<LessonObservationCorrection> =
  z
    .object({
      activeLearningRecordId: z.uuid(),
      learningRecordId: z.uuid(),
      correctedFromLearningRecordId: z.uuid(),
      observationId: z.uuid(),
      correctedFromObservationId: z.uuid(),
      componentPositionAtTime: z.number().int().min(1),
      componentLabelAtTime: z.string().trim().min(1).max(500),
      oldRating: observationRatingSchema,
      newRating: observationRatingSchema,
      oldPrivateNote: z.string().trim().min(1).max(500).nullable(),
      newPrivateNote: z.string().trim().min(1).max(500).nullable(),
      correctionReason: z.string().trim().min(1).max(500),
      correctedAt: z.iso.datetime({ offset: true }),
    })
    .strict();

export const lessonObservationCorrectionHistorySchema: z.ZodType<LessonObservationCorrectionHistory> =
  z
    .object({
      items: z
        .array(lessonObservationCorrectionSchema)
        .max(HISTORY_CORRECTIONS_MAX),
      truncated: z.boolean(),
    })
    .strict();

export const learningEvidenceDirectionSchema = z.enum(["positive", "negative"]);

export const learningEvidenceSupportSchema = z
  .enum(["independent", "with_support"])
  .nullable();

export const learningEvidenceReasonCodeSchema = z.enum([
  "independent_positive_evidence",
  "supported_positive_evidence",
  "not_yet_negative_evidence",
]);

export const learnerObjectiveStateStatusSchema = z.enum([
  "no_data",
  "forming",
  "confirmed",
  "recheck_due",
]);

export const learnerObjectiveStateReasonCodeSchema = z.enum([
  "no_eligible_evidence",
  "latest_not_yet",
  "latest_with_support",
  "independent_opportunities_missing",
  "multiple_independent_opportunities",
  "confirmed_evidence_stale",
]);

export const persistedLearnerObjectiveStateStatusSchema = z.enum([
  "forming",
  "confirmed",
  "recheck_due",
]);

export const persistedLearnerObjectiveStateReasonCodeSchema = z.enum([
  "latest_not_yet",
  "latest_with_support",
  "independent_opportunities_missing",
  "multiple_independent_opportunities",
  "confirmed_evidence_stale",
]);

export const learningRecommendationTypeSchema = z.enum([
  "repeat",
  "try_without_support",
  "apply_in_new_context",
  "move_forward",
  "recheck_freshness",
]);

export const learningRecommendationReasonCodeSchema = z.enum([
  "repeat_after_not_yet",
  "try_without_support_after_supported_success",
  "apply_in_new_context_after_one_independent_opportunity",
  "move_forward_after_confirmation",
  "recheck_due_to_freshness",
]);

const timestampSchema = z.iso.datetime({ offset: true });
const strictBoundedText = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => value === value.trim(), {
      message: "Текст projection должен быть нормализован.",
    });
const boundedTitleSchema = strictBoundedText(EVIDENCE_CONTEXT_TITLE_MAX_LENGTH);
const boundedLabelSchema = strictBoundedText(EVIDENCE_LABEL_MAX_LENGTH);
const reasonTextSchema = strictBoundedText(
  ACTIVITY_PROFILE_REASON_TEXT_MAX_LENGTH,
);
const learnerSafeStateReferenceSchema = z.string().regex(/^las_[a-f0-9]{64}$/, {
  message: "Ссылка состояния должна быть непрозрачной.",
});
const learnerSafeEvidenceReferenceKeySchema = z
  .string()
  .regex(/^lae_[a-f0-9]{64}$/, {
    message: "Ссылка evidence должна быть непрозрачной.",
  });

function hasDuplicates(values: string[]) {
  return new Set(values).size !== values.length;
}

const recommendationTypeByReason = {
  repeat_after_not_yet: "repeat",
  try_without_support_after_supported_success: "try_without_support",
  apply_in_new_context_after_one_independent_opportunity:
    "apply_in_new_context",
  move_forward_after_confirmation: "move_forward",
  recheck_due_to_freshness: "recheck_freshness",
} as const;

const stateReasonsByStatus = {
  no_data: ["no_eligible_evidence"],
  forming: [
    "latest_not_yet",
    "latest_with_support",
    "independent_opportunities_missing",
  ],
  confirmed: ["multiple_independent_opportunities"],
  recheck_due: ["confirmed_evidence_stale"],
} as const;

function stateReasonMatches(
  status: keyof typeof stateReasonsByStatus,
  reasonCode: string,
) {
  return (stateReasonsByStatus[status] as readonly string[]).includes(
    reasonCode,
  );
}

export const learningEvidenceSchema: z.ZodType<LearningEvidence> = z
  .object({
    id: z.uuid(),
    learnerProfileId: z.uuid(),
    recordedByAccountId: z.uuid(),
    learningRecordId: z.uuid(),
    sourceObservationId: z.uuid(),
    sourceCourseIdAtTime: z.uuid(),
    sourceLessonIdAtTime: z.uuid(),
    sourceLessonRunIdAtTime: z.uuid(),
    sourceComponentIdAtTime: z.uuid(),
    sourceLearningObjectiveIdAtTime: z.uuid(),
    lessonComponentId: z.uuid().nullable(),
    learningObjectiveId: z.uuid().nullable(),
    courseTitleAtTime: boundedTitleSchema,
    lessonTitleAtTime: boundedTitleSchema,
    subjectAtTime: boundedTitleSchema.nullable(),
    componentTypeAtTime: strictBoundedText(80),
    componentLabelAtTime: boundedLabelSchema,
    objectiveTitleAtTime: boundedTitleSchema,
    criterionAtTime: strictBoundedText(OBSERVABLE_CRITERION_MAX_LENGTH),
    direction: learningEvidenceDirectionSchema,
    support: learningEvidenceSupportSchema,
    observedAt: timestampSchema,
    finalizedAt: timestampSchema,
    materializedAt: timestampSchema,
    evidenceVersion: z.literal(1),
    eligibilityPolicyVersion: z.literal(1),
    reasonCode: learningEvidenceReasonCodeSchema,
    supersedesEvidenceId: z.uuid().nullable(),
    supersededByEvidenceId: z.uuid().nullable(),
  })
  .strict()
  .superRefine((evidence, context) => {
    const expected =
      evidence.direction === "negative"
        ? evidence.support === null
          ? "not_yet_negative_evidence"
          : null
        : evidence.support === "independent"
          ? "independent_positive_evidence"
          : evidence.support === "with_support"
            ? "supported_positive_evidence"
            : null;
    if (expected !== evidence.reasonCode) {
      context.addIssue({
        code: "custom",
        path: ["reasonCode"],
        message: "Направление, поддержка и причина evidence не согласованы.",
      });
    }
    if (
      evidence.lessonComponentId !== null &&
      evidence.lessonComponentId !== evidence.sourceComponentIdAtTime
    ) {
      context.addIssue({
        code: "custom",
        path: ["lessonComponentId"],
        message: "Live Component не совпадает со stable provenance.",
      });
    }
    if (
      evidence.learningObjectiveId !== null &&
      evidence.learningObjectiveId !== evidence.sourceLearningObjectiveIdAtTime
    ) {
      context.addIssue({
        code: "custom",
        path: ["learningObjectiveId"],
        message: "Live objective не совпадает со stable provenance.",
      });
    }
    if (
      Date.parse(evidence.observedAt) > Date.parse(evidence.materializedAt) ||
      Date.parse(evidence.finalizedAt) > Date.parse(evidence.materializedAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["materializedAt"],
        message: "Evidence materialization не может предшествовать источнику.",
      });
    }
  });

export const teacherRecommendationOverrideSchema: z.ZodType<TeacherRecommendationOverride> =
  z
    .object({
      action: z.enum(["replace", "dismiss"]),
      recommendationType: learningRecommendationTypeSchema.nullable(),
      privateReason: strictBoundedText(
        RECOMMENDATION_OVERRIDE_PRIVATE_REASON_MAX_LENGTH,
      ),
      updatedAt: timestampSchema,
    })
    .strict()
    .superRefine((override, context) => {
      if (
        (override.action === "replace") !==
        (override.recommendationType !== null)
      ) {
        context.addIssue({
          code: "custom",
          path: ["recommendationType"],
          message: "Тип нужен только для замены рекомендации.",
        });
      }
    });

export const teacherLearningRecommendationSchema: z.ZodType<TeacherLearningRecommendation> =
  z
    .object({
      recommendationId: z.uuid(),
      type: learningRecommendationTypeSchema,
      reasonCode: learningRecommendationReasonCodeSchema,
      reasonText: reasonTextSchema,
      ruleVersion: z.literal(1),
      generatedAt: timestampSchema,
      evidenceIds: z.array(z.uuid()).min(1).max(OBJECTIVE_STATE_EVIDENCE_MAX),
      effectiveType: learningRecommendationTypeSchema.nullable(),
      effectiveReasonText: reasonTextSchema.nullable(),
      source: z.enum(["rule", "teacher_override"]),
      override: teacherRecommendationOverrideSchema.nullable(),
    })
    .strict()
    .superRefine((recommendation, context) => {
      if (
        recommendationTypeByReason[recommendation.reasonCode] !==
        recommendation.type
      ) {
        context.addIssue({
          code: "custom",
          path: ["reasonCode"],
          message: "Тип и причина recommendation не согласованы.",
        });
      }
      if (hasDuplicates(recommendation.evidenceIds)) {
        context.addIssue({
          code: "custom",
          path: ["evidenceIds"],
          message: "Evidence ссылки не должны повторяться.",
        });
      }
      if (
        (recommendation.source === "teacher_override") !==
        (recommendation.override !== null)
      ) {
        context.addIssue({
          code: "custom",
          path: ["override"],
          message: "Источник и teacher override не согласованы.",
        });
      }
      if (
        recommendation.override?.action === "dismiss" &&
        (recommendation.effectiveType !== null ||
          recommendation.effectiveReasonText !== null)
      ) {
        context.addIssue({
          code: "custom",
          path: ["effectiveType"],
          message: "Скрытая рекомендация не имеет effective значения.",
        });
      }
      if (
        recommendation.override?.action === "replace" &&
        (recommendation.effectiveType !==
          recommendation.override.recommendationType ||
          recommendation.effectiveReasonText === null)
      ) {
        context.addIssue({
          code: "custom",
          path: ["effectiveType"],
          message: "Replacement override должен определять effective значение.",
        });
      }
      if (
        recommendation.source === "rule" &&
        (recommendation.effectiveType !== recommendation.type ||
          recommendation.effectiveReasonText !== recommendation.reasonText)
      ) {
        context.addIssue({
          code: "custom",
          path: ["effectiveType"],
          message: "Rule recommendation должна быть неизменённой.",
        });
      }
    });

export const teacherLearnerObjectiveStateSchema: z.ZodType<TeacherLearnerObjectiveState> =
  z
    .object({
      stateId: z.uuid().nullable(),
      learningObjectiveId: z.uuid().nullable(),
      sourceLearningObjectiveIdAtTime: z.uuid(),
      sourceCourseIdAtTime: z.uuid(),
      courseTitleAtTime: boundedTitleSchema,
      subjectAtTime: boundedTitleSchema.nullable(),
      objectiveTitleAtTime: boundedTitleSchema,
      status: learnerObjectiveStateStatusSchema,
      reasonCode: learnerObjectiveStateReasonCodeSchema,
      reasonText: reasonTextSchema,
      policyVersion: z.literal(1),
      evaluatedAt: timestampSchema,
      lastEvidenceAt: timestampSchema.nullable(),
      freshnessDueAt: timestampSchema.nullable(),
      evidence: z
        .array(learningEvidenceSchema)
        .max(OBJECTIVE_STATE_EVIDENCE_MAX),
      recommendation: teacherLearningRecommendationSchema.nullable(),
    })
    .strict()
    .superRefine((state, context) => {
      if (!stateReasonMatches(state.status, state.reasonCode)) {
        context.addIssue({
          code: "custom",
          path: ["reasonCode"],
          message: "Состояние и причина не согласованы.",
        });
      }
      const isNoData = state.status === "no_data";
      if (
        isNoData &&
        (state.stateId !== null ||
          state.lastEvidenceAt !== null ||
          state.freshnessDueAt !== null ||
          state.evidence.length > 0 ||
          state.recommendation !== null)
      ) {
        context.addIssue({
          code: "custom",
          path: ["status"],
          message:
            "Synthesized no-data state не содержит persisted ID, evidence или recommendation.",
        });
      }
      if (
        !isNoData &&
        (state.stateId === null ||
          state.lastEvidenceAt === null ||
          state.evidence.length === 0)
      ) {
        context.addIssue({
          code: "custom",
          path: ["stateId"],
          message:
            "Persisted objective state требует ID, last evidence и evidence links.",
        });
      }
      if (
        (state.status === "confirmed" || state.status === "recheck_due") !==
        (state.freshnessDueAt !== null)
      ) {
        context.addIssue({
          code: "custom",
          path: ["freshnessDueAt"],
          message: "Freshness date не согласована с состоянием.",
        });
      }
      if (state.freshnessDueAt !== null) {
        const expectedFreshness = state.lastEvidenceAt
          ? Date.parse(state.lastEvidenceAt) + 90 * 24 * 60 * 60 * 1_000
          : Number.NaN;
        const freshnessDue = Date.parse(state.freshnessDueAt);
        const evaluatedAt = Date.parse(state.evaluatedAt);
        if (
          freshnessDue !== expectedFreshness ||
          (state.status === "confirmed" && evaluatedAt >= freshnessDue) ||
          (state.status === "recheck_due" && evaluatedAt < freshnessDue)
        ) {
          context.addIssue({
            code: "custom",
            path: ["freshnessDueAt"],
            message: "Freshness boundary не соответствует objective-state-v1.",
          });
        }
      }
      const latest = state.evidence[0];
      if (latest && state.lastEvidenceAt !== latest.observedAt) {
        context.addIssue({
          code: "custom",
          path: ["lastEvidenceAt"],
          message: "Last evidence date не совпадает с projection links.",
        });
      }
      if (
        state.reasonCode === "latest_not_yet" &&
        latest?.direction !== "negative"
      ) {
        context.addIssue({
          code: "custom",
          path: ["evidence"],
          message: "Latest-not-yet state требует negative evidence.",
        });
      }
      if (
        state.reasonCode === "latest_with_support" &&
        !(latest?.direction === "positive" && latest.support === "with_support")
      ) {
        context.addIssue({
          code: "custom",
          path: ["evidence"],
          message: "Supported state требует evidence with support.",
        });
      }
      if (
        state.reasonCode === "independent_opportunities_missing" &&
        !(
          state.evidence.length === 1 &&
          latest?.direction === "positive" &&
          latest.support === "independent"
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["evidence"],
          message: "Forming independent state требует одну Run opportunity.",
        });
      }
      if (
        (state.status === "confirmed" || state.status === "recheck_due") &&
        (state.evidence.length < 2 ||
          new Set(state.evidence.map((item) => item.sourceLessonRunIdAtTime))
            .size < 2 ||
          state.evidence.some(
            (item) =>
              item.direction !== "positive" || item.support !== "independent",
          ))
      ) {
        context.addIssue({
          code: "custom",
          path: ["evidence"],
          message:
            "Confirmed state требует independent evidence из разных Runs.",
        });
      }
      const evidenceIds = state.evidence.map((item) => item.id);
      if (hasDuplicates(evidenceIds)) {
        context.addIssue({
          code: "custom",
          path: ["evidence"],
          message: "Evidence не должно повторяться.",
        });
      }
      if (
        state.learningObjectiveId !== null &&
        state.learningObjectiveId !== state.sourceLearningObjectiveIdAtTime
      ) {
        context.addIssue({
          code: "custom",
          path: ["learningObjectiveId"],
          message: "Live objective не совпадает со stable provenance.",
        });
      }
      for (const [index, evidence] of state.evidence.entries()) {
        if (
          evidence.sourceLearningObjectiveIdAtTime !==
            state.sourceLearningObjectiveIdAtTime ||
          evidence.sourceCourseIdAtTime !== state.sourceCourseIdAtTime ||
          evidence.supersededByEvidenceId !== null
        ) {
          context.addIssue({
            code: "custom",
            path: ["evidence", index],
            message:
              "State содержит evidence другого ключа или superseded evidence.",
          });
        }
      }
      const recommendationIds = state.recommendation?.evidenceIds ?? [];
      if (recommendationIds.some((id) => !evidenceIds.includes(id))) {
        context.addIssue({
          code: "custom",
          path: ["recommendation", "evidenceIds"],
          message: "Recommendation ссылается на evidence вне state.",
        });
      }
    });

export const teacherLearnerActivityProfileSchema: z.ZodType<TeacherLearnerActivityProfile> =
  z
    .object({
      projectionVersion: z.literal(1),
      learnerProfileId: z.uuid(),
      generatedAt: timestampSchema,
      states: z
        .array(teacherLearnerObjectiveStateSchema)
        .max(ACTIVITY_PROFILE_STATES_MAX),
    })
    .strict()
    .superRefine((profile, context) => {
      const stateIds = profile.states.flatMap((state) =>
        state.stateId ? [state.stateId] : [],
      );
      if (hasDuplicates(stateIds)) {
        context.addIssue({
          code: "custom",
          path: ["states"],
          message: "Objective state не должен повторяться.",
        });
      }
      const objectiveKeys = profile.states.map(
        (state) =>
          `${state.sourceCourseIdAtTime}:${state.sourceLearningObjectiveIdAtTime}`,
      );
      if (hasDuplicates(objectiveKeys)) {
        context.addIssue({
          code: "custom",
          path: ["states"],
          message: "Objective projection key не должен повторяться.",
        });
      }
      const recorderAccountIds = new Set(
        profile.states.flatMap((state) =>
          state.evidence.map((evidence) => evidence.recordedByAccountId),
        ),
      );
      if (recorderAccountIds.size > 1) {
        context.addIssue({
          code: "custom",
          path: ["states"],
          message: "Teacher projection смешивает recorder accounts.",
        });
      }
      for (const [stateIndex, state] of profile.states.entries()) {
        for (const [evidenceIndex, evidence] of state.evidence.entries()) {
          if (evidence.learnerProfileId !== profile.learnerProfileId) {
            context.addIssue({
              code: "custom",
              path: ["states", stateIndex, "evidence", evidenceIndex],
              message: "Evidence принадлежит другому learner profile.",
            });
          }
        }
      }
    });

export const learnerSafeEvidenceReferenceSchema: z.ZodType<LearnerSafeEvidenceReference> =
  z
    .object({
      key: learnerSafeEvidenceReferenceKeySchema,
      direction: learningEvidenceDirectionSchema,
      support: learningEvidenceSupportSchema,
      observedAt: timestampSchema,
      evidenceAt: timestampSchema,
      courseTitle: boundedTitleSchema,
      lessonTitle: boundedTitleSchema,
      componentLabel: boundedLabelSchema,
      objectiveTitle: boundedTitleSchema,
      criterion: strictBoundedText(OBSERVABLE_CRITERION_MAX_LENGTH),
    })
    .strict()
    .superRefine((evidence, context) => {
      if (
        (evidence.direction === "negative" && evidence.support !== null) ||
        (evidence.direction === "positive" && evidence.support === null)
      ) {
        context.addIssue({
          code: "custom",
          path: ["support"],
          message: "Направление и поддержка evidence не согласованы.",
        });
      }
    });

export const learnerSafeRecommendationSchema: z.ZodType<LearnerSafeRecommendation> =
  z
    .object({
      type: learningRecommendationTypeSchema,
      reasonCode: learningRecommendationReasonCodeSchema,
      reasonText: reasonTextSchema,
      source: z.enum(["rule", "teacher_override"]),
      generatedAt: timestampSchema,
      evidenceReferenceKeys: z
        .array(learnerSafeEvidenceReferenceKeySchema)
        .min(1)
        .max(LEARNER_SAFE_EVIDENCE_REFERENCES_MAX),
    })
    .strict()
    .superRefine((recommendation, context) => {
      if (
        recommendation.source === "rule" &&
        recommendationTypeByReason[recommendation.reasonCode] !==
          recommendation.type
      ) {
        context.addIssue({
          code: "custom",
          path: ["reasonCode"],
          message: "Тип и причина recommendation не согласованы.",
        });
      }
      if (hasDuplicates(recommendation.evidenceReferenceKeys)) {
        context.addIssue({
          code: "custom",
          path: ["evidenceReferenceKeys"],
          message: "Safe evidence ссылки не должны повторяться.",
        });
      }
    });

export const learnerSafeObjectiveStateSchema: z.ZodType<LearnerSafeObjectiveState> =
  z
    .object({
      key: learnerSafeStateReferenceSchema,
      courseTitle: boundedTitleSchema,
      subject: boundedTitleSchema.nullable(),
      objectiveTitle: boundedTitleSchema,
      state: learnerObjectiveStateStatusSchema,
      reasonCode: learnerObjectiveStateReasonCodeSchema,
      reasonText: reasonTextSchema,
      evaluatedAt: timestampSchema,
      lastEvidenceAt: timestampSchema.nullable(),
      freshnessDueAt: timestampSchema.nullable(),
      evidenceReferences: z
        .array(learnerSafeEvidenceReferenceSchema)
        .max(LEARNER_SAFE_EVIDENCE_REFERENCES_MAX),
      recommendation: learnerSafeRecommendationSchema.nullable(),
    })
    .strict()
    .superRefine((state, context) => {
      if (!stateReasonMatches(state.state, state.reasonCode)) {
        context.addIssue({
          code: "custom",
          path: ["reasonCode"],
          message: "No-data state и причина не согласованы.",
        });
      }
      if (state.state !== "no_data" && state.evidenceReferences.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["evidenceReferences"],
          message: "State должен иметь разрешённую evidence ссылку.",
        });
      }
      if (
        (state.state === "confirmed" || state.state === "recheck_due") !==
        (state.freshnessDueAt !== null)
      ) {
        context.addIssue({
          code: "custom",
          path: ["freshnessDueAt"],
          message: "Freshness date не согласована с safe state.",
        });
      }
      if (
        state.freshnessDueAt !== null &&
        ((state.state === "confirmed" &&
          Date.parse(state.evaluatedAt) >= Date.parse(state.freshnessDueAt)) ||
          (state.state === "recheck_due" &&
            Date.parse(state.evaluatedAt) < Date.parse(state.freshnessDueAt)))
      ) {
        context.addIssue({
          code: "custom",
          path: ["freshnessDueAt"],
          message: "Freshness boundary не согласована с safe state.",
        });
      }
      const evidenceKeys = state.evidenceReferences.map((item) => item.key);
      if (hasDuplicates(evidenceKeys)) {
        context.addIssue({
          code: "custom",
          path: ["evidenceReferences"],
          message: "Safe evidence ссылки не должны повторяться.",
        });
      }
      if (
        state.recommendation?.evidenceReferenceKeys.some(
          (key) => !evidenceKeys.includes(key),
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["recommendation", "evidenceReferenceKeys"],
          message: "Recommendation ссылается на evidence вне state.",
        });
      }
      if (
        state.state === "no_data" &&
        (state.lastEvidenceAt !== null ||
          state.freshnessDueAt !== null ||
          state.evidenceReferences.length > 0 ||
          state.recommendation !== null)
      ) {
        context.addIssue({
          code: "custom",
          path: ["state"],
          message: "No-data state не содержит evidence или recommendation.",
        });
      }
    });

export const learnerSafeActivityProfileSchema: z.ZodType<LearnerSafeActivityProfile> =
  z
    .object({
      projectionVersion: z.literal(1),
      generatedAt: timestampSchema,
      states: z
        .array(learnerSafeObjectiveStateSchema)
        .max(ACTIVITY_PROFILE_STATES_MAX),
    })
    .strict();

export const historyObservationLearningRecordIdsSchema = z
  .array(z.guid())
  .max(HISTORY_OBSERVATION_LEARNING_RECORD_IDS_MAX)
  .transform((ids) => [...new Set(ids)]);

const nullableTrimmedText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value?.trim() || null);

export const saveLessonComponentObservationEntrySchema = z
  .object({
    learningRecordId: z.guid(),
    rating: observationRatingSchema.nullable(),
    privateNote: nullableTrimmedText(OBSERVATION_PRIVATE_NOTE_MAX_LENGTH),
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.rating === null && entry.privateNote) {
      context.addIssue({
        code: "custom",
        path: ["privateNote"],
        message: "У отметки «не наблюдал» не может быть заметки.",
      });
    }
  });

export const saveLessonComponentObservationsInputSchema = z
  .object({
    lessonComponentId: z.guid(),
    observableCriterionAtTime: nullableTrimmedText(
      OBSERVABLE_CRITERION_MAX_LENGTH,
    ),
    entryMethod: observationEntryMethodSchema,
    entries: z.array(saveLessonComponentObservationEntrySchema).min(1).max(200),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      new Set(input.entries.map((entry) => entry.learningRecordId)).size !==
      input.entries.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: "Отметку каждого ученика нужно передать ровно один раз.",
      });
    }

    if (
      input.entries.some((entry) => entry.rating !== null) &&
      !input.observableCriterionAtTime
    ) {
      context.addIssue({
        code: "custom",
        path: ["observableCriterionAtTime"],
        message: "Сначала подтвердите наблюдаемый критерий.",
      });
    }
  });

export type SaveLessonComponentObservationsInput = z.infer<
  typeof saveLessonComponentObservationsInputSchema
>;

export const correctFinalizedObservationInputSchema = z
  .object({
    observationId: z.uuid(),
    expectedLearningRecordId: z.uuid(),
    rating: observationRatingSchema,
    privateNote: nullableTrimmedText(OBSERVATION_PRIVATE_NOTE_MAX_LENGTH),
    correctionReason: z
      .string()
      .trim()
      .min(1, "Укажите причину исправления.")
      .max(RECOMMENDATION_OVERRIDE_PRIVATE_REASON_MAX_LENGTH),
    idempotencyKey: z.uuid(),
  })
  .strict();

export type CorrectFinalizedObservationInput = z.infer<
  typeof correctFinalizedObservationInputSchema
>;

const nullablePrivateReasonSchema = z
  .string()
  .trim()
  .max(RECOMMENDATION_OVERRIDE_PRIVATE_REASON_MAX_LENGTH)
  .nullable()
  .transform((value) => value?.trim() || null);

export const setRecommendationOverrideInputSchema = z
  .object({
    sourceLearningObjectiveIdAtTime: z.uuid(),
    action: z.enum(["replace", "dismiss", "clear"]),
    recommendationType: learningRecommendationTypeSchema.nullable(),
    privateReason: nullablePrivateReasonSchema,
    expectedStateUpdatedAt: timestampSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if ((input.action === "replace") !== (input.recommendationType !== null)) {
      context.addIssue({
        code: "custom",
        path: ["recommendationType"],
        message: "Тип рекомендации нужен только для явной замены.",
      });
    }
    if ((input.action === "clear") !== (input.privateReason === null)) {
      context.addIssue({
        code: "custom",
        path: ["privateReason"],
        message:
          input.action === "clear"
            ? "При очистке private reason не передаётся."
            : "Укажите private reason для teacher override.",
      });
    }
  });

export type SetRecommendationOverrideInput = z.infer<
  typeof setRecommendationOverrideInputSchema
>;

export const finalizedObservationCorrectionResultSchema: z.ZodType<FinalizedObservationCorrectionResult> =
  z
    .object({
      idempotencyKey: z.uuid(),
      newLearningRecordId: z.uuid(),
      newObservationId: z.uuid(),
      correctedAt: timestampSchema,
      replayed: z.boolean(),
    })
    .strict();

export const recommendationOverrideResultSchema: z.ZodType<RecommendationOverrideResult> =
  z
    .object({
      action: z.enum(["replace", "dismiss", "clear"]),
      stateId: z.uuid(),
      updatedAt: timestampSchema,
    })
    .strict();

export function parseLearningActivitiesContract<T>(
  schema: z.ZodType<T>,
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new CourseBuilderValidationError(
    result.error.issues[0]?.message ?? "Проверьте данные наблюдения.",
  );
}
