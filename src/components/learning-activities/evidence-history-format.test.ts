import assert from "node:assert/strict";
import test from "node:test";
import type { LearningEvidence } from "@/modules/learning-activities";
import {
  currentEvidenceByObservation,
  evidenceDirectionLabel,
} from "./evidence-history-format";

const commonEvidence = {
  learnerProfileId: "10000000-0000-4000-8000-000000000001",
  recordedByAccountId: "10000000-0000-4000-8000-000000000002",
  learningRecordId: "10000000-0000-4000-8000-000000000003",
  sourceCourseIdAtTime: "10000000-0000-4000-8000-000000000004",
  sourceLessonIdAtTime: "10000000-0000-4000-8000-000000000005",
  sourceLessonRunIdAtTime: "10000000-0000-4000-8000-000000000006",
  sourceComponentIdAtTime: "10000000-0000-4000-8000-000000000007",
  sourceLearningObjectiveIdAtTime: "10000000-0000-4000-8000-000000000008",
  lessonComponentId: "10000000-0000-4000-8000-000000000007",
  learningObjectiveId: "10000000-0000-4000-8000-000000000008",
  courseTitleAtTime: "Курс",
  lessonTitleAtTime: "Урок",
  subjectAtTime: "Предмет",
  componentLabelAtTime: "Компонент",
  objectiveTitleAtTime: "Цель",
  criterionAtTime: "Критерий",
  observedAt: "2026-08-21T10:00:00.000Z",
  finalizedAt: "2026-08-21T10:01:00.000Z",
  materializedAt: "2026-08-21T10:02:00.000Z",
  evidenceVersion: 1,
  supersedesEvidenceId: null,
  supersededByEvidenceId: null,
} as const;

const observationEvidence: LearningEvidence = {
  ...commonEvidence,
  id: "20000000-0000-4000-8000-000000000001",
  sourceKind: "observation",
  sourceObservationId: "20000000-0000-4000-8000-000000000002",
  sourceChoiceQuizEvaluationId: null,
  componentTypeAtTime: "free_response",
  direction: "negative",
  support: null,
  eligibilityPolicyVersion: 1,
  reasonCode: "not_yet_negative_evidence",
};

const choiceQuizEvidence: LearningEvidence = {
  ...commonEvidence,
  id: "30000000-0000-4000-8000-000000000001",
  learningRecordId: null,
  sourceKind: "choice_quiz_evaluation",
  sourceObservationId: null,
  sourceChoiceQuizEvaluationId: "30000000-0000-4000-8000-000000000002",
  componentTypeAtTime: "choice_quiz",
  direction: "positive",
  support: "independent",
  eligibilityPolicyVersion: 2,
  reasonCode: "choice_quiz_independent_positive_evidence",
};

test("observation grouping excludes current quiz evidence instead of using a nullable key", () => {
  const grouped = currentEvidenceByObservation([
    choiceQuizEvidence,
    observationEvidence,
  ]);

  assert.deepEqual(Array.from(grouped.keys()), [
    observationEvidence.sourceObservationId,
  ]);
  assert.deepEqual(grouped.get(observationEvidence.sourceObservationId), [
    observationEvidence,
  ]);
});

test("choice quiz evidence remains renderable through the shared direction formatter", () => {
  assert.equal(
    evidenceDirectionLabel(choiceQuizEvidence),
    "Получилось самостоятельно",
  );
  assert.equal(
    evidenceDirectionLabel({
      ...choiceQuizEvidence,
      support: "with_support",
      reasonCode: "choice_quiz_supported_positive_evidence",
    }),
    "Получилось с поддержкой",
  );
});
