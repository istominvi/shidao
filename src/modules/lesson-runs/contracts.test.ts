import assert from "node:assert/strict";
import test from "node:test";
import {
  CourseBuilderConflictError,
  CourseBuilderValidationError,
} from "@/modules/course-builder/contracts";
import {
  assertSameLearnerSet,
  completeLessonRunInputSchema,
  createLearnerGroupInputSchema,
  createLearnerProfileInputSchema,
  lessonRunWindowInputSchema,
  parseLessonRunsContract,
  replaceCourseAudienceInputSchema,
  scheduleLessonRunInputSchema,
  updateLearnerProfileInputSchema,
} from "./contracts";

function uuid(sequence: number) {
  return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`;
}

test("learner profile and schedule contracts trim user text and can use the Course audience", () => {
  assert.deepEqual(
    parseLessonRunsContract(createLearnerProfileInputSchema, {
      displayName: "  Анна  ",
    }),
    { displayName: "Анна", learnerGroupIds: [] },
  );

  assert.deepEqual(
    parseLessonRunsContract(scheduleLessonRunInputSchema, {
      scheduledAt: "2026-08-08T10:00:00+09:00",
      plannedDurationMinutes: 45,
    }),
    {
      scheduledAt: "2026-08-08T10:00:00+09:00",
      plannedDurationMinutes: 45,
    },
  );
});

test("learner groups and mixed Course audience accept overlap but reject duplicates", () => {
  assert.deepEqual(
    parseLessonRunsContract(createLearnerGroupInputSchema, {
      name: "  Teen Talk  ",
    }),
    { name: "Teen Talk", learnerProfileIds: [] },
  );
  assert.deepEqual(
    parseLessonRunsContract(updateLearnerProfileInputSchema, {
      displayName: "  Анна  ",
      learnerGroupIds: [uuid(10), uuid(11)],
    }),
    {
      displayName: "Анна",
      learnerGroupIds: [uuid(10), uuid(11)],
    },
  );
  assert.deepEqual(
    parseLessonRunsContract(replaceCourseAudienceInputSchema, {
      directLearnerProfileIds: [uuid(1)],
      learnerGroupIds: [uuid(10)],
    }),
    {
      directLearnerProfileIds: [uuid(1)],
      learnerGroupIds: [uuid(10)],
    },
  );
  assert.deepEqual(
    parseLessonRunsContract(replaceCourseAudienceInputSchema, {
      learnerProfileIds: [uuid(1)],
    }),
    { learnerProfileIds: [uuid(1)] },
  );
  assert.throws(
    () =>
      parseLessonRunsContract(replaceCourseAudienceInputSchema, {
        directLearnerProfileIds: [],
        learnerGroupIds: [uuid(10), uuid(10)],
      }),
    /Одна группа не может быть указана дважды/,
  );
});

test("schedule rejects duplicate learners and timestamps without an offset", () => {
  assert.throws(
    () =>
      parseLessonRunsContract(scheduleLessonRunInputSchema, {
        scheduledAt: "2026-08-08T10:00:00",
        plannedDurationMinutes: 45,
      }),
    CourseBuilderValidationError,
  );

  assert.throws(
    () =>
      parseLessonRunsContract(scheduleLessonRunInputSchema, {
        scheduledAt: "2026-08-08T01:00:00Z",
        plannedDurationMinutes: 45,
        learnerProfileIds: [uuid(1), uuid(1)],
      }),
    /Один ученик не может быть указан дважды/,
  );
});

test("completion requires participants and rejects duplicate learner results", () => {
  assert.throws(
    () =>
      parseLessonRunsContract(completeLessonRunInputSchema, {
        records: [],
      }),
    CourseBuilderValidationError,
  );

  assert.deepEqual(
    parseLessonRunsContract(completeLessonRunInputSchema, {
      teacherReport: "  Всё по плану  ",
      records: [
        {
          learnerProfileId: uuid(1),
          wasPresent: true,
          needsRepeat: false,
        },
      ],
    }),
    {
      teacherReport: "Всё по плану",
      records: [
        {
          learnerProfileId: uuid(1),
          wasPresent: true,
          needsRepeat: false,
          teacherComment: "",
        },
      ],
    },
  );

  assert.throws(
    () =>
      parseLessonRunsContract(completeLessonRunInputSchema, {
        records: [
          {
            learnerProfileId: uuid(1),
            wasPresent: true,
            needsRepeat: false,
          },
          {
            learnerProfileId: uuid(1),
            wasPresent: false,
            needsRepeat: false,
          },
        ],
      }),
    /ровно один раз/,
  );
});

test("schedule window is ordered and bounded", () => {
  assert.deepEqual(
    parseLessonRunsContract(lessonRunWindowInputSchema, {
      from: "2026-08-01T00:00:00Z",
      to: "2026-09-01T00:00:00Z",
    }),
    {
      from: "2026-08-01T00:00:00Z",
      to: "2026-09-01T00:00:00Z",
    },
  );

  assert.throws(
    () =>
      parseLessonRunsContract(lessonRunWindowInputSchema, {
        from: "2026-08-02T00:00:00Z",
        to: "2026-08-01T00:00:00Z",
      }),
    /позже начала/,
  );
});

test("completion must cover the expected learner set exactly", () => {
  assert.doesNotThrow(() =>
    assertSameLearnerSet([uuid(1), uuid(2)], [uuid(2), uuid(1)]),
  );
  assert.throws(
    () => assertSameLearnerSet([uuid(1), uuid(2)], [uuid(1)]),
    (error: unknown) =>
      error instanceof CourseBuilderConflictError &&
      error.code === "lesson_run_participants_changed",
  );
});
