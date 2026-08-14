import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  nextProductTableSort,
  type ProductTableSortState,
} from "@/components/ui/product-table-sort";

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
const courseWorkspaceSource = source(
  "src/components/course-builder/course-workspace.tsx",
);
const progressSummarySource = source(
  "src/components/learner-identity/progress-summary.tsx",
);

test("product tables use the element radius instead of the card radius", () => {
  assert.match(
    styles,
    /:root\s*\{[^}]*--product-element-radius: 0\.75rem;[^}]*--product-card-radius: 1\.25rem;[^}]*--product-row-height: 2\.5rem;[^}]*--product-table-divider-color: #ececef;[^}]*--product-inner-control-size: 2rem;[^}]*--product-inner-control-radius: 0\.5rem;[^}]*--product-inner-control-inset: 0\.25rem;/,
  );
  assert.match(
    styles,
    /\.product-table-wrap\s*\{[^}]*border: var\(--product-surface-border\);[^}]*background-clip: padding-box;[^}]*\}[\s\S]*?\.course-demo-shell \.product-table-wrap\s*\{[^}]*overflow-x: auto;[^}]*--course-demo-table-radius,[^}]*--product-element-radius,[^}]*background-color: #fff;/,
  );
  assert.match(
    styles,
    /:root\s*\{[^}]*--product-surface-border: 1px solid oklch\(0 0 0 \/ 0\.1\);[^}]*--product-raised-surface-shadow: var\(--product-raised-control-shadow\);/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.product-table-wrap\s*\{[^}]*box-shadow: var\(--product-raised-surface-shadow\);/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.product-table-wrap:focus-visible\s*\{[^}]*outline: 2px solid rgba\(20, 20, 20, 0\.34\);[^}]*outline-offset: 2px;[^}]*box-shadow: var\(--product-raised-surface-shadow\);/,
  );
  assert.match(productTableSource, /"product-table min-w-full table-fixed/);
  assert.match(
    productTableSource,
    /"bg-white text-xs uppercase tracking-wide text-neutral-500"/,
  );
  assert.doesNotMatch(productTableSource, /bg-neutral-50/);
  assert.match(
    styles,
    /\.course-demo-shell \.product-table thead\s*\{[^}]*background: #fff;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.product-table tbody tr\s*\{[^}]*border-color: var\(--product-table-divider-color, #ececef\);/,
  );
  assert.match(
    styles,
    /:root\s*\{[^}]*--product-table-body-color: #141414;[^}]*--product-table-body-font-size: 0\.88rem;[^}]*--product-table-body-font-weight: 400;[^}]*--product-table-body-line-height: 1\.3;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell[\s\S]*?\.product-table[\s\S]*?tbody[\s\S]*?> tr[\s\S]*?> :is\(td, th\):not\(\.product-table-action-cell\)[\s\S]*?color: var\(--product-table-body-color, #141414\);[\s\S]*?font-size: var\(--product-table-body-font-size, 0\.88rem\);[\s\S]*?font-weight: var\(--product-table-body-font-weight, 400\);[\s\S]*?line-height: var\(--product-table-body-line-height, 1\.3\);/,
  );
  assert.match(
    productTableSource,
    /"product-table-action-cell whitespace-nowrap"/,
  );
  assert.doesNotMatch(
    productTableSource,
    /className=\{classNames\("text-neutral-950 font-medium"/,
  );
  assert.match(
    progressSummarySource,
    /className="product-table-wrap[^\"]*"[\s\S]*?<table className="product-table w-full min-w-\[620px\]/,
  );

  for (const consumer of [
    scheduleSource,
    directorySource,
    ownedCoursesSource,
    catalogSource,
    courseWorkspaceSource,
  ]) {
    assert.match(consumer, /className="[^"]*product-table-wrap/);
  }

  assert.match(
    styles,
    /\.surface-card\s*\{[^}]*background: #fff;[^}]*background-clip: padding-box;[^}]*box-shadow: var\(--product-raised-surface-shadow\);[\s\S]*?\.surface-card:not\(\.border\)\s*\{[^}]*border: var\(--product-surface-border\);[\s\S]*?\.course-demo-shell \.surface-card\s*\{[^}]*--course-demo-card-radius,[^}]*--product-card-radius,[^}]*background-color: rgba\(255, 255, 255, 0\.82\);/,
  );
  assert.match(
    styles,
    /@media \(forced-colors: active\)\s*\{[\s\S]*?\.product-raised-surface,\s*\.product-raised-surface:not\(\.border\),\s*\.surface-card,\s*\.surface-card:not\(\.border\),[\s\S]*?border-color: CanvasText;/,
  );
  assert.doesNotMatch(
    styles,
    /\.(?:course-index-table-wrap)\s*\{[^}]*0 20px 52px/,
  );
});

test("action menus share canonical element geometry without card styling", () => {
  assert.match(
    styles,
    /\.action-menu-panel\s*\{[^}]*border: 0;[^}]*--product-context-menu-radius,[^}]*--course-demo-element-radius,[^}]*--product-element-radius,[^}]*background: var\(--product-context-menu-surface, #fff\);[^}]*padding: 0\.25rem;[^}]*--product-context-menu-shadow,/,
  );
  assert.match(
    styles,
    /\.action-menu-item\s*\{[^}]*--course-demo-control-height,[^}]*--product-row-height,[^}]*align-items: center;[^}]*gap: 0\.5rem;[^}]*border: 0;[^}]*font-weight: var\(--course-demo-control-font-weight, 400\);/,
  );
  assert.doesNotMatch(styles, /\.action-menu-separator/);
});

