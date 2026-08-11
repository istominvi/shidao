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

test("product tables use the element radius instead of the card radius", () => {
  assert.match(
    styles,
    /:root\s*\{[^}]*--product-element-radius: 0\.75rem;[^}]*--product-card-radius: 1\.25rem;[^}]*--product-row-height: 2\.5rem;[^}]*--product-table-divider-color: #ececef;[^}]*--product-inner-control-size: 2rem;[^}]*--product-inner-control-radius: 0\.5rem;[^}]*--product-inner-control-inset: 0\.25rem;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.product-table-wrap\s*\{[^}]*overflow-x: auto;[^}]*border: 0;[^}]*--course-demo-table-radius,[^}]*--product-element-radius,[^}]*background: #fff;/,
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
  assert.match(productTableSource, /<SortIcon[\s\S]*?aria-hidden="true"/);
});
