import {
  choiceQuizApiError,
  choiceQuizJson,
  getTeacherChoiceQuizContext,
  readChoiceQuizJson,
} from "@/modules/choice-quiz/server-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ evaluationId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { evaluationId } = await params;
    const { service } = await getTeacherChoiceQuizContext();
    return choiceQuizJson(
      await service.correctTeacherEvaluation(
        evaluationId,
        await readChoiceQuizJson(request),
      ),
    );
  } catch (error) {
    return choiceQuizApiError(error);
  }
}
