import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const workspaceComponentSource = readFileSync(
  join(process.cwd(), "src/components/lessons/teacher-lesson-workspace.tsx"),
  "utf8",
);

test("teacher workspace component keeps runtime editing surface", () => {
  assert.equal(workspaceComponentSource.includes('name="runtimeStatus"'), true);
  assert.equal(
    workspaceComponentSource.includes('name="runtimeNotesSummary"'),
    true,
  );
  assert.equal(workspaceComponentSource.includes('name="runtimeNotes"'), true);
  assert.equal(workspaceComponentSource.includes('name="outcomeNotes"'), true);
  assert.equal(workspaceComponentSource.includes("Проведение занятия"), true);
});

test("teacher workspace exposes three canonical parts", () => {
  assert.equal(workspaceComponentSource.includes("Сценарий урока"), true);
  assert.equal(workspaceComponentSource.includes("Контент для ученика"), true);
  assert.equal(workspaceComponentSource.includes("Домашнее задание"), true);
  assert.equal(workspaceComponentSource.includes('name="methodology"'), false);
  assert.equal(workspaceComponentSource.includes('name="methodologyTitle"'), false);
});

test("teacher workspace keeps homework runtime controls", () => {
  assert.equal(workspaceComponentSource.includes("TeacherHomeworkPanel"), true);
});
