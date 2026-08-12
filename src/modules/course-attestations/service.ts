import { z } from "zod";
import {
  submitCourseAttestationSchema,
  type SubmitCourseAttestationInput,
} from "./contracts";
import type { CourseAttestationRepository } from "./repository";

const uuidSchema = z.uuid();

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
}) {
  const { repository } = dependencies;
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
  };
}
