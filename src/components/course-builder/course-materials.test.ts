import assert from "node:assert/strict";
import test from "node:test";
import type { CourseWorkspace } from "@/modules/course-builder/domain";
import { projectCourseMaterials } from "./course-materials";

const COURSE_ID = "11111111-1111-4111-8111-111111111111";
const LESSON_ID = "22222222-2222-4222-8222-222222222222";
const USED_ASSET_ID = "33333333-3333-4333-8333-333333333333";
const UNUSED_ASSET_ID = "44444444-4444-4444-8444-444444444444";

function workspace(): CourseWorkspace {
  const timestamp = "2026-08-10T00:00:00.000Z";
  return {
    id: COURSE_ID,
    ownerAccountId: "55555555-5555-4555-8555-555555555555",
    title: "Курс",
    learningAudience: "children",
    subject: "Тема",
    goal: "Цель",
    level: "Начальный",
    audienceDescription: "",
    targetLessonCount: 8,
    teacherPreferences: "",
    status: "draft",
    lessonCount: 1,
    assembledAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    publicationContentUpdatedAt: timestamp,
    learningObjectives: [],
    attachments: [
      {
        id: USED_ASSET_ID,
        originalFilename: "used.png",
        mimeType: "image/png",
        sizeBytes: 100,
        checksumSha256: "a".repeat(64),
        status: "ready",
        signedUrl: null,
        createdAt: timestamp,
      },
      {
        id: UNUSED_ASSET_ID,
        originalFilename: "unused.pdf",
        mimeType: "application/pdf",
        sizeBytes: 200,
        checksumSha256: "b".repeat(64),
        status: "ready",
        signedUrl: null,
        createdAt: timestamp,
      },
    ],
    lessons: [
      {
        id: LESSON_ID,
        courseId: COURSE_ID,
        position: 1,
        title: "Первый урок",
        summary: "",
        studentSlides: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        components: [
          {
            id: "66666666-6666-4666-8666-666666666666",
            lessonId: LESSON_ID,
            typeKey: "slideshow",
            schemaVersion: 1,
            position: 1,
            payload: {
              autoplay: false,
              slides: [
                {
                  id: "77777777-7777-4777-8777-777777777777",
                  storedFileId: USED_ASSET_ID,
                  alt: "",
                },
                {
                  id: "88888888-8888-4888-8888-888888888888",
                  storedFileId: USED_ASSET_ID,
                  alt: "",
                },
              ],
            },
            placement: {},
            visibility: "learner_visible",
            studentSlideId: "99999999-9999-4999-8999-999999999999",
            primaryLearningObjectiveId: null,
            activityRole: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      },
    ],
  };
}

test("course materials projection separates lesson usage from unused library files", () => {
  const result = projectCourseMaterials(workspace());

  assert.deepEqual(
    result.used.map((item) => item.asset.id),
    [USED_ASSET_ID],
  );
  assert.deepEqual(
    result.unused.map((item) => item.asset.id),
    [UNUSED_ASSET_ID],
  );
  assert.deepEqual(result.used[0]?.usages, [
    {
      lessonId: LESSON_ID,
      lessonPosition: 1,
      lessonTitle: "Первый урок",
      componentCount: 1,
      occurrenceCount: 2,
      learnerVisible: true,
    },
  ]);
  assert.equal(result.unresolvedReferenceCount, 0);
  assert.equal(result.invalidComponentCount, 0);
});
