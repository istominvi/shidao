import assert from "node:assert/strict";
import test from "node:test";
import {
  homeworkItemTypeKeys,
  lessonHomeworkScopeSchema,
  replaceLessonHomeworkInputSchema,
} from "./contracts";
import type { LessonHomeworkScope } from "./domain";
import { getComponentDefinition } from "@/modules/course-builder/registry/contracts";

const LESSON_ID = "10000000-0000-4000-8000-000000000001";
const HOMEWORK_ID = "10000000-0000-4000-8000-000000000002";
const ITEM_ID = "10000000-0000-4000-8000-000000000003";

function validDraftItem(id = ITEM_ID) {
  const definition = getComponentDefinition("rich_text");
  return {
    id,
    typeKey: definition.key,
    schemaVersion: definition.version,
    payload: structuredClone(definition.defaultPayload),
    placement: structuredClone(definition.defaultPlacement),
  };
}

test("P1.3 Homework allowlist is a passive projection of the one component registry", () => {
  assert.deepEqual(homeworkItemTypeKeys, [
    "rich_text",
    "image",
    "external_link",
    "file",
  ]);
  for (const typeKey of homeworkItemTypeKeys) {
    const definition = getComponentDefinition(typeKey);
    assert.equal(definition.key, typeKey);
    assert.equal(definition.capabilities.teacherSurface, true);
    assert.equal(definition.activityFacet, undefined);
  }
});

test("replace input keeps a bounded unique ordered-item payload", () => {
  const parsed = replaceLessonHomeworkInputSchema.parse({
    expectedRevision: null,
    items: [validDraftItem()],
  });
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0]?.typeKey, "rich_text");

  assert.equal(
    replaceLessonHomeworkInputSchema.safeParse({
      expectedRevision: 1,
      items: [],
    }).success,
    false,
    "PUT cannot masquerade as clear; DELETE owns that command",
  );
  assert.equal(
    replaceLessonHomeworkInputSchema.safeParse({
      expectedRevision: 1,
      items: [validDraftItem(), validDraftItem()],
    }).success,
    false,
  );
  assert.equal(
    replaceLessonHomeworkInputSchema.safeParse({
      expectedRevision: null,
      items: [{ ...validDraftItem(), typeKey: "free_response" }],
    }).success,
    false,
  );
  assert.equal(
    replaceLessonHomeworkInputSchema.safeParse({
      expectedRevision: null,
      items: [{ ...validDraftItem(), hidden: true }],
    }).success,
    false,
  );
});

test("persisted projection accepts a cleared aggregate and rejects non-dense order", () => {
  const cleared: LessonHomeworkScope = {
    courseId: "10000000-0000-4000-8000-000000000004",
    lessonId: LESSON_ID,
    homework: {
      id: HOMEWORK_ID,
      lessonId: LESSON_ID,
      revision: 2,
      items: [],
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:01:00.000Z",
    },
  };
  assert.equal(lessonHomeworkScopeSchema.safeParse(cleared).success, true);

  const nonDense = structuredClone(cleared);
  nonDense.homework!.items = [{ ...validDraftItem(), position: 2 }];
  assert.equal(lessonHomeworkScopeSchema.safeParse(nonDense).success, false);
});
