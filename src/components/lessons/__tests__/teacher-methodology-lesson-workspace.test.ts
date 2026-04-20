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

test("plan tab renders premium canonical script for world-around-me lesson 1", () => {
  assert.equal(pedagogicalSource.includes("Структура урока"), true);
  assert.equal(pedagogicalSource.includes("45 минут"), true);
  assert.equal(pedagogicalSource.includes("15 шагов"), true);
  assert.equal(pedagogicalSource.includes("Смотрим видео «farm animals»"), true);
  assert.equal(pedagogicalSource.includes("Учим фразу 我是…"), true);
  assert.equal(pedagogicalSource.includes("Проход 1 — слово"), true);
  assert.equal(pedagogicalSource.includes("Проход 2 — предложение"), true);
  assert.equal(pedagogicalSource.includes("StepOneVideoEmbed"), true);
  assert.equal(pedagogicalSource.includes("Скачать"), true);
  assert.equal(pedagogicalSource.includes("Цель шага"), false);
  assert.equal(pedagogicalSource.includes("Критерии успеха"), false);
  assert.equal(pedagogicalSource.includes("Методические заметки"), false);
});

test("plan tab keeps local controls for student screen step selection", () => {
  assert.equal(pedagogicalSource.includes("На экран"), true);
  assert.equal(pedagogicalSource.includes("resolveCanonicalStepSource"), true);
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
  assert.equal(workspaceSource.includes("lessonIdentity"), true);
  assert.equal(workspaceSource.includes("readModel.lesson.methodologySlug"), true);
  assert.equal(workspaceSource.includes("source={null}"), true);
  assert.equal(workspaceSource.includes("unavailableReason={null}"), true);
  assert.equal(workspaceSource.includes("assetsById={readModel.unifiedReadModel.assetsById}"), true);
});

test("lesson 1 quick glossary keeps canonical phrase patterns", () => {
  assert.equal(pedagogicalSource.includes('"这是…"'), true);
  assert.equal(pedagogicalSource.includes('"我们…吧！"'), true);
  assert.equal(pedagogicalSource.includes('"这是狗。"'), true);
});
