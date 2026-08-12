import { NextResponse } from "next/server";
import { CourseConsumptionApplicationError } from "./service";
import { CourseConsumptionRepositoryError } from "./repository";
import { courseBuilderApiError } from "@/modules/course-builder/server-context";

export async function courseConsumptionApiError(error: unknown) {
  if (error instanceof CourseConsumptionApplicationError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  if (error instanceof CourseConsumptionRepositoryError) {
    const stale =
      error.databaseCode === "40001" ||
      error.message.includes("course_publication_progress_revision_stale");
    const unavailable =
      error.status >= 500 ||
      error.message.endsWith("_response_invalid") ||
      error.databaseCode === "course_consumption_network_error";
    return NextResponse.json(
      {
        error: stale
          ? "Курс обновился. Перезагрузите страницу и повторите действие."
          : unavailable
            ? "Не удалось загрузить или сохранить прогресс курса."
            : "Курс недоступен для обучения.",
        code: stale
          ? "course_progress_revision_stale"
          : unavailable
            ? "course_progress_unavailable"
            : "course_progress_not_found",
      },
      { status: stale ? 409 : unavailable ? 503 : 404 },
    );
  }
  return courseBuilderApiError(error);
}
