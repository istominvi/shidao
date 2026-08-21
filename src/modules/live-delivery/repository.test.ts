import assert from "node:assert/strict";
import test from "node:test";
import {
  createLearnerLiveDeliveryRepository,
  createTeacherLiveDeliveryRepository,
  LIVE_DELIVERY_RPC,
} from "./repository";
import { LiveDeliveryRepositoryError } from "./errors";

function uuid(index: number) {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

const RUN_ID = uuid(1);
const SLIDE_ID = uuid(2);
const LEARNER_ID = uuid(3);
const AUTH_USER_ID = uuid(4);
const SESSION_ID = uuid(5);
const ASSET_ID = uuid(6);

function teacherDelivery() {
  return {
    run: { started: true, ended: false },
    cursor: { slideId: SLIDE_ID, revision: 2 },
    slides: [{ id: SLIDE_ID, position: 1, componentCount: 1 }],
    learners: [
      {
        learnerProfileId: LEARNER_ID,
        displayName: "Анна",
        identityState: "claimed",
        courseAccessEnabled: true,
        runCapabilityEnabled: true,
      },
    ],
  };
}

function configureEnvironment(t: test.TestContext) {
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const;
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  t.after(() => {
    for (const name of names) {
      const value = previous[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

test("teacher repository uses the user JWT and exact RPC arguments", async (t) => {
  configureEnvironment(t);
  const requests: Array<{
    pathname: string;
    authorization: string | null;
    apiKey: string | null;
    body: Record<string, unknown>;
  }> = [];
  const repository = createTeacherLiveDeliveryRepository("user-access-token", {
    fetcher: (async (input, init) => {
      const request = new URL(String(input));
      requests.push({
        pathname: request.pathname,
        authorization: new Headers(init?.headers).get("Authorization"),
        apiKey: new Headers(init?.headers).get("apikey"),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      if (request.pathname.endsWith(`/${LIVE_DELIVERY_RPC.setCursor}`)) {
        return Response.json({ slideId: SLIDE_ID, revision: 3 });
      }
      return Response.json(teacherDelivery());
    }) as typeof fetch,
  });

  await repository.getDelivery(RUN_ID);
  await repository.setAccess(RUN_ID, {
    learnerProfileId: LEARNER_ID,
    courseAccessEnabled: true,
    runCapabilityEnabled: true,
  });
  await repository.setCursor(RUN_ID, {
    slideId: SLIDE_ID,
    expectedRevision: 2,
  });

  assert.deepEqual(
    requests.map((request) => request.pathname.split("/").at(-1)),
    [
      LIVE_DELIVERY_RPC.getTeacherDelivery,
      LIVE_DELIVERY_RPC.setAccess,
      LIVE_DELIVERY_RPC.setCursor,
    ],
  );
  assert.ok(
    requests.every(
      (request) =>
        request.authorization === "Bearer user-access-token" &&
        request.apiKey === "anon-key",
    ),
  );
  assert.deepEqual(requests[0]!.body, { p_lesson_run_id: RUN_ID });
  assert.deepEqual(requests[1]!.body, {
    p_lesson_run_id: RUN_ID,
    p_learner_profile_id: LEARNER_ID,
    p_course_access_enabled: true,
    p_run_capability_enabled: true,
  });
  assert.deepEqual(requests[2]!.body, {
    p_lesson_run_id: RUN_ID,
    p_student_slide_id: SLIDE_ID,
    p_expected_revision: 2,
  });
  assert.doesNotMatch(
    JSON.stringify(requests.map((request) => request.body)),
    /actor|account|auth_user/i,
  );
});

test("learner resolver and private Storage reads stay behind service-role auth", async (t) => {
  configureEnvironment(t);
  const requests: Array<{
    pathname: string;
    authorization: string | null;
    apiKey: string | null;
    method: string | undefined;
    range: string | null;
    redirect: RequestRedirect | undefined;
    body: Record<string, unknown> | null;
  }> = [];
  const repository = createLearnerLiveDeliveryRepository({
    fetcher: (async (input, init) => {
      const request = new URL(String(input));
      requests.push({
        pathname: request.pathname,
        authorization: new Headers(init?.headers).get("Authorization"),
        apiKey: new Headers(init?.headers).get("apikey"),
        method: init?.method,
        range: new Headers(init?.headers).get("Range"),
        redirect: init?.redirect,
        body: init?.body
          ? (JSON.parse(String(init.body)) as Record<string, unknown>)
          : null,
      });
      if (request.pathname.includes("/storage/v1/object/authenticated/")) {
        return new Response("test", {
          status: 206,
          headers: {
            "Content-Length": "4",
            "Content-Range": "bytes 0-3/42",
          },
        });
      }
      return Response.json({ state: "waiting", cursorRevision: 0 });
    }) as typeof fetch,
  });

  assert.deepEqual(
    await repository.resolveSource(
      { authUserId: AUTH_USER_ID, supabaseSessionId: SESSION_ID },
      RUN_ID,
    ),
    { state: "waiting", cursorRevision: 0 },
  );
  const asset = await repository.fetchAsset(
    {
      id: ASSET_ID,
      storageBucket: "course-assets",
      storagePath: "path/image.webp",
      originalFilename: "private-name.webp",
      mimeType: "image/webp",
      sizeBytes: 42,
    },
    { range: "bytes=0-3" },
  );
  assert.equal(await new Response(asset.body).text(), "test");
  assert.deepEqual(
    {
      status: asset.status,
      contentLength: asset.contentLength,
      contentRange: asset.contentRange,
    },
    { status: 206, contentLength: 4, contentRange: "bytes 0-3/42" },
  );
  assert.ok(
    requests.every(
      (request) =>
        request.authorization === "Bearer service-role-key" &&
        request.apiKey === "service-role-key",
    ),
  );
  assert.deepEqual(requests[0]!.body, {
    p_auth_user_id: AUTH_USER_ID,
    p_session_id: SESSION_ID,
    p_lesson_run_id: RUN_ID,
  });
  assert.equal(
    requests[1]!.pathname,
    "/storage/v1/object/authenticated/course-assets/path/image.webp",
  );
  assert.equal(requests[1]!.method, "GET");
  assert.equal(requests[1]!.range, "bytes=0-3");
  assert.equal(requests[1]!.redirect, "error");
  assert.equal(requests[1]!.body, null);
  assert.doesNotMatch(JSON.stringify(requests), /signedURL|object\/sign/);
});

async function teacherCursorError(payload: unknown, status = 400) {
  const repository = createTeacherLiveDeliveryRepository("user-token", {
    fetcher: (async () => Response.json(payload, { status })) as typeof fetch,
  });
  let caught: unknown;
  try {
    await repository.setCursor(RUN_ID, {
      slideId: SLIDE_ID,
      expectedRevision: 1,
    });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof LiveDeliveryRepositoryError);
  return caught;
}

test("cursor CAS conflicts map deterministically to 409", async (t) => {
  configureEnvironment(t);
  const error = await teacherCursorError({
    code: "40001",
    message: "live_delivery_cursor_stale",
  });
  assert.equal(error.status, 409);
  assert.equal(error.code, "live_delivery_cursor_conflict");
  assert.doesNotMatch(error.message, /live_delivery_cursor_stale/);
});

test("closed Run and ineligible learner states map to bounded validation errors", async (t) => {
  configureEnvironment(t);
  for (const message of [
    "lesson_run_live_not_open",
    "lesson_run_live_learner_not_eligible",
  ]) {
    const error = await teacherCursorError({ code: "55000", message }, 500);
    assert.equal(error.status, 400);
    assert.equal(error.code, "live_delivery_validation_error");
    assert.doesNotMatch(error.message, /lesson_run|learner/);
  }
});

test("transient upstream timeout and rate-limit responses remain retryable", async (t) => {
  configureEnvironment(t);
  for (const status of [408, 425, 429]) {
    const error = await teacherCursorError({}, status);
    assert.equal(error.status, 503);
    assert.equal(error.code, "live_delivery_repository_error");
  }
});

test("capability denial is generic 404 while trusted session revocation is 401", async (t) => {
  configureEnvironment(t);
  const denied = await teacherCursorError(
    { code: "P0002", message: "lesson_run_live_not_found" },
    404,
  );
  assert.equal(denied.status, 404);
  assert.equal(denied.code, "live_delivery_not_found");

  const revoked = await teacherCursorError(
    { code: "42501", message: "live_delivery_session_revoked" },
    403,
  );
  assert.equal(revoked.status, 401);
  assert.equal(revoked.code, "live_delivery_session_revoked");
});
