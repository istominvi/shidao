import { NextResponse } from "next/server";
import { courseBuilderApiError } from "@/modules/course-builder/server-context";
import { getLessonRunsContext } from "@/modules/lesson-runs/server-context";
import { createLearningActivitiesServiceForActor } from "@/modules/learning-activities/server-context";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ lessonId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { lessonId } = await params;
    const { actor, service } = await getLessonRunsContext();
    const runs = await service.listLessonHistory(actor, lessonId);
    return NextResponse.json({
      runs,
      observations: await createLearningActivitiesServiceForActor(
        actor,
      ).listHistoryObservations(
        actor,
        runs.flatMap((run) => run.records.map((record) => record.id)),
      ),
    });
  } catch (error) {
    return courseBuilderApiError(error);
  }
}
