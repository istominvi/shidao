import crypto from "node:crypto";
import type { ZodType } from "zod";
import {
  addLessonInputSchema,
  addLessonStepInputSchema,
  COURSE_ASSET_BUCKET,
  CourseBuilderAccessError,
  CourseBuilderConflictError,
  courseDraftInputSchema,
  courseUpdateInputSchema,
  parseContract,
  prepareCourseAttachmentInputSchema,
  reorderLessonComponentInputSchema,
  updateLessonComponentInputSchema,
  updateLessonInputSchema,
  updateLessonStepInputSchema,
  uuidSchema,
  type AddLessonInput,
  type AddLessonStepInput,
  type CourseDraftInput,
  type CourseUpdateInput,
  type PrepareCourseAttachmentInput,
  type ReorderLessonComponentInput,
  type UpdateLessonComponentInput,
  type UpdateLessonInput,
  type UpdateLessonStepInput,
} from "./contracts";
import type {
  AssembleCourseResult,
  CourseAsset,
  CourseBuilderActor,
  CourseDraftAssemblyComponent,
  CourseLesson,
  CourseSummary,
  CourseWorkspace,
  LessonComponent,
  LessonStep,
  PreparedCourseAttachment,
  StudentScreenCourse,
} from "./domain";
import {
  componentTypeKeySchema,
  findComponentDefinition,
  getComponentDefinition,
  lessonAddComponentInputSchema,
  parseComponentPayload,
  parseComponentPlacement,
  type ComponentTypeKey,
  type LessonAddComponentInput,
} from "./registry/contracts";
import type { CourseBuilderRepository } from "./repository";
import {
  assertCourseAssetObjectExists,
  courseAssetExtension,
  createCourseAssetSignedDownload,
  createCourseAssetSignedUpload,
} from "./storage";

type StorageDependencies = {
  createSignedUpload: typeof createCourseAssetSignedUpload;
  createSignedDownload: typeof createCourseAssetSignedDownload;
  assertObjectExists: typeof assertCourseAssetObjectExists;
};

export type CourseBuilderServiceDependencies = {
  repository: CourseBuilderRepository;
  storage?: Partial<StorageDependencies>;
  createId?: () => string;
};

export type CourseBuilderApplicationService = ReturnType<
  typeof createCourseBuilderService
>;

function fileReferences(typeKey: ComponentTypeKey, payload: unknown) {
  const parsed = parseComponentPayload(typeKey, payload);
  switch (typeKey) {
    case "image":
    case "file": {
      const storedFileId = (parsed as { storedFileId: string | null })
        .storedFileId;
      return storedFileId ? [storedFileId] : [];
    }
    case "slideshow":
      return (parsed as { slides: Array<{ storedFileId: string }> }).slides.map(
        (slide) => slide.storedFileId,
      );
    default:
      return [];
  }
}

function attachmentLabel(filename: string) {
  return filename.replace(/\.[^.]+$/, "").trim() || "Материал курса";
}

function assertRegistryComponent(component: LessonComponent) {
  const definition = findComponentDefinition(component.typeKey);
  if (!definition || component.schemaVersion !== definition.version) {
    throw new CourseBuilderConflictError(
      `Компонент ${component.id} использует неподдерживаемую версию schema.`,
    );
  }
  definition.payloadSchema.parse(component.payload);
  definition.placementSchema.parse(component.placement);
}

