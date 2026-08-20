import assert from "node:assert/strict";
import test from "node:test";
import { CourseBuilderValidationError } from "@/modules/course-builder/contracts";
import {
  parseLearningActivitiesContract,
  saveLessonComponentObservationsInputSchema,
} from "./contracts";

function uuid(sequence: number) {
  return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`;
}

test("observation save trims bounded criterion and private notes", () => {
  assert.deepEqual(
    parseLearningActivitiesContract(
      saveLessonComponentObservationsInputSchema,
      {
        lessonComponentId: uuid(1),
        observableCriterionAtTime: "  Называет слово без подсказки  ",
        entryMethod: "direct",
        entries: [
          {
            learningRecordId: uuid(2),
            rating: "independent",
            privateNote: "  Чётко произносит тон  ",
          },
        ],
      },
    ),
    {
      lessonComponentId: uuid(1),
      observableCriterionAtTime: "Называет слово без подсказки",
      entryMethod: "direct",
      entries: [
        {
          learningRecordId: uuid(2),
          rating: "independent",
          privateNote: "Чётко произносит тон",
        },
      ],
    },
  );
});

test("structured rating requires an explicitly confirmed criterion", () => {
  assert.throws(
    () =>
      parseLearningActivitiesContract(
        saveLessonComponentObservationsInputSchema,
        {
          lessonComponentId: uuid(1),
          entryMethod: "direct",
          entries: [
            {
              learningRecordId: uuid(2),
              rating: "with_support",
            },
          ],
        },
      ),
    (error: unknown) =>
      error instanceof CourseBuilderValidationError &&
      /подтвердите наблюдаемый критерий/.test(error.message),
  );
});

test("not observed is a criterion-free delete without a private note", () => {
  assert.deepEqual(
    parseLearningActivitiesContract(
      saveLessonComponentObservationsInputSchema,
      {
        lessonComponentId: uuid(1),
        observableCriterionAtTime: null,
        entryMethod: "direct",
        entries: [
          {
            learningRecordId: uuid(2),
            rating: null,
            privateNote: "   ",
          },
        ],
      },
    ),
    {
      lessonComponentId: uuid(1),
      observableCriterionAtTime: null,
      entryMethod: "direct",
      entries: [
        {
          learningRecordId: uuid(2),
          rating: null,
          privateNote: null,
        },
      ],
    },
  );

  assert.throws(
    () =>
      parseLearningActivitiesContract(
        saveLessonComponentObservationsInputSchema,
        {
          lessonComponentId: uuid(1),
          entryMethod: "direct",
          entries: [
            {
              learningRecordId: uuid(2),
              rating: null,
              privateNote: "Эта заметка не должна пережить очистку",
            },
          ],
        },
      ),
    /не может быть заметки/,
  );
});

test("bulk confirmation rejects duplicate records and unsupported values", () => {
  assert.throws(
    () =>
      parseLearningActivitiesContract(
        saveLessonComponentObservationsInputSchema,
        {
          lessonComponentId: uuid(1),
          observableCriterionAtTime: "Отвечает на вопрос",
          entryMethod: "bulk_confirmed",
          entries: [
            { learningRecordId: uuid(2), rating: "independent" },
            { learningRecordId: uuid(2), rating: "not_yet" },
          ],
        },
      ),
    /ровно один раз/,
  );

  assert.throws(
    () =>
      parseLearningActivitiesContract(
        saveLessonComponentObservationsInputSchema,
        {
          lessonComponentId: uuid(1),
          observableCriterionAtTime: "Отвечает на вопрос",
          entryMethod: "bulk",
          entries: [{ learningRecordId: uuid(2), rating: "mastered" }],
        },
      ),
    CourseBuilderValidationError,
  );
});

test("browser save input cannot supply objective provenance", () => {
  for (const objectiveField of [
    "learningObjectiveId",
    "sourceLearningObjectiveIdAtTime",
    "learningObjectiveTitleAtTime",
  ]) {
    assert.throws(
      () =>
        parseLearningActivitiesContract(
          saveLessonComponentObservationsInputSchema,
          {
            lessonComponentId: uuid(1),
            [objectiveField]:
              objectiveField === "learningObjectiveTitleAtTime"
                ? "Подменённая цель"
                : uuid(3),
            observableCriterionAtTime: "Отвечает на вопрос",
            entryMethod: "direct",
            entries: [
              {
                learningRecordId: uuid(2),
                rating: "independent",
              },
            ],
          },
        ),
      CourseBuilderValidationError,
    );
  }
});
