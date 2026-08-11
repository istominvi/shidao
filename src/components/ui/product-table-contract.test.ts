import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const styles = source("src/app/globals.css");
const productTableSource = source("src/components/ui/product-table.tsx");
const scheduleSource = source(
  "src/components/teaching-hub/schedule-workspace.tsx",
);
const directorySource = source(
  "src/components/teaching-hub/student-directory-table.tsx",
);
const ownedCoursesSource = source(
  "src/components/course-builder/owned-courses-panel.tsx",
);
const catalogSource = source(
  "src/components/course-builder/course-catalog-panel.tsx",
);

test("product tables use the element radius instead of the card radius", () => {
  assert.match(
    styles,
    /:root\s*\{[^}]*--product-element-radius: 0\.75rem;[^}]*--product-card-radius: 1\.25rem;[^}]*--product-row-height: 2\.5rem;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.product-table-wrap\s*\{[^}]*overflow-x: auto;[^}]*border: 0;[^}]*--course-demo-table-radius,[^}]*--product-element-radius,[^}]*background: #fff;/,
  );
  assert.match(productTableSource, /"product-table min-w-full table-fixed/);

  for (const consumer of [
    scheduleSource,
    directorySource,
    ownedCoursesSource,
    catalogSource,
  ]) {
    assert.match(consumer, /className="[^"]*product-table-wrap/);
  }

  assert.match(
    styles,
    /\.course-demo-shell \.surface-card\s*\{[^}]*--course-demo-card-radius,[^}]*--product-card-radius,/,
  );
});

test("action menus share canonical element geometry without card styling", () => {
  assert.match(
    styles,
    /\.action-menu-panel\s*\{[^}]*--course-demo-element-radius,[^}]*--product-element-radius,[^}]*background: #fff;[^}]*padding: 0\.25rem;/,
  );
  assert.match(
    styles,
    /\.action-menu-item\s*\{[^}]*--course-demo-control-height,[^}]*--product-row-height,[^}]*align-items: center;[^}]*gap: 0\.5rem;[^}]*border: 0;[^}]*font-weight: var\(--course-demo-control-font-weight, 400\);/,
  );
});
