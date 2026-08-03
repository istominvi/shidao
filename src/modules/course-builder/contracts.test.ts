import assert from "node:assert/strict";
import test from "node:test";
import {
  COURSE_ASSET_MAX_BYTES,
  courseDraftInputSchema,
  prepareCourseAttachmentInputSchema,
} from "./contracts";

test("course draft contract normalizes the complete teacher form", () => {
  const parsed = courseDraftInputSchema.parse({
    title: "  Китайский для путешествий ",
    subject: " Китайский язык ",
    goal: "Уверенно общаться в поездке",
    level: "Начальный",
    targetLessonCount: 8,
  });

  assert.equal(parsed.title, "Китайский для путешествий");
  assert.equal(parsed.audienceDescription, "");
  assert.equal(parsed.teacherPreferences, "");
});

test("attachment contract rejects unsupported and oversized files", () => {
  const base = {
    originalFilename: "notes.pdf",
    mimeType: "application/pdf",
    sizeBytes: 42,
    checksumSha256: "a".repeat(64),
  };

  assert.equal(
    prepareCourseAttachmentInputSchema.safeParse(base).success,
    true,
  );
  assert.equal(
    prepareCourseAttachmentInputSchema.safeParse({
      ...base,
      mimeType: "application/x-msdownload",
    }).success,
    false,
  );
  assert.equal(
    prepareCourseAttachmentInputSchema.safeParse({
      ...base,
      sizeBytes: COURSE_ASSET_MAX_BYTES + 1,
    }).success,
    false,
  );
});
