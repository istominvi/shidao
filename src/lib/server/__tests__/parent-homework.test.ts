import assert from "node:assert/strict";
import test from "node:test";
import { getParentHomeworkProjection } from "../parent-homework";

test("parent projection includes score and comments", async () => {
  const projection = await getParentHomeworkProjection(
    {
      children: [{ studentId: "s-1", classIds: ["c-1"] }],
    },
    {
      listScheduledLessonsForClasses: async () => [{
        id: "lesson-1",
        methodologyLessonId: "m-1",
        runtimeShell: { id: "x", classId: "c-1", startsAt: "2026-04-10T10:00:00Z", runtimeStatus: "planned", format: "offline", place: "A" },
        runtimeNotes: "",
        outcomeNotes: "",
      }],
      getScheduledHomeworkAssignmentByLessonId: async () => ({ id: "sha-1", scheduledLessonId: "lesson-1", methodologyHomeworkId: "hw", assignedByTeacherId: "t", recipientMode: "all", dueAt: null, assignmentComment: "Комментарий", issuedAt: "x" }),
      listStudentHomeworkAssignmentsByScheduledAssignment: async () => [{ id: "st-1", scheduledHomeworkAssignmentId: "sha-1", studentId: "s-1", status: "reviewed", submissionText: null, submissionPayload: null, autoScore: 4, autoMaxScore: 5, autoCheckedAt: null, submittedAt: null, reviewNote: "Молодец", reviewedAt: null }],
      getMethodologyLessonById: async () => ({ id: "m-1", methodologyId: "md", methodologySlug: "slug", shell: { id: "s", methodologyId: "md", title: "Урок 1", position: { moduleIndex: 1, unitIndex: 1, lessonIndex: 1 }, vocabularySummary: [], phraseSummary: [], estimatedDurationMinutes: 45, mediaSummary: { videos: 0, songs: 0, worksheets: 0, other: 0 }, readinessStatus: "ready" }, blocks: [] }),
      getMethodologyHomeworkByLessonId: async () => ({ id: "hw", methodologyLessonId: "m-1", title: "Тест", kind: "quiz_single_choice", instructions: "", materialLinks: [] }),
    },
  );

  assert.equal(projection[0]?.items[0]?.homeworkTitle, "Тест");
  assert.equal(projection[0]?.items[0]?.score, 4);
  assert.equal(projection[0]?.items[0]?.reviewNote, "Молодец");
});
