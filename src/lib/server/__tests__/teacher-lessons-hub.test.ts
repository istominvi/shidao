import assert from "node:assert/strict";
import test from "node:test";
import { lessonContentFixtureMethodologyLesson } from "../../lesson-content";
import type { AccessResolution } from "../access-policy";
import {
  assertTeacherLessonsHubMutationAccess,
  canAccessTeacherLessonsHub,
  createTeacherScheduledLesson,
  getTeacherLessonsHub,
  parseCreateScheduledLessonFormData,
} from "../teacher-lessons-hub";

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

test("lessons hub access allows only teacher profile", () => {
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

  assert.equal(canAccessTeacherLessonsHub(teacherResolution), true);
  assert.equal(canAccessTeacherLessonsHub(parentResolution), false);
  assert.throws(
    () => assertTeacherLessonsHubMutationAccess(parentResolution),
    /Только профиль преподавателя/,
  );
});

test("lessons hub read model groups upcoming and past lessons and shapes cards", async () => {
  const hub = await getTeacherLessonsHub(
    { teacherId: "teacher-1", nowIso: "2026-04-07T10:00:00Z" },
    {
      listAssignedClassIdsForTeacher: async () => ["class-1"],
      listScheduledLessonsForClasses: async () => [
        {
          id: "scheduled-future",
          methodologyLessonId: "methodology-1",
          runtimeShell: {
            id: "scheduled-future",
            classId: "class-1",
            startsAt: "2026-04-07T12:00:00Z",
            format: "online",
            meetingLink: "https://zoom.example/1",
            runtimeStatus: "planned",
            runtimeNotesSummary: "Короткий фокус на новых словах",
          },
          runtimeNotes: "",
          outcomeNotes: "",
        },
        {
          id: "scheduled-past",
          methodologyLessonId: "methodology-1",
          runtimeShell: {
            id: "scheduled-past",
            classId: "class-1",
            startsAt: "2026-04-06T12:00:00Z",
            format: "offline",
            place: "Кабинет 5",
            runtimeStatus: "completed",
            runtimeNotesSummary: "Отличная вовлечённость",
          },
          runtimeNotes: "",
          outcomeNotes: "",
        },
      ],
      getClassDisplayNameById: async () => "Лисички 5-6",
      getMethodologyLessonById: async () => lessonContentFixtureMethodologyLesson,
      listMethodologyLessonsCatalog: async () => [
        {
          id: lessonContentFixtureMethodologyLesson.id,
          title: lessonContentFixtureMethodologyLesson.shell.title,
          methodologyId: lessonContentFixtureMethodologyLesson.methodologyId,
          methodologyTitle: lessonContentFixtureMethodologyLesson.methodologyTitle ?? null,
          moduleIndex: 1,
          unitIndex: 1,
          lessonIndex: 1,
        },
      ],
      createScheduledLesson: async () => {
        throw new Error("not used");
      },
      assertTeacherAssignedToClass: async () => {
        throw new Error("not used");
      },
    },
  );

  assert.equal(hub.upcoming.length, 1);
  assert.equal(hub.past.length, 1);
  assert.equal(hub.upcoming[0]?.statusLabel, "Запланировано");
  assert.equal(hub.past[0]?.statusLabel, "Проведено");
  assert.equal(hub.upcoming[0]?.workspaceHref, "/lessons/scheduled-future");
  assert.equal(hub.upcoming[0]?.classLabel, "Лисички 5-6");
  assert.equal("blockOverrides" in hub.upcoming[0]!, false);
});

