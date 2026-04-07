import assert from "node:assert/strict";
import test from "node:test";
import type { AccessResolution } from "../access-policy";
import {
  assertTeacherGroupsAccess,
  canAccessTeacherGroups,
  getTeacherDashboardReadModel,
  getTeacherGroupOverview,
  getTeacherGroupsIndex,
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

test("groups index and dashboard read models are group-centric", async () => {
  const deps = {
    listTeacherClasses: async () => [
      { id: "class-1", name: "Лисички 5-6" },
      { id: "class-2", name: "Драконы" },
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
    getMethodologyLessonById: async (id: string) => ({ methodologyTitle: id === "ml-1" ? "Мир вокруг" : "Приветствия" } as never),
  };

  const groups = await getTeacherGroupsIndex(
    { teacherId: "t-1", nowIso: "2026-04-07T00:00:00Z" },
    deps,
  );
  assert.equal(groups.groups.length, 2);
  assert.equal(groups.groups[0]?.label, "Драконы");
  assert.equal(groups.groups[1]?.studentCount, 2);
  assert.equal(groups.groups[1]?.upcomingLessonCount, 1);

  const dashboard = await getTeacherDashboardReadModel(
    { teacherId: "t-1", nowIso: "2026-04-07T00:00:00Z" },
    deps,
  );
  assert.equal(dashboard.groups[0]?.id, "class-1");
  assert.equal(dashboard.upcomingLessons[0]?.href, "/lessons/scheduled-future");
  assert.equal(dashboard.upcomingLessons[0]?.groupLabel, "Лисички 5-6");
});

test("group overview returns scoped students and lessons", async () => {
  const overview = await getTeacherGroupOverview(
    { teacherId: "t-1", groupId: "class-1", nowIso: "2026-04-07T00:00:00Z" },
    {
      listTeacherClasses: async () => [{ id: "class-1", name: "Лисички 5-6" }],
      listStudentsForClasses: async () => ({
        "class-1": [{ id: "s-1", fullName: null, login: "fox" }],
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
      ],
      getMethodologyLessonById: async () => ({ methodologyTitle: "Мир вокруг" } as never),
    },
  );

  assert.ok(overview);
  assert.equal(overview?.students[0]?.displayName, "@fox");
  assert.equal(overview?.upcomingLessons.length, 1);
  assert.equal(overview?.upcomingLessons[0]?.title, "Мир вокруг");

  const missing = await getTeacherGroupOverview(
    { teacherId: "t-1", groupId: "class-404", nowIso: "2026-04-07T00:00:00Z" },
    {
      listTeacherClasses: async () => [{ id: "class-1", name: "Лисички 5-6" }],
      listStudentsForClasses: async () => ({}),
      listScheduledLessonsForClasses: async () => [],
      getMethodologyLessonById: async () => null,
    },
  );

  assert.equal(missing, null);
});
