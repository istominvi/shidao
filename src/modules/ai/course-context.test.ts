import assert from "node:assert/strict";
import test from "node:test";
import type {
  CourseWorkspace,
  LessonComponent,
} from "@/modules/course-builder/domain";
import {
  buildAssistantContext,
  buildCoursePlanningContext,
  buildLessonPlanningContext,
} from "./course-context";

function component(index: number): LessonComponent {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    lessonId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    typeKey: "rich_text",
    schemaVersion: 1,
    position: index,
    payload: {
      content: `Материал ${index}`,
      format: "markdown",
      storedFileId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    },
    placement: { width: "content", textAlign: "start" },
    visibility: "staff_only",
    studentSlideId: null,
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
  };
}

function workspace(): CourseWorkspace {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ownerAccountId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    title: "Дроби",
    subject: "Математика",
    goal: "Научиться считать",
    level: "5 класс",
    audienceDescription: "Один ученик",
    targetLessonCount: 8,
    teacherPreferences: "Больше практики",
    status: "draft",
    lessonCount: 1,
    assembledAt: null,
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
    lessons: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        courseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        position: 1,
        title: "Сравнение дробей",
        summary: "Комментарий преподавателя",
        components: Array.from({ length: 21 }, (_, index) =>
          component(index + 1),
        ),
        studentSlides: [],
        createdAt: "2026-08-05T00:00:00.000Z",
        updatedAt: "2026-08-05T00:00:00.000Z",
      },
    ],
    attachments: [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        originalFilename: "private.pdf",
        mimeType: "application/pdf",
        sizeBytes: 123,
        checksumSha256: "secret-checksum",
        status: "ready",
        signedUrl: "https://storage.test/private-signed-url",
        createdAt: "2026-08-05T00:00:00.000Z",
      },
    ],
  };
}

test("AI context excludes storage credentials, file IDs and file contents", () => {
  const course = workspace();
  const serialized = JSON.stringify(buildCoursePlanningContext(course));
  assert.match(serialized, /private\.pdf/);
  assert.match(serialized, /только прикреплён/);
  assert.doesNotMatch(serialized, /private-signed-url|secret-checksum/);
  assert.doesNotMatch(
    serialized,
    /bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb|ownerAccountId/,
  );
});

test("assistant context explicitly marks component truncation", () => {
  const course = workspace();
  const context = buildAssistantContext(course, course.lessons[0]);
  assert.equal(context.selectedLesson?.componentCount, 21);
  assert.equal(context.selectedLesson?.componentsIncluded, 20);
  assert.equal(context.selectedLesson?.componentsTruncated, true);
  assert.equal(context.selectedLesson?.components.length, 20);
  assert.doesNotMatch(JSON.stringify(context), /storedFileId/);
});

test("maximum-sized course context leaves room for bounded chat history", () => {
  const course = workspace();
  const richComponents = Array.from({ length: 20 }, (_, index) => ({
    ...component(index + 1),
    payload: { content: "я".repeat(20_000), format: "markdown" },
  }));
  course.lessons = Array.from({ length: 60 }, (_, index) => ({
    ...course.lessons[0]!,
    id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    position: index + 1,
    title: `Урок ${index + 1} ${"т".repeat(160)}`,
    summary: "к".repeat(1_200),
    components: index === 0 ? richComponents : [],
  }));
  course.lessonCount = course.lessons.length;
  course.targetLessonCount = course.lessons.length;

  const assistantCharacters = JSON.stringify(
    buildAssistantContext(course, course.lessons[0]!),
  ).length;
  const lessonCharacters = JSON.stringify(
    buildLessonPlanningContext(
      course,
      course.lessons[0]!,
      course.lessons[0]!.title,
    ),
  ).length;

  assert.ok(assistantCharacters < 100_000, String(assistantCharacters));
  assert.ok(lessonCharacters < 100_000, String(lessonCharacters));
});
