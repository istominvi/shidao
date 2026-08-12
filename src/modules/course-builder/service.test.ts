import assert from "node:assert/strict";
import test from "node:test";
import {
  CourseBuilderAccessError,
  CourseBuilderConflictError,
  CourseBuilderValidationError,
  type AddLessonInput,
  type CourseDraftInput,
  type CourseUpdateInput,
  type PrepareCourseAttachmentInput,
  type SetComponentStudentScreenInput,
  type UpdateLessonInput,
} from "./contracts";
import type {
  CourseAsset,
  CourseBuilderActor,
  CourseDraftAssemblyPlan,
  CourseLesson,
  CourseSummary,
  CourseWorkspace,
  LessonComponent,
  LessonStudentSlide,
} from "./domain";
import {
  getComponentDefinition,
  type ComponentTypeKey,
} from "./registry/contracts";
import {
  CourseBuilderRepositoryError,
  type CourseArchiveOutcome,
  type CourseBuilderRepository,
} from "./repository";
import { createCourseBuilderService } from "./service";

const NOW = "2026-08-03T00:00:00.000Z";
const ASSEMBLED_AT = "2026-08-03T00:05:00.000Z";

function uuid(sequence: number) {
  return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`;
}

const ALICE_USER_ID = uuid(1);
const BOB_USER_ID = uuid(2);
const UNKNOWN_USER_ID = uuid(3);
const ALICE_ACCOUNT_ID = uuid(101);
const BOB_ACCOUNT_ID = uuid(102);

const alice: CourseBuilderActor = {
  authUserId: ALICE_USER_ID,
  accessToken: "alice-access-token",
};
const bob: CourseBuilderActor = {
  authUserId: BOB_USER_ID,
  accessToken: "bob-access-token",
};

function courseInput(
  overrides: Partial<CourseDraftInput> = {},
): CourseDraftInput {
  return {
    title: "Китайский с нуля",
    subject: "Базовый китайский язык",
    goal: "Научиться представляться и понимать простые вопросы.",
    level: "Начальный",
    audienceDescription: "Взрослый ученик без подготовки",
    targetLessonCount: 8,
    teacherPreferences: "Начинайте с короткого устного разогрева.",
    ...overrides,
  };
}

type StoredAssetRecord = {
  asset: CourseAsset;
  ownerAccountId: string;
  storageBucket: string;
  storagePath: string;
};

class InMemoryCourseBuilderRepository implements CourseBuilderRepository {
  readonly accounts = new Map([
    [ALICE_USER_ID, ALICE_ACCOUNT_ID],
    [BOB_USER_ID, BOB_ACCOUNT_ID],
  ]);
  readonly courses = new Map<string, CourseSummary>();
  readonly lessons = new Map<string, CourseLesson>();
  readonly components = new Map<string, LessonComponent>();
  readonly studentSlides = new Map<string, LessonStudentSlide>();
  readonly assets = new Map<string, StoredAssetRecord>();
  readonly courseAttachments = new Map<string, Set<string>>();
  readonly archiveOutcomes = new Map<string, CourseArchiveOutcome>();
  readonly calls = {
    addComponent: 0,
    updateComponent: 0,
    setComponentStudentScreen: 0,
    reorderComponent: 0,
    assembleDraft: 0,
    deletePendingAttachment: 0,
  };
  lastComponentUpdate: {
    componentId: string;
    payload?: Record<string, unknown>;
    placement?: Record<string, unknown>;
  } | null = null;

  private sequence = 1_000;

  private createId() {
    this.sequence += 1;
    return uuid(this.sequence);
  }

  private lessonsForCourse(courseId: string) {
    return [...this.lessons.values()]
      .filter((lesson) => lesson.courseId === courseId)
      .sort((left, right) => left.position - right.position);
  }

  private componentsForLesson(lessonId: string) {
    return [...this.components.values()]
      .filter((component) => component.lessonId === lessonId)
      .sort((left, right) => left.position - right.position);
  }

  private studentSlidesForLesson(lessonId: string) {
    return [...this.studentSlides.values()]
      .filter((slide) => slide.lessonId === lessonId)
      .sort((left, right) => left.position - right.position);
  }

  async getAccountId(authUserId: string) {
    return this.accounts.get(authUserId) ?? null;
  }

  async getSessionInvalidBefore() {
    return null;
  }

  async listCourses() {
    return [...this.courses.values()];
  }

  async getCourseWorkspace(courseId: string): Promise<CourseWorkspace | null> {
    const course = this.courses.get(courseId);
    if (!course) return null;
    const lessons = this.lessonsForCourse(courseId).map((lesson) => ({
      ...lesson,
      components: this.componentsForLesson(lesson.id).map((component) => ({
        ...component,
        payload: { ...component.payload },
        placement: { ...component.placement },
      })),
      studentSlides: this.studentSlidesForLesson(lesson.id),
    }));
    const attachments = [...(this.courseAttachments.get(courseId) ?? [])]
      .map((assetId) => this.assets.get(assetId)?.asset)
      .filter((asset): asset is CourseAsset => Boolean(asset))
      .map((asset) => ({ ...asset }));
    return {
      ...course,
      lessonCount: lessons.length,
      lessons,
      attachments,
    };
  }

  async createCourse(ownerAccountId: string, input: CourseDraftInput) {
    const id = this.createId();
    const course: CourseSummary = {
      id,
      ownerAccountId,
      ...input,
      status: "draft",
      lessonCount: 0,
      assembledAt: null,
      createdAt: NOW,
      publicationContentUpdatedAt: NOW,
      updatedAt: NOW,
    };
    this.courses.set(id, course);
    return { ...course };
  }

  async updateCourse(courseId: string, input: CourseUpdateInput) {
    const course = this.courses.get(courseId);
    if (!course) return null;
    const updated = { ...course, ...input, updatedAt: NOW };
    this.courses.set(courseId, updated);
    return { ...updated };
  }

  async archiveCourse(courseId: string) {
    const outcome =
      this.archiveOutcomes.get(courseId) ??
      (this.courses.has(courseId) ? "archived" : "not_found");
    if (outcome === "archived") this.courses.delete(courseId);
    return outcome;
  }

  async assembleDraft(input: CourseDraftAssemblyPlan) {
    const course = this.courses.get(input.courseId);
    if (!course) throw new Error("course not found");
    this.calls.assembleDraft += 1;
    const lesson = await this.addLesson(input.courseId, input.lesson);
    const componentIds: string[] = [];
    for (const planned of input.components) {
      const component = await this.addComponent({
        lessonId: lesson.id,
        ...planned,
      });
      componentIds.push(component.id);
    }
    this.courses.set(input.courseId, {
      ...course,
      assembledAt: ASSEMBLED_AT,
    });
    return {
      courseId: input.courseId,
      lessonIds: [lesson.id],
      componentIds,
      alreadyAssembled: false,
    };
  }

  async addLesson(courseId: string, input: AddLessonInput) {
    const lesson: CourseLesson = {
      id: this.createId(),
      courseId,
      position: this.lessonsForCourse(courseId).length + 1,
      title: input.title,
      summary: input.summary,
      components: [],
      studentSlides: [],
      createdAt: NOW,
      updatedAt: NOW,
    };
    this.lessons.set(lesson.id, lesson);
    return { ...lesson, components: [], studentSlides: [] };
  }

  async getLesson(lessonId: string) {
    const lesson = this.lessons.get(lessonId);
    return lesson
      ? { ...lesson, components: this.componentsForLesson(lesson.id) }
      : null;
  }

  async updateLesson(lessonId: string, input: UpdateLessonInput) {
    const lesson = this.lessons.get(lessonId);
    if (!lesson) return null;
    const updated = { ...lesson, ...input, updatedAt: NOW };
    this.lessons.set(lessonId, updated);
    return { ...updated };
  }

  async deleteLesson(lessonId: string) {
    if (!this.lessons.delete(lessonId)) return false;
    for (const component of this.componentsForLesson(lessonId)) {
      this.components.delete(component.id);
    }
    for (const slide of this.studentSlidesForLesson(lessonId)) {
      this.studentSlides.delete(slide.id);
    }
    return true;
  }

  async addComponent(input: {
    lessonId: string;
    typeKey: ComponentTypeKey;
    schemaVersion: number;
    payload: Record<string, unknown>;
    placement: Record<string, unknown>;
  }) {
    this.calls.addComponent += 1;
    const component: LessonComponent = {
      id: this.createId(),
      lessonId: input.lessonId,
      typeKey: input.typeKey,
      schemaVersion: input.schemaVersion,
      position: this.componentsForLesson(input.lessonId).length + 1,
      payload: { ...input.payload },
      placement: { ...input.placement },
      visibility: "staff_only",
      studentSlideId: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    this.components.set(component.id, component);
    return { ...component };
  }

  async getComponent(componentId: string) {
    const component = this.components.get(componentId);
    return component ? { ...component } : null;
  }

  async updateComponent(input: {
    componentId: string;
    payload?: Record<string, unknown>;
    placement?: Record<string, unknown>;
  }) {
    const component = this.components.get(input.componentId);
    if (!component) return null;
    this.calls.updateComponent += 1;
    this.lastComponentUpdate = { ...input };
    const updated: LessonComponent = {
      ...component,
      payload: input.payload ?? component.payload,
      placement: input.placement ?? component.placement,
      updatedAt: NOW,
    };
    this.components.set(component.id, updated);
    return { ...updated };
  }

  async setComponentStudentScreen(
    componentId: string,
    input: SetComponentStudentScreenInput,
  ) {
    const component = this.components.get(componentId);
    if (!component) return null;
    this.calls.setComponentStudentScreen += 1;

    if (input.mode === "hide") {
      const previousSlideId = component.studentSlideId;
      const updated = {
        ...component,
        visibility: "staff_only" as const,
        studentSlideId: null,
        updatedAt: NOW,
      };
      this.components.set(component.id, updated);
      if (
        previousSlideId &&
        ![...this.components.values()].some(
          (candidate) => candidate.studentSlideId === previousSlideId,
        )
      ) {
        this.studentSlides.delete(previousSlideId);
        this.studentSlidesForLesson(component.lessonId).forEach(
          (slide, index) =>
            this.studentSlides.set(slide.id, {
              ...slide,
              position: index + 1,
            }),
        );
      }
      return { ...updated };
    }

    let slideId: string;
    if (input.mode === "existing") {
      const slide = this.studentSlides.get(input.slideId);
      if (!slide || slide.lessonId !== component.lessonId) return null;
      slideId = slide.id;
    } else {
      const slide: LessonStudentSlide = {
        id: this.createId(),
        lessonId: component.lessonId,
        position: this.studentSlidesForLesson(component.lessonId).length + 1,
        createdAt: NOW,
        updatedAt: NOW,
      };
      this.studentSlides.set(slide.id, slide);
      slideId = slide.id;
    }

    const updated = {
      ...component,
      visibility: "learner_visible" as const,
      studentSlideId: slideId,
      updatedAt: NOW,
    };
    this.components.set(component.id, updated);
    return { ...updated };
  }

  async deleteComponent(componentId: string) {
    return this.components.delete(componentId);
  }

  async reorderComponent(componentId: string, toPosition: number) {
    const component = this.components.get(componentId);
    if (!component) return null;
    const siblings = this.componentsForLesson(component.lessonId);
    if (toPosition < 1 || toPosition > siblings.length) return null;
    this.calls.reorderComponent += 1;
    const withoutMoved = siblings.filter((item) => item.id !== componentId);
    withoutMoved.splice(toPosition - 1, 0, component);
    withoutMoved.forEach((item, index) => {
      this.components.set(item.id, { ...item, position: index + 1 });
    });
    return { ...this.components.get(componentId)! };
  }

  async createPendingAttachment(input: {
    id: string;
    ownerAccountId: string;
    courseId: string;
    storageBucket: string;
    storagePath: string;
    file: PrepareCourseAttachmentInput;
  }) {
    const asset: CourseAsset = {
      id: input.id,
      originalFilename: input.file.originalFilename,
      mimeType: input.file.mimeType,
      sizeBytes: input.file.sizeBytes,
      checksumSha256: input.file.checksumSha256.toLowerCase(),
      status: "pending",
      signedUrl: null,
      createdAt: NOW,
    };
    this.assets.set(asset.id, {
      asset,
      ownerAccountId: input.ownerAccountId,
      storageBucket: input.storageBucket,
      storagePath: input.storagePath,
    });
    const links = this.courseAttachments.get(input.courseId) ?? new Set();
    links.add(asset.id);
    this.courseAttachments.set(input.courseId, links);
    return { ...asset };
  }

  async getAttachment(courseId: string, assetId: string) {
    if (!this.courseAttachments.get(courseId)?.has(assetId)) return null;
    const record = this.assets.get(assetId);
    return record ? { ...record.asset } : null;
  }

  async getAttachmentStorageRef(courseId: string, assetId: string) {
    const asset = await this.getAttachment(courseId, assetId);
    const record = this.assets.get(assetId);
    if (!asset || !record) return null;
    return {
      asset,
      storageBucket: record.storageBucket,
      storagePath: record.storagePath,
    };
  }

  async completeAttachment(assetId: string) {
    const record = this.assets.get(assetId);
    if (!record || record.asset.status !== "pending") return null;
    const asset: CourseAsset = { ...record.asset, status: "ready" };
    this.assets.set(assetId, { ...record, asset });
    return { ...asset };
  }

  async deletePendingAttachment(assetId: string) {
    const record = this.assets.get(assetId);
    if (!record || record.asset.status !== "pending") return;
    this.calls.deletePendingAttachment += 1;
    this.assets.delete(assetId);
    for (const links of this.courseAttachments.values()) links.delete(assetId);
  }
}

function createHarness(options: { failSignedUpload?: boolean } = {}) {
  const repository = new InMemoryCourseBuilderRepository();
  const uploads: Array<{
    accessToken: string;
    bucket: string;
    path: string;
  }> = [];
  const downloads: Array<{
    accessToken: string;
    bucket: string;
    path: string;
    expiresInSeconds?: number;
  }> = [];
  const objectAssertions: Array<{
    accessToken: string;
    bucket: string;
    path: string;
    expectedSizeBytes: number;
    expectedMimeType: string;
  }> = [];
  let serviceIdSequence = 8_000;
  const service = createCourseBuilderService({
    repository,
    createId: () => uuid(++serviceIdSequence),
    storage: {
      async createSignedUpload(input) {
        uploads.push(input);
        if (options.failSignedUpload) throw new Error("signed upload failed");
        return {
          signedUrl: `https://storage.example/upload/${input.path}`,
          token: `upload-token-${uploads.length}`,
        };
      },
      async createSignedDownload(input) {
        downloads.push(input);
        return `https://storage.example/download/${input.path}`;
      },
      async assertObjectExists(input) {
        objectAssertions.push(input);
      },
    },
  });
  return { repository, service, uploads, downloads, objectAssertions };
}

