import assert from "node:assert/strict";
import test from "node:test";
import {
  lessonContentFixtureAssets,
  lessonContentFixtureHomeworkDefinition,
  lessonContentFixtureMethodologyLesson,
  lessonContentFixtureMethodologyLessonStudentContent,
  lessonContentFixtureMethodologyLessonStudentContentLessonTwo,
  lessonContentFixtureMethodologyLessonTwo,
  lessonContentFixtureScheduledLesson,
  lessonContentFixtureScheduledLessonLessonTwo,
} from "../../lesson-content";
import type { AccessResolution } from "../access-policy";
import {
  buildTeacherLessonWorkspaceReadModel,
  canAccessTeacherLessonWorkspace,
  getTeacherLessonWorkspaceByScheduledLessonId,
} from "../teacher-lesson-workspace";
import { InvalidLessonStudentContentPayloadError } from "../lesson-content-mappers";

const homeworkSnapshot = {
  schemaReady: true,
  definition: lessonContentFixtureHomeworkDefinition,
  assignment: null,
  stats: {
    assignedCount: 0,
    submittedCount: 0,
    reviewedCount: 0,
    needsRevisionCount: 0,
    averageScore: null,
  },
  roster: [],
};

test("teacher workspace loader combines scheduled + methodology and keeps sorted order", async () => {
  const readModel = await getTeacherLessonWorkspaceByScheduledLessonId(
    "scheduled-1",
    {
      getScheduledLessonById: async () => ({
        ...lessonContentFixtureScheduledLesson,
        id: "scheduled-1",
        methodologyLessonId: lessonContentFixtureMethodologyLesson.id,
      }),
      getMethodologyLessonById: async () => ({
        ...lessonContentFixtureMethodologyLesson,
        blocks: [
          lessonContentFixtureMethodologyLesson.blocks[4],
          lessonContentFixtureMethodologyLesson.blocks[0],
          lessonContentFixtureMethodologyLesson.blocks[7],
        ],
      }),
      getMethodologyLessonStudentContentByLessonId: async () =>
        lessonContentFixtureMethodologyLessonStudentContent,
      isLessonStudentContentSchemaReady: async () => true,
      listReusableAssetsByIds: async (ids) =>
        lessonContentFixtureAssets.filter((asset) => ids.includes(asset.id)),
      getClassDisplayNameById: async () => "Лисички 5-6",
      getHomeworkReadModel: async () => homeworkSnapshot,
      getLessonDiscussions: async () => [],
      getHomeworkDiscussions: async () => ({ assignmentId: null, items: [] }),
    },
  );

  assert.ok(readModel);
  assert.equal(readModel.classDisplayName, "Лисички 5-6");
  assert.deepEqual(
    readModel.projection.orderedBlocks.map((block) => block.order),
    [1, 5, 8],
  );
});

test("teacher workspace loader returns null when linked methodology lesson is missing", async () => {
  const readModel = await getTeacherLessonWorkspaceByScheduledLessonId(
    "scheduled-1",
    {
      getScheduledLessonById: async () => lessonContentFixtureScheduledLesson,
      getMethodologyLessonById: async () => null,
      getMethodologyLessonStudentContentByLessonId: async () => null,
      isLessonStudentContentSchemaReady: async () => true,
      listReusableAssetsByIds: async () => [],
      getClassDisplayNameById: async () => "Группа A",
      getHomeworkReadModel: async () => homeworkSnapshot,
      getLessonDiscussions: async () => [],
      getHomeworkDiscussions: async () => ({ assignmentId: null, items: [] }),
    },
  );

  assert.equal(readModel, null);
});

test("teacher workspace read model keeps runtime and methodology shells distinct", () => {
  const readModel = buildTeacherLessonWorkspaceReadModel({
    projection: {
      methodologyLessonId: lessonContentFixtureMethodologyLesson.id,
      methodologyShell: lessonContentFixtureMethodologyLesson.shell,
      runtimeShell: lessonContentFixtureScheduledLesson.runtimeShell,
      orderedBlocks: lessonContentFixtureMethodologyLesson.blocks,
      runtimeNotes: lessonContentFixtureScheduledLesson.runtimeNotes,
      outcomeNotes: lessonContentFixtureScheduledLesson.outcomeNotes,
    },
    scheduledLessonId: lessonContentFixtureScheduledLesson.id,
    classId: lessonContentFixtureScheduledLesson.runtimeShell.classId,
    sourceLesson: {
      methodologySlug: "world-around-me",
      lessonId: lessonContentFixtureMethodologyLesson.id,
      methodologyTitle: "Мир вокруг меня",
      lessonTitle: lessonContentFixtureMethodologyLesson.shell.title,
    },
    classDisplayName: "Лисички 5-6",
    assets: lessonContentFixtureAssets,
    homework: homeworkSnapshot,
    studentContent: lessonContentFixtureMethodologyLessonStudentContent,
  });

  assert.equal(readModel.projection.methodologyShell.title.length > 0, true);
  assert.equal(readModel.projection.runtimeShell.runtimeStatus, "planned");
  assert.equal("runtimeStatus" in readModel.projection.methodologyShell, false);
  assert.equal("readinessStatus" in readModel.projection.runtimeShell, false);
});

