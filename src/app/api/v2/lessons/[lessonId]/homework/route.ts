import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  readJson,
} from "@/modules/course-builder/server-context";
import { getHomeworkAuthoringContext } from "@/modules/homework-authoring/server-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ lessonId: string }> };

function homeworkJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(body, { ...init, headers });
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { lessonId } = await params;
    const { actor, service } = await getHomeworkAuthoringContext();
    return homeworkJson({ homework: await service.get(actor, lessonId) });
  } catch (error) {
    const response = await courseBuilderApiError(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { lessonId } = await params;
    const { actor, service } = await getHomeworkAuthoringContext();
    const homework = await service.replace(
      actor,
      lessonId,
      await readJson(request),
    );
    return homeworkJson({ homework });
  } catch (error) {
    const response = await courseBuilderApiError(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { lessonId } = await params;
    const { actor, service } = await getHomeworkAuthoringContext();
    return homeworkJson({
      homework: await service.clear(actor, lessonId, await readJson(request)),
    });
  } catch (error) {
    const response = await courseBuilderApiError(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