async function createLesson(
  harness: ReturnType<typeof createHarness>,
  actor: CourseBuilderActor,
  courseId: string,
) {
  const lesson = await harness.service.addLesson(actor, courseId, {
    title: "Урок",
    summary: "Краткое описание",
  });
  return lesson;
}

async function prepareAttachment(
  harness: ReturnType<typeof createHarness>,
  courseId: string,
  input: PrepareCourseAttachmentInput,
) {
  return harness.service.prepareAttachment(alice, courseId, input);
}

test("create/get enforce Account ownership and preserve normalized Course data", async () => {
  const harness = createHarness();
  const created = await harness.service.createDraft(
    alice,
    courseInput({ title: "  Китайский с нуля  " }),
  );

  assert.equal(created.ownerAccountId, ALICE_ACCOUNT_ID);
  assert.equal(created.title, "Китайский с нуля");
  assert.equal(created.status, "draft");
  assert.deepEqual(
    (await harness.service.getCourse(alice, created.id)).lessons,
    [],
  );

  await assert.rejects(
    () => harness.service.getCourse(bob, created.id),
    (error: unknown) => error instanceof CourseBuilderAccessError,
  );
  await assert.rejects(
    () =>
      harness.service.createDraft(
        { authUserId: UNKNOWN_USER_ID, accessToken: "unknown" },
        courseInput(),
      ),
    (error: unknown) =>
      error instanceof CourseBuilderAccessError &&
      /Account/.test(error.message),
  );
});