test("Course index and Course Lessons tables use the dense Schedule geometry", () => {
  assert.match(
    styles,
    /\.course-index-table\s*\{[^}]*width: 100%;[^}]*min-width: 58rem;[^}]*table-layout: auto;[^}]*border-collapse: collapse;[^}]*background: #fff;/,
  );
  assert.match(
    styles,
    /\.course-index-owned-table,\s*\.course-index-catalog-table\s*\{[^}]*table-layout: fixed;/,
  );
  assert.match(
    styles,
    /\.course-index-owned-table \.course-index-table-col-title\s*\{[^}]*width: 38%;[\s\S]*?\.course-index-owned-table \.course-index-table-col-actions\s*\{[^}]*width: 5%;/,
  );
  assert.match(
    styles,
    /\.course-index-catalog-table \.course-index-table-col-title\s*\{[^}]*width: 34%;[\s\S]*?\.course-index-catalog-table \.course-index-table-col-actions\s*\{[^}]*width: 5%;/,
  );
  assert.match(
    styles,
    /\.course-index-table thead tr,[\s\S]*?\.course-index-table thead th\s*\{[^}]*height: var\(\s*--course-demo-table-row-height,/,
  );
  assert.match(
    styles,
    /\.course-index-table thead th\s*\{[^}]*border-bottom: 1px solid var\(--product-table-divider-color, #ececef\);[^}]*padding-block: 0;[^}]*padding-inline: var\(--course-demo-control-padding-inline, 0\.75rem\);[^}]*font-weight: 500;[^}]*white-space: nowrap;/,
  );
  assert.match(
    styles,
    /\.course-index-table tbody tr\s*\{[^}]*height: var\(\s*--course-demo-table-row-height,[^}]*border-color: var\(--product-table-divider-color, #ececef\);[^}]*background: #fff;[^}]*color: #141414;/,
  );
  assert.match(
    styles,
    /\.course-index-table tbody td\s*\{[^}]*height: var\(\s*--course-demo-table-row-height,[^}]*padding-block: 0;[^}]*padding-inline: var\(--course-demo-control-padding-inline, 0\.75rem\);[^}]*color: #141414;[^}]*vertical-align: middle;[^}]*white-space: nowrap;/,
  );
  assert.match(
    styles,
    /\.course-index-table-action-cell\s*\{[^}]*padding-inline: var\(--product-inner-control-inset, 0\.25rem\) !important;[^}]*line-height: 0;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell[\s\S]*?\.course-index-table-action-menu[\s\S]*?\.product-btn\.action-menu-trigger\s*\{[^}]*width: var\(--product-inner-control-size, 2rem\);[^}]*min-width: var\(--product-inner-control-size, 2rem\);[^}]*height: var\(--product-inner-control-size, 2rem\);[^}]*min-height: var\(--product-inner-control-size, 2rem\);[^}]*border-radius: var\(--product-inner-control-radius, 0\.5rem\);[^}]*padding: 0;/,
  );
  assert.match(
    ownedCoursesSource,
    /className="course-index-table course-index-owned-table"/,
  );
  assert.match(
    catalogSource,
    /className="course-index-table course-index-catalog-table"/,
  );
  assert.doesNotMatch(ownedCoursesSource, /course-index-table-col-level/);
  assert.doesNotMatch(catalogSource, /course-index-table-col-level/);
  assert.doesNotMatch(
    ownedCoursesSource,
    /<ProductTableSortableHeaderCell[\s\S]*?>\s*Уровень\s*<\/ProductTableSortableHeaderCell>/,
  );
  assert.doesNotMatch(
    catalogSource,
    /<ProductTableHeaderCell>Уровень<\/ProductTableHeaderCell>/,
  );
  assert.match(
    courseWorkspaceSource,
    /className="product-table-wrap course-index-table-wrap course-lessons-table-wrap"/,
  );
  assert.match(
    courseWorkspaceSource,
    /<ProductTable className="course-index-table course-lessons-table">/,
  );
  assert.match(
    styles,
    /\.course-lessons-table-wrap\s*\{[^}]*margin-top: 1rem;/,
  );
  assert.match(styles, /\.course-lessons-table\s*\{[^}]*min-width: 58rem;/);
  assert.match(
    styles,
    /\.course-lessons-table-col-position,[\s\S]*?\.course-lessons-table-col-actions\s*\{[^}]*width: 1%;/,
  );
  assert.match(
    styles,
    /\.course-lessons-table-col-title\s*\{[^}]*width: 100%;/,
  );
  assert.match(
    courseWorkspaceSource,
    /<ProductTableActionCell className="course-index-table-action-cell text-right">/,
  );
  assert.match(
    courseWorkspaceSource,
    /className="course-index-table-action-menu course-lessons-table-action-menu"/,
  );
  assert.doesNotMatch(ownedCoursesSource, /className="h-16"/);
  assert.doesNotMatch(catalogSource, /className="h-16"/);
  assert.doesNotMatch(courseWorkspaceSource, /className="h-16"/);
});

