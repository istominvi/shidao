import assert from "node:assert/strict";
import test from "node:test";
import {
  COURSE_ASSET_MAX_BYTES,
  addLessonInputSchema,
  courseDraftInputSchema,
  prepareCourseAttachmentInputSchema,
  reorderLessonComponentInputSchema,
  setComponentStudentScreenInputSchema,
  updateLessonComponentInputSchema,
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
  assert.equal(parsed.learningAudience, "children");
  assert.equal(parsed.learningAudience, "children");
  assert.equal(parsed.audienceDescription, "");
  assert.equal(parsed.teacherPreferences, "");

  assert.equal(
    courseDraftInputSchema.parse({
      title: "Методика преподавания китайского",
      learningAudience: "educators",
      subject: "Китайский язык",
      goal: "Повысить квалификацию преподавателей",
      level: "Повышение квалификации",
      targetLessonCount: 6,
    }).learningAudience,
    "educators",
  );
});

test("course draft accepts the educator learning audience explicitly", () => {
  const parsed = courseDraftInputSchema.parse({
    title: "Методика урока китайского",
    learningAudience: "educators",
    subject: "Китайский язык",
    goal: "Спроектировать урок",
    level: "Повышение квалификации",
    targetLessonCount: 6,
  });

  assert.equal(parsed.learningAudience, "educators");
  assert.equal(
    courseDraftInputSchema.safeParse({
      ...parsed,
      learningAudience: "parents",
    }).success,
    false,
  );
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

test("component payload edits and Student Screen placement have separate contracts", () => {
  assert.deepEqual(updateLessonComponentInputSchema.parse({ payload: {} }), {
    payload: {},
  });
  assert.equal(
    updateLessonComponentInputSchema.safeParse({ visibility: "staff_only" })
      .success,
    false,
  );
  assert.deepEqual(
    setComponentStudentScreenInputSchema.parse({ mode: "new" }),
    {
      mode: "new",
    },
  );
  assert.equal(
    setComponentStudentScreenInputSchema.safeParse({
      mode: "existing",
      slideId: "00000000-0000-4000-8000-000000000001",
    }).success,
    true,
  );
  assert.equal(
    setComponentStudentScreenInputSchema.safeParse({ mode: "existing" })
      .success,
    false,
  );
  assert.equal(updateLessonComponentInputSchema.safeParse({}).success, false);
});

test("Lesson contracts expose direct document metadata and component ordering", () => {
  assert.deepEqual(Object.keys(addLessonInputSchema.shape), [
    "title",
    "summary",
  ]);
  assert.deepEqual(reorderLessonComponentInputSchema.parse({ toPosition: 3 }), {
    toPosition: 3,
  });
  assert.equal(
    reorderLessonComponentInputSchema.safeParse({ toPosition: 0 }).success,
    false,
  );
});
