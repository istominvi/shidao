import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeTrustedSupabaseSessionClaims,
  liveDeliveryApiError,
  liveDeliveryAssetError,
  liveDeliveryAssetResponse,
  liveDeliveryJson,
} from "./server-context";
import {
  LiveDeliveryAssetNotFoundError,
  LiveDeliveryAssetRangeError,
  LiveDeliveryProjectionError,
} from "./errors";
import {
  ChoiceQuizProjectionError,
  ChoiceQuizRepositoryError,
} from "@/modules/choice-quiz/errors";

function uuid(index: number) {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

function jwt(payload: unknown) {
  return [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "signature",
  ].join(".");
}

test("trusted learner context extracts only Supabase sub and session_id claims", () => {
  assert.deepEqual(
    decodeTrustedSupabaseSessionClaims(
      jwt({
        sub: uuid(1),
        session_id: uuid(2),
        user_metadata: { role: "admin" },
        account_id: uuid(3),
        learner_profile_id: uuid(4),
      }),
    ),
    { authUserId: uuid(1), sessionId: uuid(2) },
  );
});

test("trusted learner context fails closed without both canonical JWT claims", () => {
  for (const token of [
    "not-a-jwt",
    jwt({ sub: uuid(1) }),
    jwt({ session_id: uuid(2) }),
    jwt({ sub: "learner-from-browser", session_id: uuid(2) }),
  ]) {
    assert.equal(decodeTrustedSupabaseSessionClaims(token), null);
  }
});

test("every live response helper is private and uncacheable", async () => {
  const response = liveDeliveryJson({ state: { kind: "ended" } });
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(await response.json(), { state: { kind: "ended" } });
});

test("opaque asset responses stream only filtered safe headers", async () => {
  const response = liveDeliveryAssetResponse({
    body: new Response("abc").body!,
    status: 206,
    contentLength: 3,
    contentRange: "bytes 0-2/12",
    mimeType: "text/plain",
  });
  assert.equal(response.status, 206);
  assert.equal(await response.text(), "abc");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("Content-Range"), "bytes 0-2/12");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(
    response.headers.get("Cross-Origin-Resource-Policy"),
    "same-origin",
  );
  assert.match(
    response.headers.get("Content-Security-Policy") ?? "",
    /sandbox/,
  );
  assert.equal(
    response.headers.get("Content-Disposition"),
    'attachment; filename="live-material.txt"',
  );
  assert.equal(response.headers.get("Location"), null);
});

test("opaque asset errors retain security headers and expose no redirect", async () => {
  for (const [error, status] of [
    [new LiveDeliveryAssetNotFoundError(), 404],
    [new LiveDeliveryAssetRangeError(42), 416],
    [new LiveDeliveryProjectionError(), 503],
  ] as const) {
    const response = await liveDeliveryAssetError(error);
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(
      response.headers.get("Cross-Origin-Resource-Policy"),
      "same-origin",
    );
    assert.match(
      response.headers.get("Content-Security-Policy") ?? "",
      /default-src 'none'/,
    );
    assert.equal(response.headers.get("Location"), null);
  }
});

test("issued quiz failures keep live polling fail-closed and retryable", async () => {
  for (const [error, status, code] of [
    [
      new ChoiceQuizRepositoryError(
        "stale internal source",
        409,
        "choice_quiz_state_conflict",
      ),
      409,
      "live_delivery_cursor_conflict",
    ],
    [
      new ChoiceQuizRepositoryError(
        "private missing details",
        404,
        "choice_quiz_not_found",
      ),
      404,
      "live_delivery_not_found",
    ],
    [new ChoiceQuizProjectionError(), 503, "choice_quiz_projection_error"],
  ] as const) {
    const response = await liveDeliveryApiError(error);
    assert.equal(response.status, status);
    const body = (await response.json()) as { code: string; error: string };
    assert.equal(body.code, code);
    assert.doesNotMatch(body.error, /internal|private|source/i);
  }
});