test("lessons hub card identity stays human-readable and does not leak class uuid", async () => {
  const hub = await getTeacherLessonsHub(
    { teacherId: "teacher-1", nowIso: "2026-04-07T10:00:00Z" },
    {
      listAssignedClassIdsForTeacher: async () => ["11111111-1111-4111-8111-111111111111"],
      listScheduledLessonsForClasses: async () => [
        {
          id: "scheduled-1",
          methodologyLessonId: "methodology-1",
          runtimeShell: {
            id: "scheduled-1",
            classId: "11111111-1111-4111-8111-111111111111",
            startsAt: "2026-04-07T12:00:00Z",
            format: "online",
            meetingLink: "https://zoom.example/1",
            runtimeStatus: "planned",
            runtimeNotesSummary: "",
          },
          runtimeNotes: "",
          outcomeNotes: "",
        },
      ],
      getClassDisplayNameById: async () => null,
      getMethodologyLessonById: async () => lessonContentFixtureMethodologyLesson,
      listMethodologyLessonsCatalog: async () => [],
      createScheduledLesson: async () => {
        throw new Error("not used");
      },
      assertTeacherAssignedToClass: async () => {
        throw new Error("not used");
      },
    },
  );

  assert.equal(hub.upcoming[0]?.classLabel, "Группа");
  assert.equal(hub.upcoming[0]?.classLabel.includes("11111111-1111"), false);
});

test("create scheduled lesson parser validates required fields and online/offline rules", () => {
  const online = new FormData();
  online.set("classId", "class-1");
  online.set("methodologyLessonId", "lesson-1");
  online.set("date", "2026-04-20");
  online.set("time", "10:30");
  online.set("format", "online");
  online.set("meetingLink", "https://zoom.example/room");

  assert.equal(parseCreateScheduledLessonFormData(online).format, "online");

  const offlineMissingPlace = new FormData();
  offlineMissingPlace.set("classId", "class-1");
  offlineMissingPlace.set("methodologyLessonId", "lesson-1");
  offlineMissingPlace.set("date", "2026-04-20");
  offlineMissingPlace.set("time", "10:30");
  offlineMissingPlace.set("format", "offline");

  assert.throws(
    () => parseCreateScheduledLessonFormData(offlineMissingPlace),
    /укажите место проведения/i,
  );

  const unsupportedFormat = new FormData();
  unsupportedFormat.set("classId", "class-1");
  unsupportedFormat.set("methodologyLessonId", "lesson-1");
  unsupportedFormat.set("date", "2026-04-20");
  unsupportedFormat.set("time", "10:30");
  unsupportedFormat.set("format", "hybrid");

  assert.throws(
    () => parseCreateScheduledLessonFormData(unsupportedFormat),
    /должен быть online или offline/i,
  );
});

test("teacher create flow uses createScheduledLessonAdmin dependency and returns workspace-compatible id", async () => {
  const calls: Array<{ teacherId: string; classId: string; createdClassId: string }> = [];

  const created = await createTeacherScheduledLesson(
    {
      teacherId: "teacher-1",
      payload: {
        classId: "class-1",
        methodologyLessonId: "lesson-1",
        startsAt: "2026-04-20T10:30:00Z",
        format: "online",
        meetingLink: "https://zoom.example/room",
      },
    },
    {
      listAssignedClassIdsForTeacher: async () => [],
      listScheduledLessonsForClasses: async () => [],
      getClassDisplayNameById: async () => null,
      getMethodologyLessonById: async () => null,
      listMethodologyLessonsCatalog: async () => [],
      assertTeacherAssignedToClass: async (teacherId, classId) => {
        calls.push({ teacherId, classId, createdClassId: "" });
      },
      createScheduledLesson: async (input) => {
        calls[0]!.createdClassId = input.classId;
        const runtimeShell =
          input.format === "online"
            ? {
                id: "scheduled-created-1",
                classId: input.classId,
                startsAt: input.startsAt,
                format: "online" as const,
                meetingLink: input.meetingLink,
                runtimeStatus: "planned" as const,
                runtimeNotesSummary: "",
              }
            : {
                id: "scheduled-created-1",
                classId: input.classId,
                startsAt: input.startsAt,
                format: "offline" as const,
                place: input.place,
                runtimeStatus: "planned" as const,
                runtimeNotesSummary: "",
              };
        return {
          id: "scheduled-created-1",
          methodologyLessonId: input.methodologyLessonId,
          runtimeShell,
          runtimeNotes: "",
          outcomeNotes: "",
        };
      },
    },
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    teacherId: "teacher-1",
    classId: "class-1",
    createdClassId: "class-1",
  });
  assert.equal(created.id, "scheduled-created-1");
  assert.equal(`/lessons/${created.id}`, "/lessons/scheduled-created-1");
});
