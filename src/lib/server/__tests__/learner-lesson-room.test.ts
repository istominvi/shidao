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
  assert.equal(readModel.studentContent.sections.length > 0, true);
  assert.equal(readModel.studentContentMode, "canonical");
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
    parentModel.studentContent.sections,
    lessonContentFixtureMethodologyLessonStudentContent.sections,
  );
  assert.equal(parentModel.studentContentMode, "canonical");
});

test("student lesson room falls back to methodology projection when canonical content is missing", async () => {
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
      listReusableAssetsByIds: async () => lessonContentFixtureAssets,
      getStudentHomeworkReadModel: async () => [],
      loadParentLearningContextsByUser: async () => [],
      getParentHomeworkProjection: async () => [],
    },
  );

  assert.ok(readModel);
  assert.equal(readModel.studentContentMode, "fallback");
  assert.equal(readModel.studentContent.sections.some((s) => s.type === "lesson_focus"), true);
  assert.equal(readModel.studentContent.sections.some((s) => s.type === "recap"), true);
});

test("parent lesson room also uses fallback projection when canonical content is missing", async () => {
  const parentModel = await getParentLessonRoomReadModel(
    {
      userId: "u-parent",
      studentId: "s-1",
      scheduledLessonId: lessonContentFixtureScheduledLesson.id,
    },
    {
      getScheduledLessonById: async () => lessonContentFixtureScheduledLesson,
      getMethodologyLessonById: async () => lessonContentFixtureMethodologyLesson,
      getMethodologyLessonStudentContentByLessonId: async () => null,
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
      getParentHomeworkProjection: async () => [],
    },
  );

  assert.ok(parentModel);
  assert.equal(parentModel.studentContentMode, "fallback");
  assert.equal(parentModel.studentContent.sections.length > 0, true);
});

test("learner lesson room falls back when canonical source throws", async () => {
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
        throw new Error("invalid student content payload");
      },
      listReusableAssetsByIds: async () => lessonContentFixtureAssets,
      getStudentHomeworkReadModel: async () => [],
      loadParentLearningContextsByUser: async () => [],
      getParentHomeworkProjection: async () => [],
    },
  );

  assert.ok(readModel);
  assert.equal(readModel.studentContentMode, "fallback");
  assert.equal(readModel.studentContent.sections.length > 0, true);
});
