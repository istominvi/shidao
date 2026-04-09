import assert from "node:assert/strict";
import test from "node:test";
import { getStudentHomeworkReadModel, submitStudentHomework } from "../student-homework";

test("student homework read model keeps lesson title and quiz data", async () => {
  const model = await getStudentHomeworkReadModel(
    { studentId: "s-1", classIds: ["c-1"] },
    {
      listScheduledLessonsForClasses: async () => [{
        id: "lesson-1",
        methodologyLessonId: "m-1",
        runtimeShell: { id: "shell-1", classId: "c-1", startsAt: "2026-04-10T10:00:00Z", runtimeStatus: "planned", format: "offline", place: "A" },
        runtimeNotes: "",
        outcomeNotes: "",
      }],
      getScheduledLessonById: async () => null,
      getMethodologyLessonById: async () => ({ id: "m-1", methodologyId: "x", methodologySlug: "slug", shell: { id: "s", methodologyId: "x", title: "Урок 1", position: { moduleIndex: 1, unitIndex: 1, lessonIndex: 1 }, vocabularySummary: [], phraseSummary: [], estimatedDurationMinutes: 45, mediaSummary: { videos: 0, songs: 0, worksheets: 0, other: 0 }, readinessStatus: "ready" }, blocks: [] }),
      getMethodologyHomeworkByLessonId: async () => ({ id: "hw-1", methodologyLessonId: "m-1", title: "Тест", kind: "quiz_single_choice", instructions: "", materialLinks: [], quiz: { id: "q", version: 1, questions: [{ id: "q1", prompt: "Вопрос", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], correctOptionId: "a" }] } }),
      getScheduledHomeworkAssignmentByLessonId: async () => ({ id: "sha-1", scheduledLessonId: "lesson-1", methodologyHomeworkId: "hw-1", assignedByTeacherId: "t", recipientMode: "all", dueAt: null, assignmentComment: "comment", issuedAt: "x" }),
      getScheduledHomeworkAssignmentById: async () => null,
      listStudentHomeworkAssignmentsByScheduledAssignment: async () => [{ id: "st-1", scheduledHomeworkAssignmentId: "sha-1", studentId: "s-1", status: "assigned", submissionText: null, submissionPayload: null, autoScore: null, autoMaxScore: null, autoCheckedAt: null, submittedAt: null, reviewNote: null, reviewedAt: null }],
      getStudentHomeworkAssignmentById: async () => null,
      updateStudentHomeworkSubmission: async () => { throw new Error("unused"); },
    },
  );

  assert.equal(model[0]?.lessonTitle, "Урок 1");
  assert.equal(model[0]?.kind, "quiz_single_choice");
  assert.equal(model[0]?.issueComment, "comment");
});

test("student submit supports practice_text and quiz autograding", async () => {
  let textUpdated = false;
  await submitStudentHomework(
    { studentId: "s-1", studentHomeworkAssignmentId: "st-1", submissionText: " ответ " },
    {
      listScheduledLessonsForClasses: async () => [],
      getScheduledLessonById: async () => ({ id: "lesson-1", methodologyLessonId: "m-1", runtimeShell: { id: "x", classId: "c", startsAt: "2026-04-10T10:00:00Z", runtimeStatus: "planned", format: "offline", place: "A" }, runtimeNotes: "", outcomeNotes: "" }),
      getMethodologyLessonById: async () => null,
      getMethodologyHomeworkByLessonId: async () => ({ id: "hw", methodologyLessonId: "m-1", title: "text", kind: "practice_text", instructions: "", materialLinks: [] }),
      getScheduledHomeworkAssignmentByLessonId: async () => null,
      getScheduledHomeworkAssignmentById: async () => ({ id: "sha-1", scheduledLessonId: "lesson-1", methodologyHomeworkId: "hw", assignedByTeacherId: "t", recipientMode: "all", dueAt: null, assignmentComment: null, issuedAt: "x" }),
      listStudentHomeworkAssignmentsByScheduledAssignment: async () => [],
      getStudentHomeworkAssignmentById: async () => ({ id: "st-1", scheduledHomeworkAssignmentId: "sha-1", studentId: "s-1", status: "assigned", submissionText: null, submissionPayload: null, autoScore: null, autoMaxScore: null, autoCheckedAt: null, submittedAt: null, reviewNote: null, reviewedAt: null }),
      updateStudentHomeworkSubmission: async (payload) => {
        textUpdated = true;
        assert.equal(payload.submissionText, "ответ");
        return { id: "st-1", scheduledHomeworkAssignmentId: "sha-1", studentId: "s-1", status: "submitted", submissionText: "ответ", submissionPayload: null, autoScore: null, autoMaxScore: null, autoCheckedAt: null, submittedAt: payload.submittedAt, reviewNote: null, reviewedAt: null };
      },
    },
  );
  assert.equal(textUpdated, true);

  const quizResult = await submitStudentHomework(
    { studentId: "s-1", studentHomeworkAssignmentId: "st-2", submissionPayload: { answers: [{ questionId: "q1", selectedOptionId: "a" }] } },
    {
      listScheduledLessonsForClasses: async () => [],
      getScheduledLessonById: async () => ({ id: "lesson-1", methodologyLessonId: "m-1", runtimeShell: { id: "x", classId: "c", startsAt: "2026-04-10T10:00:00Z", runtimeStatus: "planned", format: "offline", place: "A" }, runtimeNotes: "", outcomeNotes: "" }),
      getMethodologyLessonById: async () => null,
      getMethodologyHomeworkByLessonId: async () => ({ id: "hw", methodologyLessonId: "m-1", title: "quiz", kind: "quiz_single_choice", instructions: "", materialLinks: [], quiz: { id: "q", version: 1, questions: [{ id: "q1", prompt: "Вопрос", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], correctOptionId: "a" }] } }),
      getScheduledHomeworkAssignmentByLessonId: async () => null,
      getScheduledHomeworkAssignmentById: async () => ({ id: "sha-1", scheduledLessonId: "lesson-1", methodologyHomeworkId: "hw", assignedByTeacherId: "t", recipientMode: "all", dueAt: null, assignmentComment: null, issuedAt: "x" }),
      listStudentHomeworkAssignmentsByScheduledAssignment: async () => [],
      getStudentHomeworkAssignmentById: async () => ({ id: "st-2", scheduledHomeworkAssignmentId: "sha-1", studentId: "s-1", status: "assigned", submissionText: null, submissionPayload: null, autoScore: null, autoMaxScore: null, autoCheckedAt: null, submittedAt: null, reviewNote: null, reviewedAt: null }),
      updateStudentHomeworkSubmission: async (payload) => {
        assert.equal(payload.autoScore, 1);
        assert.equal(payload.autoMaxScore, 1);
        return { id: "st-2", scheduledHomeworkAssignmentId: "sha-1", studentId: "s-1", status: "submitted", submissionText: null, submissionPayload: payload.submissionPayload, autoScore: 1, autoMaxScore: 1, autoCheckedAt: payload.autoCheckedAt, submittedAt: payload.submittedAt, reviewNote: null, reviewedAt: null };
      },
    },
  );

  assert.equal(quizResult.autoScore, 1);
});
