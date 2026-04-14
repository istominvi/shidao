import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const communicationPageSource = readFileSync(
  "src/app/(app)/(profile-required)/groups/[groupId]/students/[studentId]/communication/page.tsx",
  "utf8",
);

const methodologyLessonPageSource = readFileSync(
  "src/app/(app)/(profile-required)/methodologies/[methodologySlug]/lessons/[lessonId]/page.tsx",
  "utf8",
);

const scheduledLessonPageSource = readFileSync(
  "src/app/(app)/(profile-required)/lessons/[scheduledLessonId]/page.tsx",
  "utf8",
);

const demoLessonPageSource = readFileSync(
  "src/app/(app)/(profile-required)/lessons/demo/page.tsx",
  "utf8",
);

const settingsShellSource = readFileSync("src/components/settings-shell.tsx", "utf8");

test("methodology lesson page uses shared canonical AppPageHeader", () => {
  assert.equal(methodologyLessonPageSource.includes("<AppPageHeader"), true);
  assert.equal(methodologyLessonPageSource.includes("<h1"), false);
});

test("student communication page removes manual header hero and uses shared header", () => {
  assert.equal(communicationPageSource.includes("<AppPageHeader"), true);
  assert.equal(
    communicationPageSource.includes('<header className="landing-surface'),
    false,
  );
  assert.equal(communicationPageSource.includes("<h1"), false);
});

test("scheduled lesson page uses shared canonical AppPageHeader across all role surfaces", () => {
  assert.equal(scheduledLessonPageSource.includes("<AppPageHeader"), true);
  assert.equal(scheduledLessonPageSource.includes("<h1"), false);
});

test("settings shell renders canonical AppPageHeader instead of local badge + h1 stack", () => {
  assert.equal(settingsShellSource.includes("<AppPageHeader"), true);
  assert.equal(settingsShellSource.includes("text-3xl font-black"), false);
  assert.equal(settingsShellSource.includes("chip"), false);
});

test("demo lesson page uses canonical AppPageHeader in error surface", () => {
  assert.equal(demoLessonPageSource.includes("<AppPageHeader"), true);
  assert.equal(demoLessonPageSource.includes("<h1"), false);
});
