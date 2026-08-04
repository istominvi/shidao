import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const workspacePath = "src/components/course-builder/course-workspace.tsx";
const lessonAuthoringPath =
  "src/components/course-builder/lesson-authoring-workspace.tsx";

test("workspace writes persisted course, lesson, and component entities", () => {
  const combined = [source(workspacePath), source(lessonAuthoringPath)].join(
    "\n",
  );

  for (const endpoint of [
    "/api/v2/courses/",
    "/api/v2/lessons/",
    "/api/v2/components/",
  ]) {
    assert.match(combined, new RegExp(endpoint.replaceAll("/", "\\/")));
  }
  assert.match(combined, /\/api\/v2\/lessons\/\$\{lessonId\}\/components/);
  assert.match(combined, /method: "DELETE"|, "DELETE"/);
  assert.doesNotMatch(combined, /localStorage|fixture/i);
});

test("lesson creation stays title-first and no longer asks for a step", () => {
  const workspace = source(workspacePath);

  assert.match(workspace, /<DialogShell[\s\S]*?title="Новый урок"/);
  assert.match(workspace, />\s*Добавить урок\s*</);
  assert.match(
    workspace,
    /id="new-lesson-title"[\s\S]*?required[\s\S]*?maxLength=\{180\}/,
  );
  assert.match(workspace, /не отдельный компонент/);
  assert.match(workspace, /без ИИ и без списания токенов/);
  assert.doesNotMatch(workspace, /Добавить шаг|Новый шаг урока|new-step-title/);
});

test("course header opens persisted settings and course-wide materials dialogs", () => {
  const workspace = source(workspacePath);

  assert.match(workspace, />\s*Настройки\s*</);
  assert.match(workspace, />\s*Материалы курса/);
  assert.match(workspace, /title="Настройки курса"/);
  assert.match(workspace, /title="Материалы курса"/);
  assert.match(workspace, /course\.attachments\.map/);
  assert.match(workspace, /содержимое пока не анализировалось/);
  assert.match(
    workspace,
    /const saved = await runMutation\("Сохраняем настройки курса…"[\s\S]*?if \(saved\) onSaved\(\)/,
  );
});

test("selected lesson uses the three requested authoring surfaces", () => {
  const authoring = source(lessonAuthoringPath);

  for (const label of ["План урока", "Экран ученика", "Домашнее задание"]) {
    assert.match(authoring, new RegExp(label));
  }
  assert.match(authoring, /ariaLabel="Раздел выбранного урока"/);
  assert.match(authoring, />\s*Компонент\s*</);
  assert.match(authoring, /Редактор домашнего задания будет/);
  assert.doesNotMatch(authoring, /\/api\/teacher\//);
});

test("component picker is registry-driven and grouped into Russian categories", () => {
  const authoring = source(lessonAuthoringPath);

  assert.match(authoring, /componentDefinitions\.filter/);
  for (const category of [
    "Текст",
    "Изображения",
    "Игры и активности",
    "Оформление",
    "Файлы",
  ]) {
    assert.match(authoring, new RegExp(category));
  }
  assert.match(authoring, /visibility: "staff_only"/);
  assert.match(authoring, /сразу перейти к редактированию/);
});

test("component cards persist edit, delete, order, and Student Screen visibility", () => {
  const authoring = source(lessonAuthoringPath);

  assert.match(authoring, /Сохраняем компонент…/);
  assert.match(authoring, /Удаляем компонент…/);
  assert.match(authoring, /Меняем порядок компонентов…/);
  assert.match(authoring, /Обновляем экран ученика…/);
  assert.match(
    authoring,
    /visibility: learnerVisible \? "staff_only" : "learner_visible"/,
  );
  assert.match(authoring, /aria-pressed=\{learnerVisible\}/);
  assert.match(authoring, /group-hover:opacity-100/);
  assert.match(authoring, /if \(saved\) setEditing\(false\)/);
});

test("student surfaces filter teacher-only data and expose no step UI", () => {
  const combined = [
    source(lessonAuthoringPath),
    source("src/components/course-builder/student-screen-preview.tsx"),
  ].join("\n");

  assert.match(combined, /component\.visibility === "learner_visible"/);
  assert.match(combined, /mode="student"/);
  assert.doesNotMatch(combined, /teacherInstructions/);
  assert.doesNotMatch(
    source("src/components/course-builder/student-screen-preview.tsx"),
    /Шаг|шага|шагом/,
  );
});

test("course builder surfaces keep Russian product vocabulary", () => {
  const combined = [
    source(workspacePath),
    source(lessonAuthoringPath),
    source("src/components/course-builder/student-screen-preview.tsx"),
    source("src/components/course-builder/new-course-form.tsx"),
    source("src/components/course-builder/courses-index.tsx"),
  ].join("\n");

  for (const visibleEnglishPhrase of [
    "Course workspace",
    "Course builder",
    "Student Screen preview",
    "Teacher Side",
    "learner-visible",
    "Добавить Lesson",
  ]) {
    assert.doesNotMatch(combined, new RegExp(visibleEnglishPhrase));
  }
});
