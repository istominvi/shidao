import type {
  CourseAsset,
  CourseLesson,
  LearningObjective,
} from "@/modules/course-builder/domain";
import type { LessonRun } from "@/modules/lesson-runs/domain";

export type ObservationRating = "independent" | "with_support" | "not_yet";

export type ObservationEntryMethod = "direct" | "bulk_confirmed";

export const LEARNING_EVIDENCE_VERSION = 1 as const;
/** Observation eligibility remains frozen at the deployed LA-M3 policy. */
export const EVIDENCE_ELIGIBILITY_POLICY_VERSION = 1 as const;
/** Deterministic choice-quiz evidence uses its own frozen LA-M5 policy. */
export const CHOICE_QUIZ_EVIDENCE_ELIGIBILITY_POLICY_VERSION = 2 as const;
export const OBJECTIVE_STATE_POLICY_VERSION = 1 as const;
export const RECOMMENDATION_RULE_VERSION = 1 as const;

export type LearningEvidenceDirection = "positive" | "negative";
export type LearningEvidenceSupport = "independent" | "with_support" | null;

export type ObservationLearningEvidenceReasonCode =
  | "independent_positive_evidence"
  | "supported_positive_evidence"
  | "not_yet_negative_evidence";

export type ChoiceQuizLearningEvidenceReasonCode =
  | "choice_quiz_independent_positive_evidence"
  | "choice_quiz_supported_positive_evidence"
  | "choice_quiz_not_yet_negative_evidence";

export type LearningEvidenceReasonCode =
  ObservationLearningEvidenceReasonCode | ChoiceQuizLearningEvidenceReasonCode;

/**
 * Immutable, source-agnostic pedagogical evidence materialized from exactly
 * one eligible observation or deterministic choice-quiz evaluation. It
 * deliberately excludes private notes, full Component payloads, evaluator
 * payloads and scores.
 */
type LearningEvidenceBase = {
  id: string;
  learnerProfileId: string;
  recordedByAccountId: string;
  sourceCourseIdAtTime: string;
  sourceLessonIdAtTime: string;
  sourceLessonRunIdAtTime: string;
  sourceComponentIdAtTime: string;
  sourceLearningObjectiveIdAtTime: string;
  lessonComponentId: string | null;
  learningObjectiveId: string | null;
  courseTitleAtTime: string;
  lessonTitleAtTime: string;
  subjectAtTime: string | null;
  componentTypeAtTime: string;
  componentLabelAtTime: string;
  objectiveTitleAtTime: string;
  criterionAtTime: string;
  direction: LearningEvidenceDirection;
  support: LearningEvidenceSupport;
  observedAt: string;
  finalizedAt: string;
  materializedAt: string;
  evidenceVersion: typeof LEARNING_EVIDENCE_VERSION;
  supersedesEvidenceId: string | null;
  supersededByEvidenceId: string | null;
};

export type ObservationLearningEvidence = LearningEvidenceBase & {
  learningRecordId: string;
  sourceKind: "observation";
  sourceObservationId: string;
  sourceChoiceQuizEvaluationId: null;
  eligibilityPolicyVersion: typeof EVIDENCE_ELIGIBILITY_POLICY_VERSION;
  reasonCode: ObservationLearningEvidenceReasonCode;
};

export type ChoiceQuizLearningEvidence = LearningEvidenceBase & {
  /**
   * Always detached from the compact record graph so an LA-M3 worker's raw
   * `learning_record_id` history read can only receive observation evidence.
   */
  learningRecordId: null;
  sourceKind: "choice_quiz_evaluation";
  sourceObservationId: null;
  sourceChoiceQuizEvaluationId: string;
  eligibilityPolicyVersion: typeof CHOICE_QUIZ_EVIDENCE_ELIGIBILITY_POLICY_VERSION;
  reasonCode: ChoiceQuizLearningEvidenceReasonCode;
};

export type LearningEvidence =
  ObservationLearningEvidence | ChoiceQuizLearningEvidence;

export type LearnerObjectiveStateStatus =
  "no_data" | "forming" | "confirmed" | "recheck_due";

export type LearnerObjectiveStateReasonCode =
  | "no_eligible_evidence"
  | "latest_not_yet"
  | "latest_with_support"
  | "independent_opportunities_missing"
  | "multiple_independent_opportunities"
  | "confirmed_evidence_stale";

export type LearningRecommendationType =
  | "repeat"
  | "try_without_support"
  | "apply_in_new_context"
  | "move_forward"
  | "recheck_freshness";

export type LearningRecommendationReasonCode =
  | "repeat_after_not_yet"
  | "try_without_support_after_supported_success"
  | "apply_in_new_context_after_one_independent_opportunity"
  | "move_forward_after_confirmation"
  | "recheck_due_to_freshness";

export type ProjectedLearnerObjectiveStateV1 = {
  status: LearnerObjectiveStateStatus;
  reasonCode: LearnerObjectiveStateReasonCode;
  reasonText: string;
  policyVersion: typeof OBJECTIVE_STATE_POLICY_VERSION;
  evaluatedAt: string;
  lastEvidenceAt: string | null;
  freshnessDueAt: string | null;
  evidenceIds: string[];
};

export type ProjectedLearningRecommendationV1 = {
  type: LearningRecommendationType;
  reasonCode: LearningRecommendationReasonCode;
  reasonText: string;
  ruleVersion: typeof RECOMMENDATION_RULE_VERSION;
  generatedAt: string;
  evidenceIds: string[];
};

export type TeacherRecommendationOverride = {
  action: "replace" | "dismiss";
  recommendationType: LearningRecommendationType | null;
  privateReason: string;
  updatedAt: string;
};

