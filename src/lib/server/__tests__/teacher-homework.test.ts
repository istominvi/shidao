import assert from "node:assert/strict";
import test from "node:test";
import { getTeacherLessonHomeworkReadModel } from "../teacher-homework";

test("teacher homework read model includes typed info and quiz stats", async () => {
  const model = await getTeacherLessonHomeworkReadModel("lesson-1", {
    getScheduledLessonById: async () => ({
      id: "lesson-1",
      methodologyLessonId: "method-1",
      runtimeShell: {
        id: "shell-1",
        classId: "class-1",
        startsAt: "2026-04-09T10:00:00Z",
        runtimeStatus: "planned",
        format: "offline",
        place: "A",
      },
      runtimeNotes: "",
      outcomeNotes: "",
    }),
    isHomeworkSchemaReady: async () => true,
    getMethodologyHomeworkByLessonId: async () => ({
      id: "hw-1",
      methodologyLessonId: "method-1",
      title: "Quiz",
      kind: "quiz_single_choice",
      instructions: "instr",
      materialLinks: [],
      estimatedMinutes: 5,
      quiz: { id: "q", version: 1, questions: [{ id: "q1", prompt: "p", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], correctOptionId: "a" }] },
    }),
    getScheduledHomeworkAssignmentByLessonId: async () => ({
      id: "sha-1",
      scheduledLessonId: "lesson-1",
      methodologyHomeworkId: "hw-1",
      assignedByTeacherId: "t-1",
      recipientMode: "all",
      dueAt: "2026-04-10T10:00:00Z",
      assignmentComment: "Сделать вместе",
      issuedAt: "2026-04-09T10:00:00Z",
    }),
    listStudentsForClasses: async () => ({
      "class-1": [
        { id: "s-1", fullName: "A", login: "a" },
        { id: "s-2", fullName: "B", login: "b" },
      ],
    }),
    listStudentHomeworkAssignmentsByScheduledAssignment: async () => [
      {
        id: "st-1",
        scheduledHomeworkAssignmentId: "sha-1",
        studentId: "s-1",
        status: "submitted",
        submissionText: null,
        submissionPayload: null,
        autoScore: 4,
        autoMaxScore: 5,
        autoCheckedAt: "2026-04-09T11:00:00Z",
        submittedAt: "2026-04-09T11:00:00Z",
        reviewNote: null,
        reviewedAt: null,
      },
    ],
    createScheduledHomeworkAssignment: async () => {
      throw new Error("not used");
    },
    createStudentHomeworkAssignments: async () => {
      throw new Error("not used");
    },
    updateStudentHomeworkReview: async () => {
      throw new Error("not used");
    },
  });

  assert.equal(model.definition?.kind, "quiz_single_choice");
  assert.equal(model.definition?.questionCount, 1);
  assert.equal(model.assignment?.assignmentComment, "Сделать вместе");
  assert.equal(model.stats.assignedCount, 1);
  assert.equal(model.stats.submittedCount, 1);
  assert.equal(model.stats.averageScore, 0.8);
});
