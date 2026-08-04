import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("workspace edits persisted entities through the v2 application API", () => {
  const workspace = source(
    "src/components/course-builder/course-workspace.tsx",
  );

  for (const endpoint of [
    "/api/v2/courses/",
    "/api/v2/lessons/",
    "/api/v2/steps/",
    "/api/v2/components/",
  ]) {
    assert.match(workspace, new RegExp(endpoint.replaceAll("/", "\\/")));
  }
  assert.match(workspace, /componentDefinitions\.map/);
  assert.match(workspace, /Предпросмотр экрана ученика/);
  assert.doesNotMatch(workspace, /localStorage|fixture/i);
});

test("lesson creation opens a persisted manual-or-AI dialog", () => {
  const workspace = source(
    "src/components/course-builder/course-workspace.tsx",
  );

  assert.match(workspace, /<DialogShell[\s\S]*?title="Новый урок"/);
  assert.match(workspace, />\s*Добавить урок\s*</);
  assert.match(
    workspace,
    /id="new-lesson-title"[\s\S]*?required[\s\S]*?maxLength=\{180\}/,
  );
  assert.match(workspace, /не отдельный компонент/);
  assert.match(workspace, /без ИИ и без списания токенов/);
  assert.match(
    workspace,
    /<Button[\s\S]*?disabled[\s\S]*?>\s*Заполнить с помощью ИИ\s*<\/Button>/,
  );
  assert.match(workspace, /OpenRouter/);
  assert.match(
    workspace,
    /const saved = await runMutation\("Создаём пустой урок…"[\s\S]*?createdLessonId = response\.lesson\.id;[\s\S]*?if \(!saved \|\| !createdLessonId\)[\s\S]*?onSelect\(createdLessonId\);[\s\S]*?setDialogOpen\(false\);/,
  );
});

test("component editor closes only after a successful persisted mutation", () => {
  const workspace = source(
    "src/components/course-builder/course-workspace.tsx",
  );

  assert.match(workspace, /type RunMutation =[\s\S]*?Promise<boolean>;/);
  assert.match(
    workspace,
    /const saved = await runMutation\("Сохраняем компонент…",[\s\S]*?\/api\/v2\/components\/\$\{component\.id\}[\s\S]*?if \(saved\) setEditing\(false\);/,
  );
  assert.match(
    workspace,
    /const runMutation = useCallback<RunMutation>\([\s\S]*?await action\(\);[\s\S]*?await reload\(\);\s*return true;[\s\S]*?catch \(caught\)[\s\S]*?return false;/,
  );
});

test("new lesson step title has an explicit accessible label", () => {
  const workspace = source(
    "src/components/course-builder/course-workspace.tsx",
  );

  assert.match(
    workspace,
    /<label[^>]*htmlFor="new-step-title"[^>]*>\s*Название нового шага\s*<\/label>[\s\S]*?<input\s+id="new-step-title"/,
  );
});

test("student screen preview keeps canonical step titles and filters visibility", () => {
  const preview = source(
    "src/components/course-builder/student-screen-preview.tsx",
  );

  assert.match(preview, /Шаг \{active\.step\.position\}/);
  assert.match(preview, /\{active\.step\.title\}/);
  assert.match(preview, /component\.visibility === "learner_visible"/);
  assert.match(preview, /mode="student"/);
  assert.doesNotMatch(preview, /teacherInstructions/);
  assert.match(preview, /предпросмотре и повторе/);
});

test("course builder surfaces use Russian product vocabulary", () => {
  const combined = [
    source("src/components/course-builder/course-workspace.tsx"),
    source("src/components/course-builder/student-screen-preview.tsx"),
    source("src/components/course-builder/new-course-form.tsx"),
    source("src/components/course-builder/courses-index.tsx"),
    source("src/app/(app)/courses/page.tsx"),
    source("src/app/(app)/courses/new/page.tsx"),
  ].join("\n");

  for (const visibleEnglishPhrase of [
    "Course workspace",
    "Course builder",
    "Student Screen preview",
    "Teacher Side",
    "learner-visible",
    "Пустой Course",
    "Добавить Lesson",
    "Новый Lesson Step",
  ]) {
    assert.doesNotMatch(combined, new RegExp(visibleEnglishPhrase));
  }
});
