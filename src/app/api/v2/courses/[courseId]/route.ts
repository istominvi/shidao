import { NextResponse } from "next/server";
import { CourseBuilderConflictError } from "@/modules/course-builder/contracts";
import {
  courseBuilderApiError,
  getCourseBuilderContext,
  readJson,
} from "@/modules/course-builder/server-context";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { courseId } = await params;
    const { actor, service, publicationService } =
      await getCourseBuilderContext();
    const course = await service.getCourse(actor, courseId);
    return NextResponse.json({
      course: {
        ...course,
        publication: await publicationService.getPublicationForCourse(
          actor,
          course,
        ),
      },
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { courseId } = await params;
    const { actor, service, publicationService } =
      await getCourseBuilderContext();
    const course = await service.updateCourse(
      actor,
      courseId,
      await readJson(request),
    );
    return NextResponse.json({
      course: {
        ...course,
        publication: await publicationService.getPublicationForCourse(
          actor,
          course,
        ),
      },
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { courseId } = await params;
    const { actor, service, publicationService } =
      await getCourseBuilderContext();
    const course = await service.getCourse(actor, courseId);
    const publication = await publicationService.getPublicationForCourse(
      actor,
      course,
    );
    if (publication?.status === "published") {
      throw new CourseBuilderConflictError(
        "Сначала снимите курс с публикации в каталоге.",
        "course_is_published",
      );
    }
    return NextResponse.json(await service.archiveCourse(actor, courseId));
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
