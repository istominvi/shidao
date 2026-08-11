import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("active V2 pages share one page header contract without visual modifiers", () => {
  const header = source("src/components/app/page-header.tsx");
  const styles = source("src/app/globals.css");
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

  assert.match(
    styles,
    /\.app-page-header\s*\{[^}]*--app-page-header-description-color: rgba\(20, 20, 20, 0\.5\);/,
  );
  assert.match(
    styles,
    /\.app-page-description\s*\{[^}]*color: var\(--app-page-header-description-color\);/,
  );
  assert.doesNotMatch(
    styles,
    /\.course-demo-shell \.app-page-description\s*\{[^}]*color:/,
    "Product routes must inherit the canonical AppPageHeader subtitle color",
  );
  assert.match(
    styles,
    /\.course-demo-shell \.app-page-header > \.app-page-heading,\s*\.course-demo-shell \.app-page-header > \.app-page-meta\s*\{[^}]*min-width: 0;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.app-page-header > \.app-page-actions\s*\{[^}]*width: max-content;[^}]*max-width: 100%;[^}]*align-self: flex-start;/,
  );
  assert.match(
    styles,
    /@media \(min-width: 1280px\)\s*\{[\s\S]*?\.course-demo-shell \.app-page-header\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) max-content;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.app-page-back-link\s*\{[^}]*min-width: 0;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.app-page-back-link > span:last-child,\s*\.course-demo-shell \.app-page-title,\s*\.course-demo-shell \.app-page-description\s*\{[^}]*min-width: 0;[^}]*overflow-wrap: anywhere;/,
  );
  assert.doesNotMatch(
    styles,
    /\.course-demo-shell \.app-page-actions \.product-btn\s*\{[^}]*flex:\s*1;/,
    "Product page actions must keep their intrinsic width on narrow screens",
  );

  for (const consumer of consumers) {
    assert.match(consumer, /<AppPageHeader/);
    assert.doesNotMatch(
      consumer,
      /course-index-page-header|course-builder-page-header|teaching-hub-page-header|workspace-page-header/,
    );
  }
});
