import crypto from "node:crypto";
import { z } from "zod";
import { logger } from "@/lib/server/logger";
import {
  copyCourseInputSchema,
  COURSE_ASSET_BUCKET,
  COURSE_PUBLICATION_ASSET_BUCKET,
  coursePublicationSnapshotSchema,
  CoursePublicationAccessError,
  CoursePublicationConflictError,
  CoursePublicationValidationError,
  parsePublicationContract,
  rightsConfirmationInputSchema,
  type CatalogQuery,
} from "./contracts";
import type {
  CourseBuilderActor,
  CourseSummary,
  CourseWorkspace,
  LessonComponent,
} from "@/modules/course-builder/domain";
import type { CourseBuilderApplicationService } from "@/modules/course-builder/service";
import { courseAssetExtension } from "@/modules/course-builder/storage";
import type {
  ClonedAssetManifestItem,
  CopiedCourseResult,
  CourseCatalogDetail,
  CourseCatalogEntry,
  CourseCatalogPage,
  CoursePublicationSnapshot,
  OwnedCoursePublication,
  PublicationAssetManifestItem,
  PublicationIdMap,
} from "./domain";
import type {
  CatalogPublicationDetailRecord,
  CatalogPublicationRecord,
  CoursePublicationRepository,
  OwnedPublicationRecord,
  PublicationSourceAsset,
} from "./repository";
import { CoursePublicationRepositoryError } from "./errors";
import {
  coursePublicationMutationGuard,
  type CoursePublicationMutationGuard,
} from "./mutation-guard";
import type { CoursePublicationStorageBroker } from "./storage";

export const COURSE_PUBLICATION_MAX_MATERIALS = 24;
export const COURSE_PUBLICATION_MAX_TOTAL_BYTES = 120 * 1024 * 1024;

const uuidSchema = z.uuid();

type CourseService = Pick<
  CourseBuilderApplicationService,
  "getActorAccountId" | "getCourse"
>;

export type CoursePublicationServiceDependencies = {
  repository: CoursePublicationRepository;
  storage: CoursePublicationStorageBroker;
  courseService: CourseService;
  mutationGuard?: CoursePublicationMutationGuard;
  createId?: () => string;
};

export type CoursePublicationApplicationService = ReturnType<
  typeof createCoursePublicationService
>;

function encodeCursor(offset: number) {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | null) {
  if (!cursor) return 0;
  try {
    const value = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as { offset?: unknown };
    if (
      typeof value.offset !== "number" ||
      !Number.isSafeInteger(value.offset) ||
      value.offset < 0
    ) {
      throw new Error("invalid cursor");
    }
    return value.offset;
  } catch {
    throw new CoursePublicationValidationError("Некорректный cursor каталога.");
  }
}

