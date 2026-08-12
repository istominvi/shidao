import assert from "node:assert/strict";
import test from "node:test";
import {
  coursePublicationProgressSchema,
  updateCoursePublicationProgressSchema,
} from "./contracts";

const PUBLICATION_ID = "00000000-0000-4000-8000-000000000101";
const REVISION_ID = "00000000-0000-4000-8000-000000000102";
const LESSON_ID = "00000000-0000-4000-8000-000000000103";

test("progress contract keeps completion and the personal resume pointer", () => {
  const parsed = coursePublicationProgressSchema.parse({
    publicationId: PUBLICATION_ID,
    revisionId: REVISION_ID,
    lastOpenedLessonRef: LESSON_ID,
    completedLessonRefs: [LESSON_ID],
    completedLessonCount: 1,
    totalLessonCount: 2,
    percent: 50,
    complete: false,
  });
  assert.equal(parsed.lastOpenedLessonRef, LESSON_ID);

  assert.equal(
    coursePublicationProgressSchema.safeParse({
      ...parsed,
      completedLessonRefs: [LESSON_ID, LESSON_ID],
      completedLessonCount: 2,
      percent: 100,
      complete: true,
    }).success,
    false,
  );
  assert.equal(
    coursePublicationProgressSchema.safeParse({
      ...parsed,
      percent: 51,
    }).success,
    false,
  );
});

test("lesson progress update is an exact revision-scoped contract", () => {
  assert.deepEqual(
    updateCoursePublicationProgressSchema.parse({
      expectedRevisionId: REVISION_ID,
      lessonRef: LESSON_ID,
      completed: true,
    }),
    {
      expectedRevisionId: REVISION_ID,
      lessonRef: LESSON_ID,
      completed: true,
    },
  );
  assert.equal(
    updateCoursePublicationProgressSchema.safeParse({
      expectedRevisionId: REVISION_ID,
      lessonRef: LESSON_ID,
      completed: true,
      accountId: PUBLICATION_ID,
    }).success,
    false,
  );
});
