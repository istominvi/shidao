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
  assert.equal(workspaceComponentSource.includes("<details"), true);
});

test("teacher workspace methodology section remains read-only", () => {
  assert.equal(workspaceComponentSource.includes("Ориентиры методики"), true);
  assert.equal(workspaceComponentSource.includes('name="methodology"'), false);
  assert.equal(workspaceComponentSource.includes('name="methodologyTitle"'), false);
});
