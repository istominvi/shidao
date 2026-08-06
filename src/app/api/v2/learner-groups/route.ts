import { NextResponse } from "next/server";
import {
  courseBuilderApiError,
  readJson,
} from "@/modules/course-builder/server-context";
import { getLessonRunsContext } from "@/modules/lesson-runs/server-context";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { actor, service } = await getLessonRunsContext();
    return NextResponse.json({
      learnerGroups: await service.listLearnerGroups(actor),
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, service } = await getLessonRunsContext();
    return NextResponse.json(
      {
        learnerGroup: await service.createLearnerGroup(
          actor,
          await readJson(request),
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