test("teacher workspace presentation hero does not depend on raw class id", () => {
  const readModel = buildTeacherLessonWorkspaceReadModel({
    projection: {
      methodologyLessonId: lessonContentFixtureMethodologyLesson.id,
      methodologyShell: lessonContentFixtureMethodologyLesson.shell,
      runtimeShell: lessonContentFixtureScheduledLesson.runtimeShell,
      orderedBlocks: lessonContentFixtureMethodologyLesson.blocks,
      runtimeNotes: lessonContentFixtureScheduledLesson.runtimeNotes,
      outcomeNotes: lessonContentFixtureScheduledLesson.outcomeNotes,
    },
    scheduledLessonId: lessonContentFixtureScheduledLesson.id,
    classId: "11111111-1111-4111-8111-111111111111",
    sourceLesson: {
      methodologySlug: "world-around-me",
      lessonId: lessonContentFixtureMethodologyLesson.id,
      methodologyTitle: "Мир вокруг меня",
      lessonTitle: lessonContentFixtureMethodologyLesson.shell.title,
    },
    assets: lessonContentFixtureAssets,
    homework: homeworkSnapshot,
    studentContent: lessonContentFixtureMethodologyLessonStudentContent,
  });

  assert.equal(readModel.presentation.hero.groupLabel, "Группа");
  assert.equal(
    readModel.presentation.hero.groupLabel.includes("11111111-1111"),
    false,
  );
});

test("teacher workspace presentation keeps methodology title separate from lesson title", () => {
  const readModel = buildTeacherLessonWorkspaceReadModel({
    projection: {
      methodologyLessonId: lessonContentFixtureMethodologyLesson.id,
      methodologyTitle: "Мир вокруг меня",
      methodologyShell: {
        ...lessonContentFixtureMethodologyLesson.shell,
        title: "Урок 1. Животные на ферме",
      },
      runtimeShell: lessonContentFixtureScheduledLesson.runtimeShell,
      orderedBlocks: lessonContentFixtureMethodologyLesson.blocks,
      runtimeNotes: lessonContentFixtureScheduledLesson.runtimeNotes,
      outcomeNotes: lessonContentFixtureScheduledLesson.outcomeNotes,
    },
    scheduledLessonId: lessonContentFixtureScheduledLesson.id,
    classId: lessonContentFixtureScheduledLesson.runtimeShell.classId,
    classDisplayName: "Лисички 5-6",
    sourceLesson: {
      methodologySlug: "world-around-me",
      lessonId: lessonContentFixtureMethodologyLesson.id,
      methodologyTitle: "Мир вокруг меня",
      lessonTitle: lessonContentFixtureMethodologyLesson.shell.title,
    },
    assets: lessonContentFixtureAssets,
    homework: homeworkSnapshot,
    studentContent: lessonContentFixtureMethodologyLessonStudentContent,
  });

  assert.equal(
    readModel.presentation.hero.lessonTitle,
    "Урок 1. Животные на ферме",
  );
  assert.equal(readModel.presentation.hero.methodologyTitle, "Мир вокруг меня");
  assert.equal("methodologyLine" in readModel.presentation.hero, false);
});

