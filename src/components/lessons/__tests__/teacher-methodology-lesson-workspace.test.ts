import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const workspaceSource = readFileSync(
  "src/components/lessons/teacher-methodology-lesson-workspace.tsx",
  "utf8",
);
const lessonTabsSource = readFileSync(
  "src/components/lessons/teacher-lesson-tabs.tsx",
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

test("methodology workspace restores canonical top-level tabs", () => {
  assert.equal(workspaceSource.includes("TeacherLessonTabs"), true);
  assert.equal(workspaceSource.includes('const mainTabs: TeacherLessonTabKey[] = ["plan", "content", "homework"]'), true);
  assert.equal(workspaceSource.includes('useState<TeacherLessonTabKey>("plan")'), true);
  assert.equal(workspaceSource.includes('tone="embedded"'), true);
  assert.equal(lessonTabsSource.includes("План урока"), true);
  assert.equal(lessonTabsSource.includes("Контент"), true);
  assert.equal(lessonTabsSource.includes("Домашнее задание"), true);
  assert.equal(workspaceSource.includes("Контент для ученика"), false);
  assert.equal(workspaceSource.includes("Презентация"), true);
});

test("methodology workspace keeps resource hub inside plan tab", () => {
  assert.equal(workspaceSource.includes("Материалы к уроку"), true);
  assert.equal(workspaceSource.includes("Презентация к уроку"), true);
  assert.equal(workspaceSource.includes("Карточки урока"), true);
  assert.equal(workspaceSource.includes("Новые слова и фразы"), true);
  assert.equal(workspaceSource.includes("Реквизит к уроку"), true);
  assert.equal(workspaceSource.includes("Открыть на весь экран"), true);
  assert.equal(workspaceSource.includes("Слайд"), true);
  assert.equal(workspaceSource.includes("Карточка"), true);
  assert.equal(workspaceSource.includes("4 в ряд"), true);
  assert.equal(workspaceSource.includes("Слушать"), true);
  assert.equal(workspaceSource.includes("Открыть / скачать PDF"), false);
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
