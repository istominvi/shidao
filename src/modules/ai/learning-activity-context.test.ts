import assert from "node:assert/strict";
import test from "node:test";
import {
  learningActivityAiContextSchema,
  learningActivityContextProvider,
} from "./learning-activity-context";

const API_URL = "https://shidao-test.supabase.co";
const ANON_KEY = "test-anon-key";
const SERVICE_ROLE_KEY = "test-service-role-key";
const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COURSE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STATE_KEY = `las_${"1".repeat(64)}`;
const EVIDENCE_KEY = `lae_${"2".repeat(64)}`;

function projection() {
  return {
    used: true,
    revision: "a".repeat(64),
    projectionVersion: 1 as const,
    summary: {
      totalStateCount: 1,
      includedStateCount: 1,
      formingCount: 1,
      confirmedCount: 0,
      recheckDueCount: 0,
      evidenceReferenceCount: 1,
      truncated: false,
    },
    states: [
      {
        key: STATE_KEY,
        courseTitle: "Русский язык",
        subject: "Русский язык",
        objectiveTitle: "Приветствует собеседника",
        state: "forming" as const,
        reasonCode: "independent_opportunities_missing" as const,
        reasonText: "Есть одна самостоятельная попытка; нужна ещё одна.",
        evaluatedAt: "2026-08-20T12:00:00.000Z",
        lastEvidenceAt: "2026-08-20T11:00:00.000Z",
        freshnessDueAt: null,
        evidenceReferences: [
          {
            key: EVIDENCE_KEY,
            direction: "positive" as const,
            support: "independent" as const,
            observedAt: "2026-08-20T11:00:00.000Z",
            evidenceAt: "2026-08-20T11:01:00.000Z",
            courseTitle: "Русский язык",
            lessonTitle: "Знакомство",
            componentLabel: "Диалог-приветствие",
            objectiveTitle: "Приветствует собеседника",
            criterion: "Начинает диалог без подсказки",
          },
        ],
        recommendation: {
          type: "apply_in_new_context" as const,
          reasonCode:
            "apply_in_new_context_after_one_independent_opportunity" as const,
          reasonText: "Попробуйте применить навык в другой ситуации.",
          source: "rule" as const,
          generatedAt: "2026-08-20T12:00:00.000Z",
          evidenceReferenceKeys: [EVIDENCE_KEY],
        },
      },
    ],
  };
}

function snakeCaseProjection(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(snakeCaseProjection);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`),
      snakeCaseProjection(nested),
    ]),
  );
}

test("learning-activity provider uses the bounded service-role RPC", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousFetch = globalThis.fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
  globalThis.fetch = (async (input, init) => {
    assert.equal(
      input,
      `${API_URL}/rest/v1/rpc/build_course_learning_activity_context`,
    );
    assert.equal(init?.method, "POST");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("apikey"), SERVICE_ROLE_KEY);
    assert.equal(headers.get("authorization"), `Bearer ${SERVICE_ROLE_KEY}`);
    assert.deepEqual(JSON.parse(String(init?.body)), {
      p_actor_auth_user_id: ACTOR_ID,
      p_course_id: COURSE_ID,
    });
    return Response.json([{ result: snakeCaseProjection(projection()) }]);
  }) as typeof fetch;

  try {
    const result = await learningActivityContextProvider.load(
      ACTOR_ID,
      COURSE_ID,
    );
    assert.equal(result.states.length, 1);
    assert.equal(result.states[0]?.key, STATE_KEY);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnonKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
    if (previousServiceRoleKey === undefined)
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
  }
});

test("learning-activity AI projection rejects identity and private policy payloads", () => {
  const raw = projection() as Record<string, unknown>;
  const states = raw.states as Array<Record<string, unknown>>;
  states[0] = {
    ...states[0],
    key: `las_prefix-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-${"a".repeat(32)}`,
    learnerProfileId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    privateNote: "Не передавать модели",
    policyVersion: 1,
    evaluator: { weights: [0.8] },
  };

  assert.equal(learningActivityAiContextSchema.safeParse(raw).success, false);
});

test("learning-activity AI projection accepts only namespaced hash references", () => {
  const embeddedUuid = projection();
  embeddedUuid.states[0]!.key = `las_prefix-${ACTOR_ID}-${"a".repeat(32)}`;
  assert.equal(
    learningActivityAiContextSchema.safeParse(embeddedUuid).success,
    false,
  );

  const wrongEvidenceNamespace = projection();
  wrongEvidenceNamespace.states[0]!.evidenceReferences[0]!.key = `las_${"2".repeat(64)}`;
  assert.equal(
    learningActivityAiContextSchema.safeParse(wrongEvidenceNamespace).success,
    false,
  );
});

test("learning-activity AI projection enforces state and evidence caps", () => {
  const tooManyStates = projection();
  tooManyStates.states = Array.from({ length: 81 }, (_, index) => ({
    ...projection().states[0]!,
    key: `las_${index.toString(16).padStart(64, "0")}`,
  }));
  tooManyStates.summary.totalStateCount = 81;
  tooManyStates.summary.includedStateCount = 80;
  tooManyStates.summary.evidenceReferenceCount = 80;
  tooManyStates.summary.truncated = true;
  assert.equal(
    learningActivityAiContextSchema.safeParse(tooManyStates).success,
    false,
  );

  const tooMuchEvidence = projection();
  tooMuchEvidence.states[0]!.evidenceReferences = Array.from(
    { length: 4 },
    (_, index) => ({
      ...projection().states[0]!.evidenceReferences[0]!,
      key: `lae_${index.toString(16).padStart(64, "0")}`,
    }),
  );
  tooMuchEvidence.summary.evidenceReferenceCount = 4;
  assert.equal(
    learningActivityAiContextSchema.safeParse(tooMuchEvidence).success,
    false,
  );
});