test("teacher workspace quick summary and lesson flow are derived from lesson content", () => {
  const readModel = buildTeacherLessonWorkspaceReadModel({
    projection: {
      methodologyLessonId: lessonContentFixtureMethodologyLesson.id,
      methodologyShell: lessonContentFixtureMethodologyLesson.shell,
      runtimeShell: lessonContentFixtureScheduledLesson.runtimeShell,
      orderedBlocks: lessonContentFixtureMethodologyLesson.blocks,
      runtimeNotes: "runtime note",
      outcomeNotes: "outcome note",
    },
    scheduledLessonId: lessonContentFixtureScheduledLesson.id,
    classId: lessonContentFixtureScheduledLesson.runtimeShell.classId,
    sourceLesson: {
      methodologySlug: "world-around-me",
      lessonId: lessonContentFixtureMethodologyLesson.id,
      methodologyTitle: "Мир вокруг меня",
      lessonTitle: lessonContentFixtureMethodologyLesson.shell.title,
    },
    classDisplayName: "Лисички 5-6",
    assets: lessonContentFixtureAssets,
    homework: homeworkSnapshot,
    studentContent: lessonContentFixtureMethodologyLessonStudentContent,
  });

  assert.ok(readModel.presentation.quickSummary.prepChecklist.length > 0);
  assert.deepEqual(
    readModel.presentation.quickSummary.keyWords,
    lessonContentFixtureMethodologyLesson.shell.vocabularySummary,
  );
  assert.deepEqual(
    readModel.presentation.lessonFlow.map((step) => step.order),
    lessonContentFixtureMethodologyLesson.blocks.map((block) => block.order),
  );
  assert.equal(readModel.presentation.hero.lessonEssence.length > 0, true);
});

test("teacher workspace read model includes runtime edit fields and no block override structure", () => {
  const readModel = buildTeacherLessonWorkspaceReadModel({
    projection: {
      methodologyLessonId: lessonContentFixtureMethodologyLesson.id,
      methodologyShell: lessonContentFixtureMethodologyLesson.shell,
      runtimeShell: {
        ...lessonContentFixtureScheduledLesson.runtimeShell,
        runtimeStatus: "completed",
        runtimeNotesSummary: "Сильный прогресс",
      },
      orderedBlocks: lessonContentFixtureMethodologyLesson.blocks,
      runtimeNotes: "runtime note",
      outcomeNotes: "outcome note",
    },
    scheduledLessonId: lessonContentFixtureScheduledLesson.id,
    classId: lessonContentFixtureScheduledLesson.runtimeShell.classId,
    sourceLesson: {
      methodologySlug: "world-around-me",
      lessonId: lessonContentFixtureMethodologyLesson.id,
      methodologyTitle: "Мир вокруг меня",
      lessonTitle: lessonContentFixtureMethodologyLesson.shell.title,
    },
    classDisplayName: "Лисички 5-6",
    assets: lessonContentFixtureAssets,
    homework: homeworkSnapshot,
    studentContent: lessonContentFixtureMethodologyLessonStudentContent,
  });

  assert.equal(readModel.projection.runtimeShell.runtimeStatus, "completed");
  assert.equal(
    readModel.projection.runtimeShell.runtimeNotesSummary,
    "Сильный прогресс",
  );
  assert.equal(readModel.projection.runtimeNotes, "runtime note");
  assert.equal(readModel.projection.outcomeNotes, "outcome note");
  assert.equal(
    readModel.studentContent.source?.title,
    "Урок 1. Животные на ферме",
  );
  assert.equal(readModel.studentContent.unavailableReason, null);
  assert.equal("blockOverrides" in readModel.projection, false);
  assert.equal("blockOverrides" in readModel.presentation, false);
});

test("teacher workspace falls back to fixture learner content when student-content schema is unavailable", async () => {
  const readModel = await getTeacherLessonWorkspaceByScheduledLessonId(
    "scheduled-1",
    {
      getScheduledLessonById: async () => ({
        ...lessonContentFixtureScheduledLesson,
        id: "scheduled-1",
        methodologyLessonId: lessonContentFixtureMethodologyLesson.id,
      }),
      getMethodologyLessonById: async () =>
        lessonContentFixtureMethodologyLesson,
      getMethodologyLessonStudentContentByLessonId: async () => null,
      isLessonStudentContentSchemaReady: async () => false,
      listReusableAssetsByIds: async () => [],
      getClassDisplayNameById: async () => "Лисички 5-6",
      getHomeworkReadModel: async () => homeworkSnapshot,
      getLessonDiscussions: async () => [],
      getHomeworkDiscussions: async () => ({ assignmentId: null, items: [] }),
    },
  );

  assert.ok(readModel);
  assert.equal(readModel.studentContent.source?.title, "Урок 1. Животные на ферме");
  assert.equal(readModel.studentContent.unavailableReason, null);
  assert.ok(readModel.presentation.lessonFlow.length > 0);
});

