import {
  choiceQuizApiError,
  choiceQuizJson,
  getTeacherChoiceQuizContext,
} from "@/modules/choice-quiz/server-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ lessonRunId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { lessonRunId } = await params;
    const { service } = await getTeacherChoiceQuizContext();
    return choiceQuizJson(await service.getTeacherHistory(lessonRunId));
  } catch (error) {
    return choiceQuizApiError(error);
  }
}