export type TeacherLearningRecommendation = {
  recommendationId: string;
  type: LearningRecommendationType;
  reasonCode: LearningRecommendationReasonCode;
  reasonText: string;
  ruleVersion: typeof RECOMMENDATION_RULE_VERSION;
  generatedAt: string;
  evidenceIds: string[];
  effectiveType: LearningRecommendationType | null;
  effectiveReasonText: string | null;
  source: "rule" | "teacher_override";
  override: TeacherRecommendationOverride | null;
};

export type TeacherLearnerObjectiveState = {
  /** Null only for a synthesized no-data projection with no persisted row. */
  stateId: string | null;
  learningObjectiveId: string | null;
  sourceLearningObjectiveIdAtTime: string;
  sourceCourseIdAtTime: string;
  courseTitleAtTime: string;
  subjectAtTime: string | null;
  objectiveTitleAtTime: string;
  status: LearnerObjectiveStateStatus;
  reasonCode: LearnerObjectiveStateReasonCode;
  reasonText: string;
  policyVersion: typeof OBJECTIVE_STATE_POLICY_VERSION;
  evaluatedAt: string;
  lastEvidenceAt: string | null;
  freshnessDueAt: string | null;
  evidence: LearningEvidence[];
  recommendation: TeacherLearningRecommendation | null;
};

export type TeacherLearnerActivityProfile = {
  projectionVersion: 1;
  learnerProfileId: string;
  generatedAt: string;
  states: TeacherLearnerObjectiveState[];
};

/** Learner/observer-safe evidence reference. Every key is opaque and scoped. */
export type LearnerSafeEvidenceReference = {
  key: string;
  direction: LearningEvidenceDirection;
  support: LearningEvidenceSupport;
  observedAt: string;
  evidenceAt: string;
  courseTitle: string;
  lessonTitle: string;
  componentLabel: string;
  objectiveTitle: string;
  criterion: string;
};

export type LearnerSafeRecommendation = {
  type: LearningRecommendationType;
  reasonCode: LearningRecommendationReasonCode;
  reasonText: string;
  source: "rule" | "teacher_override";
  generatedAt: string;
  evidenceReferenceKeys: string[];
};

export type LearnerSafeObjectiveState = {
  key: string;
  courseTitle: string;
  subject: string | null;
  objectiveTitle: string;
  state: LearnerObjectiveStateStatus;
  reasonCode: LearnerObjectiveStateReasonCode;
  reasonText: string;
  evaluatedAt: string;
  lastEvidenceAt: string | null;
  freshnessDueAt: string | null;
  evidenceReferences: LearnerSafeEvidenceReference[];
  recommendation: LearnerSafeRecommendation | null;
};

export type LearnerSafeActivityProfile = {
  projectionVersion: 1;
  generatedAt: string;
  states: LearnerSafeObjectiveState[];
};

export type FinalizedObservationCorrectionResult = {
  idempotencyKey: string;
  newLearningRecordId: string;
  newObservationId: string;
  correctedAt: string;
  replayed: boolean;
};

/**
 * Teacher-only audit edge for one explicit correction of a finalized
 * observation. The active LearningRecord stays the grouping anchor while the
 * old/new values are read from the append-only ancestor chain.
 */
export type LessonObservationCorrection = {
  activeLearningRecordId: string;
  learningRecordId: string;
  correctedFromLearningRecordId: string;
  observationId: string;
  correctedFromObservationId: string;
  componentPositionAtTime: number;
  componentLabelAtTime: string;
  oldRating: ObservationRating;
  newRating: ObservationRating;
  oldPrivateNote: string | null;
  newPrivateNote: string | null;
  correctionReason: string;
  correctedAt: string;
};

export type LessonObservationCorrectionHistory = {
  items: LessonObservationCorrection[];
  truncated: boolean;
};

export type RecommendationOverrideResult = {
  action: "replace" | "dismiss" | "clear";
  stateId: string;
  updatedAt: string;
};

/**
 * One teacher-owned, component-level observation for one expected learner in
 * a LessonRun. While its LearningRecord is a draft the row may be replaced or
 * removed; completion makes the same row durable read-only history.
 */
export type LessonComponentObservation = {
  id: string;
  learningRecordId: string;
  /** Explicit append-only correction chain; finalized rows are never edited. */
  correctedFromObservationId: string | null;
  supersededByObservationId: string | null;
  lessonComponentId: string | null;
  sourceComponentIdAtTime: string;
  /** Nullable live FK; deletion does not erase the stable fields below. */
  learningObjectiveId: string | null;
  /** Stable objective provenance captured by the save RPC under its locks. */
  sourceLearningObjectiveIdAtTime: string | null;
  /** Bounded historical title; null for honest LA-M1 component-only rows. */
  learningObjectiveTitleAtTime: string | null;
  componentPositionAtTime: number;
  /** Historical registry key; it remains readable if a live type is retired. */
  componentTypeAtTime: string;
  componentLabelAtTime: string;
  observableCriterionAtTime: string;
  rating: ObservationRating;
  entryMethod: ObservationEntryMethod;
  privateNote: string | null;
  observedAt: string;
  recordedByAccountId: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Teacher-only projection for conducting one existing LessonRun. The Lesson
 * remains the single source of authored content; the Run does not receive a
 * content snapshot or a second component order.
 */
export type RunObservationWorkspace = {
  run: LessonRun;
  lesson: CourseLesson;
  attachments: CourseAsset[];
  learningObjectives: LearningObjective[];
  observations: LessonComponentObservation[];
};
