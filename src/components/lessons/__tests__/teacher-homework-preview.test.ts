import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const teacherHomeworkPanelSource = readFileSync(
  "src/components/lessons/teacher-homework-panel.tsx",
  "utf8",
);
const teacherPreviewPanelSource = readFileSync(
  "src/components/lessons/teacher-homework-quiz-preview-panel.tsx",
  "utf8",
);
const sharedQuizSource = readFileSync(
  "src/components/lessons/homework-quiz-experience.tsx",
  "utf8",
);
const studentQuizCardSource = readFileSync(
  "src/components/dashboard/student-homework-quiz-card.tsx",
  "utf8",
);

test("teacher homework panel renders dedicated student-preview block for quiz homework", () => {
  assert.equal(teacherHomeworkPanelSource.includes("TeacherHomeworkQuizPreviewPanel"), true);
  assert.equal(teacherHomeworkPanelSource.includes("homework.definition.quizDefinition"), true);
});

test("preview panel communicates local non-persistent preview semantics", () => {
  assert.equal(teacherPreviewPanelSource.includes("Предпросмотр ученической версии"), true);
  assert.equal(teacherPreviewPanelSource.includes("Это локальный предпросмотр. Ответы не сохраняются"), true);
  assert.equal(teacherPreviewPanelSource.includes('mode="preview"'), true);
});

test("shared quiz experience keeps preview local and student mode form-based", () => {
  assert.equal(sharedQuizSource.includes('mode: "student" | "preview"'), true);
  assert.equal(sharedQuizSource.includes('if (mode === "preview" && previewCompleted)'), true);
  assert.equal(sharedQuizSource.includes("Предпросмотр завершён"), true);
  assert.equal(sharedQuizSource.includes("Начать заново"), true);
  assert.equal(sharedQuizSource.includes("Посмотреть результат"), true);
  assert.equal(sharedQuizSource.includes("/api/student/homework/"), true);
});

test("student quiz card remains thin wrapper around shared student mode", () => {
  assert.equal(studentQuizCardSource.includes("HomeworkQuizExperience"), true);
  assert.equal(studentQuizCardSource.includes('mode="student"'), true);
  assert.equal(studentQuizCardSource.includes("item.studentHomeworkAssignmentId"), true);
});
