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
  assert.match(workspace, /Student Screen preview/);
  assert.doesNotMatch(workspace, /localStorage|fixture/i);
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

test("new Lesson Step title has an explicit accessible label", () => {
  const workspace = source(
    "src/components/course-builder/course-workspace.tsx",
  );

  assert.match(
    workspace,
    /<label[^>]*htmlFor="new-step-title"[^>]*>\s*Название нового шага\s*<\/label>[\s\S]*?<input\s+id="new-step-title"/,
  );
});

test("Student Screen preview keeps canonical step titles and filters visibility", () => {
  const preview = source(
    "src/components/course-builder/student-screen-preview.tsx",
  );

  assert.match(preview, /Шаг \{active\.step\.position\}/);
  assert.match(preview, /\{active\.step\.title\}/);
  assert.match(preview, /component\.visibility === "learner_visible"/);
  assert.match(preview, /mode="student"/);
  assert.doesNotMatch(preview, /teacherInstructions/);
  assert.match(preview, /preview\/review/);
});
