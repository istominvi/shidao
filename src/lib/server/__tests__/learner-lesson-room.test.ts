import assert from "node:assert/strict";
import test from "node:test";
import {
  lessonContentFixtureAssets,
  lessonContentFixtureHomeworkDefinition,
  lessonContentFixtureMethodologyLesson,
  lessonContentFixtureScheduledLesson,
  lessonContentFixtureStudentContent,
} from "../../lesson-content";
import { getLearnerLessonRoomReadModel } from "../learner-lesson-room";

test("learner lesson room resolves lesson content + homework for student", async () => {
  const model = await getLearnerLessonRoomReadModel(
    {
      scheduledLessonId: lessonContentFixtureScheduledLesson.id,
      studentId: "s-1",
      readOnlyHomework: false,
    },
    {
      getScheduledLessonById: async () => lessonContentFixtureScheduledLesson,
      getMethodologyLessonById: async () => lessonContentFixtureMethodologyLesson,
      getMethodologyLessonStudentContentByLessonId: async () => lessonContentFixtureStudentContent,
      getMethodologyHomeworkByLessonId: async () => lessonContentFixtureHomeworkDefinition,
      getScheduledHomeworkAssignmentByLessonId: async () => ({
        id: "sha-1",
        scheduledLessonId: lessonContentFixtureScheduledLesson.id,
        methodologyHomeworkId: lessonContentFixtureHomeworkDefinition.id,
        assignedByTeacherId: "t-1",
        recipientMode: "all",
        dueAt: null,
        assignmentComment: null,
        issuedAt: "2026-04-10T00:00:00Z",
      }),
      listStudentHomeworkAssignmentsByScheduledAssignment: async () => [
        {
          id: "st-1",
          scheduledHomeworkAssignmentId: "sha-1",
          studentId: "s-1",
          status: "assigned",
          submissionText: null,
          submissionPayload: null,
          autoScore: null,
          autoMaxScore: null,
          autoCheckedAt: null,
          submittedAt: null,
          reviewNote: null,
          reviewedAt: null,
        },
      ],
      listReusableAssetsByIds: async () => lessonContentFixtureAssets,
    },
  );

  assert.ok(model);
  assert.equal(model?.lessonContent.sections.length, 9);
  assert.equal(model?.homework?.readOnly, false);
});

test("parent lesson room reuses same learner content projection", async () => {
  const model = await getLearnerLessonRoomReadModel(
    {
      scheduledLessonId: lessonContentFixtureScheduledLesson.id,
      studentId: "s-1",
      readOnlyHomework: true,
    },
    {
      getScheduledLessonById: async () => lessonContentFixtureScheduledLesson,
      getMethodologyLessonById: async () => lessonContentFixtureMethodologyLesson,
      getMethodologyLessonStudentContentByLessonId: async () => lessonContentFixtureStudentContent,
      getMethodologyHomeworkByLessonId: async () => lessonContentFixtureHomeworkDefinition,
      getScheduledHomeworkAssignmentByLessonId: async () => null,
      listStudentHomeworkAssignmentsByScheduledAssignment: async () => [],
      listReusableAssetsByIds: async () => lessonContentFixtureAssets,
    },
  );

  assert.equal(model?.lessonContent.title, lessonContentFixtureStudentContent.title);
  assert.equal(model?.homework, null);
});