test("archiveCourse hides an owned course without deleting its authored history", async () => {
  const harness = createHarness();
  const course = await harness.service.createDraft(alice, courseInput());
  const lesson = await createLesson(harness, alice, course.id);

  assert.deepEqual(await harness.service.archiveCourse(alice, course.id), {
    courseId: course.id,
  });
  assert.equal(harness.repository.courses.has(course.id), false);
  assert.equal(harness.repository.lessons.has(lesson.id), true);
  await assert.rejects(
    () => harness.service.getCourse(alice, course.id),
    (error: unknown) => error instanceof CourseBuilderAccessError,
  );
});

test("archiveCourse enforces ownership before changing the course", async () => {
  const harness = createHarness();
  const course = await harness.service.createDraft(alice, courseInput());

  await assert.rejects(
    () => harness.service.archiveCourse(bob, course.id),
    (error: unknown) => error instanceof CourseBuilderAccessError,
  );
  assert.equal(harness.repository.courses.has(course.id), true);
});

test("archiveCourse preserves a course while it has open lesson runs", async () => {
  const harness = createHarness();
  const course = await harness.service.createDraft(alice, courseInput());
  harness.repository.archiveOutcomes.set(
    course.id,
    "course_has_open_lesson_runs",
  );

  await assert.rejects(
    () => harness.service.archiveCourse(alice, course.id),
    (error: unknown) =>
      error instanceof CourseBuilderConflictError &&
      error.code === "course_has_open_lesson_runs",
  );
  assert.equal(harness.repository.courses.has(course.id), true);
});

