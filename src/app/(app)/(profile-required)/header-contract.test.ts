import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const studentNewPageSource = readFileSync(
  "src/app/(app)/(profile-required)/students/new/page.tsx",
  "utf8",
);

const communicationPageSource = readFileSync(
  "src/app/(app)/(profile-required)/groups/[groupId]/students/[studentId]/communication/page.tsx",
  "utf8",
);

const methodologyLessonPageSource = readFileSync(
  "src/app/(app)/(profile-required)/methodologies/[methodologySlug]/lessons/[lessonId]/page.tsx",
  "utf8",
);

test("methodology lesson page uses shared canonical AppPageHeader", () => {
  assert.equal(methodologyLessonPageSource.includes("<AppPageHeader"), true);
  assert.equal(methodologyLessonPageSource.includes("<h1"), false);
});

test("student creation page uses shared canonical AppPageHeader", () => {
  assert.equal(studentNewPageSource.includes("<AppPageHeader"), true);
  assert.equal(studentNewPageSource.includes("text-3xl font-black"), false);
  assert.equal(
    studentNewPageSource.includes("text-[11px] font-semibold uppercase"),
    false,
  );
});

test("student communication page removes manual header hero and uses shared header", () => {
  assert.equal(communicationPageSource.includes("<AppPageHeader"), true);
  assert.equal(
    communicationPageSource.includes('<header className="landing-surface'),
    false,
  );
  assert.equal(communicationPageSource.includes("<h1"), false);
});
