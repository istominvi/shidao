import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/server/teacher-methodologies.ts", "utf8");

test("methodology lesson read model keeps canonical homework and source student content", () => {
  assert.equal(source.includes("canonicalHomework"), true);
  assert.equal(source.includes("getMethodologyLessonStudentContentByLessonIdAdmin"), true);
  assert.equal(source.includes("studentContentUnavailableReason"), true);
  assert.equal(source.includes('"schema_missing"'), true);
  assert.equal(source.includes('"invalid_payload"'), true);
  assert.equal(source.includes('"load_failed"'), true);
});