test("archiveCourse preserves a published course until it is unpublished", async () => {
  const harness = createHarness();
  const course = await harness.service.createDraft(alice, courseInput());
  harness.repository.archiveOutcomes.set(course.id, "course_is_published");

  await assert.rejects(
    () => harness.service.archiveCourse(alice, course.id),
    (error: unknown) =>
      error instanceof CourseBuilderConflictError &&
      error.code === "course_is_published",
  );
  assert.equal(harness.repository.courses.has(course.id), true);
});

test("archiveCourse maps an atomic not_found race to access denied", async () => {
  const harness = createHarness();
  const course = await harness.service.createDraft(alice, courseInput());
  harness.repository.archiveOutcomes.set(course.id, "not_found");

  await assert.rejects(
    () => harness.service.archiveCourse(alice, course.id),
    (error: unknown) => error instanceof CourseBuilderAccessError,
  );
  assert.equal(harness.repository.courses.has(course.id), true);
});

test("deterministic assembler is idempotent and describes attachments honestly", async () => {
  const harness = createHarness();
  const course = await harness.service.createDraft(alice, courseInput());
  const image = await prepareAttachment(harness, course.id, {
    originalFilename: "map.png",
    mimeType: "image/png",
    sizeBytes: 1_024,
    checksumSha256: "a".repeat(64),
  });
  await harness.service.completeAttachment(alice, course.id, image.asset.id);
  const file = await prepareAttachment(harness, course.id, {
    originalFilename: "plan.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2_048,
    checksumSha256: "b".repeat(64),
  });
  await harness.service.completeAttachment(alice, course.id, file.asset.id);
  const pending = await prepareAttachment(harness, course.id, {
    originalFilename: "notes.txt",
    mimeType: "text/plain",
    sizeBytes: 256,
    checksumSha256: "c".repeat(64),
  });

  const first = await harness.service.assembleCourse(alice, course.id);
  assert.equal(first.alreadyAssembled, false);
  assert.equal(first.lessonIds.length, 1);
  assert.equal(first.componentIds.length, 5);
  assert.equal(harness.repository.calls.assembleDraft, 1);

  const workspace = await harness.service.getCourse(alice, course.id);
  assert.equal(workspace.assembledAt, ASSEMBLED_AT);
  assert.equal(workspace.lessons[0]?.title, "Введение: Базовый китайский язык");
  const components = workspace.lessons[0]?.components ?? [];
  assert.deepEqual(
    components.map((component) => component.typeKey),
    ["heading", "rich_text", "callout", "image", "file"],
  );
  const imageComponent = components.find(
    (component) => component.typeKey === "image",
  );
  const fileComponent = components.find(
    (component) => component.typeKey === "file",
  );
  assert.match(
    String(imageComponent?.payload.caption),
    /без автоматического анализа/,
  );
  assert.match(
    String(fileComponent?.payload.description),
    /не анализировалось/,
  );
  assert.equal(
    components.some(
      (component) => component.payload.storedFileId === pending.asset.id,
    ),
    false,
  );

  const second = await harness.service.assembleCourse(alice, course.id);
  assert.equal(second.alreadyAssembled, true);
  assert.deepEqual(second.lessonIds, first.lessonIds);
  assert.deepEqual(second.componentIds, first.componentIds);
  assert.equal(harness.repository.calls.assembleDraft, 1);
  assert.equal(
    (await harness.service.getCourse(alice, course.id)).lessons.length,
    1,
  );

  const studentPreview = await harness.service.getStudentPreview(
    alice,
    course.id,
  );
  const serializedPreview = JSON.stringify(studentPreview);
  assert.doesNotMatch(serializedPreview, /teacherInstructions/);
  assert.equal("summary" in (studentPreview.lessons[0] ?? {}), false);
  assert.doesNotMatch(
    serializedPreview,
    /Начинайте с короткого устного разогрева/,
  );
  assert.deepEqual(studentPreview.lessons[0]?.slides, []);
  assert.equal(
    workspace.lessons[0]?.components.every(
      (component) =>
        component.visibility === "staff_only" &&
        component.studentSlideId === null,
    ),
    true,
  );
});