export function createCourseBuilderService(
  dependencies: CourseBuilderServiceDependencies,
) {
  const repository = dependencies.repository;
  const storage: StorageDependencies = {
    createSignedUpload:
      dependencies.storage?.createSignedUpload ?? createCourseAssetSignedUpload,
    createSignedDownload:
      dependencies.storage?.createSignedDownload ??
      createCourseAssetSignedDownload,
    assertObjectExists:
      dependencies.storage?.assertObjectExists ?? assertCourseAssetObjectExists,
  };
  const createId = dependencies.createId ?? crypto.randomUUID;

  async function requireAccountId(actor: CourseBuilderActor) {
    const accountId = await repository.getAccountId(
      parseContract(uuidSchema, actor.authUserId),
    );
    if (!accountId) {
      throw new CourseBuilderAccessError(
        "Для текущей Auth-сессии не найден Account.",
      );
    }
    return accountId;
  }

  async function requireOwnedCourse(
    actor: CourseBuilderActor,
    courseIdValue: string,
  ) {
    const courseId = parseContract(uuidSchema, courseIdValue);
    const [accountId, course] = await Promise.all([
      requireAccountId(actor),
      repository.getCourseWorkspace(courseId),
    ]);
    if (!course || course.ownerAccountId !== accountId) {
      throw new CourseBuilderAccessError();
    }
    return course;
  }

  async function requireOwnedLesson(
    actor: CourseBuilderActor,
    lessonIdValue: string,
  ) {
    const lessonId = parseContract(uuidSchema, lessonIdValue);
    const lesson = await repository.getLesson(lessonId);
    if (!lesson) throw new CourseBuilderAccessError("Урок не найден.");
    await requireOwnedCourse(actor, lesson.courseId);
    return lesson;
  }

  async function requireOwnedStep(
    actor: CourseBuilderActor,
    stepIdValue: string,
  ) {
    const stepId = parseContract(uuidSchema, stepIdValue);
    const step = await repository.getStep(stepId);
    if (!step) throw new CourseBuilderAccessError("Шаг урока не найден.");
    const lesson = await requireOwnedLesson(actor, step.lessonId);
    return { step, lesson };
  }

  async function requireOwnedComponent(
    actor: CourseBuilderActor,
    componentIdValue: string,
  ) {
    const componentId = parseContract(uuidSchema, componentIdValue);
    const component = await repository.getComponent(componentId);
    if (!component) {
      throw new CourseBuilderAccessError("Компонент не найден.");
    }
    const { lesson } = await requireOwnedStep(actor, component.stepId);
    assertRegistryComponent(component);
    return { component, lesson };
  }

  async function assertAttachedFiles(
    courseId: string,
    typeKey: ComponentTypeKey,
    payload: unknown,
  ) {
    const ids = [...new Set(fileReferences(typeKey, payload))];
    for (const assetId of ids) {
      const attachment = await repository.getAttachment(courseId, assetId);
      if (!attachment || attachment.status !== "ready") {
        throw new CourseBuilderAccessError(
          "Компонент может ссылаться только на готовое вложение этого курса.",
        );
      }
      if (
        (typeKey === "image" || typeKey === "slideshow") &&
        !attachment.mimeType.startsWith("image/")
      ) {
        throw new CourseBuilderConflictError(
          "Для картинки или слайдшоу нужно выбрать изображение.",
        );
      }
    }
  }

  async function hydrateSignedUrls(
    actor: CourseBuilderActor,
    workspace: CourseWorkspace,
  ): Promise<CourseWorkspace> {
    const attachments = await Promise.all(
      workspace.attachments.map(async (asset): Promise<CourseAsset> => {
        if (asset.status !== "ready") return asset;
        const ref = await repository.getAttachmentStorageRef(
          workspace.id,
          asset.id,
        );
        if (!ref) return asset;
        try {
          const signedUrl = await storage.createSignedDownload({
            accessToken: actor.accessToken,
            bucket: ref.storageBucket,
            path: ref.storagePath,
            expiresInSeconds: 600,
          });
          return { ...asset, signedUrl };
        } catch {
          return asset;
        }
      }),
    );
    return { ...workspace, attachments };
  }

  async function getValidatedWorkspace(
    actor: CourseBuilderActor,
    courseId: string,
  ) {
    const workspace = await requireOwnedCourse(actor, courseId);
    for (const lesson of workspace.lessons) {
      for (const step of lesson.steps) {
        for (const component of step.components) {
          assertRegistryComponent(component);
        }
      }
    }
    return hydrateSignedUrls(actor, workspace);
  }

  async function addValidatedComponent(
    actor: CourseBuilderActor,
    rawInput: unknown,
  ) {
    const input = parseContract(lessonAddComponentInputSchema, rawInput);
    const { lesson } = await requireOwnedStep(actor, input.lessonStepId);
    const definition = getComponentDefinition(input.typeKey);
    const payload = parseComponentPayload(input.typeKey, input.payload);
    const placement = parseComponentPlacement(input.typeKey, input.placement);
    await assertAttachedFiles(lesson.courseId, input.typeKey, payload);
    return repository.addComponent({
      stepId: input.lessonStepId,
      typeKey: input.typeKey,
      schemaVersion: definition.version,
      payload: payload as Record<string, unknown>,
      placement: placement as Record<string, unknown>,
      visibility: "learner_visible",
    });
  }

  return {
    async listCourses(actor: CourseBuilderActor): Promise<CourseSummary[]> {
      await requireAccountId(actor);
      return repository.listCourses();
    },

    async createDraft(
      actor: CourseBuilderActor,
      rawInput: CourseDraftInput | unknown,
    ) {
      const input = parseContract(courseDraftInputSchema, rawInput);
      const accountId = await requireAccountId(actor);
      return repository.createCourse(accountId, input);
    },

    async getCourse(actor: CourseBuilderActor, courseId: string) {
      return getValidatedWorkspace(actor, courseId);
    },

    async getStudentPreview(
      actor: CourseBuilderActor,
      courseId: string,
    ): Promise<StudentScreenCourse> {
      const workspace = await getValidatedWorkspace(actor, courseId);
      return {
        id: workspace.id,
        title: workspace.title,
        attachments: workspace.attachments,
        lessons: workspace.lessons.map((lesson) => ({
          id: lesson.id,
          courseId: lesson.courseId,
          position: lesson.position,
          title: lesson.title,
          summary: lesson.summary,
          createdAt: lesson.createdAt,
          updatedAt: lesson.updatedAt,
          steps: lesson.steps.map((step) => ({
            id: step.id,
            lessonId: step.lessonId,
            position: step.position,
            title: step.title,
            learnerInstruction: step.learnerInstruction,
            components: step.components.filter(
              (component) => component.visibility === "learner_visible",
            ),
            createdAt: step.createdAt,
            updatedAt: step.updatedAt,
          })),
        })),
      };
    },

    async updateCourse(
      actor: CourseBuilderActor,
      courseId: string,
      rawInput: CourseUpdateInput | unknown,
    ) {
      await requireOwnedCourse(actor, courseId);
      const input = parseContract(courseUpdateInputSchema, rawInput);
      const updated = await repository.updateCourse(courseId, input);
      if (!updated) throw new CourseBuilderAccessError();
      return updated;
    },

    async addLesson(
      actor: CourseBuilderActor,
      courseId: string,
      rawInput: AddLessonInput | unknown,
    ): Promise<CourseLesson> {
      await requireOwnedCourse(actor, courseId);
      return repository.addLesson(
        courseId,
        parseContract(addLessonInputSchema, rawInput),
      );
    },

    async updateLesson(
      actor: CourseBuilderActor,
      lessonId: string,
      rawInput: UpdateLessonInput | unknown,
    ) {
      await requireOwnedLesson(actor, lessonId);
      const updated = await repository.updateLesson(
        lessonId,
        parseContract(updateLessonInputSchema, rawInput),
      );
      if (!updated) throw new CourseBuilderAccessError("Урок не найден.");
      return updated;
    },

    async deleteLesson(actor: CourseBuilderActor, lessonId: string) {
      await requireOwnedLesson(actor, lessonId);
      if (!(await repository.deleteLesson(lessonId))) {
        throw new CourseBuilderAccessError("Урок не найден.");
      }
      return { lessonId };
    },

    async addStep(
      actor: CourseBuilderActor,
      lessonId: string,
      rawInput: AddLessonStepInput | unknown,
    ): Promise<LessonStep> {
      await requireOwnedLesson(actor, lessonId);
      return repository.addStep(
        lessonId,
        parseContract(addLessonStepInputSchema, rawInput),
      );
    },

    async updateStep(
      actor: CourseBuilderActor,
      stepId: string,
      rawInput: UpdateLessonStepInput | unknown,
    ) {
      await requireOwnedStep(actor, stepId);
      const updated = await repository.updateStep(
        stepId,
        parseContract(updateLessonStepInputSchema, rawInput),
      );
      if (!updated) throw new CourseBuilderAccessError("Шаг урока не найден.");
      return updated;
    },

    addComponent(
      actor: CourseBuilderActor,
      input: LessonAddComponentInput | unknown,
    ) {
      return addValidatedComponent(actor, input);
    },

    async updateComponent(
      actor: CourseBuilderActor,
      componentId: string,
      rawInput: UpdateLessonComponentInput | unknown,
    ) {
      const { component, lesson } = await requireOwnedComponent(
        actor,
        componentId,
      );
      const input = parseContract(updateLessonComponentInputSchema, rawInput);
      const definition = getComponentDefinition(component.typeKey);
      const payload =
        input.payload === undefined
          ? component.payload
          : parseContract(
              definition.payloadSchema as ZodType<unknown>,
              input.payload,
            );
      const placement =
        input.placement === undefined
          ? component.placement
          : parseContract(
              definition.placementSchema as ZodType<unknown>,
              input.placement,
            );
      await assertAttachedFiles(lesson.courseId, component.typeKey, payload);
      const updated = await repository.updateComponent({
        componentId,
        payload: payload as Record<string, unknown>,
        placement: placement as Record<string, unknown>,
      });
      if (!updated) {
        throw new CourseBuilderAccessError("Компонент не найден.");
      }
      return updated;
    },

    async deleteComponent(actor: CourseBuilderActor, componentId: string) {
      await requireOwnedComponent(actor, componentId);
      if (!(await repository.deleteComponent(componentId))) {
        throw new CourseBuilderAccessError("Компонент не найден.");
      }
      return { componentId };
    },

    async reorderComponent(
      actor: CourseBuilderActor,
      componentId: string,
      rawInput: ReorderLessonComponentInput | unknown,
    ) {
      await requireOwnedComponent(actor, componentId);
      const input = parseContract(reorderLessonComponentInputSchema, rawInput);
      const reordered = await repository.reorderComponent(
        componentId,
        input.toPosition,
      );
      if (!reordered) {
        throw new CourseBuilderAccessError("Компонент не найден.");
      }
      return reordered;
    },

    async prepareAttachment(
      actor: CourseBuilderActor,
      courseId: string,
      rawInput: PrepareCourseAttachmentInput | unknown,
    ): Promise<PreparedCourseAttachment> {
      const course = await requireOwnedCourse(actor, courseId);
      const input = parseContract(prepareCourseAttachmentInputSchema, rawInput);
      const accountId = course.ownerAccountId;
      const assetId = createId();
      const objectId = createId();
      const extension = courseAssetExtension(input.mimeType);
      const storagePath = `${accountId}/courses/${course.id}/assets/${assetId}/${objectId}.${extension}`;
      const asset = await repository.createPendingAttachment({
        id: assetId,
        ownerAccountId: accountId,
        courseId: course.id,
        storageBucket: COURSE_ASSET_BUCKET,
        storagePath,
        file: input,
      });
      try {
        const signed = await storage.createSignedUpload({
          accessToken: actor.accessToken,
          bucket: COURSE_ASSET_BUCKET,
          path: storagePath,
        });
        return {
          asset,
          upload: {
            bucket: COURSE_ASSET_BUCKET,
            path: storagePath,
            ...signed,
          },
        };
      } catch (error) {
        await repository.deletePendingAttachment(assetId).catch(() => null);
        throw error;
      }
    },

    async completeAttachment(
      actor: CourseBuilderActor,
      courseId: string,
      assetIdValue: string,
    ) {
      await requireOwnedCourse(actor, courseId);
      const assetId = parseContract(uuidSchema, assetIdValue);
      const ref = await repository.getAttachmentStorageRef(courseId, assetId);
      if (!ref || ref.asset.status !== "pending") {
        throw new CourseBuilderAccessError("Вложение не найдено.");
      }
      await storage.assertObjectExists({
        accessToken: actor.accessToken,
        bucket: ref.storageBucket,
        path: ref.storagePath,
        expectedSizeBytes: ref.asset.sizeBytes,
        expectedMimeType: ref.asset.mimeType,
      });
      const completed = await repository.completeAttachment(assetId);
      if (!completed) {
        throw new CourseBuilderConflictError(
          "Не удалось подтвердить загрузку вложения.",
        );
      }
      return completed;
    },

    async assembleCourse(
      actor: CourseBuilderActor,
      courseId: string,
    ): Promise<AssembleCourseResult> {
      const course = await requireOwnedCourse(actor, courseId);
      if (course.assembledAt) {
        return {
          courseId: course.id,
          lessonIds: course.lessons.map((lesson) => lesson.id),
          stepIds: course.lessons.flatMap((lesson) =>
            lesson.steps.map((step) => step.id),
          ),
          componentIds: course.lessons.flatMap((lesson) =>
            lesson.steps.flatMap((step) =>
              step.components.map((component) => component.id),
            ),
          ),
          alreadyAssembled: true,
        };
      }
      if (course.lessons.length > 0) {
        throw new CourseBuilderConflictError(
          "В курсе уже есть ручной контент. Откройте workspace и продолжите редактирование.",
        );
      }

      const lesson = {
        title: `Введение: ${course.subject}`,
        summary: `Первый из ${course.targetLessonCount} запланированных уроков курса «${course.title}».`,
      };
      const step = {
        title: "Знакомство с темой",
        teacherInstructions:
          course.teacherPreferences ||
          "Коротко обозначьте цель курса и проверьте исходное понимание темы.",
        learnerInstruction:
          "Познакомьтесь с темой и выберите ответ в завершающем вопросе.",
      };

      const components: CourseDraftAssemblyComponent[] = [];
      const plan = async (
        typeKey: ComponentTypeKey,
        rawPayload: Record<string, unknown>,
      ) => {
        const definition = getComponentDefinition(typeKey);
        const payload = parseComponentPayload(typeKey, rawPayload);
        const placement = parseComponentPlacement(
          typeKey,
          definition.defaultPlacement,
        );
        await assertAttachedFiles(course.id, typeKey, payload);
        components.push({
          typeKey,
          schemaVersion: definition.version,
          payload: payload as Record<string, unknown>,
          placement: placement as Record<string, unknown>,
        });
      };

      await plan("heading", { text: course.title, level: "h2" });
      await plan("rich_text", {
        content: `**Тема:** ${course.subject}\n\n**Уровень:** ${course.level}${
          course.audienceDescription
            ? `\n\n**Для кого:** ${course.audienceDescription}`
            : ""
        }`,
        format: "markdown",
      });
      await plan("callout", {
        title: "Цель курса",
        text: course.goal,
        tone: "info",
      });
      await plan("divider", {});

      for (const asset of course.attachments.filter(
        (attachment) => attachment.status === "ready",
      )) {
        if (asset.mimeType.startsWith("image/")) {
          await plan("image", {
            storedFileId: asset.id,
            alt: attachmentLabel(asset.originalFilename),
            caption: `${asset.originalFilename} — прикреплено преподавателем, без автоматического анализа.`,
          });
        } else {
          await plan("file", {
            storedFileId: asset.id,
            label: asset.originalFilename.slice(0, 240),
            description:
              "Файл прикреплён преподавателем; его содержимое пока не анализировалось.",
            openMode: "download",
          });
        }
      }

      return repository.assembleDraft({
        courseId: course.id,
        lesson,
        step,
        components,
      });
    },
  };
}

export function assertComponentTypeKey(value: unknown) {
  return parseContract(componentTypeKeySchema, value);
}
