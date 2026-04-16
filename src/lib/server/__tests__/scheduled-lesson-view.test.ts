import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/server/scheduled-lesson-view.ts", "utf8");

test("scheduled lesson view defines explicit role-aware read models", () => {
  assert.equal(source.includes("TeacherScheduledLessonView"), true);
  assert.equal(source.includes("StudentScheduledLessonView"), true);
  assert.equal(source.includes("ParentScheduledLessonView"), true);
  assert.equal(source.includes("childrenRuntime"), true);
});

test("parent projection is multi-child and route-independent", () => {
  assert.equal(source.includes("childrenInLesson"), true);
  assert.equal(source.includes("childrenRuntime = await Promise.all"), true);
  assert.equal(source.includes("loadParentLearningContextsByUser"), true);
  assert.equal(source.includes("lesson-room"), false);
  assert.equal(source.includes("children/[studentId]/lesson-room"), false);
});

test("teacher and student access are class-scoped server-side", () => {
  assert.equal(source.includes("listAssignedClassIdsForTeacherAdmin"), true);
  assert.equal(source.includes("listClassIdsForStudentAdmin"), true);
  assert.equal(source.includes("if (!classIds.includes"), true);
});

test("learner communication preview uses neutral helper (no fake teacher identity)", () => {
  assert.equal(source.includes("getLearnerConversationPreviewReadModel"), true);
  assert.equal(source.includes("getTeacherConversationReadModel"), false);
  assert.equal(source.includes("teacherId: \"\""), false);
});

test("learner shared projection resolves assets for richer student content section types", () => {
  assert.equal(source.includes('section.type === "media_stage"'), true);
  assert.equal(source.includes('section.type === "song_stage"'), true);
  assert.equal(source.includes('section.type === "worksheet_preview"'), true);
});

test("learner projection logs concise diagnostics when student content load fails", () => {
  assert.equal(
    source.includes("[scheduled-lesson][student-content-load-failed]"),
    true,
  );
});

test("learner projection can auto-publish world-around-me lesson one content", () => {
  assert.equal(source.includes("publishWorldAroundMeLessonOneContent"), true);
  assert.equal(source.includes("student-content-autopublished"), true);
  assert.equal(source.includes("student-content-autopublish-failed"), true);
});