test("direct component authoring validates before persistence", async () => {
  const harness = createHarness();
  const course = await harness.service.createDraft(alice, courseInput());
  const lesson = await harness.service.addLesson(alice, course.id, {
    title: "Урок без шагов в интерфейсе",
    summary: "Приватный комментарий",
  });
  const headingDefinition = getComponentDefinition("heading");

  await assert.rejects(() =>
    harness.service.addComponent(alice, {
      lessonId: lesson.id,
      typeKey: "heading",
      payload: { text: "", level: "h2" },
      placement: headingDefinition.defaultPlacement,
    }),
  );
  assert.equal(harness.repository.components.size, 0);

  const pending = await prepareAttachment(harness, course.id, {
    originalFilename: "pending.png",
    mimeType: "image/png",
    sizeBytes: 1_024,
    checksumSha256: "a".repeat(64),
  });
  const imageDefinition = getComponentDefinition("image");
  await assert.rejects(() =>
    harness.service.addComponent(alice, {
      lessonId: lesson.id,
      typeKey: "image",
      payload: {
        storedFileId: pending.asset.id,
        alt: "Ещё не загружено",
      },
      placement: imageDefinition.defaultPlacement,
    }),
  );
  assert.equal(harness.repository.components.size, 0);

  await assert.rejects(
    () =>
      harness.service.addComponent(bob, {
        lessonId: lesson.id,
        typeKey: "heading",
        payload: headingDefinition.defaultPayload,
        placement: headingDefinition.defaultPlacement,
      }),
    (error: unknown) => error instanceof CourseBuilderAccessError,
  );
  assert.equal(harness.repository.components.size, 0);

  await harness.service.addComponent(alice, {
    lessonId: lesson.id,
    typeKey: "heading",
    payload: headingDefinition.defaultPayload,
    placement: headingDefinition.defaultPlacement,
  });
  await harness.service.addComponent(alice, {
    lessonId: lesson.id,
    typeKey: "heading",
    payload: { text: "Второй заголовок", level: "h3" },
    placement: headingDefinition.defaultPlacement,
  });

  assert.equal(harness.repository.components.size, 2);
});