function deterministicRef(namespace: string, kind: string, sourceId: string) {
  const bytes = crypto
    .createHash("sha256")
    .update(`${namespace}:${kind}:${sourceId}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalize(nested)]),
  );
}

export function publicationContentSha256(snapshot: CoursePublicationSnapshot) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(snapshot)))
    .digest("hex");
}

function validateMaterialLimits(
  materials: Array<{ sizeBytes: number; status?: "pending" | "ready" }>,
) {
  if (materials.length > COURSE_PUBLICATION_MAX_MATERIALS) {
    throw new CoursePublicationValidationError(
      `В публикации может быть не больше ${COURSE_PUBLICATION_MAX_MATERIALS} материалов.`,
    );
  }
  if (materials.some((material) => material.status === "pending")) {
    throw new CoursePublicationValidationError(
      "Дождитесь завершения загрузки всех материалов перед публикацией.",
    );
  }
  const totalBytes = materials.reduce(
    (total, material) => total + material.sizeBytes,
    0,
  );
  if (totalBytes > COURSE_PUBLICATION_MAX_TOTAL_BYTES) {
    throw new CoursePublicationValidationError(
      "Общий размер материалов публикации не должен превышать 120 МиБ.",
    );
  }
}

function storedFileRefs(component: LessonComponent) {
  switch (component.typeKey) {
    case "image":
    case "file": {
      const value = component.payload.storedFileId;
      return typeof value === "string" ? [value] : [];
    }
    case "slideshow": {
      const slides = component.payload.slides;
      if (!Array.isArray(slides)) return [];
      return slides.flatMap((slide) =>
        slide &&
        typeof slide === "object" &&
        typeof (slide as Record<string, unknown>).storedFileId === "string"
          ? [(slide as Record<string, unknown>).storedFileId as string]
          : [],
      );
    }
    default:
      return [];
  }
}

function remapPayload(
  component: LessonComponent,
  materialRefBySourceId: Map<string, string>,
) {
  const remap = (sourceId: unknown) => {
    if (sourceId === null) return null;
    if (typeof sourceId !== "string") {
      throw new CoursePublicationConflictError(
        "Компонент содержит некорректную ссылку на материал.",
        "publication_component_asset_invalid",
      );
    }
    const ref = materialRefBySourceId.get(sourceId);
    if (!ref) {
      throw new CoursePublicationConflictError(
        "Компонент ссылается на материал вне этого курса.",
        "publication_component_asset_missing",
      );
    }
    return ref;
  };

  if (component.typeKey === "image" || component.typeKey === "file") {
    return {
      ...component.payload,
      storedFileId: remap(component.payload.storedFileId),
    };
  }
  if (component.typeKey === "slideshow") {
    const slides = component.payload.slides;
    if (!Array.isArray(slides)) {
      throw new CoursePublicationConflictError(
        "Слайдшоу содержит некорректные данные.",
        "publication_component_asset_invalid",
      );
    }
    return {
      ...component.payload,
      slides: slides.map((slide) => {
        if (!slide || typeof slide !== "object") {
          throw new CoursePublicationConflictError(
            "Слайдшоу содержит некорректный материал.",
            "publication_component_asset_invalid",
          );
        }
        const record = slide as Record<string, unknown>;
        return { ...record, storedFileId: remap(record.storedFileId) };
      }),
    };
  }
  return structuredClone(component.payload);
}

function assertSourceAssetsMatch(
  workspace: CourseWorkspace,
  sourceAssets: PublicationSourceAsset[],
) {
  validateMaterialLimits(sourceAssets);
  const byId = new Map(
    sourceAssets.map((asset) => [asset.sourceStoredFileId, asset]),
  );
  if (byId.size !== workspace.attachments.length) {
    throw new CoursePublicationConflictError(
      "Не удалось подтвердить все материалы курса.",
      "publication_assets_incomplete",
    );
  }
  for (const attachment of workspace.attachments) {
    const source = byId.get(attachment.id);
    if (
      !source ||
      source.status !== "ready" ||
      attachment.status !== "ready" ||
      source.originalFilename !== attachment.originalFilename ||
      source.mimeType !== attachment.mimeType ||
      source.sizeBytes !== attachment.sizeBytes ||
      source.checksumSha256.toLowerCase() !==
        attachment.checksumSha256.toLowerCase()
    ) {
      throw new CoursePublicationConflictError(
        "Материалы курса изменились. Обновите страницу и повторите публикацию.",
        "publication_assets_changed",
      );
    }
  }
  for (const lesson of workspace.lessons) {
    for (const component of lesson.components) {
      for (const sourceId of storedFileRefs(component)) {
        if (!byId.has(sourceId)) {
          throw new CoursePublicationConflictError(
            "Компонент ссылается на материал вне этого курса.",
            "publication_component_asset_missing",
          );
        }
      }
    }
  }
}

function assertDetailAssetsMatchSnapshot(
  detail: CatalogPublicationDetailRecord,
) {
  const assetById = new Map(
    detail.assets.map((asset) => [asset.publicationAssetId, asset]),
  );
  if (assetById.size !== detail.snapshot.materials.length) {
    throw new CoursePublicationConflictError(
      "Не все материалы публикации доступны.",
      "publication_materials_incomplete",
    );
  }
  for (const material of detail.snapshot.materials) {
    const asset = assetById.get(material.ref);
    if (
      !asset ||
      material.originalFilename !== asset.originalFilename ||
      material.mimeType !== asset.mimeType ||
      material.sizeBytes !== asset.sizeBytes ||
      material.checksumSha256.toLowerCase() !==
        asset.checksumSha256.toLowerCase()
    ) {
      throw new CoursePublicationConflictError(
        "Материал публикации повреждён.",
        "publication_material_invalid",
      );
    }
  }
}

export function buildCoursePublicationSnapshot(input: {
  workspace: CourseWorkspace;
  sourceAssets: PublicationSourceAsset[];
  publicationId: string;
}) {
  const { workspace, sourceAssets, publicationId } = input;
  assertSourceAssetsMatch(workspace, sourceAssets);
  const orderedSourceAssets = [...sourceAssets].sort((left, right) =>
    left.sourceStoredFileId.localeCompare(right.sourceStoredFileId),
  );
  const materialRefBySourceId = new Map(
    orderedSourceAssets.map((asset) => [
      asset.sourceStoredFileId,
      deterministicRef(publicationId, "material", asset.sourceStoredFileId),
    ]),
  );
  const materials = orderedSourceAssets.map((asset) => ({
    ref: materialRefBySourceId.get(asset.sourceStoredFileId)!,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    checksumSha256: asset.checksumSha256.toLowerCase(),
  }));
  const lessons = [...workspace.lessons]
    .sort((left, right) => left.position - right.position)
    .map((lesson) => {
      const slideRefBySourceId = new Map(
        lesson.studentSlides.map((slide) => [
          slide.id,
          deterministicRef(publicationId, "slide", slide.id),
        ]),
      );
      return {
        ref: deterministicRef(publicationId, "lesson", lesson.id),
        position: lesson.position,
        title: lesson.title,
        summary: lesson.summary,
        estimatedDurationMinutes: lesson.estimatedDurationMinutes ?? null,
        components: [...lesson.components]
          .sort((left, right) => left.position - right.position)
          .map((component) => ({
            ref: deterministicRef(publicationId, "component", component.id),
            position: component.position,
            typeKey: component.typeKey,
            schemaVersion: component.schemaVersion,
            payload: remapPayload(component, materialRefBySourceId),
            placement: structuredClone(component.placement),
            visibility: component.visibility,
            studentSlideRef:
              component.studentSlideId === null
                ? null
                : (slideRefBySourceId.get(component.studentSlideId) ?? null),
          })),
        slides: [...lesson.studentSlides]
          .sort((left, right) => left.position - right.position)
          .map((slide) => ({
            ref: slideRefBySourceId.get(slide.id)!,
            position: slide.position,
          })),
      };
    });
  for (const lesson of lessons) {
    for (const component of lesson.components) {
      if (
        component.visibility === "learner_visible" &&
        component.studentSlideRef === null
      ) {
        throw new CoursePublicationConflictError(
          "Экран ученика содержит повреждённую связь со слайдом.",
          "publication_slide_assignment_invalid",
        );
      }
    }
  }
  return parsePublicationContract(coursePublicationSnapshotSchema, {
    schemaVersion: 1,
    course: {
      title: workspace.title,
      subject: workspace.subject,
      goal: workspace.goal,
      level: workspace.level,
      audienceDescription: workspace.audienceDescription,
      targetLessonCount: workspace.targetLessonCount,
    },
    lessons,
    materials,
  });
}

function mapOwnedPublication(
  record:
    | OwnedPublicationRecord
    | {
        publicationId: string;
        status: "published" | "unpublished";
        currentRevisionId: string;
        publishedAt: string | null;
        updatedAt: string;
        sourceCourseUpdatedAt: string;
        sourceContentUpdatedAt: string;
      },
  publicationContentUpdatedAt: string,
): OwnedCoursePublication {
  return {
    id: record.publicationId,
    status: record.status,
    currentRevisionId: record.currentRevisionId,
    publishedAt: record.publishedAt,
    updatedAt: record.updatedAt,
    hasUnpublishedChanges:
      publicationContentUpdatedAt !== record.sourceContentUpdatedAt,
  };
}

function mapCatalogEntry(
  record: CatalogPublicationRecord,
  actorAccountId: string,
): CourseCatalogEntry {
  const { course, lessons, materials } = record.snapshot;
  const isCurrentUser = record.ownerAccountId === actorAccountId;
  return {
    id: record.publicationId,
    sourceCourseId: isCurrentUser ? record.sourceCourseId : null,
    ...course,
    lessonCount: lessons.length,
    materialCount: materials.length,
    publishedAt: record.publishedAt,
    author: {
      displayName: record.publisherDisplayName,
      isShiDao: record.isShiDao,
      isCurrentUser,
    },
  };
}

function createIdMapFromSnapshot(
  snapshot: CoursePublicationSnapshot,
  createId: () => string,
): PublicationIdMap {
  return {
    lessons: snapshot.lessons.map((lesson) => ({
      ref: lesson.ref,
      id: createId(),
    })),
    components: snapshot.lessons.flatMap((lesson) =>
      lesson.components.map((component) => ({
        ref: component.ref,
        id: createId(),
      })),
    ),
    slides: snapshot.lessons.flatMap((lesson) =>
      lesson.slides.map((slide) => ({ ref: slide.ref, id: createId() })),
    ),
  };
}

function createIdMapFromWorkspace(
  workspace: CourseWorkspace,
  createId: () => string,
): PublicationIdMap {
  return {
    lessons: workspace.lessons.map((lesson) => ({
      ref: lesson.id,
      id: createId(),
    })),
    components: workspace.lessons.flatMap((lesson) =>
      lesson.components.map((component) => ({
        ref: component.id,
        id: createId(),
      })),
    ),
    slides: workspace.lessons.flatMap((lesson) =>
      lesson.studentSlides.map((slide) => ({ ref: slide.id, id: createId() })),
    ),
  };
}

type CleanupLogContext = {
  operation: "publish" | "catalog_copy";
  operationId: string;
};

function safeCleanupError(error: unknown) {
  const record =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : null;
  const rawName = error instanceof Error ? error.name : "UnknownError";
  const rawCode = record?.code ?? record?.status;
  return {
    errorName: /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(rawName)
      ? rawName
      : "UnknownError",
    errorCode:
      (typeof rawCode === "string" || typeof rawCode === "number") &&
      /^[A-Za-z0-9_-]{1,80}$/.test(String(rawCode))
        ? String(rawCode)
        : null,
  };
}

async function cleanupCopiedObjects(
  storage: CoursePublicationStorageBroker,
  bucket: string,
  paths: string[],
  context: CleanupLogContext,
) {
  if (paths.length === 0) return;
  try {
    await storage.deleteObjects(bucket, paths);
  } catch (error) {
    logger.warn("[course-publications] copied object cleanup failed", {
      operation: context.operation,
      operationId: context.operationId,
      bucket,
      objectCount: paths.length,
      ...safeCleanupError(error),
    });
  }
}

function shouldCleanupAfterRepositoryError(error: unknown) {
  return !(
    error instanceof CoursePublicationRepositoryError &&
    !error.definitelyNotCommitted
  );
}

export function createCoursePublicationService(
  dependencies: CoursePublicationServiceDependencies,
) {
  const { repository, storage, courseService } = dependencies;
  const createId = dependencies.createId ?? crypto.randomUUID;
  const mutationGuard =
    dependencies.mutationGuard ?? coursePublicationMutationGuard;

  async function ownedWorkspace(
    actor: CourseBuilderActor,
    courseIdValue: string,
  ) {
    const courseId = parsePublicationContract(uuidSchema, courseIdValue);
    return courseService.getCourse(actor, courseId);
  }

  async function publicationForOwnedCourse(
    actor: CourseBuilderActor,
    course: Pick<
      CourseSummary,
      "id" | "ownerAccountId" | "publicationContentUpdatedAt"
    >,
  ) {
    const actorAccountId = await courseService.getActorAccountId(actor);
    if (course.ownerAccountId !== actorAccountId) {
      throw new CoursePublicationAccessError("Курс не найден или недоступен.");
    }
    const record = await repository.getOwnedPublication(
      actorAccountId,
      course.id,
    );
    return record
      ? mapOwnedPublication(record, course.publicationContentUpdatedAt)
      : null;
  }

  async function catalogDetailRecord(publicationIdValue: string) {
    const publicationId = parsePublicationContract(
      uuidSchema,
      publicationIdValue,
    );
    const detail = await repository.getCatalogPublication(publicationId);
    if (!detail) throw new CoursePublicationAccessError();
    validateMaterialLimits(detail.assets);
    assertDetailAssetsMatchSnapshot(detail);
    return detail;
  }

  async function assertActivePublicationActor(actorAccountId: string) {
    if (!(await repository.isActiveAccount(actorAccountId))) {
      throw new CoursePublicationAccessError(
        "Каталог курсов недоступен для этого аккаунта.",
      );
    }
  }

  async function copyAssets(
    copies: Array<{
      sourceBucket: string;
      sourcePath: string;
      destinationBucket: string;
      destinationPath: string;
      expectedSizeBytes: number;
      expectedMimeType: string;
    }>,
    cleanupContext: CleanupLogContext,
  ) {
    const copiedPaths: string[] = [];
    try {
      for (const copy of copies) {
        // Track before copy: if Storage writes the object but verification
        // fails, cleanup must include that just-written destination too.
        copiedPaths.push(copy.destinationPath);
        await storage.copyObject(copy);
      }
      return copiedPaths;
    } catch (error) {
      if (copies[0]) {
        await cleanupCopiedObjects(
          storage,
          copies[0].destinationBucket,
          copiedPaths,
          cleanupContext,
        );
      }
      throw error;
    }
  }

  return {
    async getOwnedPublication(
      actor: CourseBuilderActor,
      sourceCourseId: string,
    ): Promise<OwnedCoursePublication | null> {
      const workspace = await ownedWorkspace(actor, sourceCourseId);
      return publicationForOwnedCourse(actor, workspace);
    },

    getPublicationForCourse(
      actor: CourseBuilderActor,
      course: Pick<
        CourseSummary,
        "id" | "ownerAccountId" | "publicationContentUpdatedAt"
      >,
    ) {
      return publicationForOwnedCourse(actor, course);
    },

    async enrichCoursesWithPublication<TCourse extends CourseSummary>(
      actor: CourseBuilderActor,
      courses: TCourse[],
    ): Promise<
      Array<TCourse & { publication: OwnedCoursePublication | null }>
    > {
      if (courses.length === 0) return [];
      const actorAccountId = await courseService.getActorAccountId(actor);
      if (courses.some((course) => course.ownerAccountId !== actorAccountId)) {
        throw new CoursePublicationAccessError(
          "Курс не найден или недоступен.",
        );
      }
      const records = await repository.listOwnedPublications(
        actorAccountId,
        courses.map((course) => course.id),
      );
      const byCourseId = new Map(
        records.map((record) => [record.sourceCourseId, record]),
      );
      return courses.map((course) => {
        const record = byCourseId.get(course.id);
        return {
          ...course,
          publication: record
            ? mapOwnedPublication(record, course.publicationContentUpdatedAt)
            : null,
        };
      });
    },

    async publishCourse(
      actor: CourseBuilderActor,
      sourceCourseId: string,
      rawInput: unknown,
      intent: "create" | "update",
    ): Promise<OwnedCoursePublication> {
      const actorAccountId = await courseService.getActorAccountId(actor);
      return mutationGuard.run(actorAccountId, async () => {
        await assertActivePublicationActor(actorAccountId);
        const input = parsePublicationContract(
          rightsConfirmationInputSchema,
          rawInput,
        );
        const workspace = await ownedWorkspace(actor, sourceCourseId);
        if (workspace.lessons.length === 0) {
          throw new CoursePublicationValidationError(
            "Добавьте хотя бы один урок перед публикацией курса.",
          );
        }
        validateMaterialLimits(workspace.attachments);
        const existing = await repository.getOwnedPublication(
          workspace.ownerAccountId,
          workspace.id,
        );
        if (intent === "create" && existing?.status === "published") {
          throw new CoursePublicationConflictError(
            "Курс уже опубликован. Используйте обновление публикации.",
            "publication_already_exists",
          );
        }
        if (intent === "update" && !existing) {
          throw new CoursePublicationConflictError(
            "Сначала опубликуйте курс.",
            "publication_not_created",
          );
        }
        const publicationId = existing?.publicationId ?? createId();
        const sourceAssets = await repository.listSourceAssets(
          workspace.ownerAccountId,
          workspace.id,
        );
        const snapshot = buildCoursePublicationSnapshot({
          workspace,
          sourceAssets,
          publicationId,
        });
        const contentSha256 = publicationContentSha256(snapshot);
        const revisionId = createId();

        if (existing?.contentSha256 === contentSha256) {
          const result = await repository.publishCourseRevision({
            actorAccountId: workspace.ownerAccountId,
            sourceCourseId: workspace.id,
            publicationId,
            revisionId,
            contentSha256,
            snapshot,
            assetManifest: [],
            rightsConfirmed: input.rightsConfirmed,
          });
          return mapOwnedPublication(
            result,
            workspace.publicationContentUpdatedAt,
          );
        }

        const sourceById = new Map(
          sourceAssets.map((asset) => [asset.sourceStoredFileId, asset]),
        );
        const assetManifest: PublicationAssetManifestItem[] =
          snapshot.materials.map((material) => {
            const sourceStoredFileId = [...sourceById.keys()].find(
              (sourceId) =>
                deterministicRef(publicationId, "material", sourceId) ===
                material.ref,
            );
            if (!sourceStoredFileId) {
              throw new CoursePublicationConflictError(
                "Не удалось сопоставить материал публикации.",
                "publication_asset_map_invalid",
              );
            }
            const { ref: _ref, ...metadata } = material;
            return {
              ...metadata,
              publicationAssetId: material.ref,
              sourceStoredFileId,
              storageBucket: COURSE_PUBLICATION_ASSET_BUCKET,
              storagePath: `${publicationId}/revisions/${revisionId}/assets/${material.ref}`,
            };
          });
        const copies = assetManifest.map((asset) => {
          const source = sourceById.get(asset.sourceStoredFileId)!;
          return {
            sourceBucket: source.storageBucket,
            sourcePath: source.storagePath,
            destinationBucket: asset.storageBucket,
            destinationPath: asset.storagePath,
            expectedSizeBytes: asset.sizeBytes,
            expectedMimeType: asset.mimeType,
          };
        });
        const cleanupContext: CleanupLogContext = {
          operation: "publish",
          operationId: revisionId,
        };
        const copiedPaths = await copyAssets(copies, cleanupContext);
        try {
          const result = await repository.publishCourseRevision({
            actorAccountId: workspace.ownerAccountId,
            sourceCourseId: workspace.id,
            publicationId,
            revisionId,
            contentSha256,
            snapshot,
            assetManifest,
            rightsConfirmed: input.rightsConfirmed,
          });
          if (result.currentRevisionId !== revisionId) {
            await cleanupCopiedObjects(
              storage,
              COURSE_PUBLICATION_ASSET_BUCKET,
              copiedPaths,
              cleanupContext,
            );
          }
          return mapOwnedPublication(
            result,
            workspace.publicationContentUpdatedAt,
          );
        } catch (error) {
          if (shouldCleanupAfterRepositoryError(error)) {
            await cleanupCopiedObjects(
              storage,
              COURSE_PUBLICATION_ASSET_BUCKET,
              copiedPaths,
              cleanupContext,
            );
          }
          throw error;
        }
      });
    },

    async unpublishCourse(actor: CourseBuilderActor, sourceCourseId: string) {
      const workspace = await ownedWorkspace(actor, sourceCourseId);
      const result = await repository.unpublishCourse({
        actorAccountId: workspace.ownerAccountId,
        sourceCourseId: workspace.id,
      });
      return mapOwnedPublication(result, workspace.publicationContentUpdatedAt);
    },

    async listCatalog(
      actor: CourseBuilderActor,
      query: CatalogQuery,
    ): Promise<CourseCatalogPage> {
      const actorAccountId = await courseService.getActorAccountId(actor);
      const page = await repository.listCatalog({
        actorAccountId,
        q: query.q,
        subject: query.subject,
        level: query.level,
        offset: decodeCursor(query.cursor),
        limit: query.limit,
      });
      return {
        courses: page.courses.map((course) => {
          const { publicationId, sourceCourseId, ...safe } = course;
          return {
            id: publicationId,
            sourceCourseId: safe.author.isCurrentUser ? sourceCourseId : null,
            ...safe,
          };
        }),
        facets: page.facets,
        nextCursor:
          page.nextOffset === null ? null : encodeCursor(page.nextOffset),
      };
    },

    async getCatalogDetail(
      actor: CourseBuilderActor,
      publicationId: string,
    ): Promise<CourseCatalogDetail> {
      const actorAccountId = await courseService.getActorAccountId(actor);
      await assertActivePublicationActor(actorAccountId);
      const detail = await catalogDetailRecord(publicationId);
      const materials = await Promise.all(
        detail.assets.map(async (asset) => {
          return {
            id: asset.publicationAssetId,
            originalFilename: asset.originalFilename,
            mimeType: asset.mimeType,
            sizeBytes: asset.sizeBytes,
            downloadUrl: await storage.createSignedDownload({
              bucket: asset.storageBucket,
              path: asset.storagePath,
              expiresInSeconds: 600,
            }),
          };
        }),
      );
      return {
        ...mapCatalogEntry(detail, actorAccountId),
        lessons: detail.snapshot.lessons.map((lesson) => ({
          position: lesson.position,
          title: lesson.title,
          summary: lesson.summary,
          estimatedDurationMinutes: lesson.estimatedDurationMinutes,
        })),
        materials,
      };
    },

    async copyCatalogCourse(
      actor: CourseBuilderActor,
      publicationId: string,
      rawInput: unknown = {},
    ): Promise<CopiedCourseResult> {
      const actorAccountId = await courseService.getActorAccountId(actor);
      return mutationGuard.run(actorAccountId, async () => {
        const input = parsePublicationContract(copyCourseInputSchema, rawInput);
        await assertActivePublicationActor(actorAccountId);
        const detail = await catalogDetailRecord(publicationId);
        validateMaterialLimits(detail.assets);
        const targetCourseId = createId();
        const idMap = createIdMapFromSnapshot(detail.snapshot, createId);
        const assetManifest: ClonedAssetManifestItem[] = detail.assets.map(
          (asset) => {
            const targetStoredFileId = createId();
            const extension = courseAssetExtension(asset.mimeType);
            return {
              publicationAssetId: asset.publicationAssetId,
              targetStoredFileId,
              originalFilename: asset.originalFilename,
              mimeType: asset.mimeType,
              sizeBytes: asset.sizeBytes,
              checksumSha256: asset.checksumSha256,
              storageBucket: COURSE_ASSET_BUCKET,
              storagePath: `${actorAccountId}/courses/${targetCourseId}/assets/${targetStoredFileId}/${targetStoredFileId}.${extension}`,
            };
          },
        );
        const sourceById = new Map(
          detail.assets.map((asset) => [asset.publicationAssetId, asset]),
        );
        const cleanupContext: CleanupLogContext = {
          operation: "catalog_copy",
          operationId: targetCourseId,
        };
        const copiedPaths = await copyAssets(
          assetManifest.map((asset) => {
            const source = sourceById.get(asset.publicationAssetId)!;
            return {
              sourceBucket: source.storageBucket,
              sourcePath: source.storagePath,
              destinationBucket: asset.storageBucket,
              destinationPath: asset.storagePath,
              expectedSizeBytes: asset.sizeBytes,
              expectedMimeType: asset.mimeType,
            };
          }),
          cleanupContext,
        );
        let result: { courseId: string };
        try {
          result = await repository.clonePublication({
            actorAccountId,
            publicationId: detail.publicationId,
            targetCourseId,
            targetTitle: input.title ?? null,
            idMap,
            assetManifest,
          });
        } catch (error) {
          if (shouldCleanupAfterRepositoryError(error)) {
            await cleanupCopiedObjects(
              storage,
              COURSE_ASSET_BUCKET,
              copiedPaths,
              cleanupContext,
            );
          }
          throw error;
        }
        return { courseId: result.courseId };
      });
    },

    async duplicateOwnCourse(
      actor: CourseBuilderActor,
      sourceCourseId: string,
      rawInput: unknown = {},
    ): Promise<CopiedCourseResult> {
      const input = parsePublicationContract(copyCourseInputSchema, rawInput);
      const workspace = await ownedWorkspace(actor, sourceCourseId);
      const targetCourseId = createId();
      const result = await repository.duplicateCourse({
        actorAccountId: workspace.ownerAccountId,
        sourceCourseId: workspace.id,
        targetCourseId,
        targetTitle: input.title ?? null,
        idMap: createIdMapFromWorkspace(workspace, createId),
      });
      return { courseId: result.courseId };
    },
  };
}
