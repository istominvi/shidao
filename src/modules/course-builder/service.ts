import crypto from "node:crypto";
import type { ZodType } from "zod";
import {
  addLessonInputSchema,
  COURSE_ASSET_BUCKET,
  CourseBuilderAccessError,
  CourseBuilderConflictError,
  courseDraftInputSchema,
  courseUpdateInputSchema,
  parseContract,
  prepareCourseAttachmentInputSchema,
  reorderLessonComponentInputSchema,
  setComponentStudentScreenInputSchema,
  updateLessonComponentInputSchema,
  updateLessonInputSchema,
  uuidSchema,
  type AddLessonInput,
  type CourseDraftInput,
  type CourseUpdateInput,
  type PrepareCourseAttachmentInput,
  type ReorderLessonComponentInput,
  type SetComponentStudentScreenInput,
  type UpdateLessonComponentInput,
  type UpdateLessonInput,
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
  type CreatableComponentTypeKey,
  type LessonAddComponentInput,
} from "./registry/contracts";
import { extractComponentStoredFileReferences } from "./registry/stored-file-references";
import {
  CourseBuilderRepositoryError,
  type CourseBuilderRepository,
} from "./repository";
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

  async function requireMutableOwnedCourse(
    actor: CourseBuilderActor,
    courseIdValue: string,
  ) {
    const course = await requireOwnedCourse(actor, courseIdValue);
    if (
      course.learningAudience === "educators" &&
      actor.canAuthorEducatorCourses !== true
    ) {
      throw new CourseBuilderAccessError(
        "Редактирование курса для педагогов недоступно этому аккаунту.",
      );
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
    await requireMutableOwnedCourse(actor, lesson.courseId);
    return lesson;
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
    const lesson = await requireOwnedLesson(actor, component.lessonId);
    assertRegistryComponent(component);
    return { component, lesson };
  }

  async function assertAttachedFiles(
    courseId: string,
    typeKey: ComponentTypeKey,
    payload: unknown,
  ) {
    const ids = [
      ...new Set(extractComponentStoredFileReferences(typeKey, payload)),
    ];
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
      for (const component of lesson.components) {
        assertRegistryComponent(component);
      }
    }
    return hydrateSignedUrls(actor, workspace);
  }

  async function validateComponentForLesson(
    lesson: CourseLesson,
    input: {
      typeKey: ComponentTypeKey;
      payload: unknown;
      placement: unknown;
    },
  ) {
    const definition = getComponentDefinition(input.typeKey);
    const payload = parseComponentPayload(input.typeKey, input.payload);
    const placement = parseComponentPlacement(input.typeKey, input.placement);
    await assertAttachedFiles(lesson.courseId, input.typeKey, payload);
    return { definition, payload, placement };
  }

  async function persistValidatedComponent(
    lessonId: string,
    input: {
      typeKey: ComponentTypeKey;
    },
    validated: Awaited<ReturnType<typeof validateComponentForLesson>>,
  ) {
    return repository.addComponent({
      lessonId,
      typeKey: input.typeKey,
      schemaVersion: validated.definition.version,
      payload: validated.payload as Record<string, unknown>,
      placement: validated.placement as Record<string, unknown>,
    });
  }

  async function addValidatedComponent(
    actor: CourseBuilderActor,
    rawInput: unknown,
  ) {
    const input = parseContract(lessonAddComponentInputSchema, rawInput);
    const lesson = await requireOwnedLesson(actor, input.lessonId);
    const validated = await validateComponentForLesson(lesson, input);
    return persistValidatedComponent(lesson.id, input, validated);
  }

  return {
    async getActorAccountId(actor: CourseBuilderActor) {
      return requireAccountId(actor);
    },

    async listCourses(actor: CourseBuilderActor): Promise<CourseSummary[]> {
      await requireAccountId(actor);
      return repository.listCourses();
    },

    async createDraft(
      actor: CourseBuilderActor,
      rawInput: CourseDraftInput | unknown,
    ) {
      const input = parseContract(courseDraftInputSchema, rawInput);
      if (
        input.learningAudience === "educators" &&
        actor.canAuthorEducatorCourses !== true
      ) {
        throw new CourseBuilderAccessError(
          "Создание курсов для педагогов недоступно этому аккаунту.",
        );
      }
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
      const lessons = workspace.lessons.map((lesson) => ({
        id: lesson.id,
        courseId: lesson.courseId,
        position: lesson.position,
        title: lesson.title,
        createdAt: lesson.createdAt,
        updatedAt: lesson.updatedAt,
        slides: lesson.studentSlides
          .map((slide) => ({
            ...slide,
            components: lesson.components.filter(
              (component) =>
                component.visibility === "learner_visible" &&
                component.studentSlideId === slide.id,
            ),
          }))
          .filter((slide) => slide.components.length > 0),
      }));
      const learnerAttachmentIds = new Set(
        lessons.flatMap((lesson) =>
          lesson.slides.flatMap((slide) =>
            slide.components.flatMap((component) =>
              extractComponentStoredFileReferences(
                component.typeKey,
                component.payload,
              ),
            ),
          ),
        ),
      );
      return {
        id: workspace.id,
        title: workspace.title,
        attachments: workspace.attachments.filter((attachment) =>
          learnerAttachmentIds.has(attachment.id),
        ),
        lessons,
      };
    },

    async updateCourse(
      actor: CourseBuilderActor,
      courseId: string,
      rawInput: CourseUpdateInput | unknown,
    ) {
      const course = await requireMutableOwnedCourse(actor, courseId);
      const input = parseContract(courseUpdateInputSchema, rawInput);
      if (
        input.learningAudience !== undefined &&
        input.learningAudience !== course.learningAudience
      ) {
        throw new CourseBuilderConflictError(
          "Направление обучения выбирается при создании курса и не меняется.",
          "course_learning_audience_immutable",
        );
      }
      const updated = await repository.updateCourse(courseId, input);
      if (!updated) throw new CourseBuilderAccessError();
      return updated;
    },

    async archiveCourse(actor: CourseBuilderActor, courseId: string) {
      const course = await requireOwnedCourse(actor, courseId);
      const outcome = await repository.archiveCourse(course.id);
      switch (outcome) {
        case "archived":
          return { courseId: course.id };
        case "course_is_published":
          throw new CourseBuilderConflictError(
            "Сначала снимите курс с публикации в каталоге.",
            "course_is_published",
          );
        case "course_has_open_lesson_runs":
          throw new CourseBuilderConflictError(
            "Сначала завершите или отмените запланированные занятия по этому курсу.",
            "course_has_open_lesson_runs",
          );
        case "not_found":
          throw new CourseBuilderAccessError();
      }
    },

    async addLesson(
      actor: CourseBuilderActor,
      courseId: string,
      rawInput: AddLessonInput | unknown,
    ): Promise<CourseLesson> {
      await requireMutableOwnedCourse(actor, courseId);
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
          ? undefined
          : parseContract(
              definition.payloadSchema as ZodType<unknown>,
              input.payload,
            );
      const placement =
        input.placement === undefined
          ? undefined
          : parseContract(
              definition.placementSchema as ZodType<unknown>,
              input.placement,
            );
      if (payload !== undefined) {
        await assertAttachedFiles(lesson.courseId, component.typeKey, payload);
      }
      const updated = await repository.updateComponent({
        componentId,
        ...(payload === undefined
          ? {}
          : { payload: payload as Record<string, unknown> }),
        ...(placement === undefined
          ? {}
          : { placement: placement as Record<string, unknown> }),
      });
      if (!updated) {
        throw new CourseBuilderAccessError("Компонент не найден.");
      }
      return updated;
    },

    async setComponentStudentScreen(
      actor: CourseBuilderActor,
      componentId: string,
      rawInput: SetComponentStudentScreenInput | unknown,
    ) {
      await requireOwnedComponent(actor, componentId);
      const input = parseContract(
        setComponentStudentScreenInputSchema,
        rawInput,
      );
      try {
        const updated = await repository.setComponentStudentScreen(
          componentId,
          input,
        );
        if (!updated) {
          throw new CourseBuilderAccessError("Компонент не найден.");
        }
        return updated;
      } catch (error) {
        if (
          error instanceof CourseBuilderRepositoryError &&
          /student_slide_(?:target_out_of_order|cannot_split_group|not_found)/.test(
            error.message,
          )
        ) {
          throw new CourseBuilderConflictError(
            "Этот компонент нельзя поместить на выбранный слайд без нарушения порядка плана урока.",
            "student_slide_order_conflict",
          );
        }
        throw error;
      }
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
      const course = await requireMutableOwnedCourse(actor, courseId);
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
      await requireMutableOwnedCourse(actor, courseId);
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
      const course = await requireMutableOwnedCourse(actor, courseId);
      if (course.assembledAt) {
        return {
          courseId: course.id,
          lessonIds: course.lessons.map((lesson) => lesson.id),
          componentIds: course.lessons.flatMap((lesson) =>
            lesson.components.map((component) => component.id),
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

      const components: CourseDraftAssemblyComponent[] = [];
      const plan = async (
        typeKey: CreatableComponentTypeKey,
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

      await plan("rich_text", {
        title: course.title,
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
        components,
      });
    },
  };
}

export function assertComponentTypeKey(value: unknown) {
  return parseContract(componentTypeKeySchema, value);
}
