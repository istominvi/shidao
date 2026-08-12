import { postgresUuidSchema } from "@/lib/postgres-uuid";
import { updateCoursePublicationProgressSchema } from "./contracts";
import type { CourseConsumptionRepository } from "./repository";

export class CourseConsumptionApplicationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CourseConsumptionApplicationError";
  }
}

function publicationId(value: string) {
  const parsed = postgresUuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new CourseConsumptionApplicationError(
      "Некорректный идентификатор курса.",
      "validation_error",
      400,
    );
  }
  return parsed.data;
}

export function createCourseConsumptionService(dependencies: {
  repository: CourseConsumptionRepository;
}) {
  const { repository } = dependencies;
  return {
    getProgress(publicationIdValue: string) {
      return repository.getProgress(publicationId(publicationIdValue));
    },

    setLessonProgress(publicationIdValue: string, rawInput: unknown) {
      const input = updateCoursePublicationProgressSchema.safeParse(rawInput);
      if (!input.success) {
        throw new CourseConsumptionApplicationError(
          input.error.issues[0]?.message ?? "Проверьте данные прогресса.",
          "validation_error",
          400,
        );
      }
      return repository.setLessonProgress({
        publicationId: publicationId(publicationIdValue),
        ...input.data,
      });
    },
  };
}
