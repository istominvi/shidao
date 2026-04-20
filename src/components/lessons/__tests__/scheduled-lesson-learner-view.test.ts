import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/components/lessons/scheduled-lesson-learner-view.tsx",
  "utf8",
);

const sharedDeckSource = readFileSync(
  "src/components/lessons/lesson-learner-content-deck.tsx",
  "utf8",
);
const studentPanelSource = readFileSync(
  "src/components/lessons/lesson-student-content-panel.tsx",
  "utf8",
);

test("learner lesson view supports dedicated preview role", () => {
  assert.equal(source.includes("ScheduledLessonPreviewView"), true);
});

test("learner lesson view renders shared learner deck", () => {
  assert.equal(source.includes("LessonLearnerContentDeck"), true);
  assert.equal(source.includes("model.unifiedReadModel.steps"), true);
  assert.equal(source.includes("controlledStepId"), true);
  assert.equal(source.includes("student_live_locked"), true);
  assert.equal(source.includes("student_review"), true);
  assert.equal(source.includes("model.studentContent?.sections"), false);
});

test("scheduled learner view handles planned/completed/cancelled states", () => {
  assert.equal(source.includes("Учитель ещё не начал урок"), true);
  assert.equal(source.includes("Преподаватель откроет первый шаг"), false);
  assert.equal(source.includes("Урок отменён"), true);
  assert.equal(source.includes("/api/lessons/${model.scheduledLessonId}/live-state"), true);
  assert.equal(source.includes("/api/student/lessons/${model.scheduledLessonId}/homework"), true);
  assert.equal(source.includes("Домашнее задание пока не выдано."), true);
  assert.equal(source.includes("setStudentTab(\"homework\")"), true);
  assert.equal(source.includes("window.clearInterval(timer)"), true);
  assert.equal(source.includes("catch {"), true);
});

test("shared learner deck works as step-by-step player", () => {
  assert.equal(sharedDeckSource.includes("buildLegacyStepDeckFromStudentContent"), true);
  assert.equal(sharedDeckSource.includes("hasUnifiedSteps"), true);
  assert.equal(sharedDeckSource.includes("Шаг"), true);
  assert.equal(sharedDeckSource.includes("Сцена"), false);
  assert.equal(sharedDeckSource.includes("Назад"), true);
  assert.equal(sharedDeckSource.includes("Далее"), true);
  assert.equal(sharedDeckSource.includes("Инструкция для ученика"), false);
});

test("shared learner deck mode behavior uses learner-focused banners and locking", () => {
  assert.equal(sharedDeckSource.includes("mode !== \"student_live_locked\""), true);
  assert.equal(sharedDeckSource.includes("Урок ведёт преподаватель"), true);
  assert.equal(sharedDeckSource.includes("Повторение урока"), true);
  assert.equal(sharedDeckSource.includes("Режим предпросмотра для преподавателя"), false);
});

test("shared learner deck keeps existing rich renderers", () => {
  assert.equal(sharedDeckSource.includes("FlashcardCarousel"), true);
  assert.equal(sharedDeckSource.includes("ActionSlider"), true);
  assert.equal(sharedDeckSource.includes('section.type === "presentation"'), true);
  assert.equal(sharedDeckSource.includes('section.type === "count_board"'), true);
  assert.equal(sharedDeckSource.includes("StepResources"), true);
  assert.equal(sharedDeckSource.includes("Материалы шага"), false);
  assert.equal(sharedDeckSource.includes("Посмотри и послушай"), true);
});

test("learner wording removes teacher-only labels and uses child-friendly roadmap", () => {
  assert.equal(sharedDeckSource.includes("Что делает педагог"), false);
  assert.equal(sharedDeckSource.includes("План урока"), false);
  assert.equal(sharedDeckSource.includes("Что сегодня делаем"), true);
  assert.equal(sharedDeckSource.includes("контента"), false);
  assert.equal(sharedDeckSource.includes("Слушай преподавателя"), true);
});

test("student panel fullscreen button is functional and has no dead control", () => {
  assert.equal(studentPanelSource.includes("document.fullscreenEnabled"), true);
  assert.equal(studentPanelSource.includes("requestFullscreen"), true);
  assert.equal(studentPanelSource.includes("exitFullscreen"), true);
  assert.equal(studentPanelSource.includes("showFullscreenControl"), true);
  assert.equal(studentPanelSource.includes("shouldShowFullscreenButton"), true);
  assert.equal(studentPanelSource.includes("if (!container || !isFullscreenSupported) return;"), true);
  assert.equal(studentPanelSource.includes("catch {"), true);
  assert.equal(studentPanelSource.includes("На весь экран"), true);
  assert.equal(studentPanelSource.includes("Выйти из полноэкранного режима"), true);
  assert.equal(studentPanelSource.includes('href="#"'), false);
});

test("deck navigation calls onStepChange and supports controlled id flow", () => {
  assert.equal(sharedDeckSource.includes("controlledStepId"), true);
  assert.equal(sharedDeckSource.includes("onStepChange?.(next.id)"), true);
  assert.equal(sharedDeckSource.includes("disabled={currentStepIndex === 0}"), true);
  assert.equal(sharedDeckSource.includes("disabled={currentStepIndex >= resolvedSteps.length - 1}"), true);
});

test("scheduled learner view unlocks navigation in review mode", () => {
  assert.equal(
    source.includes(
      "learnerMode === \"student_live_locked\" ? controlledStepId ?? undefined : undefined",
    ),
    true,
  );
});
