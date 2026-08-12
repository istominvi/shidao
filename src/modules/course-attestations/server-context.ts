import { NextResponse } from "next/server";
import {
  getActiveCourseBuilderContext,
  courseBuilderApiError,
} from "@/modules/course-builder/server-context";
import { CourseAttestationApplicationError } from "./service";
import {
  CourseAttestationRepositoryError,
  createCourseAttestationRepository,
} from "./repository";
import { createCourseAttestationService } from "./service";

export async function getCourseAttestationContext() {
  const { actor, service: courseService } =
    await getActiveCourseBuilderContext();
  return {
    service: createCourseAttestationService({
      repository: createCourseAttestationRepository(actor.accessToken),
      requireAuthoredEducatorCourse: async (courseId) => {
        if (actor.canAuthorEducatorCourses !== true) {
          throw new CourseAttestationApplicationError(
            "Редактирование аттестации недоступно этому аккаунту.",
            "educator_course_authoring_denied",
            403,
          );
        }
        const course = await courseService.getCourse(actor, courseId);
        if (course.learningAudience !== "educators") {
          throw new CourseAttestationApplicationError(
            "Аттестация доступна только для курса обучения педагогов.",
            "educator_course_required",
            404,
          );
        }
      },
    }),
  };
}

export async function courseAttestationApiError(error: unknown) {
  if (error instanceof CourseAttestationApplicationError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  if (error instanceof CourseAttestationRepositoryError) {
    const authoringDenied =
      error.databaseCode === "42501" &&
      error.message.includes("educator_course_authoring_not_allowed");
    const rateLimited =
      error.databaseCode === "P0004" ||
      error.message.includes("course_attestation_attempt_rate_limited");
    const notFound =
      error.databaseCode === "P0002" ||
      error.message.includes("course_attestation_not_found");
    const invalid =
      error.databaseCode === "22023" ||
      error.message.includes("course_attestation_answers_invalid");
    const stale =
      error.databaseCode === "40001" ||
      error.message.includes("course_attestation_revision_stale");
    const lessonsIncomplete = error.message.includes(
      "course_attestation_lessons_incomplete",
    );
    const status = authoringDenied
      ? 403
      : rateLimited
        ? 429
        : notFound
          ? 404
          : invalid
            ? 400
            : stale
              ? 409
              : lessonsIncomplete
                ? 409
                : 503;
    return NextResponse.json(
      {
        error: authoringDenied
          ? "Редактирование аттестации недоступно этому аккаунту."
          : rateLimited
            ? "Слишком много попыток аттестации. Попробуйте снова через 15 минут."
            : notFound
              ? "Аттестация курса не найдена или недоступна."
              : invalid
                ? "Ответьте на все вопросы аттестации."
                : stale
                  ? "Курс обновлён, загрузите аттестацию заново."
                  : lessonsIncomplete
                    ? "Завершите все уроки курса перед аттестацией."
                    : "Сервис аттестации временно недоступен.",
        code: authoringDenied
          ? "educator_course_authoring_denied"
          : rateLimited
            ? "attestation_attempt_rate_limited"
            : notFound
              ? "attestation_not_found"
              : invalid
                ? "attestation_answers_invalid"
                : stale
                  ? "attestation_revision_stale"
                  : lessonsIncomplete
                    ? "attestation_lessons_incomplete"
                    : "attestation_unavailable",
      },
      {
        status,
        headers: rateLimited ? { "Retry-After": "900" } : undefined,
      },
    );
  }
  return courseBuilderApiError(error);
}
