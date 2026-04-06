import assert from "node:assert/strict";
import test from "node:test";
import { lessonContentFixtureScheduledLesson } from "../../lesson-content";
import type { AccessResolution } from "../access-policy";
import {
  assertTeacherRuntimeMutationAccess,
  parseTeacherRuntimeUpdateFormData,
  updateTeacherLessonRuntime,
} from "../teacher-lesson-runtime-actions";

test("teacher runtime mutation access allows only teacher profile", () => {
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
    availableAdultProfiles: ["teacher" as const, "parent" as const],
    hasAnyAdultProfile: true,
    hasPin: false,
  };

  const teacherResolution: AccessResolution = {
    status: "adult-with-profile",
    activeProfile: "teacher",
    context: baseContext,
  };

  const parentResolution: AccessResolution = {
    ...teacherResolution,
    activeProfile: "parent",
    context: {
      ...baseContext,
      activeProfile: "parent" as const,
    },
  };

  assert.equal(assertTeacherRuntimeMutationAccess(teacherResolution).teacherId, "t-1");
  assert.throws(
    () => assertTeacherRuntimeMutationAccess(parentResolution),
    /Только профиль преподавателя/,
  );
});

test("runtime mutation parser accepts only allowed runtime fields and trims text", () => {
  const formData = new FormData();
  formData.set("runtimeStatus", "completed");
  formData.set("runtimeNotesSummary", "  summary  ");
  formData.set("runtimeNotes", "  notes  ");
  formData.set("outcomeNotes", "  outcome  ");

  const parsed = parseTeacherRuntimeUpdateFormData(formData);

  assert.deepEqual(parsed, {
    runtimeStatus: "completed",
    runtimeNotesSummary: "summary",
    runtimeNotes: "notes",
    outcomeNotes: "outcome",
  });

  const withUnknownField = new FormData();
  withUnknownField.set("runtimeStatus", "planned");
  withUnknownField.set("methodologyTitle", "hacked");

  assert.throws(
    () => parseTeacherRuntimeUpdateFormData(withUnknownField),
    /неподдерживаемые поля/,
  );
});

test("runtime mutation parser validates runtime status values", () => {
  const formData = new FormData();
  formData.set("runtimeStatus", "hybrid");
  formData.set("runtimeNotesSummary", "");
  formData.set("runtimeNotes", "");
  formData.set("outcomeNotes", "");

  assert.throws(() => parseTeacherRuntimeUpdateFormData(formData), /Неверный статус/);
});

test("runtime mutation updates scheduled lesson through allowed repository fields only", async () => {
  const calls: Array<Record<string, string>> = [];

  await updateTeacherLessonRuntime(
    {
      scheduledLessonId: "scheduled-1",
      teacherId: "teacher-1",
      payload: {
        runtimeStatus: "in_progress",
        runtimeNotesSummary: "summary",
        runtimeNotes: "runtime note",
        outcomeNotes: "outcome note",
      },
    },
    {
      getScheduledLessonById: async () => ({
        ...lessonContentFixtureScheduledLesson,
        id: "scheduled-1",
      }),
      assertTeacherAssignedToClass: async (teacherId, classId) => {
        calls.push({ teacherId, classId });
      },
      updateScheduledLessonRuntimeNotes: async (input) => {
        assert.deepEqual(input, {
          scheduledLessonId: "scheduled-1",
          runtimeStatus: "in_progress",
          runtimeNotesSummary: "summary",
          runtimeNotes: "runtime note",
          outcomeNotes: "outcome note",
        });

        return {
          ...lessonContentFixtureScheduledLesson,
          runtimeShell: {
            ...lessonContentFixtureScheduledLesson.runtimeShell,
            runtimeStatus: "in_progress",
            runtimeNotesSummary: "summary",
          },
          runtimeNotes: "runtime note",
          outcomeNotes: "outcome note",
        };
      },
    },
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    teacherId: "teacher-1",
    classId: lessonContentFixtureScheduledLesson.runtimeShell.classId,
  });
});
