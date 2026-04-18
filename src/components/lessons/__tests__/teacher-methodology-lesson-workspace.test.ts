import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const workspaceSource = readFileSync(
  "src/components/lessons/teacher-methodology-lesson-workspace.tsx",
  "utf8",
);
const pedagogicalSource = readFileSync(
  "src/components/lessons/teacher-lesson-pedagogical-content.tsx",
  "utf8",
);
const studentPanelSource = readFileSync(
  "src/components/lessons/lesson-student-content-panel.tsx",
  "utf8",
);
const homeworkPanelSource = readFileSync(
  "src/components/lessons/lesson-canonical-homework-panel.tsx",
  "utf8",
);

test("methodology workspace uses one canonical lesson card with embedded tabs", () => {
  assert.equal(workspaceSource.includes('<SurfaceCard as="section"'), true);
  assert.equal(workspaceSource.includes("Презентация"), true);
  assert.equal(workspaceSource.includes("Карточки"), true);
  assert.equal(workspaceSource.includes("Новые слова и фразы"), true);
  assert.equal(workspaceSource.includes("Реквизит к уроку"), true);
  assert.equal(workspaceSource.includes("Скачать PPTX"), true);
  assert.equal(workspaceSource.includes("flashcards:world-around-me-lesson-1"), true);
  assert.equal(workspaceSource.includes("cardImageRefs"), true);
  assert.equal(workspaceSource.includes("Откройте PDF"), true);
  assert.equal(workspaceSource.includes("Контент для ученика"), true);
  assert.equal(workspaceSource.includes("Домашнее задание"), true);
});

test("plan tab is organized as one pedagogical document without extra mini-navigation", () => {
  assert.equal(pedagogicalSource.includes('aria-label="План урока"'), true);
  assert.equal(pedagogicalSource.includes("Навигация по плану урока"), false);
  assert.equal(pedagogicalSource.includes('id="lesson-passport"'), true);
  assert.equal(pedagogicalSource.includes('id="lesson-materials"'), true);
  assert.equal(pedagogicalSource.includes('id="lesson-flow"'), true);
  assert.equal(pedagogicalSource.includes("md:grid-cols-4"), false);
});

test("content and homework panels support embedded mode without own outer SurfaceCard", () => {
  assert.equal(studentPanelSource.includes("embedded?: boolean"), true);
  assert.equal(studentPanelSource.includes("if (embedded)"), true);
  assert.equal(homeworkPanelSource.includes("embedded?: boolean"), true);
  assert.equal(homeworkPanelSource.includes("if (embedded)"), true);
  assert.equal(homeworkPanelSource.includes("TeacherHomeworkQuizPreviewPanel"), true);
});