test("product table sort state starts ascending and toggles per column", () => {
  type SortKey = "name" | "groups";

  const firstClick = nextProductTableSort<SortKey>(null, "name");
  assert.deepEqual(firstClick, { key: "name", direction: "asc" });

  const repeatClick = nextProductTableSort(firstClick, "name");
  assert.deepEqual(repeatClick, { key: "name", direction: "desc" });

  const newKeyClick = nextProductTableSort(repeatClick, "groups");
  assert.deepEqual(newKeyClick, { key: "groups", direction: "asc" });

  const typedState: ProductTableSortState<SortKey> = newKeyClick;
  assert.equal(typedState.direction, "asc");
});

test("sortable product table headers keep native table and button accessibility", () => {
  assert.match(productTableSource, /nextProductTableSort/);
  assert.match(productTableSource, /type ProductTableSortDirection/);
  assert.match(productTableSource, /type ProductTableSortState/);
  assert.match(
    productTableSource,
    /export function ProductTableSortableHeaderCell/,
  );
  assert.match(
    productTableSource,
    /direction === "asc"[\s\S]*?"ascending"[\s\S]*?direction === "desc"[\s\S]*?"descending"[\s\S]*?"none"/,
  );
  assert.match(productTableSource, /aria-sort=\{ariaSort\}/);
  assert.match(
    productTableSource,
    /<button[\s\S]*?type="button"[\s\S]*?onClick=\{onSort\}/,
  );
  assert.doesNotMatch(productTableSource, /ArrowUpDown/);
  assert.match(
    productTableSource,
    /direction === "desc"[\s\S]*?\? ArrowDown[\s\S]*?: null/,
  );
  assert.match(
    productTableSource,
    /\{SortIcon \? \([\s\S]*?<SortIcon[\s\S]*?aria-hidden="true"[\s\S]*?: null\}/,
  );
});
