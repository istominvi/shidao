import assert from "node:assert/strict";
import test from "node:test";
import {
  CourseBuilderAccessError,
  CourseBuilderConflictError,
  CourseBuilderValidationError,
} from "@/modules/course-builder/contracts";
import type {
  CourseBuilderActor,
  CourseWorkspace,
} from "@/modules/course-builder/domain";
import { CourseBuilderRepositoryError } from "@/modules/course-builder/repository";
import type { CourseBuilderApplicationService } from "@/modules/course-builder/service";
import { getComponentDefinition } from "@/modules/course-builder/registry/contracts";
import type { LessonHomeworkItem, LessonHomeworkScope } from "./domain";
import type { HomeworkAuthoringRepository } from "./repository";
import { createHomeworkAuthoringService } from "./service";

const COURSE_ID = "30000000-0000-4000-8000-000000000001";
const LESSON_ID = "30000000-0000-4000-8000-000000000002";
const HOMEWORK_ID = "30000000-0000-4000-8000-000000000003";
const ITEM_ID = "30000000-0000-4000-8000-000000000004";
const ASSET_ID = "30000000-0000-4000-8000-000000000005";

const actor: CourseBuilderActor = {
  authUserId: "30000000-0000-4000-8000-000000000010",
  supabaseSessionId: "session-id",
  accessToken: "access-token",
};

function workspace(
  attachments: CourseWorkspace["attachments"] = [],
): CourseWorkspace {
  return {
    id: COURSE_ID,
    ownerAccountId: "30000000-0000-4000-8000-000000000011",
    title: "Курс",
    learningAudience: "children",
    subject: "Предмет",
    goal: "Цель",
    level: "Начальный",
    audienceDescription: "",
    targetLessonCount: 1,
    teacherPreferences: "",
    status: "draft",
    lessonCount: 1,
    assembledAt: null,
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
    publicationContentUpdatedAt: "2026-08-22T00:00:00.000Z",
    lessons: [],
    learningObjectives: [],
    attachments,
  };
}

function homeworkScope(
  revision = 1,
  items: LessonHomeworkItem[] = [],
): LessonHomeworkScope {
  return {
    courseId: COURSE_ID,
    lessonId: LESSON_ID,
    homework: {
      id: HOMEWORK_ID,
      lessonId: LESSON_ID,
      revision,
      items,
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:01:00.000Z",
    },
  };
}

function richTextItem() {
  const definition = getComponentDefinition("rich_text");
  return {
    id: ITEM_ID,
    typeKey: definition.key,
    schemaVersion: definition.version,
    payload: structuredClone(definition.defaultPayload),
    placement: structuredClone(definition.defaultPlacement),
  };
}

function dependencies(
  options: {
    scope?: LessonHomeworkScope;
    replacement?: LessonHomeworkScope;
    course?: CourseWorkspace;
    replaceError?: Error;
    courseError?: Error;
  } = {},
) {
  const replaceCalls: Parameters<HomeworkAuthoringRepository["replace"]>[0][] =
    [];
  const scope = options.scope ?? {
    courseId: COURSE_ID,
    lessonId: LESSON_ID,
    homework: null,
  };
  const repository: HomeworkAuthoringRepository = {
    async getScope() {
      return scope;
    },
    async replace(input) {
      replaceCalls.push(input);
      if (options.replaceError) throw options.replaceError;
      return options.replacement ?? homeworkScope();
    },
  };
  const courseService = {
    async getCourse() {
      if (options.courseError) throw options.courseError;
      return options.course ?? workspace();
    },
  } as unknown as Pick<CourseBuilderApplicationService, "getCourse">;
  return { repository, courseService, replaceCalls };
}

test("owner can read an empty scope and atomically create one Homework draft", async () => {
  const item = richTextItem();
  const deps = dependencies({
    replacement: homeworkScope(1, [{ ...item, position: 1 }]),
  });
  const service = createHomeworkAuthoringService(deps);

  assert.equal(await service.get(actor, LESSON_ID), null);
  const saved = await service.replace(actor, LESSON_ID, {
    expectedRevision: null,
    items: [item],
  });
  assert.equal(saved?.revision, 1);
  assert.deepEqual(deps.replaceCalls, [
    { lessonId: LESSON_ID, expectedRevision: null, items: [item] },
  ]);
});

