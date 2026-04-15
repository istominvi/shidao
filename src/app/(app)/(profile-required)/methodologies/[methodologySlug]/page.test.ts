import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(
  "src/app/(app)/(profile-required)/methodologies/[methodologySlug]/page.tsx",
  "utf8",
);

const workspaceSource = readFileSync(
  "src/components/methodologies/teacher-methodology-workspace.tsx",
  "utf8",
);

const tabsSource = readFileSync(
  "src/components/methodologies/teacher-methodology-tabs.tsx",
  "utf8",
);

const descriptionPanelSource = readFileSync(
  "src/components/methodologies/methodology-description-panel.tsx",
  "utf8",
);

const lessonsTableSource = readFileSync(
  "src/components/methodologies/methodology-lessons-table-card.tsx",
  "utf8",
);

test("methodology detail page renders one tabbed workspace instead of standalone overview and lessons sections", () => {
  assert.equal(pageSource.includes("TeacherMethodologyWorkspace"), true);
  assert.equal(pageSource.includes("MethodologyLessonsTableCard"), false);
  assert.equal(pageSource.includes("overviewCards"), false);
  assert.equal(pageSource.includes("grid gap-4 lg:grid-cols-2"), false);
});

test("methodology workspace uses one canonical card with embedded tabs and expected labels", () => {
  assert.equal(workspaceSource.includes('<SurfaceCard as="section"'), true);
  assert.equal(workspaceSource.includes('tone="embedded"'), true);
  assert.equal(tabsSource.includes("Описание"), true);
  assert.equal(tabsSource.includes("Уроки"), true);
  assert.equal(workspaceSource.includes("MethodologyDescriptionPanel"), true);
  assert.equal(workspaceSource.includes("MethodologyLessonsTableCard"), true);
  assert.equal(workspaceSource.includes("embedded"), true);
});

test("description panel is embedded content with canonical curriculum table", () => {
  assert.equal(descriptionPanelSource.includes("SurfaceCard"), false);
  assert.equal(descriptionPanelSource.includes("Учебно-тематический план"), true);
  assert.equal(descriptionPanelSource.includes("ProductTable"), true);
  assert.equal(descriptionPanelSource.includes("Список литературы"), true);
});

test("methodology lessons table keeps canonical primitives and keyboard row navigation", () => {
  assert.equal(lessonsTableSource.includes("ProductTableCard"), true);
  assert.equal(lessonsTableSource.includes("embedded?: boolean"), true);
  assert.equal(lessonsTableSource.includes("if (embedded)"), true);
  assert.equal(lessonsTableSource.includes("ProductTableEmptyState"), true);
  assert.equal(lessonsTableSource.includes("toMethodologyLessonRoute"), true);
  assert.equal(lessonsTableSource.includes("Материалы"), true);
  assert.equal(lessonsTableSource.includes("Назначен"), true);
  assert.equal(lessonsTableSource.includes('role="button"'), true);
  assert.equal(lessonsTableSource.includes("tabIndex={0}"), true);
  assert.equal(lessonsTableSource.includes('event.key === "Enter" || event.key === " "'), true);
});
