import {
  choiceQuizApiError,
  choiceQuizJson,
  getLearnerChoiceQuizContext,
  readChoiceQuizJson,
} from "@/modules/choice-quiz/server-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ lessonRunId: string; issueRef: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { lessonRunId, issueRef } = await params;
    const { actor, service } = await getLearnerChoiceQuizContext();
    return choiceQuizJson({
      ...(await service.submitAttempt(
        actor,
        lessonRunId,
        issueRef,
        await readChoiceQuizJson(request),
      )),
    });
  } catch (error) {
    return choiceQuizApiError(error);
  }
}