test("assembler refuses to overwrite manually authored content", async () => {
  const harness = createHarness();
  const course = await harness.service.createDraft(alice, courseInput());
  await harness.service.addLesson(alice, course.id, {
    title: "Ручной урок",
    summary: "",
  });

  await assert.rejects(
    () => harness.service.assembleCourse(alice, course.id),
    (error: unknown) =>
      error instanceof CourseBuilderConflictError &&
      /ручной контент/.test(error.message),
  );
});

test("component add/update/reorder share registry validation and ownership", async () => {
  const harness = createHarness();
  const course = await harness.service.createDraft(alice, courseInput());
  const lesson = await harness.service.addLesson(alice, course.id, {
    title: "Ручной урок",
    summary: "",
  });
  const quoteDefinition = getComponentDefinition("quote");
  const quote = await harness.service.addComponent(alice, {
    lessonId: lesson.id,
    typeKey: "quote",
    payload: { text: "Путь в тысячу ли начинается с первого шага." },
    placement: quoteDefinition.defaultPlacement,
  });
  const headingDefinition = getComponentDefinition("heading");
  const heading = await harness.service.addComponent(alice, {
    lessonId: lesson.id,
    typeKey: "heading",
    payload: { text: "Начало", level: "h3" },
    placement: headingDefinition.defaultPlacement,
  });

  assert.equal(quote.lessonId, lesson.id);
  assert.equal(heading.lessonId, lesson.id);
  assert.equal(heading.position, 2);
  assert.equal(harness.repository.components.get(quote.id)?.position, 1);
  assert.equal(quote.schemaVersion, quoteDefinition.version);
  assert.equal(quote.visibility, "staff_only");

  const addCalls = harness.repository.calls.addComponent;
  await assert.rejects(() =>
    harness.service.addComponent(alice, {
      lessonId: lesson.id,
      typeKey: "quote",
      payload: { text: "" },
      placement: quoteDefinition.defaultPlacement,
    }),
  );
  assert.equal(harness.repository.calls.addComponent, addCalls);

  const updated = await harness.service.updateComponent(alice, quote.id, {
    payload: { text: "Новая цитата", attribution: "Автор" },
    placement: { width: "wide", textAlign: "center" },
  });
  assert.deepEqual(updated.payload, {
    text: "Новая цитата",
    attribution: "Автор",
  });
  assert.deepEqual(updated.placement, { width: "wide", textAlign: "center" });

  const learnerVisible = await harness.service.setComponentStudentScreen(
    alice,
    quote.id,
    { mode: "new" },
  );
  assert.equal(learnerVisible.visibility, "learner_visible");
  assert.notEqual(learnerVisible.studentSlideId, null);
  assert.equal(harness.repository.calls.setComponentStudentScreen, 1);

  const updateCalls = harness.repository.calls.updateComponent;
  await assert.rejects(() =>
    harness.service.updateComponent(alice, quote.id, {
      payload: { text: "Допустимый текст", unexpected: true },
    }),
  );
  assert.equal(harness.repository.calls.updateComponent, updateCalls);

  const reordered = await harness.service.reorderComponent(alice, quote.id, {
    toPosition: 1,
  });
  assert.equal(reordered.position, 1);
  assert.equal(harness.repository.components.get(heading.id)?.position, 2);
  await assert.rejects(
    () => harness.service.reorderComponent(alice, quote.id, { toPosition: 0 }),
    (error: unknown) => error instanceof CourseBuilderValidationError,
  );
  await assert.rejects(
    () =>
      harness.service.updateComponent(bob, quote.id, {
        payload: { text: "Чужое изменение" },
      }),
    (error: unknown) => error instanceof CourseBuilderAccessError,
  );
});

