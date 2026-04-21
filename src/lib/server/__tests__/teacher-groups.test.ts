import assert from "node:assert/strict";
import test from "node:test";
import type { AccessResolution } from "../access-policy";
import {
  assertTeacherGroupsAccess,
  canAccessTeacherGroups,
  createTeacherGroup,
  createTeacherGroupScopedLesson,
  getTeacherGroupOverview,
  getTeacherGroupsIndex,
  parseGroupScopedLessonFormData,
} from "../teacher-groups";

const teacherContext = {
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
  availableAdultProfiles: ["teacher" as const, "parent" as const],
  hasAnyAdultProfile: true,
  hasPin: false,
};

test("teacher groups access allows only teacher profile", () => {
  const teacherResolution: AccessResolution = {
    status: "adult-with-profile",
    activeProfile: "teacher",
    context: teacherContext,
  };
  const parentResolution: AccessResolution = {
    ...teacherResolution,
    activeProfile: "parent",
    context: {
      ...teacherContext,
      activeProfile: "parent",
    },
  };

  assert.equal(canAccessTeacherGroups(teacherResolution), true);
  assert.equal(canAccessTeacherGroups(parentResolution), false);
  assert.throws(() => assertTeacherGroupsAccess(parentResolution), /Только профиль преподавателя/);
});

test("group models use explicit methodology assignment and honest progress", async () => {
  const deps = {
    listTeacherClasses: async () => [
      { id: "class-1", schoolId: "school-personal", name: "Лисички 5-6", methodologyId: "m-1", methodologyTitle: "Мир вокруг" },
      { id: "class-2", schoolId: "school-personal", name: "Драконы", methodologyId: null, methodologyTitle: null },
    ],
    listStudentsForClasses: async () => ({
      "class-1": [
        { id: "s-1", fullName: "Аня", login: "anya" },
        { id: "s-2", fullName: "Борис", login: "boris" },
      ],
      "class-2": [],
    }),
    listScheduledLessonsForClasses: async () => [
      {
        id: "scheduled-future",
        methodologyLessonId: "ml-1",
        runtimeShell: {
          id: "scheduled-future",
          classId: "class-1",
          startsAt: "2026-04-08T10:00:00Z",
          format: "online" as const,
          meetingLink: "https://meet.example/1",
          runtimeStatus: "planned" as const,
          runtimeNotesSummary: "",
        },
        runtimeNotes: "",
        outcomeNotes: "",
      },
      {
        id: "scheduled-past",
        methodologyLessonId: "ml-2",
        runtimeShell: {
          id: "scheduled-past",
          classId: "class-1",
          startsAt: "2026-04-01T10:00:00Z",
          format: "offline" as const,
          place: "Кабинет 4",
          runtimeStatus: "completed" as const,
          runtimeNotesSummary: "",
        },
        runtimeNotes: "",
        outcomeNotes: "",
      },
    ],
    getMethodologyLessonById: async () =>
      ({ shell: { title: "Урок", position: { moduleIndex: 1, unitIndex: 1, lessonIndex: 1 } } } as never),
    listMethodologies: async () => [{ id: "m-1", title: "Мир вокруг", shortDescription: null }],
    listMethodologyLessonsByMethodology: async () =>
      [
        { id: "ml-1", shell: { title: "Урок 1", position: { moduleIndex: 1, unitIndex: 1, lessonIndex: 1 } } },
        { id: "ml-2", shell: { title: "Урок 2", position: { moduleIndex: 1, unitIndex: 1, lessonIndex: 2 } } },
      ] as never,
    createScheduledLesson: async () => { throw new Error("unused"); },
    createClassForTeacher: async () => ({ classId: "unused" }),
    assertTeacherAssignedToClass: async () => undefined,
  };

  const groups = await getTeacherGroupsIndex({ teacherId: "t-1", nowIso: "2026-04-07T00:00:00Z" }, deps);
  assert.equal(groups.groups[1]?.progressLabel, "1 / 2 (50%)");

  const overview = await getTeacherGroupOverview(
    { teacherId: "t-1", groupId: "class-1", nowIso: "2026-04-07T00:00:00Z" },
    deps,
  );
  assert.equal(overview?.methodology.assignedMethodologyTitle, "Мир вокруг");
  assert.equal(overview?.schedule.canSchedule, true);
  assert.equal(overview?.students[0]?.login, "anya");
});

test("group creation requires methodology and scheduling validates assigned methodology", async () => {
  const created = await createTeacherGroup(
    { teacherId: "t-1", userId: "u-1", teacherFullName: "Teacher One", name: "Лисички", methodologyId: "m-2" },
    {
      listTeacherClasses: async () => [],
      listStudentsForClasses: async () => ({}),
      listScheduledLessonsForClasses: async () => [],
      getMethodologyLessonById: async () => null,
      listMethodologies: async () => [],
      listMethodologyLessonsByMethodology: async () => [],
      createScheduledLesson: async () => {
        throw new Error("unused");
      },
      createClassForTeacher: async () => ({ classId: "class-7" }),
      assertTeacherAssignedToClass: async () => undefined,
    },
  );
  assert.equal(created.classId, "class-7");

  await assert.rejects(
    () =>
      createTeacherGroup(
        { teacherId: "t-1", userId: "u-1", teacherFullName: "Teacher One", name: "Без методики", methodologyId: "" },
        {
          listTeacherClasses: async () => [],
          listStudentsForClasses: async () => ({}),
          listScheduledLessonsForClasses: async () => [],
          getMethodologyLessonById: async () => null,
          listMethodologies: async () => [],
          listMethodologyLessonsByMethodology: async () => [],
          createScheduledLesson: async () => {
            throw new Error("unused");
          },
          createClassForTeacher: async () => ({ classId: "class-8" }),
          assertTeacherAssignedToClass: async () => undefined,
        },
      ),
    /выберите методику/i,
  );

  await assert.rejects(
    () =>
      createTeacherGroupScopedLesson(
        {
          teacherId: "t-1",
          groupId: "class-1",
          payload: {
            methodologyLessonId: "ml-outside",
            startsAt: "2026-04-20T10:30:00Z",
            format: "online",
            meetingLink: "https://zoom.example/room",
          },
        },
        {
          listTeacherClasses: async () => [
            { id: "class-1", schoolId: "school-personal", name: "Лисички", methodologyId: "m-1", methodologyTitle: "Мир" },
          ],
          listStudentsForClasses: async () => ({}),
          listScheduledLessonsForClasses: async () => [],
          getMethodologyLessonById: async () => null,
          listMethodologies: async () => [],
          listMethodologyLessonsByMethodology: async () => [{ id: "ml-1" }] as never,
          assertTeacherAssignedToClass: async () => undefined,
          createClassForTeacher: async () => ({ classId: "unused" }),
          createScheduledLesson: async () => {
            throw new Error("should not create");
          },
        },
      ),
    /не принадлежит назначенной методике/i,
  );
});

test("group-scoped scheduling parser enforces online/offline constraints", () => {
  const offlineMissingPlace = new FormData();
  offlineMissingPlace.set("methodologyLessonId", "lesson-1");
  offlineMissingPlace.set("date", "2026-04-20");
  offlineMissingPlace.set("time", "10:30");
  offlineMissingPlace.set("format", "offline");

  assert.throws(
    () => parseGroupScopedLessonFormData(offlineMissingPlace),
    /укажите место проведения/i,
  );
});
