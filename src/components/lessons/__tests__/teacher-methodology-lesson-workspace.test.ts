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
  assert.equal(pedagogicalSource.includes("Смотрим видео «Животные на ферме»"), true);
  assert.equal(pedagogicalSource.includes("Учим фразу 我是…"), true);
  assert.equal(pedagogicalSource.includes("Проход 1 — слово"), true);
  assert.equal(pedagogicalSource.includes("Проход 2 — предложение"), true);
  assert.equal(pedagogicalSource.includes("StepOneVideoEmbed"), true);
  assert.equal(pedagogicalSource.includes("Скачать"), true);
  assert.equal(pedagogicalSource.includes("LessonOnePlan"), true);
});

test("plan tab keeps local controls for student screen step selection", () => {
  assert.equal(pedagogicalSource.includes("На экран"), true);
  assert.equal(pedagogicalSource.includes("resolveCanonicalStepSource"), true);
  assert.equal(workspaceSource.includes("setSelectedStepId(stepId);"), true);
  assert.equal(workspaceSource.includes("setTab(\"student_screen\")"), true);
});

test("generic plan renders full teacher-side step details for canonical lessons", () => {
  assert.equal(pedagogicalSource.includes("function GenericPlan"), true);
  assert.equal(pedagogicalSource.includes("Действия преподавателя"), true);
  assert.equal(pedagogicalSource.includes("Действия детей"), true);
  assert.equal(pedagogicalSource.includes("Ожидаемые ответы"), true);
  assert.equal(pedagogicalSource.includes("Критерии успеха"), true);
  assert.equal(pedagogicalSource.includes("Методические заметки"), true);
  assert.equal(pedagogicalSource.includes("GenericStepResources"), true);
});

test("plan tab renders rich source materials for world-around-me lesson 4", () => {
  assert.equal(pedagogicalSource.includes("function LessonFourPlan"), true);
  assert.equal(pedagogicalSource.includes("isLessonFourPlan(lessonIdentity)"), true);
  assert.equal(pedagogicalSource.includes("Игра 4.6 · что пропало?"), true);
  assert.equal(pedagogicalSource.includes("Игра 4.7 · сортировка по корзинам"), true);
  assert.equal(pedagogicalSource.includes("color-animals-grassland.svg"), true);
  assert.equal(pedagogicalSource.includes("color-domino.svg"), true);
  assert.equal(pedagogicalSource.includes("workbook-pages-7-8.svg"), true);
  assert.equal(pedagogicalSource.includes("song-video:my-favorite-color-is-blue"), true);
  assert.equal(pedagogicalSource.includes("extractGoogleDriveFileId"), true);
  assert.equal(pedagogicalSource.includes("drivePreviewUrl"), true);
});

test("plan tab renders rich source materials for world-around-me lesson 5", () => {
  assert.equal(pedagogicalSource.includes("function LessonFivePlan"), true);
  assert.equal(pedagogicalSource.includes("isLessonFivePlan(lessonIdentity)"), true);
  assert.equal(pedagogicalSource.includes("Игра «Колесо слов»"), true);
  assert.equal(pedagogicalSource.includes("appendix-2-page-01.png"), true);
  assert.equal(pedagogicalSource.includes("lesson-5-slide-22.png"), true);
  assert.equal(pedagogicalSource.includes("worksheet:lesson-5-homework"), true);
  assert.equal(pedagogicalSource.includes("presentation:world-around-me-lesson-5"), true);
});

test("student screen has custom interactions for world-around-me lesson 5", () => {
  const learnerDeckSource = readFileSync(
    "src/components/lessons/lesson-learner-content-deck.tsx",
    "utf8",
  );
  assert.equal(learnerDeckSource.includes("PlantWheelGameRenderer"), true);
  assert.equal(learnerDeckSource.includes("MeadowBuilderRenderer"), true);
  assert.equal(learnerDeckSource.includes("plant_wheel_game_v1"), true);
  assert.equal(learnerDeckSource.includes("meadow_builder_v1"), true);
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