test("illegal Student Screen target becomes a stable friendly conflict", async () => {
  const harness = createHarness();
  const course = await harness.service.createDraft(alice, courseInput());
  const lesson = await createLesson(harness, alice, course.id);
  const definition = getComponentDefinition("heading");
  const component = await harness.service.addComponent(alice, {
    lessonId: lesson.id,
    typeKey: "heading",
    payload: definition.defaultPayload,
    placement: definition.defaultPlacement,
  });
  harness.repository.setComponentStudentScreen = async () => {
    throw new CourseBuilderRepositoryError(
      "student_slide_target_out_of_order",
      400,
      "23514",
    );
  };

  await assert.rejects(
    () =>
      harness.service.setComponentStudentScreen(alice, component.id, {
        mode: "existing",
        slideId: uuid(9_999),
      }),
    (error: unknown) =>
      error instanceof CourseBuilderConflictError &&
      error.code === "student_slide_order_conflict" &&
      /порядка плана урока/.test(error.message),
  );
});

test("attachment prepare/complete uses private opaque path and verifies the object", async () => {
  const harness = createHarness();
  const course = await harness.service.createDraft(alice, courseInput());
  const prepared = await prepareAttachment(harness, course.id, {
    originalFilename: "My Lesson Plan.PDF",
    mimeType: "application/pdf",
    sizeBytes: 4_096,
    checksumSha256: "ABCDEF".repeat(10) + "ABCD",
  });

  assert.equal(prepared.asset.status, "pending");
  assert.equal(prepared.upload.bucket, "course-assets");
  assert.equal(
    prepared.upload.path.startsWith(`${ALICE_ACCOUNT_ID}/courses/`),
    true,
  );
  assert.equal(prepared.upload.path.includes("My Lesson Plan"), false);
  assert.equal(prepared.upload.path.endsWith(".pdf"), true);
  assert.deepEqual(harness.uploads[0], {
    accessToken: alice.accessToken,
    bucket: "course-assets",
    path: prepared.upload.path,
  });

  const completed = await harness.service.completeAttachment(
    alice,
    course.id,
    prepared.asset.id,
  );
  assert.equal(completed.status, "ready");
  assert.deepEqual(harness.objectAssertions[0], {
    accessToken: alice.accessToken,
    bucket: "course-assets",
    path: prepared.upload.path,
    expectedSizeBytes: 4_096,
    expectedMimeType: "application/pdf",
  });

  const workspace = await harness.service.getCourse(alice, course.id);
  assert.match(
    workspace.attachments[0]?.signedUrl ?? "",
    /^https:\/\/storage\.example\/download\//,
  );
  assert.equal(harness.downloads[0]?.expiresInSeconds, 600);
});

