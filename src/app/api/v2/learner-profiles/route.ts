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
      learnerProfiles: await service.listLearnerProfiles(actor),
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, service } = await getLessonRunsContext();
    const learnerProfile = await service.createLearnerProfile(
      actor,
      await readJson(request),
    );
    return NextResponse.json({ learnerProfile }, { status: 201 });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
