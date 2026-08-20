import assert from "node:assert/strict";
import test from "node:test";
import { createLearningActivitiesRepository } from "./repository";

const API_URL = "https://shidao-test.supabase.co";
const ANON_KEY = "test-anon-key";
const ACCESS_TOKEN = "test-access-token";
const NOW = "2026-08-19T01:00:00.000Z";

function uuid(sequence: number) {
  return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`;
}

const RUN_ID = uuid(1);
const COMPONENT_ID = uuid(2);
const RECORD_ID = uuid(3);
const OBSERVATION_ID = uuid(4);
const ACCOUNT_ID = uuid(5);
const OBJECTIVE_ID = uuid(6);

type CapturedRequest = {
  url: string;
  method: string;
  headers: Headers;
  body: Record<string, unknown> | null;
};

type MockReply = {
  payload?: unknown;
  status?: number;
  empty?: boolean;
  headers?: HeadersInit;
};

function observationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: OBSERVATION_ID,
    learning_record_id: RECORD_ID,
    lesson_component_id: COMPONENT_ID,
    source_lesson_component_id_at_time: COMPONENT_ID,
    learning_objective_id: OBJECTIVE_ID,
    source_learning_objective_id_at_time: OBJECTIVE_ID,
    learning_objective_title_at_time: "Выбирает столицу по названию страны",
    component_position_at_time: 2,
    component_type_key_at_time: "choice_quiz",
    component_label_at_time: "Тест с выбором ответа: Выберите столицу",
    observable_criterion_at_time: "Выбирает столицу самостоятельно",
    rating: "independent",
    entry_method: "direct",
    private_note: "Ответил без подсказки",
    observed_at: NOW,
    recorded_by_account_id: ACCOUNT_ID,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

async function withMockSupabase<T>(
  replies: MockReply[],
  run: (
    repository: ReturnType<typeof createLearningActivitiesRepository>,
    requests: CapturedRequest[],
  ) => Promise<T>,
) {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const previousFetch = globalThis.fetch;
  const requests: CapturedRequest[] = [];
  const pendingReplies = [...replies];

  process.env.NEXT_PUBLIC_SUPABASE_URL = API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;
  globalThis.fetch = (async (input, init) => {
    const reply = pendingReplies.shift();
    assert.ok(reply, "Unexpected Supabase request");
    const rawBody = typeof init?.body === "string" ? init.body : null;
    requests.push({
      url:
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url,
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : null,
    });
    const headers = new Headers(reply.headers);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return new Response(
      reply.empty ? null : JSON.stringify(reply.payload ?? null),
      {
        status: reply.status ?? 200,
        headers,
      },
    );
  }) as typeof fetch;

  try {
    const result = await run(
      createLearningActivitiesRepository(ACCESS_TOKEN),
      requests,
    );
    assert.equal(pendingReplies.length, 0, "Not all mock replies were used");
    return result;
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnonKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
  }
}

test("repository reads recorder-scoped observations by LearningRecord IDs", async () => {
  await withMockSupabase(
    [
      {
        payload: [observationRow()],
        headers: { "Content-Range": "0-0/1" },
      },
    ],
    async (repository, requests) => {
      const observations = await repository.listByLearningRecordIds([
        RECORD_ID,
        RECORD_ID,
      ]);

      assert.equal(observations.length, 1);
      assert.deepEqual(observations[0], {
        id: OBSERVATION_ID,
        learningRecordId: RECORD_ID,
        lessonComponentId: COMPONENT_ID,
        sourceComponentIdAtTime: COMPONENT_ID,
        learningObjectiveId: OBJECTIVE_ID,
        sourceLearningObjectiveIdAtTime: OBJECTIVE_ID,
        learningObjectiveTitleAtTime: "Выбирает столицу по названию страны",
        componentPositionAtTime: 2,
        componentTypeAtTime: "choice_quiz",
        componentLabelAtTime: "Тест с выбором ответа: Выберите столицу",
        observableCriterionAtTime: "Выбирает столицу самостоятельно",
        rating: "independent",
        entryMethod: "direct",
        privateNote: "Ответил без подсказки",
        observedAt: NOW,
        recordedByAccountId: ACCOUNT_ID,
        createdAt: NOW,
        updatedAt: NOW,
      });
      const selectedColumns = new URL(requests[0]!.url).searchParams
        .get("select")
        ?.split(",");
      assert.ok(selectedColumns?.includes("learning_objective_id"));
      assert.ok(
        selectedColumns?.includes("source_learning_objective_id_at_time"),
      );
      assert.ok(selectedColumns?.includes("learning_objective_title_at_time"));
      assert.match(
        requests[0]?.url ?? "",
        new RegExp(`learning_record_id=in\\.\\(${RECORD_ID}\\)`),
      );
      assert.equal(
        requests[0]?.headers.get("authorization"),
        `Bearer ${ACCESS_TOKEN}`,
      );
      assert.equal(requests[0]?.headers.get("prefer"), "count=exact");
      assert.equal(requests[0]?.headers.get("range-unit"), "items");
      assert.equal(requests[0]?.headers.get("range"), "0-499");
    },
  );
});

test("repository follows exact Content-Range pages without truncating observations", async () => {
  const secondObservationId = uuid(6);
  const thirdObservationId = uuid(7);
  await withMockSupabase(
    [
      {
        payload: [
          observationRow({ id: OBSERVATION_ID }),
          observationRow({ id: secondObservationId }),
        ],
        headers: { "Content-Range": "0-1/3" },
      },
      {
        payload: [observationRow({ id: thirdObservationId })],
        headers: { "Content-Range": "2-2/3" },
      },
    ],
    async (repository, requests) => {
      const observations = await repository.listByLearningRecordIds([
        RECORD_ID,
      ]);

      assert.deepEqual(
        observations.map((observation) => observation.id),
        [OBSERVATION_ID, secondObservationId, thirdObservationId],
      );
      assert.equal(requests.length, 2);
      assert.equal(requests[0]?.headers.get("range"), "0-499");
      assert.equal(requests[1]?.headers.get("range"), "2-501");
      assert.ok(
        requests.every(
          (request) => request.headers.get("prefer") === "count=exact",
        ),
      );
    },
  );
});

test("repository fails closed when exact Content-Range is missing or malformed", async () => {
  for (const contentRange of [null, "0-0/*", "1-1/1", "0-2/2"]) {
    await withMockSupabase(
      [
        {
          payload: [observationRow()],
          headers: contentRange ? { "Content-Range": contentRange } : {},
        },
      ],
      async (repository) => {
        await assert.rejects(
          repository.listByLearningRecordIds([RECORD_ID]),
          (error: unknown) =>
            error instanceof Error &&
            "code" in error &&
            error.code === "observation_content_range_invalid",
        );
      },
    );
  }
});

test("repository fails closed when exact totals change between pages", async () => {
  await withMockSupabase(
    [
      {
        payload: [observationRow()],
        headers: { "Content-Range": "0-0/2" },
      },
      {
        payload: [observationRow({ id: uuid(8) })],
        headers: { "Content-Range": "1-1/3" },
      },
    ],
    async (repository) => {
      await assert.rejects(
        repository.listByLearningRecordIds([RECORD_ID]),
        (error: unknown) =>
          error instanceof Error &&
          "code" in error &&
          error.code === "observation_content_range_invalid",
      );
    },
  );
});

test("repository accepts an exact empty observation range", async () => {
  await withMockSupabase(
    [{ payload: [], headers: { "Content-Range": "*/0" } }],
    async (repository, requests) => {
      assert.deepEqual(
        await repository.listByLearningRecordIds([RECORD_ID]),
        [],
      );
      assert.equal(requests.length, 1);
    },
  );
});

test("repository sends one atomic save RPC and does not write the table directly", async () => {
  await withMockSupabase([{ empty: true }], async (repository, requests) => {
    await repository.saveRunObservations({
      lessonRunId: RUN_ID,
      lessonComponentId: COMPONENT_ID,
      componentLabelAtTime: "Тест с выбором ответа: Выберите столицу",
      observableCriterionAtTime: "Выбирает столицу самостоятельно",
      entryMethod: "bulk_confirmed",
      entries: [
        {
          learningRecordId: RECORD_ID,
          rating: "with_support",
          privateNote: null,
        },
      ],
    });

    assert.equal(
      requests[0]?.url,
      `${API_URL}/rest/v1/rpc/save_lesson_component_observations`,
    );
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.headers.get("prefer"), "return=minimal");
    assert.deepEqual(requests[0]?.body, {
      p_lesson_run_id: RUN_ID,
      p_lesson_component_id: COMPONENT_ID,
      p_component_label_at_time: "Тест с выбором ответа: Выберите столицу",
      p_observable_criterion_at_time: "Выбирает столицу самостоятельно",
      p_entry_method: "bulk_confirmed",
      p_observations: [
        {
          learningRecordId: RECORD_ID,
          rating: "with_support",
          privateNote: null,
        },
      ],
    });
    for (const parameter of [
      "p_learning_objective_id",
      "p_source_learning_objective_id_at_time",
      "p_learning_objective_title_at_time",
    ]) {
      assert.equal(parameter in (requests[0]?.body ?? {}), false);
    }
    assert.doesNotMatch(
      requests[0]?.url ?? "",
      /\/rest\/v1\/lesson_component_observation(?:\?|$)/,
    );
  });
});

test("repository keeps LA-M1 rows component-only without inventing objective provenance", async () => {
  await withMockSupabase(
    [
      {
        payload: [
          observationRow({
            learning_objective_id: null,
            source_learning_objective_id_at_time: null,
            learning_objective_title_at_time: null,
          }),
        ],
        headers: { "Content-Range": "0-0/1" },
      },
    ],
    async (repository) => {
      const [observation] = await repository.listByLearningRecordIds([
        RECORD_ID,
      ]);
      assert.equal(observation?.learningObjectiveId, null);
      assert.equal(observation?.sourceLearningObjectiveIdAtTime, null);
      assert.equal(observation?.learningObjectiveTitleAtTime, null);
    },
  );
});

test("repository retains objective-at-time after the live objective FK is nulled", async () => {
  await withMockSupabase(
    [
      {
        payload: [observationRow({ learning_objective_id: null })],
        headers: { "Content-Range": "0-0/1" },
      },
    ],
    async (repository) => {
      const [observation] = await repository.listByLearningRecordIds([
        RECORD_ID,
      ]);
      assert.equal(observation?.learningObjectiveId, null);
      assert.equal(observation?.sourceLearningObjectiveIdAtTime, OBJECTIVE_ID);
      assert.equal(
        observation?.learningObjectiveTitleAtTime,
        "Выбирает столицу по названию страны",
      );
    },
  );
});

test("repository rejects partial or inconsistent objective-at-time projections", async () => {
  const invalidRows = [
    observationRow({ learning_objective_title_at_time: null }),
    observationRow({ learning_objective_id: uuid(99) }),
    observationRow({ learning_objective_title_at_time: "  Не обрезано  " }),
    observationRow({
      learning_objective_title_at_time: "x".repeat(241),
    }),
  ];

  for (const row of invalidRows) {
    await withMockSupabase(
      [{ payload: [row], headers: { "Content-Range": "0-0/1" } }],
      async (repository) => {
        await assert.rejects(
          repository.listByLearningRecordIds([RECORD_ID]),
          (error: unknown) =>
            error instanceof Error &&
            "code" in error &&
            error.code === "observation_projection_invalid",
        );
      },
    );
  }
});

test("repository avoids a PostgREST request for an empty record set", async () => {
  await withMockSupabase([], async (repository, requests) => {
    assert.deepEqual(await repository.listByLearningRecordIds([]), []);
    assert.equal(requests.length, 0);
  });
});

test("finalized history keeps a retired registry type readable", async () => {
  await withMockSupabase(
    [
      {
        payload: [
          observationRow({
            lesson_component_id: null,
            component_type_key_at_time: "retired_activity_type",
          }),
        ],
        headers: { "Content-Range": "0-0/1" },
      },
    ],
    async (repository) => {
      const observations = await repository.listByLearningRecordIds([
        RECORD_ID,
      ]);
      assert.equal(observations[0]?.lessonComponentId, null);
      assert.equal(
        observations[0]?.componentTypeAtTime,
        "retired_activity_type",
      );
    },
  );
});
