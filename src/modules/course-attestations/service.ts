import { postgresUuidSchema } from "@/lib/postgres-uuid";
import {
  submitCourseAttestationSchema,
  replaceCourseAttestationDefinitionInputSchema,
  type SubmitCourseAttestationInput,
} from "./contracts";
import type { CourseAttestationRepository } from "./repository";

const uuidSchema = postgresUuidSchema;

export class CourseAttestationApplicationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CourseAttestationApplicationError";
  }
}

function parsePublicationId(value: string) {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new CourseAttestationApplicationError(
      "Некорректный идентификатор курса.",
      "validation_error",
      400,
    );
  }
  return parsed.data;
}

function parseSubmission(value: unknown): SubmitCourseAttestationInput {
  const parsed = submitCourseAttestationSchema.safeParse(value);
  if (!parsed.success) {
    throw new CourseAttestationApplicationError(
      parsed.error.issues[0]?.message ?? "Проверьте ответы аттестации.",
      "validation_error",
      400,
    );
  }
  return parsed.data;
}

export function createCourseAttestationService(dependencies: {
  repository: CourseAttestationRepository;
  requireAuthoredEducatorCourse?: (courseId: string) => Promise<void>;
}) {
  const { repository, requireAuthoredEducatorCourse } = dependencies;

  async function authorizeCourseAuthor(courseId: string) {
    if (!requireAuthoredEducatorCourse) {
      throw new CourseAttestationApplicationError(
        "Редактирование аттестации недоступно.",
        "educator_course_authoring_denied",
        403,
      );
    }
    await requireAuthoredEducatorCourse(courseId);
  }

  return {
    getPublicationAttestation(publicationId: string) {
      return repository.getPublicationAttestation(
        parsePublicationId(publicationId),
      );
    },

    submitPublicationAttestation(publicationId: string, rawInput: unknown) {
      const input = parseSubmission(rawInput);
      return repository.submitPublicationAttestation(
        parsePublicationId(publicationId),
        input.expectedRevisionId,
        input.selectedOptionByQuestionId,
      );
    },

    listAccountAttestations() {
      return repository.listAccountAttestations();
    },

    async getAuthoredCourseAttestation(courseIdValue: string) {
      const courseId = parsePublicationId(courseIdValue);
      await authorizeCourseAuthor(courseId);
      return repository.getAuthoredCourseAttestation(courseId);
    },

    async replaceAuthoredCourseAttestation(
      courseIdValue: string,
      rawInput: unknown,
    ) {
      const courseId = parsePublicationId(courseIdValue);
      await authorizeCourseAuthor(courseId);
      const parsed =
        replaceCourseAttestationDefinitionInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new CourseAttestationApplicationError(
          parsed.error.issues[0]?.message ?? "Проверьте настройки аттестации.",
          "validation_error",
          400,
        );
      }
      return repository.replaceAuthoredCourseAttestation(courseId, parsed.data);
    },
  };
}
