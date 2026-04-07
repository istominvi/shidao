import assert from "node:assert/strict";
import test from "node:test";
import { getTeacherDashboardOperationsReadModel, getTeacherGroupsIndexOperationsReadModel } from "../teacher-dashboard-operations";

const deps = {
  listTeacherClasses: async () => [
    { id: "class-1", name: "Лисички", methodologyId: "m-1", methodologyTitle: "Мир вокруг" },
    { id: "class-2", name: "Драконы", methodologyId: null, methodologyTitle: null },
  ],
  listStudentsForClasses: async () => ({
    "class-1": [{ id: "s-1", fullName: "Анна", login: "anna" }],
    "class-2": [],
  }),
  listScheduledLessonsForClasses: async () => [
    {
      id: "sl-1",
      methodologyLessonId: "ml-1",
      runtimeShell: {
        id: "sl-1",
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
      id: "sl-2",
      methodologyLessonId: "ml-1",
      runtimeShell: {
        id: "sl-2",
        classId: "class-1",
        startsAt: "2026-04-01T10:00:00Z",
        format: "online" as const,
        meetingLink: "https://meet.example/1",
        runtimeStatus: "completed" as const,
        runtimeNotesSummary: "",
      },
      runtimeNotes: "",
      outcomeNotes: "",
    },
  ],
  listMethodologyLessonsByMethodology: async () => [{ id: "ml-1" }, { id: "ml-2" }] as never,
};

test("dashboard operations model builds rows, schedule and alerts", async () => {
  const model = await getTeacherDashboardOperationsReadModel(
    {
      teacherId: "t-1",
      nowIso: "2026-04-07T00:00:00Z",
      weekStartsAtIso: "2026-04-07T00:00:00Z",
    },
    deps,
  );

  assert.equal(model.groups.rows.length, 2);
  const foxes = model.groups.rows.find((row) => row.groupLabel === "Лисички");
  const dragons = model.groups.rows.find((row) => row.groupLabel === "Драконы");
  assert.equal(foxes?.progressLabel, "1/2 (50%)");
  assert.equal(dragons?.status, "attention");
  assert.equal(model.schedule.totalLessons, 1);
  assert.equal(model.alerts.groupsWithoutStudents, 1);
  assert.equal(model.actions[0]?.href, "/groups/new");
});

test("groups index supports search/methodology/status filtering", async () => {
  const filtered = await getTeacherGroupsIndexOperationsReadModel(
    {
      teacherId: "t-1",
      search: "лис",
      methodology: "Мир вокруг",
      status: "scheduled",
      nowIso: "2026-04-07T00:00:00Z",
    },
    deps,
  );

  assert.equal(filtered.rows.length, 1);
  assert.equal(filtered.rows[0]?.groupLabel, "Лисички");
});
