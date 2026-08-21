import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { homeworkItemTypeKeys } from "@/modules/homework-authoring/contracts";

const source = readFileSync(
  join(
    process.cwd(),
    "src/components/course-builder/homework-authoring-surface.tsx",
  ),
  "utf8",
);

test("homework editor derives its picker from the one safe registry allowlist", () => {
  assert.deepEqual(homeworkItemTypeKeys, [
    "rich_text",
    "image",
    "external_link",
    "file",
  ]);
  assert.match(source, /homeworkItemTypeKeys\.map/);
  assert.match(source, /getComponentDefinition\(typeKey\)/);
  assert.match(source, /<ComponentPickerPreview typeKey=\{typeKey\}/);
  assert.match(source, /<ComponentPayloadEditor/);
  assert.match(source, /showPedagogy=\{false\}/);
  assert.doesNotMatch(source, /lesson\.components|studentSlides|stepId/);
});

test("homework authoring keeps explicit dirty/CAS states and a no-write preview", () => {
  assert.match(source, /expectedRevision: homework\?\.revision \?\? null/);
  assert.match(source, /expectedRevision: homework\.revision/);
  assert.match(source, /Есть несохранённые изменения/);
  assert.match(source, /Изменения сохранены/);
  assert.match(source, /Версия устарела/);
  assert.match(source, /Повторить сохранение/);
  assert.match(source, /Повторить очистку/);
  assert.match(source, /mode="teacher"[\s\S]*?interaction="presentation"/);
  assert.match(source, /mode="student"[\s\S]*?interaction="presentation"/);
  assert.match(source, /Предпросмотр не создаёт выдачу/);
  assert.doesNotMatch(source, /localStorage|attempt|evidence|LessonRun/);
});

test("homework controls expose deterministic keyboard reorder and responsive layout", () => {
  assert.match(source, /aria-label=\{`Переместить .* выше`\}/);
  assert.match(source, /aria-label=\{`Переместить .* ниже`\}/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /role="group"/);
  assert.match(source, /sm:flex-row/);
  assert.match(source, /lg:grid-cols-2/);
  assert.match(source, /beforeunload/);
});