test("teacher workspace falls back to fixture learner content when payload is malformed", async () => {
  const readModel = await getTeacherLessonWorkspaceByScheduledLessonId(
    "scheduled-1",
    {
      getScheduledLessonById: async () => ({
        ...lessonContentFixtureScheduledLesson,
        id: "scheduled-1",
        methodologyLessonId: lessonContentFixtureMethodologyLesson.id,
      }),
      getMethodologyLessonById: async () =>
        lessonContentFixtureMethodologyLesson,
      getMethodologyLessonStudentContentByLessonId: async () => {
        throw new InvalidLessonStudentContentPayloadError("invalid payload");
      },
      isLessonStudentContentSchemaReady: async () => true,
      listReusableAssetsByIds: async () => [],
      getClassDisplayNameById: async () => "Лисички 5-6",
      getHomeworkReadModel: async () => homeworkSnapshot,
      getLessonDiscussions: async () => [],
      getHomeworkDiscussions: async () => ({ assignmentId: null, items: [] }),
    },
  );

  assert.ok(readModel);
  assert.equal(readModel.studentContent.source?.title, "Урок 1. Животные на ферме");
  assert.equal(readModel.studentContent.unavailableReason, null);
  assert.ok(readModel.presentation.lessonFlow.length > 0);
});

test("teacher workspace fallback resolves lesson 2 learner deck without lesson-1 hardcoding", async () => {
  const readModel = await getTeacherLessonWorkspaceByScheduledLessonId(
    "scheduled-2",
    {
      getScheduledLessonById: async () => ({
        ...lessonContentFixtureScheduledLessonLessonTwo,
        id: "scheduled-2",
        methodologyLessonId: lessonContentFixtureMethodologyLessonTwo.id,
      }),
      getMethodologyLessonById: async () => lessonContentFixtureMethodologyLessonTwo,
      getMethodologyLessonStudentContentByLessonId: async () => null,
      isLessonStudentContentSchemaReady: async () => false,
      listReusableAssetsByIds: async () => [],
      getClassDisplayNameById: async () => "Лисички 5-6",
      getHomeworkReadModel: async () => homeworkSnapshot,
      getLessonDiscussions: async () => [],
      getHomeworkDiscussions: async () => ({ assignmentId: null, items: [] }),
    },
  );

  assert.ok(readModel);
  assert.equal(
    readModel.studentContent.source?.id,
    lessonContentFixtureMethodologyLessonStudentContentLessonTwo.id,
  );
  assert.equal(readModel.studentContent.unavailableReason, null);
  assert.equal(readModel.studentContent.source?.sections.length >= 10, true);
});

test("teacher workspace still throws on core homework load failure", async () => {
  await assert.rejects(
    () =>
      getTeacherLessonWorkspaceByScheduledLessonId("scheduled-1", {
        getScheduledLessonById: async () => ({
          ...lessonContentFixtureScheduledLesson,
          id: "scheduled-1",
          methodologyLessonId: lessonContentFixtureMethodologyLesson.id,
        }),
        getMethodologyLessonById: async () =>
          lessonContentFixtureMethodologyLesson,
        getMethodologyLessonStudentContentByLessonId: async () =>
          lessonContentFixtureMethodologyLessonStudentContent,
        isLessonStudentContentSchemaReady: async () => true,
        listReusableAssetsByIds: async () => [],
        getClassDisplayNameById: async () => "Лисички 5-6",
        getHomeworkReadModel: async () => {
          throw new Error("homework core failed");
        },
        getLessonDiscussions: async () => [],
        getHomeworkDiscussions: async () => ({ assignmentId: null, items: [] }),
      }),
    /homework core failed/,
  );
});

test("teacher workspace access allows only teacher profile", () => {
  const baseContext = {
    userId: "u-1",
    email: "teacher@example.com",
    fullName: "Teacher One",
    actorKind: "adult" as const,
    student: {
      id: "s-0",
      login: "stub",
      first_name: null,
      last_name: null,
    },
    teacher: { id: "t-1", full_name: "Teacher One" },
    parent: { id: "p-1", full_name: "Parent One" },
    preferences: {
      last_active_profile: "teacher" as const,
      last_selected_school_id: null,
      theme: null,
      settings: {},
    },
    activeProfile: "teacher" as const,
    availableAdultProfiles: ["teacher" as const],
    hasAnyAdultProfile: true,
    hasPin: false,
  };

  const teacherResolution: AccessResolution = {
    status: "adult-with-profile",
    activeProfile: "teacher",
    context: baseContext,
  };

  const studentResolution: AccessResolution = {
    status: "student",
    context: {
      ...baseContext,
      actorKind: "student",
      student: {
        id: "s-1",
        login: "student",
        first_name: "Stu",
        last_name: "Dent",
      },
    },
  };

  assert.equal(canAccessTeacherLessonWorkspace(teacherResolution), true);
  assert.equal(canAccessTeacherLessonWorkspace(studentResolution), false);
  assert.equal(canAccessTeacherLessonWorkspace({ status: "guest" }), false);
});
