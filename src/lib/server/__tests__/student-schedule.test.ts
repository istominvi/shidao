import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/lib/server/student-schedule.ts", "utf8");

test("student lessons hub mapping attaches connection info for online and offline lessons", () => {
  assert.equal(source.includes("buildLessonConnectionInfo(lesson.runtimeShell"), true);
  assert.equal(source.includes('onlineCtaLabel: "Войти на урок"'), true);
  assert.equal(source.includes('offlineDisplayPrefix: "Место: "'), true);
  assert.equal(source.includes("connection: LessonConnectionInfo"), true);
});
