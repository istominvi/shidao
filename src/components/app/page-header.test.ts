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
    source("src/components/course-builder/published-course-workspace.tsx"),
    source("src/components/teaching-hub/students-workspace.tsx"),
    source("src/app/(app)/(teacher-required)/schedule/page.tsx"),
    source("src/components/learner-identity/learning-profile-workspace.tsx"),
    source("src/components/learner-identity/observing-workspace.tsx"),
    source("src/components/learner-identity/invitation-accept-workspace.tsx"),
    source("src/components/settings-shell.tsx"),
  ];

  assert.match(header, /type: "link"/);
  assert.match(header, /type: "button"/);
  assert.match(header, /"app-page-header"/);
  assert.match(header, /back && "app-page-header-with-back"/);
  assert.match(header, /Boolean\(actions\) && "app-page-header-with-actions"/);
  assert.match(header, /className="app-page-header-content"/);
  assert.match(header, /className="app-page-back-link"/);
  assert.match(header, /className="app-page-back-link-label"/);
  assert.match(header, /className="app-page-actions"/);
  assert.doesNotMatch(header, /className\?: string/);

  assert.match(
    styles,
    /:root\s*\{[^}]*--product-muted-foreground: rgba\(20, 20, 20, 0\.5\);/,
  );
  assert.match(
    styles,
    /\.app-page-header\s*\{[^}]*--app-page-header-description-color: var\(--product-muted-foreground\);/,
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
    /\.app-page-header\s*\{[^}]*--app-page-header-back-gap: var\(--app-page-header-padding-block\);/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.app-page-header > \.app-page-actions\s*\{[^}]*width: max-content;[^}]*max-width: 100%;[^}]*align-self: flex-start;/,
  );
  assert.match(
    styles,
    /@media \(min-width: 1280px\)\s*\{[\s\S]*?\.course-demo-shell \.app-page-header-with-actions\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) max-content;[^}]*column-gap: 1\.5rem;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell\s*\.app-page-header-with-actions\s*> \.app-page-header-content\s*\{[^}]*align-self: stretch;[^}]*justify-content: center;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell\s*\.app-page-header-with-actions\.app-page-header-with-back\s*> \.app-page-header-content\s*\{[^}]*justify-content: flex-start;/,
  );
  assert.match(
    styles,
    /\.app-page-header-with-back \.app-page-back-link\s*\{[^}]*margin-bottom: calc\([\s\S]*?var\(--app-page-header-back-gap\) - var\(--app-page-header-space\)[\s\S]*?\);/,
  );
  assert.match(
    styles,
    /\.app-page-back-link\s*\{[^}]*min-width: 0;[^}]*max-width: min\(100%, 38rem\);[^}]*text-align: left;[^}]*color: #141414;/,
  );
  assert.match(styles, /\.app-page-back-link-icon\s*\{[^}]*flex: 0 0 auto;/);
  assert.match(
    styles,
    /\.app-page-back-link-label\s*\{[^}]*min-width: 0;[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/,
  );
  assert.match(styles, /\.app-page-back-link:hover\s*\{[^}]*color: #141414;/);
  assert.match(
    styles,
    /\.app-page-back-link:focus-visible\s*\{[^}]*color: #141414;/,
  );
  assert.match(
    styles,
    /\.app-page-title\s*\{[^}]*width: 100%;[^}]*max-width: none;/,
  );
  assert.doesNotMatch(styles, /\.app-page-title\s*\{[^}]*24ch/);
  assert.match(
    styles,
    /\.course-demo-shell \.app-page-title,\s*\.course-demo-shell \.app-page-description\s*\{[^}]*min-width: 0;[^}]*overflow-wrap: anywhere;/,
  );
  assert.doesNotMatch(
    styles,
    /\.app-page-back-link-label\s*\{[^}]*overflow-wrap: anywhere;/,
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
