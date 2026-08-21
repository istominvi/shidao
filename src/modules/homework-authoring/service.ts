import type { ZodType } from "zod";
import {
  CourseBuilderConflictError,
  CourseBuilderValidationError,
} from "@/modules/course-builder/contracts";
import type {
  CourseBuilderActor,
  CourseWorkspace,
} from "@/modules/course-builder/domain";
import { CourseBuilderRepositoryError } from "@/modules/course-builder/repository";
import type { CourseBuilderApplicationService } from "@/modules/course-builder/service";
import {
  getComponentDefinition,
  type ComponentTypeKey,
} from "@/modules/course-builder/registry/contracts";
import { extractComponentStoredFileReferences } from "@/modules/course-builder/registry/stored-file-references";
import { postgresUuidSchema } from "@/lib/postgres-uuid";
import {
  clearLessonHomeworkInputSchema,
  homeworkItemTypeKeys,
  replaceLessonHomeworkInputSchema,
} from "./contracts";
import type { LessonHomeworkDraftItem } from "./domain";
import type { HomeworkAuthoringRepository } from "./repository";

type Dependencies = {
  repository: HomeworkAuthoringRepository;
  courseService: Pick<CourseBuilderApplicationService, "getCourse">;
};

function parseInput<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new CourseBuilderValidationError(
    parsed.error.issues[0]?.message ??
      "Проверьте домашнее задание и попробуйте снова.",
  );
}

function parseLessonId(value: unknown) {
  return parseInput(postgresUuidSchema, value);
}

function validateItems(items: LessonHomeworkDraftItem[]) {
  return items.map((item): LessonHomeworkDraftItem => {
    const definition = getComponentDefinition(item.typeKey as ComponentTypeKey);
    if (
      !homeworkItemTypeKeys.includes(
        definition.key as (typeof homeworkItemTypeKeys)[number],
      ) ||
      definition.activityFacet ||
      item.schemaVersion !== definition.version
    ) {
      throw new CourseBuilderValidationError(
        "Этот тип пункта недоступен в домашнем задании.",
      );
    }
    const payload = parseInput(
      definition.payloadSchema as ZodType<Record<string, unknown>>,
      item.payload,
    );
    const placement = parseInput(
      definition.placementSchema as ZodType<Record<string, unknown>>,
      item.placement,
    );
    return { ...item, payload, placement };
  });
}

function assertAttachedAssets(
  workspace: CourseWorkspace,
  items: LessonHomeworkDraftItem[],
) {
  const readyById = new Map(
    workspace.attachments.map((asset) => [asset.id, asset]),
  );
  for (const item of items) {
    for (const assetId of extractComponentStoredFileReferences(
      item.typeKey,
      item.payload,
    )) {
      const asset = readyById.get(assetId);
      if (!asset || asset.status !== "ready") {
        throw new CourseBuilderValidationError(
          "Пункт может ссылаться только на готовый материал этого курса.",
        );
      }
      if (item.typeKey === "image" && !asset.mimeType.startsWith("image/")) {
        throw new CourseBuilderValidationError(
          "Для изображения выберите графический материал курса.",
        );
      }
    }
  }
}

export function createHomeworkAuthoringService(dependencies: Dependencies) {
  const { repository, courseService } = dependencies;

  async function scopeWithCourse(actor: CourseBuilderActor, lessonId: string) {
    const scope = await repository.getScope(lessonId);
    const course = await courseService.getCourse(actor, scope.courseId);
    return { scope, course };
  }

  return {
    async get(actor: CourseBuilderActor, lessonIdValue: unknown) {
      const lessonId = parseLessonId(lessonIdValue);
      return (await scopeWithCourse(actor, lessonId)).scope.homework;
    },

    async replace(
      actor: CourseBuilderActor,
      lessonIdValue: unknown,
      rawInput: unknown,
    ) {
      const lessonId = parseLessonId(lessonIdValue);
      const input = parseInput(replaceLessonHomeworkInputSchema, rawInput);
      const items = validateItems(input.items);
      const { course } = await scopeWithCourse(actor, lessonId);
      assertAttachedAssets(course, items);
      try {
        return (
          await repository.replace({
            lessonId,
            expectedRevision: input.expectedRevision,
            items,
          })
        ).homework;
      } catch (error) {
        if (
          error instanceof CourseBuilderRepositoryError &&
          error.code === "homework_revision_conflict"
        ) {
          throw new CourseBuilderConflictError(
            "Домашнее задание уже изменено в другой вкладке. Перезагрузите актуальную версию.",
            "homework_revision_conflict",
          );
        }
        throw error;
      }
    },

    async clear(
      actor: CourseBuilderActor,
      lessonIdValue: unknown,
      rawInput: unknown,
    ) {
      const lessonId = parseLessonId(lessonIdValue);
      const input = parseInput(clearLessonHomeworkInputSchema, rawInput);
      await scopeWithCourse(actor, lessonId);
      try {
        const scope = await repository.replace({
          lessonId,
          expectedRevision: input.expectedRevision,
          items: [],
        });
        if (!scope.homework || scope.homework.items.length !== 0) {
          throw new Error("Homework clear returned an invalid aggregate.");
        }
        return scope.homework;
      } catch (error) {
        if (
          error instanceof CourseBuilderRepositoryError &&
          error.code === "homework_revision_conflict"
        ) {
          throw new CourseBuilderConflictError(
            "Домашнее задание уже изменено в другой вкладке. Перезагрузите актуальную версию.",
            "homework_revision_conflict",
          );
        }
        throw error;
      }
    },
  };
}

export type HomeworkAuthoringApplicationService = ReturnType<
  typeof createHomeworkAuthoringService
>;
