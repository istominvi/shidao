import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const teacherRoute = source(
  "src/app/api/v2/lesson-runs/[lessonRunId]/live-delivery/route.ts",
);
const accessRoute = source(
  "src/app/api/v2/lesson-runs/[lessonRunId]/live-delivery/access/route.ts",
);
const cursorRoute = source(
  "src/app/api/v2/lesson-runs/[lessonRunId]/live-delivery/cursor/route.ts",
);
const learnerRoute = source(
  "src/app/api/v2/me/live-runs/[lessonRunId]/route.ts",
);
const learnerAssetRoute = source(
  "src/app/api/v2/me/live-runs/[lessonRunId]/assets/[assetRef]/route.ts",
);
const repository = source("src/modules/live-delivery/repository.ts");
const service = source("src/modules/live-delivery/service.ts");
const serverContext = source("src/modules/live-delivery/server-context.ts");

test("live delivery routes are thin application-service adapters", () => {
  assert.match(teacherRoute, /service\.getTeacherDelivery\(lessonRunId\)/);
  assert.match(accessRoute, /service\.setTeacherAccess\(/);
  assert.match(cursorRoute, /service\.setTeacherCursor\(/);
  assert.match(learnerRoute, /service\.getLearnerState\(actor, lessonRunId\)/);
  assert.match(learnerAssetRoute, /service\.getLearnerAsset\(/);
  for (const route of [teacherRoute, accessRoute, cursorRoute, learnerRoute]) {
    assert.match(route, /export const dynamic = "force-dynamic"/);
    assert.match(route, /liveDeliveryJson\(/);
    assert.match(route, /liveDeliveryApiError\(error\)/);
    assert.doesNotMatch(
      route,
      /\/rest\/v1|SUPABASE_SERVICE_ROLE_KEY|accountId|learnerProfileId/,
    );
  }
  assert.match(learnerAssetRoute, /export const dynamic = "force-dynamic"/);
  assert.match(learnerAssetRoute, /liveDeliveryAssetResponse\(/);
  assert.match(learnerAssetRoute, /liveDeliveryAssetError\(error\)/);
  assert.match(learnerAssetRoute, /request\.headers\.get\("range"\)/);
  assert.doesNotMatch(
    learnerAssetRoute,
    /SUPABASE_SERVICE_ROLE_KEY|storagePath|accountId|learnerProfileId|request\.json/,
  );
  assert.doesNotMatch(learnerRoute, /request\.json|readLiveDeliveryJson/);
  assert.match(
    serverContext,
    /headers\.set\("Cache-Control", "private, no-store"\)/,
  );
  assert.equal(serverContext.match(/NextResponse\.json\(/g)?.length, 1);
});

test("learner assets are opaque same-origin streams, never browser signed URLs", () => {
  assert.match(
    repository,
    /\/storage\/v1\/object\/authenticated\/\$\{objectPath\}/,
  );
  assert.match(repository, /redirect: "error"/);
  assert.match(service, /\/api\/v2\/me\/live-runs\//);
  assert.match(service, /source\.cursorRevision !== revision/);
  assert.match(service, /projectActiveSource\(source\)/);
  assert.doesNotMatch(
    `${repository}\n${service}`,
    /createAssetSignedUrl|signedURL|\/object\/sign\//,
  );
});

test("learner authority comes from encrypted session JWT claims, never request input", () => {
  assert.match(serverContext, /requireSupabaseUserSession\(\)/);
  assert.match(serverContext, /candidate\.session_id/);
  assert.match(serverContext, /claims\.authUserId !== session\.uid/);
  assert.match(repository, /p_auth_user_id: actor\.authUserId/);
  assert.match(repository, /p_session_id: actor\.supabaseSessionId/);
  assert.match(repository, /^import "server-only";/);
  assert.doesNotMatch(serverContext, /user_metadata/);
});

test("learner projection uses the registry and excludes private activity fields", () => {
  assert.match(service, /projectLearnerComponentPayload\(/);
  assert.match(
    service,
    /definition\.activityFacet\.learnerDeliverySchema\.parse/,
  );
  assert.match(service, /parseComponentPlacement\(/);
  assert.doesNotMatch(
    service,
    /projectComponentEvaluatorConfig|primaryLearningObjectiveId|teacherReport|summary/,
  );
});

test("browser-authorized teacher RPCs never accept an Account authority id", () => {
  for (const rpc of [
    "get_lesson_run_live_delivery_admin",
    "set_lesson_run_live_access",
    "set_lesson_run_presentation_cursor",
    "resolve_lesson_run_live_source_admin",
  ]) {
    assert.match(repository, new RegExp(`"${rpc}"`));
  }
  const teacherBoundary = repository.slice(
    repository.indexOf("createTeacherLiveDeliveryRepository"),
    repository.indexOf("function requireServiceRoleKey"),
  );
  assert.match(teacherBoundary, /bearer: accessToken/);
  assert.match(repository, /Authorization: `Bearer \$\{input\.bearer\}`/);
  assert.doesNotMatch(
    teacherBoundary,
    /p_(?:actor_)?(?:account|auth_user|learner_account)_id/,
  );
});
