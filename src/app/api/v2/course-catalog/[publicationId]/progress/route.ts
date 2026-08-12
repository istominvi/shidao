import { NextResponse } from "next/server";
import { getCourseConsumptionContext } from "@/modules/course-builder/server-context";
import { courseConsumptionApiError } from "@/modules/course-consumption/server-context";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ publicationId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { publicationId } = await params;
    const { consumptionService } = await getCourseConsumptionContext();
    return NextResponse.json({
      progress: await consumptionService.getProgress(publicationId),
    });
  } catch (error) {
    return courseConsumptionApiError(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { publicationId } = await params;
    const { consumptionService } = await getCourseConsumptionContext();
    const input = await request.json().catch(() => {
      throw new Error("invalid_json");
    });
    return NextResponse.json({
      progress: await consumptionService.setLessonProgress(
        publicationId,
        input,
      ),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_json") {
      return NextResponse.json(
        { error: "Ожидался JSON body.", code: "validation_error" },
        { status: 400 },
      );
    }
    return courseConsumptionApiError(error);
  }
}
