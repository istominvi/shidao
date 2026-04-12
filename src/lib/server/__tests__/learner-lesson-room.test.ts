import assert from "node:assert/strict";
import test from "node:test";
import {
  lessonContentFixtureAssets,
  lessonContentFixtureMethodologyLesson,
  lessonContentFixtureMethodologyLessonStudentContent,
  lessonContentFixtureScheduledLesson,
} from "../../lesson-content";
import {
  getParentLessonRoomReadModel,
  getStudentLessonRoomReadModel,
} from "../learner-lesson-room";
import { InvalidLessonStudentContentPayloadError } from "../lesson-content-mappers";

test("student lesson room resolves scheduled lesson + student content + homework", async () => {
  const readModel = await getStudentLessonRoomReadModel(
    {
      studentId: "s-1",
      classIds: [lessonContentFixtureScheduledLesson.runtimeShell.classId],
      scheduledLessonId: lessonContentFixtureScheduledLesson.id,
    },
    {
      getScheduledLessonById: async () => lessonContentFixtureScheduledLesson,
      getMethodologyLessonById: async () => lessonContentFixtureMethodologyLesson,
      getMethodologyLessonStudentContentByLessonId: async () =>
        lessonContentFixtureMethodologyLessonStudentContent,
      isLessonStudentContentSchemaReady: async () => true,
      listReusableAssetsByIds: async () => lessonContentFixtureAssets,
      getStudentHomeworkReadModel: async () => [
        {
          classId: lessonContentFixtureScheduledLesson.runtimeShell.classId,
          scheduledLessonId: lessonContentFixtureScheduledLesson.id,
          scheduledHomeworkAssignmentId: "sha-1",
          lessonTitle: "Урок 1",
          homeworkTitle: "Тест",
          kind: "quiz_single_choice",
          instructions: "ответь на вопросы",
          dueAt: null,
          issueComment: null,
          status: "assigned",
          statusLabel: "Ожидает сдачи",
          studentHomeworkAssignmentId: "st-1",
          submissionText: null,
          submissionPayload: null,
          reviewNote: null,
          score: null,
          maxScore: null,
          quizMeta: null,
          quizDefinition: null,
        },
      ],
      loadParentLearningContextsByUser: async () => [],
      getParentHomeworkProjection: async () => [],
    },
  );

  assert.ok(readModel);
  assert.equal(readModel.homework?.role, "student");
  assert.equal((readModel.studentContent?.sections.length ?? 0) > 0, true);
  assert.equal(readModel.studentContentUnavailableReason, null);
});

test("parent lesson room reuses same learner-facing content projection", async () => {
  const parentModel = await getParentLessonRoomReadModel(
    {
      userId: "u-parent",
      studentId: "s-1",
      scheduledLessonId: lessonContentFixtureScheduledLesson.id,
    },
    {
      getScheduledLessonById: async () => lessonContentFixtureScheduledLesson,
      getMethodologyLessonById: async () => lessonContentFixtureMethodologyLesson,
      getMethodologyLessonStudentContentByLessonId: async () =>
        lessonContentFixtureMethodologyLessonStudentContent,
      isLessonStudentContentSchemaReady: async () => true,
      listReusableAssetsByIds: async () => lessonContentFixtureAssets,
      getStudentHomeworkReadModel: async () => [],
      loadParentLearningContextsByUser: async () => [
        {
          studentId: "s-1",
          studentName: "Student One",
          login: "student1",
          classes: [
            {
              classId: lessonContentFixtureScheduledLesson.runtimeShell.classId,
              className: "A",
              schoolId: "school-1",
              schoolName: "Школа",
            },
          ],
        },
      ],
      getParentHomeworkProjection: async () => [
        {
          studentId: "s-1",
          items: [
            {
              studentId: "s-1",
              scheduledLessonId: lessonContentFixtureScheduledLesson.id,
              lessonTitle: "Урок 1",
              homeworkTitle: "Тест",
              dueAt: null,
              statusLabel: "Назначено",
              assignmentComment: null,
              reviewNote: null,
              score: null,
              maxScore: null,
            },
          ],
        },
      ],
    },
  );

  assert.ok(parentModel);
  assert.equal(parentModel.homework?.role, "parent");
  assert.deepEqual(
    parentModel.studentContent?.sections,
    lessonContentFixtureMethodologyLessonStudentContent.sections,
  );
});

test("learner lesson room degrades gracefully when student content source is unavailable", async () => {
  const readModel = await getStudentLessonRoomReadModel(
    {
      studentId: "s-1",
      classIds: [lessonContentFixtureScheduledLesson.runtimeShell.classId],
      scheduledLessonId: lessonContentFixtureScheduledLesson.id,
    },
    {
      getScheduledLessonById: async () => lessonContentFixtureScheduledLesson,
      getMethodologyLessonById: async () => lessonContentFixtureMethodologyLesson,
      getMethodologyLessonStudentContentByLessonId: async () => null,
      isLessonStudentContentSchemaReady: async () => false,
      listReusableAssetsByIds: async () => [],
      getStudentHomeworkReadModel: async () => [],
      loadParentLearningContextsByUser: async () => [],
      getParentHomeworkProjection: async () => [],
    },
  );

  assert.ok(readModel);
  assert.equal(readModel.studentContent, null);
  assert.equal(readModel.studentContentUnavailableReason, "schema_missing");
});

test("learner lesson room degrades gracefully when student content payload is malformed", async () => {
  const readModel = await getStudentLessonRoomReadModel(
    {
      studentId: "s-1",
      classIds: [lessonContentFixtureScheduledLesson.runtimeShell.classId],
      scheduledLessonId: lessonContentFixtureScheduledLesson.id,
    },
    {
      getScheduledLessonById: async () => lessonContentFixtureScheduledLesson,
      getMethodologyLessonById: async () => lessonContentFixtureMethodologyLesson,
      getMethodologyLessonStudentContentByLessonId: async () => {
        throw new InvalidLessonStudentContentPayloadError("invalid payload");
      },
      isLessonStudentContentSchemaReady: async () => true,
      listReusableAssetsByIds: async () => [],
      getStudentHomeworkReadModel: async () => [],
      loadParentLearningContextsByUser: async () => [],
      getParentHomeworkProjection: async () => [],
    },
  );

  assert.ok(readModel);
  assert.equal(readModel.studentContent, null);
  assert.equal(readModel.studentContentUnavailableReason, "invalid_payload");
});
