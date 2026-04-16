import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const workspaceComponentSource = readFileSync(
  join(process.cwd(), "src/components/lessons/teacher-lesson-workspace.tsx"),
  "utf8",
);
const tabsSource = readFileSync(
  join(process.cwd(), "src/components/lessons/teacher-lesson-tabs.tsx"),
  "utf8",
);

test("teacher workspace component keeps runtime editing surface", () => {
  assert.equal(workspaceComponentSource.includes('name="runtimeStatus"'), true);
  assert.equal(
    workspaceComponentSource.includes('name="runtimeNotesSummary"'),
    true,
  );
  assert.equal(workspaceComponentSource.includes('name="runtimeNotes"'), true);
  assert.equal(workspaceComponentSource.includes('name="outcomeNotes"'), true);
  assert.equal(workspaceComponentSource.includes("Проведение занятия"), true);
});

test("teacher workspace uses unified five-tab labels and removes legacy side cards", () => {
  assert.equal(
    workspaceComponentSource.includes(
      '[\"plan\", \"content\", \"homework\", \"conduct\", \"chat\"]',
    ),
    true,
  );
  assert.equal(tabsSource.includes("План урока"), true);
  assert.equal(tabsSource.includes("Контент"), true);
  assert.equal(tabsSource.includes("Домашнее задание"), true);
  assert.equal(tabsSource.includes("Проведение занятия"), true);
  assert.equal(tabsSource.includes("Чат"), true);
  assert.equal(workspaceComponentSource.includes("Ориентиры методики"), false);
  assert.equal(workspaceComponentSource.includes("Фокус преподавателя"), false);
  assert.equal(
    workspaceComponentSource.includes("Discussion for this lesson"),
    false,
  );
});

test("teacher workspace is headerless content surface", () => {
  assert.equal(workspaceComponentSource.includes("AppPageHeader"), false);
  assert.equal(workspaceComponentSource.includes("LessonMetaRail"), false);
  assert.equal(workspaceComponentSource.includes("LessonMetaPill"), false);
  assert.equal(workspaceComponentSource.includes("hero.lessonTitle"), false);
  assert.equal(
    workspaceComponentSource.includes("hero.methodologyTitle"),
    false,
  );
  assert.equal(
    workspaceComponentSource.includes("description={hero.lessonEssence}"),
    false,
  );
});

test("teacher workspace homework section keeps methodology content read-only and runtime controls", () => {
  assert.equal(
    workspaceComponentSource.includes("Из методики (только чтение)"),
    false,
  );
  assert.equal(workspaceComponentSource.includes("TeacherHomeworkPanel"), true);
  assert.equal(
    workspaceComponentSource.includes("TeacherHomeworkQuizPreviewPanel"),
    false,
  );
  assert.equal(workspaceComponentSource.includes("Задать ДЗ"), false);
  assert.equal(
    workspaceComponentSource.includes('name="homeworkTitle"'),
    false,
  );
  assert.equal(workspaceComponentSource.includes('name="instructions"'), false);
});
