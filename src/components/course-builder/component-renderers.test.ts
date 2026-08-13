import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { componentTypeKeys } from "../../modules/course-builder/registry/contracts";

const source = readFileSync(
  join(process.cwd(), "src/components/course-builder/component-renderers.tsx"),
  "utf8",
);

test("course component renderer map covers every registry key exactly once", () => {
  const rendererMap =
    /export const courseComponentRenderers = \{([\s\S]*?)\n\} as const satisfies/.exec(
      source,
    );
  assert.ok(rendererMap, "renderer map export must remain discoverable");

  const rendererKeys = Array.from(
    rendererMap[1].matchAll(/^\s{2}([a-z_]+):/gm),
    (match) => match[1],
  );

  assert.deepEqual(rendererKeys, componentTypeKeys);
  assert.match(
    source,
    /export const courseComponentRendererKeys = componentTypeKeys\.filter/,
  );
});

test("renderers stay generic, learner-visible and free of hardcoded entity ids", () => {
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(source, /\b(?:courseId|lessonId|lessonStepId)\b/);
  assert.doesNotMatch(source, /\bteacherInstructions\b|teacher_content/);
  assert.doesNotMatch(
    source,
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  );
  assert.doesNotMatch(source, /english-b1|present-perfect|world-around-me/i);
});

test("teacher cards do not center component content while Student Screen keeps placement", () => {
  assert.match(
    source,
    /const alignment = mode === "teacher" \? "" : "mx-auto ";/,
  );
  assert.match(source, /widthClass\(placement\.width, mode\)/);
});

test("rich text renders independent title/body fields while legacy headings remain supported", () => {
  assert.match(source, /function HeadingRenderer/);
  assert.match(source, /heading: HeadingRenderer/);
  assert.match(
    source,
    /function RichTextRenderer[\s\S]*?payload\.title \? \([\s\S]*?\{payload\.title\}[\s\S]*?: null[\s\S]*?payload\.content \? <SafeRichText content=\{payload\.content\} \/> : null/,
  );
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
});

test("new remote and exercise renderers stay safe, deterministic, and preview-only", () => {
  assert.match(source, /function safeHttpsUrl/);
  assert.match(source, /url\.protocol === "https:"/);
  assert.doesNotMatch(source, /Math\.random/);
  assert.doesNotMatch(source, /DividerRenderer|componentRegistry\.divider/);
  assert.match(source, /не сохраняется/);
  assert.match(source, /проверяет преподаватель вручную/);
});
