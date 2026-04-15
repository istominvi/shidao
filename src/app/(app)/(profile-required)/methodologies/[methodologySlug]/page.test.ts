import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(
  "src/app/(app)/(profile-required)/methodologies/[methodologySlug]/page.tsx",
  "utf8",
);

const workspaceSource = readFileSync(
  "src/components/methodologies/teacher-methodology-detail-workspace.tsx",
  "utf8",
);

const tabsSource = readFileSync(
  "src/components/methodologies/methodology-detail-tabs.tsx",
  "utf8",
);

const lessonsTableSource = readFileSync(
  "src/components/methodologies/methodology-lessons-table-card.tsx",
  "utf8",
);

const descriptionPanelSource = readFileSync(
  "src/components/methodologies/methodology-description-panel.tsx",
  "utf8",
);

test("methodology detail page renders canonical tabbed workspace instead of free-floating overview cards", () => {
  assert.equal(pageSource.includes("TeacherMethodologyDetailWorkspace"), true);
  assert.equal(pageSource.includes("overviewCards"), false);
  assert.equal(pageSource.includes("<MethodologyLessonsTableCard"), false);
  assert.equal(pageSource.includes("<MethodologyEntityCard"), false);
  assert.equal(pageSource.includes("<AssignLessonDialog"), false);
});

test("methodology detail workspace exposes Описание and Уроки tabs", () => {
  assert.equal(workspaceSource.includes('useState<MethodologyDetailTabKey>("description")'), true);
  assert.equal(workspaceSource.includes("MethodologyDetailTabs"), true);
  assert.equal(workspaceSource.includes("MethodologyDescriptionPanel"), true);
  assert.equal(workspaceSource.includes("MethodologyLessonsTableCard"), true);

  assert.equal(tabsSource.includes('description: { label: "Описание"'), true);
  assert.equal(tabsSource.includes('lessons: { label: "Уроки"'), true);
});

test("methodology lessons tab still uses canonical lessons table component in embedded mode", () => {
  assert.equal(lessonsTableSource.includes("embedded?: boolean"), true);
  assert.equal(lessonsTableSource.includes("if (embedded)"), true);
  assert.equal(lessonsTableSource.includes("toMethodologyLessonRoute"), true);
  assert.equal(lessonsTableSource.includes("ProductTableEmptyState"), true);
  assert.equal(lessonsTableSource.includes('role="button"'), true);
  assert.equal(lessonsTableSource.includes('tabIndex={0}'), true);
  assert.equal(
    lessonsTableSource.includes('event.key === "Enter" || event.key === " "'),
    true,
  );
});


test("description panel renders cover+lead intro without legacy chips list", () => {
  assert.equal(pageSource.includes("coverImage={readModel.methodology.coverImage}"), true);
  assert.equal(descriptionPanelSource.includes("next/image"), true);
  assert.equal(descriptionPanelSource.includes("description.passportFacts"), false);
  assert.equal(descriptionPanelSource.includes("description.highlights"), false);
  assert.equal(descriptionPanelSource.includes('type === "goal_map"'), true);
});