test("student projection excludes staff-only components, comments, and their signed materials", async () => {
  const harness = createHarness();
  const course = await harness.service.createDraft(alice, courseInput());
  const prepared = await prepareAttachment(harness, course.id, {
    originalFilename: "teacher-only.png",
    mimeType: "image/png",
    sizeBytes: 2_048,
    checksumSha256: "f".repeat(64),
  });
  await harness.service.completeAttachment(alice, course.id, prepared.asset.id);
  const lesson = await harness.service.addLesson(alice, course.id, {
    title: "Приватный план",
    summary: "Не показывать ученику",
  });
  const imageDefinition = getComponentDefinition("image");
  const image = await harness.service.addComponent(alice, {
    lessonId: lesson.id,
    typeKey: "image",
    payload: {
      storedFileId: prepared.asset.id,
      alt: "Материал преподавателя",
    },
    placement: imageDefinition.defaultPlacement,
  });

  const hiddenPreview = await harness.service.getStudentPreview(
    alice,
    course.id,
  );
  assert.equal(hiddenPreview.attachments.length, 0);
  assert.equal(hiddenPreview.lessons[0]?.slides.length, 0);
  assert.doesNotMatch(JSON.stringify(hiddenPreview), /Не показывать ученику/);

  await harness.service.setComponentStudentScreen(alice, image.id, {
    mode: "new",
  });
  const visiblePreview = await harness.service.getStudentPreview(
    alice,
    course.id,
  );
  assert.deepEqual(
    visiblePreview.attachments.map((asset) => asset.id),
    [prepared.asset.id],
  );
  assert.equal(
    visiblePreview.lessons[0]?.slides[0]?.components[0]?.id,
    image.id,
  );
});

test("attachment operations deny cross-course references", async () => {
  const harness = createHarness();
  const firstCourse = await harness.service.createDraft(alice, courseInput());
  const secondCourse = await harness.service.createDraft(
    alice,
    courseInput({ title: "Второй курс" }),
  );
  const pending = await prepareAttachment(harness, firstCourse.id, {
    originalFilename: "private.png",
    mimeType: "image/png",
    sizeBytes: 1_024,
    checksumSha256: "d".repeat(64),
  });

  await assert.rejects(
    () =>
      harness.service.completeAttachment(
        alice,
        secondCourse.id,
        pending.asset.id,
      ),
    (error: unknown) => error instanceof CourseBuilderAccessError,
  );
  assert.equal(harness.objectAssertions.length, 0);

  await harness.service.completeAttachment(
    alice,
    firstCourse.id,
    pending.asset.id,
  );
  const lesson = await createLesson(harness, alice, secondCourse.id);
  const imageDefinition = getComponentDefinition("image");
  await assert.rejects(
    () =>
      harness.service.addComponent(alice, {
        lessonId: lesson.id,
        typeKey: "image",
        payload: {
          storedFileId: pending.asset.id,
          alt: "Чужое вложение",
        },
        placement: imageDefinition.defaultPlacement,
      }),
    (error: unknown) => error instanceof CourseBuilderAccessError,
  );
});

test("failed signed-upload preparation removes pending metadata", async () => {
  const harness = createHarness({ failSignedUpload: true });
  const course = await harness.service.createDraft(alice, courseInput());

  await assert.rejects(
    () =>
      prepareAttachment(harness, course.id, {
        originalFilename: "broken.txt",
        mimeType: "text/plain",
        sizeBytes: 100,
        checksumSha256: "e".repeat(64),
      }),
    /signed upload failed/,
  );
  assert.equal(harness.repository.calls.deletePendingAttachment, 1);
  assert.equal(harness.repository.assets.size, 0);
  assert.equal(
    (await harness.service.getCourse(alice, course.id)).attachments.length,
    0,
  );
});
