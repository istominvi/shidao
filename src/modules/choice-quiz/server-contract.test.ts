import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const submitRoute = source(
  "src/app/api/v2/me/live-runs/[lessonRunId]/activities/[issueRef]/attempts/route.ts",
);
const historyRoute = source(
  "src/app/api/v2/lesson-runs/[lessonRunId]/choice-quiz-history/route.ts",
);
const correctionRoute = source(
  "src/app/api/v2/choice-quiz-evaluations/[evaluationId]/corrections/route.ts",
);
const repository = source("src/modules/choice-quiz/repository.ts");
const service = source("src/modules/choice-quiz/service.ts");
const serverContext = source("src/modules/choice-quiz/server-context.ts");
const liveService = source("src/modules/live-delivery/service.ts");

test("choice quiz routes are thin authenticated application adapters", () => {
  assert.match(submitRoute, /getLearnerChoiceQuizContext\(\)/);
  assert.match(submitRoute, /service\.submitAttempt\(/);
  assert.match(historyRoute, /getTeacherChoiceQuizContext\(\)/);
  assert.match(historyRoute, /service\.getTeacherHistory\(lessonRunId\)/);
  assert.match(correctionRoute, /service\.correctTeacherEvaluation\(/);

  for (const route of [submitRoute, historyRoute, correctionRoute]) {
    assert.match(route, /export const dynamic = "force-dynamic"/);
    assert.match(route, /choiceQuizJson\(/);
    assert.match(route, /choiceQuizApiError\(error\)/);
    assert.doesNotMatch(
      route,
      /SUPABASE_SERVICE_ROLE_KEY|authUserId|accountId|learnerProfileId|correctOptionIds|evaluatorConfig/,
    );
  }
  assert.doesNotMatch(historyRoute, /request\.json|readChoiceQuizJson/);
});

test("learner authority and grading stay behind service-role RPCs", () => {
  assert.match(serverContext, /getLearnerLiveActor\(\)/);
  assert.match(repository, /^import "server-only";/);
  assert.match(service, /^import "server-only";/);
  assert.match(repository, /bearer: serviceRoleKey/);
  assert.match(repository, /p_auth_user_id: actor\.authUserId/);
  assert.match(repository, /p_session_id: actor\.supabaseSessionId/);
  assert.match(repository, /p_selected_option_ids: input\.selectedOptionIds/);
  assert.doesNotMatch(
    repository.slice(
      repository.indexOf("submitAttempt(actor"),
      repository.indexOf("createChoiceQuizTeacherRepository"),
    ),
    /p_(?:account|learner_profile)_id|p_(?:is_)?correct|p_score|p_evaluation/,
  );
  assert.match(
    serverContext,
    /headers\.set\("Cache-Control", "private, no-store"\)/,
  );
});

test("live projection issues before delivery and strips server-only component context", () => {
  assert.match(
    service,
    /projectLearnerComponentPayload\([\s\S]*?"choice_quiz"/,
  );
  assert.match(service, /projectComponentEvaluatorConfig\(/);
  assert.match(
    service,
    /expectedComponentUpdatedAt: input\.component\.updatedAt/,
  );
  assert.match(
    liveService,
    /await input\.choiceQuizService\.issueLiveDefinition\(/,
  );
  assert.match(liveService, /payload: issued\.learnerDefinition/);
  assert.match(liveService, /execution: issued\.execution/);
  assert.doesNotMatch(
    liveService.slice(
      liveService.indexOf("components.push({"),
      liveService.indexOf("async function projectLearnerState"),
    ),
    /primaryLearningObjectiveId:|activityRole:|id: sourceComponent\.id/,
  );
});

test("teacher history/correction authority is inferred from trusted session actor", () => {
  assert.match(serverContext, /getActiveCourseBuilderContext\(\)/);
  assert.match(serverContext, /decodeTrustedSupabaseSessionClaims\(/);
  assert.match(
    serverContext,
    /createChoiceQuizTeacherRepository\(\{[\s\S]*?authUserId: actor\.authUserId,[\s\S]*?supabaseSessionId: sessionClaims\.sessionId/,
  );
  assert.match(repository, /p_actor_auth_user_id: actor\.authUserId/);
  assert.match(repository, /p_session_id: actor\.supabaseSessionId/);
  assert.doesNotMatch(
    historyRoute,
    /actor|authUser|account|sessionId|session_id/,
  );
  assert.doesNotMatch(
    correctionRoute,
    /actor|authUser|account|sessionId|session_id/,
  );
});
