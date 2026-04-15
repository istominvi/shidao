import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(
  "src/app/(app)/(profile-required)/methodologies/[methodologySlug]/page.tsx",
  "utf8",
);

const lessonsTableSource = readFileSync(
  "src/components/methodologies/methodology-lessons-table-card.tsx",
  "utf8",
);

test("methodology detail page renders canonical lessons table card", () => {
  assert.equal(pageSource.includes("MethodologyLessonsTableCard"), true);
  assert.equal(pageSource.includes("<MethodologyEntityCard"), false);
  assert.equal(pageSource.includes("<AssignLessonDialog"), false);
});

test("methodology lessons table uses canonical product table primitives and keyboard row navigation", () => {
  assert.equal(lessonsTableSource.includes("ProductTableCard"), true);
  assert.equal(lessonsTableSource.includes("ProductTableEmptyState"), true);
  assert.equal(lessonsTableSource.includes("toMethodologyLessonRoute"), true);
  assert.equal(lessonsTableSource.includes('role="button"'), true);
  assert.equal(lessonsTableSource.includes('tabIndex={0}'), true);
  assert.equal(lessonsTableSource.includes('event.key === "Enter" || event.key === " "'), true);
});
