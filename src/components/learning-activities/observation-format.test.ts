import assert from "node:assert/strict";
import test from "node:test";
import {
  componentDisplayLabel,
  observationsForComponent,
  observationObjectiveTitleAtTime,
  persistedCriterionForComponent,
  ratingLabel,
  suggestObservableCriterion,
  summarizeObservations,
} from "./observation-format";
import type { LessonComponentObservation } from "@/modules/learning-activities";

function observation(
  overrides: Partial<LessonComponentObservation> &
    Pick<LessonComponentObservation, "learningRecordId" | "rating">,
): LessonComponentObservation {
  const { learningRecordId, rating, ...rest } = overrides;
  return {
    id: `observation-${learningRecordId}`,
    learningRecordId,
    lessonComponentId: "component-1",
    sourceComponentIdAtTime: "component-1",
    learningObjectiveId: null,
    sourceLearningObjectiveIdAtTime: null,
    learningObjectiveTitleAtTime: null,
    componentPositionAtTime: 1,
    componentTypeAtTime: "free_response",
    componentLabelAtTime: "Свободный ответ",
    observableCriterionAtTime: "Объясняет решение",
    rating,
    entryMethod: "direct",
    privateNote: null,
    observedAt: "2026-08-19T10:00:00.000Z",
    recordedByAccountId: "account-1",
    createdAt: "2026-08-19T10:00:00.000Z",
    updatedAt: "2026-08-19T10:00:00.000Z",
    ...rest,
  };
}

test("summarizeObservations counts each learning record once", () => {
  const summary = summarizeObservations(
    [
      observation({ learningRecordId: "record-1", rating: "not_yet" }),
      observation({ learningRecordId: "record-1", rating: "independent" }),
      observation({ learningRecordId: "record-2", rating: "with_support" }),
    ],
    4,
  );

  assert.deepEqual(summary, {
    totalLearners: 4,
    observedLearners: 2,
    independent: 1,
    withSupport: 1,
    notYet: 0,
    notObserved: 2,
  });
});

test("component observations include a durable snapshot after FK nulling", () => {
  const current = observation({
    learningRecordId: "record-current",
    rating: "independent",
  });
  const snapshot = observation({
    learningRecordId: "record-snapshot",
    lessonComponentId: null,
    sourceComponentIdAtTime: "component-1",
    rating: "not_yet",
  });

  assert.deepEqual(
    observationsForComponent([current, snapshot], "component-1"),
    [current, snapshot],
  );
  assert.equal(
    persistedCriterionForComponent([snapshot], "component-1"),
    "Объясняет решение",
  );
});

test("criterion suggestion is derived from visible component copy", () => {
  assert.equal(
    suggestObservableCriterion({
      typeKey: "free_response",
      payload: { prompt: "  Объясни, почему ответ верный.  " },
    }),
    "Ученик отвечает на вопрос: «Объясни, почему ответ верный.»",
  );
  assert.equal(
    componentDisplayLabel({ position: 3, typeKey: "choice_quiz" }),
    "3. Тест с выбором ответа",
  );
  assert.equal(ratingLabel("with_support"), "С помощью");
  assert.equal(ratingLabel("not_yet"), "Пока не получилось");
  assert.equal(ratingLabel(null), "Не наблюдал");
});

test("objective-at-time formatter keeps legacy rows empty and preserves history", () => {
  const legacy = observation({
    learningRecordId: "record-legacy",
    rating: "independent",
  });
  const aligned = observation({
    learningRecordId: "record-aligned",
    rating: "with_support",
    learningObjectiveId: null,
    sourceLearningObjectiveIdAtTime: "objective-deleted",
    learningObjectiveTitleAtTime: "Различает второй и третий тон",
  });

  assert.equal(observationObjectiveTitleAtTime(legacy), null);
  assert.equal(
    observationObjectiveTitleAtTime(aligned),
    "Различает второй и третий тон",
  );
});
