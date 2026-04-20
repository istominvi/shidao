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

test("methodology workspace uses plan / student screen / homework tabs", () => {
  assert.equal(workspaceSource.includes('const mainTabs: TeacherLessonTabKey[] = ["plan", "student_screen", "homework"]'), true);
  assert.equal(lessonTabsSource.includes("План урока"), true);
  assert.equal(lessonTabsSource.includes("Экран ученика"), true);
  assert.equal(lessonTabsSource.includes("Контент"), false);
  assert.equal(lessonTabsSource.includes("Домашнее задание"), true);
  assert.equal(studentPanelSource.includes("На весь экран"), true);
  assert.equal(workspaceSource.includes("showFullscreenControl"), true);
});

test("plan tab renders detailed pedagogical cards with phase and student preview", () => {
  assert.equal(pedagogicalSource.includes("Кратко об уроке"), true);
  assert.equal(pedagogicalSource.includes("Подготовка до урока"), true);
  assert.equal(pedagogicalSource.includes("Ход урока"), true);
  assert.equal(pedagogicalSource.includes("quickSummary.prepChecklist.length ? ("), true);

  assert.equal(pedagogicalSource.includes("Открытие урока"), true);
  assert.equal(pedagogicalSource.includes("Ввод языка"), true);
  assert.equal(pedagogicalSource.includes("Активная практика"), true);
  assert.equal(pedagogicalSource.includes("Закрепление"), true);
  assert.equal(pedagogicalSource.includes("Завершение"), true);

  assert.equal(pedagogicalSource.includes("На экране ученика"), true);
  assert.equal(pedagogicalSource.includes("Опорный экран без интерактива"), true);
  assert.equal(pedagogicalSource.includes("Что говорит педагог"), true);
  assert.equal(pedagogicalSource.includes("Целевой язык"), false);

  assert.equal(pedagogicalSource.includes("Педагогические детали будут уточнены"), false);
  assert.equal(pedagogicalSource.includes("не указано"), false);
  assert.equal(pedagogicalSource.includes('href={asset.fileRef ?? asset.sourceUrl ?? "#"}'), false);
  assert.equal(pedagogicalSource.includes('href="#"'), false);
});

test("plan tab keeps local controls for student screen step selection", () => {
  assert.equal(pedagogicalSource.includes("Показать ученикам"), true);
  assert.equal(pedagogicalSource.includes("Открыть экран ученика"), true);
  assert.equal(pedagogicalSource.includes("onOpenStudentScreen?.(step.id)"), true);
  assert.equal(workspaceSource.includes("setSelectedStepId(stepId);"), true);
  assert.equal(workspaceSource.includes("setTab(\"student_screen\")"), true);
});

test("student screen panel supports step deck API and controlled navigation", () => {
  assert.equal(studentPanelSource.includes("steps?: MethodologyLessonStep[]"), true);
  assert.equal(studentPanelSource.includes("controlledStepId?: string"), true);
  assert.equal(studentPanelSource.includes("mode?: \"teacher_preview\" | \"student_live_locked\" | \"student_review\""), true);
  assert.equal(studentPanelSource.includes("showFullscreenControl?: boolean"), true);
  assert.equal(studentPanelSource.includes("embedded && fullscreenButton"), true);
});

test("methodology workspace uses unified read model as primary source", () => {
  assert.equal(workspaceSource.includes("readModel.unifiedReadModel.lesson.durationLabel"), true);
  assert.equal(workspaceSource.includes("source={null}"), true);
  assert.equal(workspaceSource.includes("unavailableReason={null}"), true);
  assert.equal(workspaceSource.includes("assetsById={readModel.unifiedReadModel.assetsById}"), true);
});
