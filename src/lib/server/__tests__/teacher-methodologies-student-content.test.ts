import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/server/teacher-methodologies.ts", "utf8");

test("teacher methodology lesson read model logs student content load failures", () => {
  assert.equal(
    source.includes("[teacher-methodology-lesson][student-content-load-failed]"),
    true,
  );
  assert.equal(source.includes("studentContentDebugError"), true);
  assert.equal(source.includes("debugError:"), true);
});
