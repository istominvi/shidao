import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync(
  "src/components/methodologies/methodology-detail-workspace.tsx",
  "utf8",
);
const tabsSource = readFileSync(
  "src/components/methodologies/methodology-detail-tabs.tsx",
  "utf8",
);
const descriptionSource = readFileSync(
  "src/components/methodologies/methodology-description-panel.tsx",
  "utf8",
);

test("methodology workspace keeps two tabs with description as default", () => {
  assert.equal(workspaceSource.includes('useState<MethodologyDetailTabKey>("description")'), true);
  assert.equal(tabsSource.includes('description: { label: "Описание"'), true);
  assert.equal(tabsSource.includes('lessons: { label: "Уроки"'), true);
});

test("lessons tab keeps existing methodology lessons table path", () => {
  assert.equal(workspaceSource.includes("MethodologyLessonsTableCard"), true);
  assert.equal(workspaceSource.includes("methodologySlug={methodology.slug}"), true);
});

test("description panel is structured and includes curriculum plan section", () => {
  assert.equal(descriptionSource.includes("О программе"), true);
  assert.equal(descriptionSource.includes("Цели и задачи курса"), true);
  assert.equal(descriptionSource.includes("Учебно-тематический план"), true);
  assert.equal(descriptionSource.includes("overflow-x-auto"), true);
});
