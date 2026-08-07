import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("active V2 pages share one page header contract without visual modifiers", () => {
  const header = source("src/components/app/page-header.tsx");
  const consumers = [
    source("src/app/(app)/courses/page.tsx"),
    source("src/app/(app)/courses/new/page.tsx"),
    source("src/components/course-builder/course-workspace.tsx"),
    source("src/components/course-builder/lesson-authoring-workspace.tsx"),
    source("src/components/teaching-hub/students-workspace.tsx"),
    source("src/app/(app)/(teacher-required)/schedule/page.tsx"),
  ];

  assert.match(header, /type: "link"/);
  assert.match(header, /type: "button"/);
  assert.match(header, /<header className="app-page-header">/);
  assert.match(header, /className="app-page-back-link"/);
  assert.match(header, /className="app-page-actions"/);
  assert.doesNotMatch(header, /className\?: string/);

  for (const consumer of consumers) {
    assert.match(consumer, /<AppPageHeader/);
    assert.doesNotMatch(
      consumer,
      /course-index-page-header|course-builder-page-header|teaching-hub-page-header|workspace-page-header/,
    );
  }
});
