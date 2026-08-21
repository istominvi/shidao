import { NextResponse } from "next/server";
import {
  CourseBuilderAccessError,
  CourseBuilderConflictError,
  CourseBuilderValidationError,
} from "@/modules/course-builder/contracts";
import type { CourseBuilderActor } from "@/modules/course-builder/domain";
import {
  CourseBuilderRepositoryError,
  createCourseBuilderRepository,
} from "@/modules/course-builder/repository";
import {
  courseBuilderApiError,
  getActiveCourseBuilderContext,
} from "@/modules/course-builder/server-context";
import { createCourseBuilderService } from "@/modules/course-builder/service";
import { createLessonRunsServiceForActor } from "@/modules/lesson-runs/server-context";
import { createLearningActivitiesRepository } from "./repository";
import { createLearningActivitiesService } from "./service";

export function createLearningActivitiesServiceForActor(
  actor: CourseBuilderActor,
) {
  return createLearningActivitiesService({
    repository: createLearningActivitiesRepository(actor.accessToken),
    courseBuilderService: createCourseBuilderService({
      repository: createCourseBuilderRepository(actor.accessToken),
    }),
    lessonRunsService: createLessonRunsServiceForActor(actor),
  });
}

export async function getLearningActivitiesContext() {
  const { actor } = await getActiveCourseBuilderContext();
  return {
    actor,
    service: createLearningActivitiesServiceForActor(actor),
  };
}

export async function learningActivityProfileApiError(error: unknown) {
  if (error instanceof CourseBuilderValidationError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 400 },
    );
  }
  if (error instanceof CourseBuilderConflictError) {
    return NextResponse.json(
      {
        error:
          "Учебный профиль уже изменился. Обновите данные и повторите действие.",
        code: "learning_activity_profile_conflict",
      },
      { status: 409 },
    );
  }
  if (
    error instanceof CourseBuilderAccessError ||
    (error instanceof CourseBuilderRepositoryError &&
      [403, 404].includes(error.status))
  ) {
    return NextResponse.json(
      {
        error: "Учебный профиль не найден или недоступен.",
        code: "learning_activity_profile_not_found",
      },
      { status: 404 },
    );
  }
  if (error instanceof CourseBuilderRepositoryError && error.status === 401) {
    await courseBuilderApiError(error);
    return NextResponse.json(
      {
        error: "Войдите снова, чтобы продолжить работу с учебным профилем.",
        code: "learning_activity_profile_reauthentication_required",
        loginRequired: true,
      },
      { status: 401 },
    );
  }

  const sessionResponse = await courseBuilderApiError(error);
  if (sessionResponse.status === 401) {
    return NextResponse.json(
      {
        error: "Войдите снова, чтобы продолжить работу с учебным профилем.",
        code: "learning_activity_profile_reauthentication_required",
        loginRequired: true,
      },
      { status: 401 },
    );
  }
  return NextResponse.json(
    {
      error: "Учебный профиль временно недоступен.",
      code: "learning_activity_profile_unavailable",
    },
    { status: 503 },
  );
}