test("owner can edit and deterministically reorder the full Homework list", async () => {
  const item = richTextItem();
  const reversed = [
    item,
    { ...item, id: "30000000-0000-4000-8000-000000000006" },
  ].reverse();
  const deps = dependencies({
    scope: homeworkScope(1, [{ ...item, position: 1 }]),
    replacement: homeworkScope(
      2,
      reversed.map((entry, index) => ({ ...entry, position: index + 1 })),
    ),
  });

  const saved = await createHomeworkAuthoringService(deps).replace(
    actor,
    LESSON_ID,
    { expectedRevision: 1, items: reversed },
  );

  assert.equal(saved?.revision, 2);
  assert.deepEqual(
    saved?.items.map((entry) => entry.id),
    reversed.map((entry) => entry.id),
  );
  assert.deepEqual(deps.replaceCalls, [
    { lessonId: LESSON_ID, expectedRevision: 1, items: reversed },
  ]);
});

test("stale schema, malformed payload, forbidden type, and foreign attachment fail before persistence", async () => {
  const invalidInputs = [
    {
      expectedRevision: null,
      items: [{ ...richTextItem(), schemaVersion: 2 }],
    },
    { expectedRevision: null, items: [{ ...richTextItem(), payload: {} }] },
    {
      expectedRevision: null,
      items: [{ ...richTextItem(), typeKey: "free_response" }],
    },
    {
      expectedRevision: null,
      items: [
        {
          id: ITEM_ID,
          typeKey: "file",
          schemaVersion: 1,
          payload: {
            storedFileId: ASSET_ID,
            label: "Лист",
            openMode: "download",
          },
          placement: { width: "content", display: "card" },
        },
      ],
    },
  ];

  for (const rawInput of invalidInputs) {
    const deps = dependencies();
    const service = createHomeworkAuthoringService(deps);
    await assert.rejects(
      () => service.replace(actor, LESSON_ID, rawInput),
      CourseBuilderValidationError,
    );
    assert.equal(deps.replaceCalls.length, 0);
  }
});

test("ready same-Course attachments are accepted while owner authorization remains fail closed", async () => {
  const fileItem = {
    id: ITEM_ID,
    typeKey: "file" as const,
    schemaVersion: 1,
    payload: { storedFileId: ASSET_ID, label: "Лист", openMode: "download" },
    placement: { width: "content", display: "card" },
  };
  const deps = dependencies({
    course: workspace([
      {
        id: ASSET_ID,
        originalFilename: "sheet.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
        checksumSha256: "a".repeat(64),
        status: "ready",
        signedUrl: null,
        createdAt: "2026-08-22T00:00:00.000Z",
      },
    ]),
  });
  await createHomeworkAuthoringService(deps).replace(actor, LESSON_ID, {
    expectedRevision: null,
    items: [fileItem],
  });
  assert.equal(deps.replaceCalls.length, 1);

  const denied = dependencies({ courseError: new CourseBuilderAccessError() });
  await assert.rejects(
    () =>
      createHomeworkAuthoringService(denied).replace(actor, LESSON_ID, {
        expectedRevision: null,
        items: [richTextItem()],
      }),
    CourseBuilderAccessError,
  );
  assert.equal(denied.replaceCalls.length, 0);
});

test("CAS conflict is reloadable and clear retains an empty aggregate with monotonic revision", async () => {
  const conflict = dependencies({
    replaceError: new CourseBuilderRepositoryError(
      "revision conflict",
      409,
      "homework_revision_conflict",
    ),
  });
  await assert.rejects(
    () =>
      createHomeworkAuthoringService(conflict).replace(actor, LESSON_ID, {
        expectedRevision: 1,
        items: [richTextItem()],
      }),
    (error: unknown) =>
      error instanceof CourseBuilderConflictError &&
      error.code === "homework_revision_conflict",
  );

  const cleared = dependencies({
    scope: homeworkScope(1),
    replacement: homeworkScope(2, []),
  });
  const result = await createHomeworkAuthoringService(cleared).clear(
    actor,
    LESSON_ID,
    { expectedRevision: 1 },
  );
  assert.equal(result.revision, 2);
  assert.deepEqual(result.items, []);
  assert.deepEqual(cleared.replaceCalls, [
    { lessonId: LESSON_ID, expectedRevision: 1, items: [] },
  ]);
});
