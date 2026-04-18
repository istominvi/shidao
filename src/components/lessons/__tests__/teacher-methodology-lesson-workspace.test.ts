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
});

test("plan tab keeps only pedagogical scenario and contextual resource chips", () => {
  assert.equal(workspaceSource.includes("TeacherLessonContentHub readModel"), true);
  assert.equal(workspaceSource.includes("resourceChipsByStepId"), true);
  assert.equal(workspaceSource.includes("Видео farm animals"), true);
  assert.equal(workspaceSource.includes("Карточки животных"), true);
  assert.equal(workspaceSource.includes("Аудио слов"), true);
  assert.equal(workspaceSource.includes("Приложение 1"), true);
  assert.equal(workspaceSource.includes("Рабочая тетрадь, стр. 3–4"), true);
  assert.equal(workspaceSource.includes("Песня farm animals"), true);
  assert.equal(workspaceSource.includes("TeacherLessonPlanResources"), false);
  assert.equal(workspaceSource.includes("Реквизит к уроку"), false);
});

test("plan tab remains scannable: passport + preparation + step-by-step plan", () => {
  assert.equal(pedagogicalSource.includes('aria-label="План урока"'), true);
  assert.equal(pedagogicalSource.includes("Навигация по плану урока"), false);
  assert.equal(pedagogicalSource.includes('id="lesson-passport"'), true);
  assert.equal(pedagogicalSource.includes('id="lesson-materials"'), true);
  assert.equal(pedagogicalSource.includes('id="lesson-flow"'), true);
  assert.equal(pedagogicalSource.includes("Подготовка к уроку"), true);
  assert.equal(pedagogicalSource.includes("Ресурсы по шагу"), true);
});

test("content tab hosts material hub sections and homework remains embedded", () => {
  assert.equal(workspaceSource.includes("Презентация к уроку"), true);
  assert.equal(workspaceSource.includes("Карточки урока"), true);
  assert.equal(workspaceSource.includes("Новые слова и фразы"), true);
  assert.equal(workspaceSource.includes("Материалы урока"), true);
  assert.equal(workspaceSource.includes("Предпросмотр для ученика"), true);
  assert.equal(studentPanelSource.includes("embedded?: boolean"), true);
  assert.equal(studentPanelSource.includes("if (embedded)"), true);
  assert.equal(homeworkPanelSource.includes("embedded?: boolean"), true);
  assert.equal(homeworkPanelSource.includes("if (embedded)"), true);
  assert.equal(homeworkPanelSource.includes("TeacherHomeworkQuizPreviewPanel"), true);
});
