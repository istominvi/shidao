import assert from "node:assert/strict";
import test from "node:test";
import {
  CoursePublicationAccessError,
  CoursePublicationConflictError,
  CoursePublicationValidationError,
  type CatalogQuery,
} from "./contracts";
import { courseBuilderApiError } from "@/modules/course-builder/server-context";
import type {
  CourseBuilderActor,
  CourseWorkspace,
} from "@/modules/course-builder/domain";
import type {
  CoursePublicationSnapshot,
  CoursePublicationSnapshotV1,
} from "./domain";
import type {
  CatalogPublicationDetailRecord,
  CoursePublicationRepository,
  PublicationSourceAsset,
} from "./repository";
import type { CoursePublicationStorageBroker } from "./storage";
import type { CoursePublicationMutationGuard } from "./mutation-guard";
import {
  CoursePublicationMutationRateLimitError,
  CoursePublicationRepositoryError,
} from "./errors";
import {
  buildCoursePublicationSnapshot,
  createCoursePublicationService,
  publicationContentSha256,
} from "./service";

function uuid(sequence: number) {
  return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`;
}

const ACTOR: CourseBuilderActor = {
  authUserId: uuid(1),
  accessToken: "access-token",
};
const ACCOUNT_ID = uuid(101);
const COURSE_ID = uuid(201);
const LESSON_ID = uuid(301);
const SLIDE_ID = uuid(401);
const STAFF_COMPONENT_ID = uuid(501);
const LEARNER_COMPONENT_ID = uuid(502);
const OBJECTIVE_ID = uuid(550);
const ARCHIVED_OBJECTIVE_ID = uuid(551);
const ASSET_ID = uuid(601);
const PUBLICATION_ID = uuid(701);
const NOW = "2026-08-10T10:00:00.000Z";

function workspace(overrides: Partial<CourseWorkspace> = {}): CourseWorkspace {
  return {
    id: COURSE_ID,
    ownerAccountId: ACCOUNT_ID,
    title: "Китайский с нуля",
    subject: "Китайский язык",
    goal: "Научиться вести короткий диалог",
    level: "Начальный",
    audienceDescription: "Дети 9–11 лет",
    targetLessonCount: 8,
    teacherPreferences: "Называть ученика Машей",
    status: "draft",
    lessonCount: 1,
    assembledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    publicationContentUpdatedAt: NOW,
    publication: null,
    learningObjectives: [],
    lessons: [
      {
        id: LESSON_ID,
        courseId: COURSE_ID,
        position: 1,
        title: "Знакомство",
        summary: "Комментарий преподавателя",
        estimatedDurationMinutes: 45,
        components: [
          {
            id: STAFF_COMPONENT_ID,
            lessonId: LESSON_ID,
            typeKey: "file",
            schemaVersion: 1,
            position: 1,
            payload: {
              storedFileId: ASSET_ID,
              label: "Карточки",
              openMode: "download",
            },
            placement: { width: "content", display: "card" },
            visibility: "staff_only",
            studentSlideId: null,
            primaryLearningObjectiveId: null,
            activityRole: null,
            createdAt: NOW,
            updatedAt: NOW,
          },
          {
            id: LEARNER_COMPONENT_ID,
            lessonId: LESSON_ID,
            typeKey: "file",
            schemaVersion: 1,
            position: 2,
            payload: {
              storedFileId: ASSET_ID,
              label: "Задание",
              openMode: "preview",
            },
            placement: { width: "content", display: "link" },
            visibility: "learner_visible",
            studentSlideId: SLIDE_ID,
            primaryLearningObjectiveId: null,
            activityRole: null,
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
        studentSlides: [
          {
            id: SLIDE_ID,
            lessonId: LESSON_ID,
            position: 1,
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    attachments: [
      {
        id: ASSET_ID,
        originalFilename: "cards.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2_048,
        checksumSha256: "a".repeat(64),
        status: "ready",
        signedUrl: "https://private.example/signed-source",
        createdAt: NOW,
      },
    ],
    ...overrides,
    learningAudience: overrides.learningAudience ?? "children",
  };
}

function objectiveWorkspace(): CourseWorkspace {
  const base = workspace();
  return workspace({
    learningObjectives: [
      {
        id: OBJECTIVE_ID,
        courseId: COURSE_ID,
        title: "Распознавать приветствие на слух",
        description: "Отличать приветствие от прощания.",
        archivedAt: null,
        createdAt: "2026-08-09T10:00:00.000Z",
        updatedAt: NOW,
      },
      {
        id: ARCHIVED_OBJECTIVE_ID,
        courseId: COURSE_ID,
        title: "Использовать формальное приветствие",
        description: null,
        archivedAt: NOW,
        createdAt: "2026-08-08T10:00:00.000Z",
        updatedAt: NOW,
      },
    ],
    lessons: base.lessons.map((lesson) => ({
      ...lesson,
      components: lesson.components.map((component) =>
        component.id === LEARNER_COMPONENT_ID
          ? {
              ...component,
              primaryLearningObjectiveId: OBJECTIVE_ID,
              activityRole: "assessment",
            }
          : {
              ...component,
              primaryLearningObjectiveId: ARCHIVED_OBJECTIVE_ID,
            },
      ),
    })),
  });
}

function legacySnapshotFixture(): CoursePublicationSnapshotV1 {
  const current = buildCoursePublicationSnapshot({
    workspace: workspace(),
    sourceAssets: sourceAssets(),
    publicationId: PUBLICATION_ID,
  });
  return {
    schemaVersion: 1,
    course: current.course,
    lessons: current.lessons.map((lesson) => ({
      ref: lesson.ref,
      position: lesson.position,
      title: lesson.title,
      summary: lesson.summary,
      estimatedDurationMinutes: lesson.estimatedDurationMinutes,
      components: lesson.components.map((component) => ({
        ref: component.ref,
        position: component.position,
        typeKey: component.typeKey,
        schemaVersion: component.schemaVersion,
        payload: component.payload,
        placement: component.placement,
        visibility: component.visibility,
        studentSlideRef: component.studentSlideRef,
      })),
      slides: lesson.slides,
    })),
    materials: current.materials,
  };
}

function sourceAssets(
  status: "pending" | "ready" = "ready",
): PublicationSourceAsset[] {
  return [
    {
      sourceStoredFileId: ASSET_ID,
      storageBucket: "course-assets",
      storagePath: `${ACCOUNT_ID}/courses/${COURSE_ID}/assets/source.pdf`,
      originalFilename: "cards.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2_048,
      checksumSha256: "a".repeat(64),
      status,
    },
  ];
}

function repository(
  overrides: Partial<CoursePublicationRepository> = {},
): CoursePublicationRepository {
  return {
    isActiveAccount: async () => true,
    getOwnedPublication: async () => null,
    listOwnedPublications: async () => [],
    listCatalog: async () => ({
      courses: [],
      facets: { subjects: [], levels: [] },
      nextOffset: null,
    }),
    getCatalogPublication: async () => null,
    assertCatalogCopyEligible: async () => undefined,
    getCourseAttestationDefinition: async () => null,
    listSourceAssets: async () => sourceAssets(),
    publishCourseRevision: async () => {
      throw new Error("unexpected publish");
    },
    unpublishCourse: async () => {
      throw new Error("unexpected unpublish");
    },
    clonePublication: async () => {
      throw new Error("unexpected clone");
    },
    duplicateCourse: async () => {
      throw new Error("unexpected duplicate");
    },
    ...overrides,
  };
}

function storageBroker() {
  const calls = {
    copies: [] as string[],
    deletes: [] as string[][],
    signedDownloads: 0,
  };
  const storage: CoursePublicationStorageBroker = {
    async copyObject(input) {
      calls.copies.push(input.destinationPath);
    },
    async deleteObjects(_bucket, paths) {
      calls.deletes.push(paths);
    },
    async createSignedDownload() {
      calls.signedDownloads += 1;
      return "https://private.example/signed-publication";
    },
  };
  return { storage, calls };
}

function courseService(value: CourseWorkspace, accountId = ACCOUNT_ID) {
  return {
    async getActorAccountId() {
      return accountId;
    },
    async getCourse() {
      return value;
    },
  };
}

function idFactory(start = 800) {
  let sequence = start;
  return () => uuid(sequence++);
}

function catalogRecordFixture(
  snapshot: CoursePublicationSnapshot = buildCoursePublicationSnapshot({
    workspace: workspace(),
    sourceAssets: sourceAssets(),
    publicationId: PUBLICATION_ID,
  }),
): CatalogPublicationDetailRecord {
  const material = snapshot.materials[0]!;
  return {
    publicationId: PUBLICATION_ID,
    sourceCourseId: COURSE_ID,
    ownerAccountId: ACCOUNT_ID,
    publisherDisplayName: "Преподаватель",
    isShiDao: false,
    learningAudience: "children",
    publishedAt: NOW,
    revisionId: uuid(702),
    snapshot,
    assets: [
      {
        publicationAssetId: material.ref,
        storageBucket: "course-publication-assets",
        storagePath: `${PUBLICATION_ID}/revisions/${uuid(702)}/assets/${material.ref}`,
        originalFilename: material.originalFilename,
        mimeType: material.mimeType,
        sizeBytes: material.sizeBytes,
        checksumSha256: material.checksumSha256,
      },
    ],
  };
}

test("snapshot keeps all components and slides but removes private/source fields", () => {
  const snapshot = buildCoursePublicationSnapshot({
    workspace: workspace(),
    sourceAssets: sourceAssets(),
    publicationId: PUBLICATION_ID,
  });
  const materialRef = snapshot.materials[0]!.ref;
  assert.equal(snapshot.schemaVersion, 2);
  assert.deepEqual(snapshot.objectives, []);
  assert.equal(snapshot.lessons[0]!.summary, "Комментарий преподавателя");
  assert.deepEqual(
    snapshot.lessons[0]!.components.map((component) => component.visibility),
    ["staff_only", "learner_visible"],
  );
  assert.equal(
    snapshot.lessons[0]!.components[0]!.payload.storedFileId,
    materialRef,
  );
  assert.equal(
    snapshot.lessons[0]!.components[1]!.studentSlideRef,
    snapshot.lessons[0]!.slides[0]!.ref,
  );
  assert.notEqual(snapshot.lessons[0]!.ref, LESSON_ID);
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(
    serialized,
    /teacherPreferences|ownerAccountId|signed-source/,
  );
  assert.doesNotMatch(serialized, new RegExp(COURSE_ID));
  assert.doesNotMatch(serialized, new RegExp(ASSET_ID));
});

test("V2 snapshot preserves objectives and alignment with deterministic local refs", () => {
  const source = objectiveWorkspace();
  const first = buildCoursePublicationSnapshot({
    workspace: source,
    sourceAssets: sourceAssets(),
    publicationId: PUBLICATION_ID,
  });
  const second = buildCoursePublicationSnapshot({
    workspace: source,
    sourceAssets: sourceAssets(),
    publicationId: PUBLICATION_ID,
  });

  assert.equal(first.schemaVersion, 2);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.objectives.map((objective) => ({
      title: objective.title,
      position: objective.position,
      archivedAt: objective.archivedAt,
    })),
    [
      {
        title: "Использовать формальное приветствие",
        position: 1,
        archivedAt: NOW,
      },
      {
        title: "Распознавать приветствие на слух",
        position: 2,
        archivedAt: null,
      },
    ],
  );
  const activeObjective = first.objectives.find(
    (objective) => objective.title === "Распознавать приветствие на слух",
  )!;
  const archivedObjective = first.objectives.find(
    (objective) => objective.archivedAt !== null,
  )!;
  const learnerComponent = first.lessons[0]!.components.find(
    (component) => component.position === 2,
  )!;
  const staffComponent = first.lessons[0]!.components.find(
    (component) => component.position === 1,
  )!;
  assert.equal(learnerComponent.primaryObjectiveRef, activeObjective.ref);
  assert.equal(learnerComponent.activityRole, "assessment");
  assert.equal(staffComponent.primaryObjectiveRef, archivedObjective.ref);
  assert.notEqual(activeObjective.ref, OBJECTIVE_ID);
  const serialized = JSON.stringify(first);
  assert.doesNotMatch(serialized, new RegExp(OBJECTIVE_ID));
  assert.doesNotMatch(serialized, new RegExp(ARCHIVED_OBJECTIVE_ID));
});

test("objective and alignment changes alter the immutable publication hash", () => {
  const baselineWorkspace = objectiveWorkspace();
  const snapshotFor = (value: CourseWorkspace) =>
    buildCoursePublicationSnapshot({
      workspace: value,
      sourceAssets: sourceAssets(),
      publicationId: PUBLICATION_ID,
    });
  const baselineHash = publicationContentSha256(snapshotFor(baselineWorkspace));
  const variants: CourseWorkspace[] = [
    {
      ...baselineWorkspace,
      learningObjectives: baselineWorkspace.learningObjectives.map(
        (objective) =>
          objective.id === OBJECTIVE_ID
            ? { ...objective, title: "Различать приветствия на слух" }
            : objective,
      ),
    },
    {
      ...baselineWorkspace,
      learningObjectives: baselineWorkspace.learningObjectives.map(
        (objective) =>
          objective.id === OBJECTIVE_ID
            ? { ...objective, archivedAt: NOW }
            : objective,
      ),
    },
    {
      ...baselineWorkspace,
      lessons: baselineWorkspace.lessons.map((lesson) => ({
        ...lesson,
        components: lesson.components.map((component) =>
          component.id === LEARNER_COMPONENT_ID
            ? { ...component, primaryLearningObjectiveId: null }
            : component,
        ),
      })),
    },
    {
      ...baselineWorkspace,
      lessons: baselineWorkspace.lessons.map((lesson) => ({
        ...lesson,
        components: lesson.components.map((component) =>
          component.id === LEARNER_COMPONENT_ID
            ? { ...component, activityRole: "practice" }
            : component,
        ),
      })),
    },
  ];
  for (const variant of variants) {
    assert.notEqual(
      publicationContentSha256(snapshotFor(variant)),
      baselineHash,
    );
  }
});

test("snapshot build rejects cross-Course objectives and dangling alignments", () => {
  const source = objectiveWorkspace();
  assert.throws(
    () =>
      buildCoursePublicationSnapshot({
        workspace: {
          ...source,
          learningObjectives: source.learningObjectives.map((objective) => ({
            ...objective,
            courseId: uuid(999),
          })),
        },
        sourceAssets: sourceAssets(),
        publicationId: PUBLICATION_ID,
      }),
    (error: unknown) =>
      error instanceof CoursePublicationConflictError &&
      error.code === "publication_objective_course_mismatch",
  );
  assert.throws(
    () =>
      buildCoursePublicationSnapshot({
        workspace: { ...source, learningObjectives: [] },
        sourceAssets: sourceAssets(),
        publicationId: PUBLICATION_ID,
      }),
    (error: unknown) =>
      error instanceof CoursePublicationConflictError &&
      error.code === "publication_component_objective_missing",
  );
});

test("publication hash includes learning audience and attestation definition", () => {
  const snapshot = buildCoursePublicationSnapshot({
    workspace: workspace(),
    sourceAssets: sourceAssets(),
    publicationId: PUBLICATION_ID,
  });
  const childrenHash = publicationContentSha256(snapshot, {
    learningAudience: "children",
    attestation: null,
  });
  const educatorsHash = publicationContentSha256(snapshot, {
    learningAudience: "educators",
    attestation: null,
  });
  const attestedEducatorsHash = publicationContentSha256(snapshot, {
    learningAudience: "educators",
    attestation: {
      version: 1,
      title: "Итоговая аттестация",
      description: "Проверка методики преподавания китайского языка.",
      passingScorePercent: 80,
      questions: [
        {
          id: "question-1",
          prompt: "Как вводить новый тон?",
          options: [
            { id: "option-1", label: "Через слуховую модель" },
            { id: "option-2", label: "Только через запись" },
          ],
          correctOptionId: "option-1",
          explanation: "Слуховая модель предшествует анализу записи.",
        },
      ],
    },
  });

  assert.notEqual(childrenHash, educatorsHash);
  assert.notEqual(educatorsHash, attestedEducatorsHash);
});

test("pending material and empty lesson plan fail before repository or Storage writes", async () => {
  let repositoryCalls = 0;
  const fakeRepository = repository({
    getOwnedPublication: async () => {
      repositoryCalls += 1;
      return null;
    },
  });
  const broker = storageBroker();
  const pendingService = createCoursePublicationService({
    repository: fakeRepository,
    storage: broker.storage,
    courseService: courseService(
      workspace({
        attachments: [{ ...workspace().attachments[0]!, status: "pending" }],
      }),
    ),
  });
  await assert.rejects(
    pendingService.publishCourse(
      ACTOR,
      COURSE_ID,
      { rightsConfirmed: true },
      "create",
    ),
    CoursePublicationValidationError,
  );
  const emptyService = createCoursePublicationService({
    repository: fakeRepository,
    storage: broker.storage,
    courseService: courseService(workspace({ lessons: [], lessonCount: 0 })),
  });
  await assert.rejects(
    emptyService.publishCourse(
      ACTOR,
      COURSE_ID,
      { rightsConfirmed: true },
      "create",
    ),
    CoursePublicationValidationError,
  );
  assert.equal(repositoryCalls, 0);
  assert.deepEqual(broker.calls.copies, []);
});

test("failed committed-safe publish cleans copied publication objects", async () => {
  const broker = storageBroker();
  const service = createCoursePublicationService({
    repository: repository({
      publishCourseRevision: async () => {
        throw new CoursePublicationRepositoryError(
          "publish_failed",
          409,
          "publish_failed",
          true,
        );
      },
    }),
    storage: broker.storage,
    courseService: courseService(workspace()),
    createId: idFactory(),
  });
  await assert.rejects(
    service.publishCourse(
      ACTOR,
      COURSE_ID,
      { rightsConfirmed: true },
      "create",
    ),
    CoursePublicationRepositoryError,
  );
  assert.equal(broker.calls.copies.length, 1);
  assert.deepEqual(broker.calls.deletes, [[broker.calls.copies[0]!]]);
});

test("commit-unknown publish failure never deletes a possibly committed object", async () => {
  const broker = storageBroker();
  const service = createCoursePublicationService({
    repository: repository({
      publishCourseRevision: async () => {
        throw new CoursePublicationRepositoryError(
          "Не удалось подтвердить результат операции.",
          503,
          "repository_network_error",
          false,
        );
      },
    }),
    storage: broker.storage,
    courseService: courseService(workspace()),
    createId: idFactory(),
  });
  await assert.rejects(
    service.publishCourse(
      ACTOR,
      COURSE_ID,
      { rightsConfirmed: true },
      "create",
    ),
    CoursePublicationRepositoryError,
  );
  assert.equal(broker.calls.copies.length, 1);
  assert.deepEqual(broker.calls.deletes, []);
});

test("failed cleanup is logged safely without replacing the publish error", async () => {
  const broker = storageBroker();
  broker.storage.deleteObjects = async () => {
    throw Object.assign(
      new Error("secret delete failure for owner/course/source.pdf"),
      { name: "StorageDeleteFailure", status: 503 },
    );
  };
  const publishError = new CoursePublicationRepositoryError(
    "publish_failed",
    409,
    "publish_failed",
    true,
  );
  const service = createCoursePublicationService({
    repository: repository({
      publishCourseRevision: async () => {
        throw publishError;
      },
    }),
    storage: broker.storage,
    courseService: courseService(workspace()),
    createId: idFactory(),
  });
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = ((...values: unknown[]) => {
    warnings.push(values.map(String).join(" "));
  }) as typeof console.warn;
  try {
    await assert.rejects(
      service.publishCourse(
        ACTOR,
        COURSE_ID,
        { rightsConfirmed: true },
        "create",
      ),
      (error: unknown) => error === publishError,
    );
  } finally {
    console.warn = originalWarn;
  }
  const warning = warnings.find((value) =>
    value.includes("copied object cleanup failed"),
  );
  assert.ok(warning);
  const payload = JSON.parse(warning) as {
    meta: Record<string, unknown>;
  };
  assert.equal(payload.meta.operation, "publish");
  assert.equal(payload.meta.bucket, "course-publication-assets");
  assert.equal(payload.meta.objectCount, 1);
  assert.equal(payload.meta.errorName, "StorageDeleteFailure");
  assert.equal(payload.meta.errorCode, "503");
  assert.doesNotMatch(warning, /secret delete|source\.pdf|destinationPath/);
});

test("publish and catalog copy enter the actor guard before any Storage work", async () => {
  let guardCalls = 0;
  let activeChecks = 0;
  const mutationGuard: CoursePublicationMutationGuard = {
    async run() {
      guardCalls += 1;
      throw new CoursePublicationMutationRateLimitError(30);
    },
  };
  const broker = storageBroker();
  const service = createCoursePublicationService({
    repository: repository({
      isActiveAccount: async () => {
        activeChecks += 1;
        return true;
      },
    }),
    storage: broker.storage,
    courseService: courseService(workspace()),
    mutationGuard,
  });

  await assert.rejects(
    service.publishCourse(
      ACTOR,
      COURSE_ID,
      { rightsConfirmed: true },
      "create",
    ),
    CoursePublicationMutationRateLimitError,
  );
  await assert.rejects(
    service.copyCatalogCourse(ACTOR, PUBLICATION_ID),
    CoursePublicationMutationRateLimitError,
  );
  assert.equal(guardCalls, 2);
  assert.equal(activeChecks, 0);
  assert.deepEqual(broker.calls.copies, []);
});

test("catalog copy checks eligibility before any Storage work", async () => {
  const expected = new CoursePublicationRepositoryError(
    "Сначала пройдите аттестацию по текущей версии курса.",
    403,
    "attestation_required_before_copy",
    true,
  );
  let eligibilityChecks = 0;
  let cloneCalls = 0;
  const broker = storageBroker();
  const service = createCoursePublicationService({
    repository: repository({
      getCatalogPublication: async () => catalogRecordFixture(),
      assertCatalogCopyEligible: async () => {
        eligibilityChecks += 1;
        throw expected;
      },
      clonePublication: async () => {
        cloneCalls += 1;
        throw new Error("unexpected clone");
      },
    }),
    storage: broker.storage,
    courseService: courseService(workspace()),
    createId: idFactory(),
  });

  await assert.rejects(
    service.copyCatalogCourse(ACTOR, PUBLICATION_ID),
    (error: unknown) => error === expected,
  );
  assert.equal(eligibilityChecks, 1);
  assert.equal(cloneCalls, 0);
  assert.deepEqual(broker.calls.copies, []);
});

test("catalog copy normalizes V1 and remaps V2 objective refs", async () => {
  const v2 = buildCoursePublicationSnapshot({
    workspace: objectiveWorkspace(),
    sourceAssets: sourceAssets(),
    publicationId: PUBLICATION_ID,
  });
  for (const [snapshot, expectedRefs] of [
    [legacySnapshotFixture(), []],
    [v2, v2.objectives.map((objective) => objective.ref)],
  ] as const) {
    let cloneInput:
      | Parameters<CoursePublicationRepository["clonePublication"]>[0]
      | undefined;
    const broker = storageBroker();
    const service = createCoursePublicationService({
      repository: repository({
        getCatalogPublication: async () => catalogRecordFixture(snapshot),
        clonePublication: async (input) => {
          cloneInput = input;
          return { courseId: input.targetCourseId };
        },
      }),
      storage: broker.storage,
      courseService: courseService(workspace()),
      createId: idFactory(),
    });

    await service.copyCatalogCourse(ACTOR, PUBLICATION_ID);
    assert.ok(cloneInput);
    assert.deepEqual(
      cloneInput.idMap.objectives.map((item) => item.ref),
      expectedRefs,
    );
    assert.equal(
      cloneInput.idMap.objectives.every((item) => item.ref !== item.id),
      true,
    );
  }
});

test("own-course duplicate sends a source-objective to target-objective id map", async () => {
  let duplicateInput:
    Parameters<CoursePublicationRepository["duplicateCourse"]>[0] | undefined;
  const service = createCoursePublicationService({
    repository: repository({
      duplicateCourse: async (input) => {
        duplicateInput = input;
        return { courseId: input.targetCourseId };
      },
    }),
    storage: storageBroker().storage,
    courseService: courseService(objectiveWorkspace()),
    createId: idFactory(),
  });

  await service.duplicateOwnCourse(ACTOR, COURSE_ID);
  assert.ok(duplicateInput);
  assert.deepEqual(
    duplicateInput.idMap.objectives.map((item) => item.ref),
    [OBJECTIVE_ID, ARCHIVED_OBJECTIVE_ID],
  );
  assert.equal(
    duplicateInput.idMap.objectives.every((item) => item.ref !== item.id),
    true,
  );
});

test("educator publications cannot be copied or cloned", async () => {
  let eligibilityChecks = 0;
  let cloneCalls = 0;
  const broker = storageBroker();
  const service = createCoursePublicationService({
    repository: repository({
      getCatalogPublication: async () => ({
        ...catalogRecordFixture(),
        learningAudience: "educators",
        isShiDao: true,
      }),
      assertCatalogCopyEligible: async () => {
        eligibilityChecks += 1;
      },
      clonePublication: async () => {
        cloneCalls += 1;
        throw new Error("unexpected clone");
      },
    }),
    storage: broker.storage,
    courseService: courseService(workspace()),
    createId: idFactory(),
  });

  await assert.rejects(
    service.copyCatalogCourse(ACTOR, PUBLICATION_ID),
    (error: unknown) =>
      error instanceof CoursePublicationConflictError &&
      error.code === "educator_course_not_copyable",
  );
  assert.equal(eligibilityChecks, 0);
  assert.equal(cloneCalls, 0);
  assert.deepEqual(broker.calls.copies, []);
});

test("owned educator courses cannot be duplicated past the application boundary", async () => {
  let duplicateCalls = 0;
  const service = createCoursePublicationService({
    repository: repository({
      duplicateCourse: async () => {
        duplicateCalls += 1;
        throw new Error("unexpected duplicate");
      },
    }),
    storage: storageBroker().storage,
    courseService: courseService(workspace({ learningAudience: "educators" })),
    createId: idFactory(),
  });

  await assert.rejects(
    service.duplicateOwnCourse(ACTOR, COURSE_ID),
    (error: unknown) =>
      error instanceof CoursePublicationConflictError &&
      error.code === "educator_course_duplicate_forbidden" &&
      error.message === "Курс для педагогов нельзя дублировать.",
  );
  assert.equal(duplicateCalls, 0);
});

test("GET, unpublish and own duplicate do not enter the Storage-write guard", async () => {
  let guardCalls = 0;
  const mutationGuard: CoursePublicationMutationGuard = {
    async run() {
      guardCalls += 1;
      throw new CoursePublicationMutationRateLimitError(30);
    },
  };
  const unpublishedRecord = {
    publicationId: PUBLICATION_ID,
    sourceCourseId: COURSE_ID,
    status: "unpublished" as const,
    currentRevisionId: uuid(702),
    publishedAt: NOW,
    updatedAt: NOW,
    sourceCourseUpdatedAt: NOW,
    sourceContentUpdatedAt: NOW,
    contentSha256: "b".repeat(64),
    reviewStatus: null,
    reviewRevisionId: null,
    approvedRevisionId: null,
  };
  const service = createCoursePublicationService({
    repository: repository({
      getCatalogPublication: async () => catalogRecordFixture(),
      unpublishCourse: async () => unpublishedRecord,
      duplicateCourse: async (input) => ({ courseId: input.targetCourseId }),
    }),
    storage: storageBroker().storage,
    courseService: courseService(workspace()),
    mutationGuard,
    createId: idFactory(),
  });

  assert.equal(
    (await service.getCatalogDetail(ACTOR, PUBLICATION_ID)).id,
    PUBLICATION_ID,
  );
  assert.equal(
    (await service.unpublishCourse(ACTOR, COURSE_ID)).status,
    "unpublished",
  );
  assert.match(
    (await service.duplicateOwnCourse(ACTOR, COURSE_ID)).courseId,
    /^[0-9a-f-]{36}$/,
  );
  assert.equal(guardCalls, 0);
});

test("inactive Accounts cannot publish, view or copy catalog files", async () => {
  for (const [state, accountId] of [
    ["suspended", uuid(102)],
    ["provisional", uuid(103)],
  ] as const) {
    let catalogLoads = 0;
    let sourceLoads = 0;
    const broker = storageBroker();
    const service = createCoursePublicationService({
      repository: repository({
        isActiveAccount: async () => false,
        getCatalogPublication: async () => {
          catalogLoads += 1;
          return catalogRecordFixture();
        },
        listSourceAssets: async () => {
          sourceLoads += 1;
          return sourceAssets();
        },
      }),
      storage: broker.storage,
      courseService: courseService(workspace(), accountId),
    });

    for (const operation of [
      () =>
        service.publishCourse(
          ACTOR,
          COURSE_ID,
          { rightsConfirmed: true },
          "create",
        ),
      () => service.getCatalogDetail(ACTOR, PUBLICATION_ID),
      () => service.copyCatalogCourse(ACTOR, PUBLICATION_ID),
    ]) {
      const error = await operation().catch((caught: unknown) => caught);
      assert.ok(error instanceof CoursePublicationAccessError, state);
      assert.doesNotMatch(error.message, new RegExp(accountId), state);
      const response = await courseBuilderApiError(error);
      const payload = (await response.json()) as { error: string };
      assert.equal(response.status, 404, state);
      assert.doesNotMatch(payload.error, new RegExp(accountId), state);
    }
    assert.equal(catalogLoads, 0, state);
    assert.equal(sourceLoads, 0, state);
    assert.deepEqual(broker.calls.copies, [], state);
    assert.equal(broker.calls.signedDownloads, 0, state);
  }
});

test("publish and unpublish return a clean state from the publication content clock", async () => {
  const publicationRecord = {
    publicationId: PUBLICATION_ID,
    sourceCourseId: COURSE_ID,
    status: "published" as const,
    currentRevisionId: uuid(702),
    publishedAt: NOW,
    updatedAt: NOW,
    sourceCourseUpdatedAt: "2026-08-09T00:00:00.000Z",
    sourceContentUpdatedAt: NOW,
    contentSha256: "b".repeat(64),
    reviewStatus: null,
    reviewRevisionId: null,
    approvedRevisionId: null,
  };
  const service = createCoursePublicationService({
    repository: repository({
      publishCourseRevision: async () => publicationRecord,
      unpublishCourse: async () => ({
        ...publicationRecord,
        status: "unpublished",
      }),
    }),
    storage: storageBroker().storage,
    courseService: courseService(
      workspace({
        updatedAt: "2026-08-10T12:00:00.000Z",
        publicationContentUpdatedAt: NOW,
      }),
    ),
    createId: idFactory(),
  });

  const published = await service.publishCourse(
    ACTOR,
    COURSE_ID,
    { rightsConfirmed: true },
    "create",
  );
  assert.equal(published.hasUnpublishedChanges, false);
  const unpublished = await service.unpublishCourse(ACTOR, COURSE_ID);
  assert.equal(unpublished.hasUnpublishedChanges, false);
});

test("dirty publication state compares only publication content timestamps", async () => {
  const publicationRecord = {
    publicationId: PUBLICATION_ID,
    sourceCourseId: COURSE_ID,
    ownerAccountId: ACCOUNT_ID,
    status: "published" as const,
    currentRevisionId: uuid(702),
    publishedAt: NOW,
    updatedAt: NOW,
    sourceCourseUpdatedAt: "2026-08-09T00:00:00.000Z",
    sourceContentUpdatedAt: NOW,
    contentSha256: "b".repeat(64),
    reviewStatus: null,
    reviewRevisionId: null,
    approvedRevisionId: null,
  };
  const cleanService = createCoursePublicationService({
    repository: repository({
      getOwnedPublication: async () => publicationRecord,
    }),
    storage: storageBroker().storage,
    courseService: courseService(
      workspace({
        updatedAt: "2026-08-10T12:00:00.000Z",
        publicationContentUpdatedAt: NOW,
      }),
    ),
  });
  assert.equal(
    (await cleanService.getOwnedPublication(ACTOR, COURSE_ID))
      ?.hasUnpublishedChanges,
    false,
  );

  const dirtyService = createCoursePublicationService({
    repository: repository({
      getOwnedPublication: async () => publicationRecord,
    }),
    storage: storageBroker().storage,
    courseService: courseService(
      workspace({
        publicationContentUpdatedAt: "2026-08-10T12:00:00.000Z",
      }),
    ),
  });
  assert.equal(
    (await dirtyService.getOwnedPublication(ACTOR, COURSE_ID))
      ?.hasUnpublishedChanges,
    true,
  );
});

test("catalog detail exposes only learner slides and signed material metadata", async () => {
  const snapshot = legacySnapshotFixture();
  const material = snapshot.materials[0]!;
  const service = createCoursePublicationService({
    repository: repository({
      getCatalogPublication: async () => ({
        publicationId: PUBLICATION_ID,
        sourceCourseId: COURSE_ID,
        ownerAccountId: ACCOUNT_ID,
        publisherDisplayName: "Преподаватель",
        isShiDao: false,
        learningAudience: "children",
        publishedAt: NOW,
        revisionId: uuid(702),
        snapshot,
        assets: [
          {
            publicationAssetId: material.ref,
            storageBucket: "course-publication-assets",
            storagePath: `${PUBLICATION_ID}/revisions/${uuid(702)}/assets/${material.ref}`,
            originalFilename: material.originalFilename,
            mimeType: material.mimeType,
            sizeBytes: material.sizeBytes,
            checksumSha256: material.checksumSha256,
          },
        ],
      }),
    }),
    storage: storageBroker().storage,
    courseService: courseService(workspace()),
  });
  const detail = await service.getCatalogDetail(ACTOR, PUBLICATION_ID);
  assert.equal(detail.revisionId, uuid(702));
  assert.equal(detail.lessons.length, 1);
  assert.equal(detail.lessons[0]!.id, snapshot.lessons[0]!.ref);
  assert.equal(detail.lessons[0]!.slides.length, 1);
  assert.equal(detail.lessons[0]!.slides[0]!.components.length, 1);
  assert.equal(
    detail.lessons[0]!.slides[0]!.components[0]!.payload.label,
    "Задание",
  );
  const serializedLessons = JSON.stringify(detail.lessons);
  assert.doesNotMatch(serializedLessons, /Комментарий преподавателя|Карточки/);
  assert.doesNotMatch(serializedLessons, /staff_only|learner_visible/);
  assert.equal(detail.materials.length, 1);
  assert.equal("checksumSha256" in detail.materials[0]!, false);
  assert.match(detail.materials[0]!.downloadUrl, /^https:\/\//);
});

test("catalog detail projects assessable payload without answer keys", async () => {
  const base = workspace();
  const assessableWorkspace = workspace({
    lessons: base.lessons.map((lesson) => ({
      ...lesson,
      components: lesson.components.map((component) =>
        component.id === LEARNER_COMPONENT_ID
          ? {
              ...component,
              typeKey: "choice_quiz",
              payload: {
                question: "Как поздороваться?",
                options: [
                  { id: uuid(910), label: "你好", isCorrect: true },
                  { id: uuid(911), label: "再见", isCorrect: false },
                ],
                allowMultiple: false,
                explanation: "你好 — нейтральное приветствие.",
                shuffle: true,
              },
              placement: { width: "content", compact: false },
            }
          : component,
      ),
    })),
  });
  const snapshot = buildCoursePublicationSnapshot({
    workspace: assessableWorkspace,
    sourceAssets: sourceAssets(),
    publicationId: PUBLICATION_ID,
  });
  assert.match(JSON.stringify(snapshot), /isCorrect/);

  const service = createCoursePublicationService({
    repository: repository({
      getCatalogPublication: async () => catalogRecordFixture(snapshot),
    }),
    storage: storageBroker().storage,
    courseService: courseService(workspace()),
  });
  const detail = await service.getCatalogDetail(ACTOR, PUBLICATION_ID);
  const payload = detail.lessons[0]!.slides[0]!.components[0]!.payload;
  assert.equal(payload.question, "Как поздороваться?");
  assert.doesNotMatch(JSON.stringify(payload), /isCorrect/);
  assert.doesNotMatch(JSON.stringify(payload), /explanation|нейтральное/);
});

test("catalog detail fails closed when learner projection cannot validate payload", async () => {
  const snapshot = buildCoursePublicationSnapshot({
    workspace: workspace(),
    sourceAssets: sourceAssets(),
    publicationId: PUBLICATION_ID,
  });
  const learnerComponent = snapshot.lessons[0]!.components.find(
    (component) => component.visibility === "learner_visible",
  )!;
  learnerComponent.payload = { storedFileId: "not-a-uuid" };
  const service = createCoursePublicationService({
    repository: repository({
      getCatalogPublication: async () => catalogRecordFixture(snapshot),
    }),
    storage: storageBroker().storage,
    courseService: courseService(workspace()),
  });

  await assert.rejects(
    service.getCatalogDetail(ACTOR, PUBLICATION_ID),
    (error: unknown) =>
      error instanceof CoursePublicationConflictError &&
      error.code === "publication_component_delivery_invalid",
  );
});

test("catalog sourceCourseId is owner-only and null across accounts", async () => {
  const snapshot = buildCoursePublicationSnapshot({
    workspace: workspace(),
    sourceAssets: sourceAssets(),
    publicationId: PUBLICATION_ID,
  });
  const record = (
    publicationId: string,
    sourceCourseId: string | null,
    isCurrentUser: boolean,
  ) => ({
    publicationId,
    sourceCourseId,
    learningAudience: "children" as const,
    ...snapshot.course,
    lessonCount: snapshot.lessons.length,
    materialCount: snapshot.materials.length,
    publishedAt: NOW,
    author: {
      displayName: "Преподаватель",
      isShiDao: false,
      isCurrentUser,
    },
  });
  const service = createCoursePublicationService({
    repository: repository({
      listCatalog: async () => ({
        courses: [
          record(PUBLICATION_ID, COURSE_ID, true),
          // Even a malformed elevated response cannot expose this source ID
          // when isCurrentUser is false.
          record(uuid(702), uuid(202), false),
        ],
        facets: {
          subjects: ["Китайский язык"],
          levels: ["Начальный"],
        },
        nextOffset: null,
      }),
    }),
    storage: storageBroker().storage,
    courseService: courseService(workspace()),
  });
  const query: CatalogQuery = {
    q: "",
    learningAudience: "children",
    subject: "",
    level: "",
    cursor: null,
    limit: 24,
  };
  const page = await service.listCatalog(ACTOR, query);
  assert.equal(page.courses[0]!.sourceCourseId, COURSE_ID);
  assert.equal(page.courses[0]!.author.isCurrentUser, true);
  assert.equal(page.courses[1]!.sourceCourseId, null);
  assert.equal(page.courses[1]!.author.isCurrentUser, false);
  assert.deepEqual(page.facets, {
    subjects: ["Китайский язык"],
    levels: ["Начальный"],
  });
});
