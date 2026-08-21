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
    corrected_from_observation_id: null,
    superseded_by_observation_id: null,
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

function evidenceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: uuid(30),
    learner_profile_id: uuid(31),
    recorded_by_account_id: ACCOUNT_ID,
    learning_record_id: RECORD_ID,
    source_kind: "observation",
    source_observation_id: OBSERVATION_ID,
    source_choice_quiz_evaluation_id: null,
    source_course_id_at_time: uuid(32),
    source_lesson_id_at_time: uuid(33),
    source_lesson_run_id_at_time: RUN_ID,
    source_component_id_at_time: COMPONENT_ID,
    source_learning_objective_id_at_time: OBJECTIVE_ID,
    lesson_component_id: COMPONENT_ID,
    learning_objective_id: OBJECTIVE_ID,
    course_title_at_time: "Китайский с нуля",
    lesson_title_at_time: "Знакомство",
    subject_at_time: "Китайский язык",
    component_type_at_time: "choice_quiz",
    component_label_at_time: "Тест с выбором ответа: Выберите столицу",
    objective_title_at_time: "Выбирает столицу по названию страны",
    criterion_at_time: "Выбирает столицу самостоятельно",
    direction: "positive",
    support: "independent",
    observed_at: NOW,
    finalized_at: "2026-08-19T01:01:00.000Z",
    materialized_at: "2026-08-19T01:01:01.000Z",
    evidence_version: 1,
    eligibility_policy_version: 1,
    reason_code: "independent_positive_evidence",
    supersedes_evidence_id: null,
    superseded_by_evidence_id: null,
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
        correctedFromObservationId: null,
        supersededByObservationId: null,
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
        selectedColumns?.includes("source_lesson_component_id_at_time"),
      );
      assert.ok(selectedColumns?.includes("corrected_from_observation_id"));
      assert.ok(selectedColumns?.includes("superseded_by_observation_id"));
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

test("repository exposes explicit observation correction links and rejects self-links", async () => {
  const originalObservationId = uuid(21);
  await withMockSupabase(
    [
      {
        payload: [
          observationRow({
            corrected_from_observation_id: originalObservationId,
          }),
        ],
        headers: { "Content-Range": "0-0/1" },
      },
    ],
    async (repository) => {
      const [observation] = await repository.listByLearningRecordIds([
        RECORD_ID,
      ]);
      assert.equal(
        observation?.correctedFromObservationId,
        originalObservationId,
      );
      assert.equal(observation?.supersededByObservationId, null);
    },
  );

  await withMockSupabase(
    [
      {
        payload: [
          observationRow({ superseded_by_observation_id: OBSERVATION_ID }),
        ],
        headers: { "Content-Range": "0-0/1" },
      },
    ],
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
});

test("repository reads typed evidence by LearningRecord IDs with stable deleted provenance", async () => {
  await withMockSupabase(
    [
      {
        payload: [
          evidenceRow({
            lesson_component_id: null,
            learning_objective_id: null,
          }),
        ],
        headers: { "Content-Range": "0-0/1" },
      },
    ],
    async (repository, requests) => {
      const [evidence] = await repository.listEvidenceByLearningRecordIds([
        RECORD_ID,
        RECORD_ID,
      ]);
      assert.equal(evidence?.sourceComponentIdAtTime, COMPONENT_ID);
      assert.equal(evidence?.sourceKind, "observation");
      assert.equal(evidence?.sourceObservationId, OBSERVATION_ID);
      assert.equal(evidence?.sourceChoiceQuizEvaluationId, null);
      assert.equal(evidence?.sourceLearningObjectiveIdAtTime, OBJECTIVE_ID);
      assert.equal(evidence?.lessonComponentId, null);
      assert.equal(evidence?.learningObjectiveId, null);
      assert.equal(evidence?.direction, "positive");
      assert.equal(evidence?.support, "independent");
      assert.equal(evidence?.evidenceVersion, 1);
      assert.doesNotMatch(JSON.stringify(evidence), /private_note|privateNote/);
      assert.match(requests[0]?.url ?? "", /\/rest\/v1\/learning_evidence\?/);
      assert.match(
        requests[0]?.url ?? "",
        new RegExp(`learning_record_id=in\\.\\(${RECORD_ID}\\)`),
      );
      assert.equal(requests[0]?.headers.get("prefer"), "count=exact");
      const selectedColumns = new URL(requests[0]!.url).searchParams
        .get("select")
        ?.split(",");
      assert.ok(selectedColumns?.includes("source_component_id_at_time"));
      assert.ok(selectedColumns?.includes("source_choice_quiz_evaluation_id"));
      assert.equal(
        selectedColumns?.includes("source_lesson_component_id_at_time"),
        false,
      );
    },
  );
});

test("record-scoped raw history rejects impossible record-linked choice-quiz evidence", async () => {
  const evaluationId = uuid(35);
  await withMockSupabase(
    [
      {
        payload: [
          evidenceRow({
            source_observation_id: null,
            source_choice_quiz_evaluation_id: evaluationId,
            eligibility_policy_version: 2,
            reason_code: "choice_quiz_independent_positive_evidence",
          }),
        ],
        headers: { "Content-Range": "0-0/1" },
      },
    ],
    async (repository) => {
      await assert.rejects(
        repository.listEvidenceByLearningRecordIds([RECORD_ID]),
        (error: unknown) =>
          error instanceof Error &&
          "code" in error &&
          error.code === "learning_evidence_projection_invalid",
      );
    },
  );
});

test("repository fails closed on malformed evidence semantics or paging", async () => {
  await withMockSupabase(
    [
      {
        payload: [evidenceRow({ direction: "negative" })],
        headers: { "Content-Range": "0-0/1" },
      },
    ],
    async (repository) => {
      await assert.rejects(
        repository.listEvidenceByLearningRecordIds([RECORD_ID]),
        (error: unknown) =>
          error instanceof Error &&
          "code" in error &&
          error.code === "learning_evidence_projection_invalid",
      );
    },
  );

  await withMockSupabase(
    [
      {
        payload: [evidenceRow({ source_choice_quiz_evaluation_id: uuid(36) })],
        headers: { "Content-Range": "0-0/1" },
      },
    ],
    async (repository) => {
      await assert.rejects(
        repository.listEvidenceByLearningRecordIds([RECORD_ID]),
        (error: unknown) =>
          error instanceof Error &&
          "code" in error &&
          error.code === "learning_evidence_projection_invalid",
      );
    },
  );

  await withMockSupabase(
    [{ payload: [evidenceRow()], headers: {} }],
    async (repository) => {
      await assert.rejects(
        repository.listEvidenceByLearningRecordIds([RECORD_ID]),
        (error: unknown) =>
          error instanceof Error &&
          "code" in error &&
          error.code === "learning_evidence_content_range_invalid",
      );
    },
  );
});

test("repository uses narrow correction RPC and returns a strict result", async () => {
  const correctedAt = "2026-08-20T00:00:00.000Z";
  const idempotencyKey = uuid(40);
  await withMockSupabase(
    [
      {
        payload: {
          idempotency_key: idempotencyKey,
          new_learning_record_id: uuid(41),
          new_observation_id: uuid(42),
          corrected_at: correctedAt,
          replayed: false,
        },
      },
    ],
    async (repository, requests) => {
      assert.deepEqual(
        await repository.correctFinalizedObservation({
          observationId: OBSERVATION_ID,
          learnerProfileId: uuid(31),
          expectedLearningRecordId: RECORD_ID,
          rating: "not_yet",
          privateNote: "Нужна подсказка",
          correctionReason: "Исправлена отметка",
          idempotencyKey,
          correctedAt,
        }),
        {
          idempotencyKey,
          newLearningRecordId: uuid(41),
          newObservationId: uuid(42),
          correctedAt,
          replayed: false,
        },
      );
      assert.equal(
        requests[0]?.url,
        `${API_URL}/rest/v1/rpc/correct_finalized_lesson_component_observation`,
      );
      assert.deepEqual(requests[0]?.body, {
        p_observation_id: OBSERVATION_ID,
        p_learner_profile_id: uuid(31),
        p_expected_learning_record_id: RECORD_ID,
        p_rating: "not_yet",
        p_private_note: "Нужна подсказка",
        p_correction_reason: "Исправлена отметка",
        p_idempotency_key: idempotencyKey,
        p_corrected_at: correctedAt,
      });
      assert.equal(requests[0]?.headers.get("prefer"), "return=representation");
    },
  );
});

test("repository reads bounded correction audit only through the recorder RPC", async () => {
  const activeRecordId = uuid(43);
  const parentRecordId = uuid(44);
  const replacementObservationId = uuid(45);
  const sourceObservationId = uuid(46);
  const correctedAt = "2026-08-20T00:00:00.000Z";
  await withMockSupabase(
    [
      {
        payload: {
          items: [
            {
              active_learning_record_id: activeRecordId,
              learning_record_id: activeRecordId,
              corrected_from_learning_record_id: parentRecordId,
              observation_id: replacementObservationId,
              corrected_from_observation_id: sourceObservationId,
              component_position_at_time: 2,
              component_label_at_time: "Свободный ответ",
              old_rating: "independent",
              new_rating: "not_yet",
              old_private_note: "Справился",
              new_private_note: "Нужна перепроверка",
              correction_reason: "Ошибочная отметка",
              corrected_at: correctedAt,
            },
          ],
          truncated: false,
        },
      },
    ],
    async (repository, requests) => {
      const result = await repository.listHistoryCorrections([
        activeRecordId,
        activeRecordId,
      ]);
      assert.deepEqual(result, {
        items: [
          {
            activeLearningRecordId: activeRecordId,
            learningRecordId: activeRecordId,
            correctedFromLearningRecordId: parentRecordId,
            observationId: replacementObservationId,
            correctedFromObservationId: sourceObservationId,
            componentPositionAtTime: 2,
            componentLabelAtTime: "Свободный ответ",
            oldRating: "independent",
            newRating: "not_yet",
            oldPrivateNote: "Справился",
            newPrivateNote: "Нужна перепроверка",
            correctionReason: "Ошибочная отметка",
            correctedAt,
          },
        ],
        truncated: false,
      });
      assert.equal(
        requests[0]?.url,
        `${API_URL}/rest/v1/rpc/get_teacher_learning_record_correction_history`,
      );
      assert.deepEqual(requests[0]?.body, {
        p_active_learning_record_ids: [activeRecordId],
      });
      assert.equal(requests[0]?.method, "POST");
    },
  );
});

test("repository persists recommendation override only through the narrow RPC", async () => {
  const updatedAt = "2026-08-20T00:00:00.000Z";
  await withMockSupabase(
    [
      {
        payload: {
          action: "replace",
          state_id: uuid(50),
          updated_at: updatedAt,
        },
      },
    ],
    async (repository, requests) => {
      assert.deepEqual(
        await repository.setRecommendationOverride({
          learnerProfileId: uuid(31),
          sourceLearningObjectiveIdAtTime: OBJECTIVE_ID,
          action: "replace",
          recommendationType: "repeat",
          privateReason: "Повторить перед контрольной",
          expectedStateUpdatedAt: updatedAt,
        }),
        { action: "replace", stateId: uuid(50), updatedAt },
      );
      assert.equal(
        requests[0]?.url,
        `${API_URL}/rest/v1/rpc/set_learner_recommendation_override`,
      );
      assert.deepEqual(requests[0]?.body, {
        p_learner_profile_id: uuid(31),
        p_source_learning_objective_id_at_time: OBJECTIVE_ID,
        p_action: "replace",
        p_recommendation_type: "repeat",
        p_private_reason: "Повторить перед контрольной",
        p_expected_state_updated_at: updatedAt,
      });
    },
  );
});

test("repository maps teacher/self/observer activity-profile RPCs through strict DTOs", async () => {
  const generatedAt = "2026-08-20T00:00:00.000Z";
  await withMockSupabase(
    [
      {
        payload: {
          projection_version: 1,
          learner_profile_id: uuid(31),
          generated_at: generatedAt,
          states: [],
        },
      },
      {
        payload: {
          projection_version: 1,
          generated_at: generatedAt,
          states: [],
        },
      },
      {
        payload: {
          projection_version: 1,
          generated_at: generatedAt,
          states: [],
        },
      },
    ],
    async (repository, requests) => {
      assert.equal(
        (await repository.getTeacherLearnerActivityProfile(uuid(31)))
          .learnerProfileId,
        uuid(31),
      );
      assert.equal(
        (await repository.getMyLearningActivityProfile()).projectionVersion,
        1,
      );
      assert.equal(
        (await repository.getObservedLearnerActivityProfile(uuid(31)))
          .projectionVersion,
        1,
      );
      assert.deepEqual(
        requests.map((request) => new URL(request.url).pathname),
        [
          "/rest/v1/rpc/get_teacher_learner_activity_profile_v2",
          "/rest/v1/rpc/get_my_learning_activity_profile",
          "/rest/v1/rpc/get_observed_learner_activity_profile",
        ],
      );
      assert.deepEqual(requests[0]?.body, {
        p_learner_profile_id: uuid(31),
      });
      assert.deepEqual(requests[1]?.body, {});
      assert.deepEqual(requests[2]?.body, {
        p_learner_profile_id: uuid(31),
      });
    },
  );
});

test("teacher profile RPC maps bounded evidence, state and recommendation without private observation data", async () => {
  const generatedAt = "2026-08-20T00:00:00.000Z";
  const evidenceId = uuid(30);
  await withMockSupabase(
    [
      {
        payload: {
          projection_version: 1,
          learner_profile_id: uuid(31),
          generated_at: generatedAt,
          states: [
            {
              state_id: uuid(60),
              learning_objective_id: OBJECTIVE_ID,
              source_learning_objective_id_at_time: OBJECTIVE_ID,
              source_course_id_at_time: uuid(32),
              course_title_at_time: "Китайский с нуля",
              subject_at_time: "Китайский язык",
              objective_title_at_time: "Выбирает столицу по названию страны",
              status: "forming",
              reason_code: "latest_with_support",
              reason_text:
                "Последний результат получен с поддержкой; навык продолжает формироваться.",
              policy_version: 1,
              evaluated_at: generatedAt,
              last_evidence_at: NOW,
              freshness_due_at: null,
              evidence: [
                evidenceRow({
                  support: "with_support",
                  reason_code: "supported_positive_evidence",
                }),
                evidenceRow({
                  id: uuid(37),
                  learning_record_id: null,
                  source_kind: "choice_quiz_evaluation",
                  source_observation_id: null,
                  source_choice_quiz_evaluation_id: uuid(38),
                  eligibility_policy_version: 2,
                  reason_code: "choice_quiz_independent_positive_evidence",
                }),
              ],
              recommendation: {
                recommendation_id: uuid(61),
                type: "try_without_support",
                reason_code: "try_without_support_after_supported_success",
                reason_text:
                  "Получилось с поддержкой — следующим шагом попробуйте без подсказки.",
                rule_version: 1,
                generated_at: generatedAt,
                evidence_ids: [evidenceId],
                effective_type: "try_without_support",
                effective_reason_text:
                  "Получилось с поддержкой — следующим шагом попробуйте без подсказки.",
                source: "rule",
                override: null,
              },
            },
            {
              state_id: null,
              learning_objective_id: uuid(62),
              source_learning_objective_id_at_time: uuid(62),
              source_course_id_at_time: uuid(32),
              course_title_at_time: "Китайский с нуля",
              subject_at_time: "Китайский язык",
              objective_title_at_time: "Использует приветствие",
              status: "no_data",
              reason_code: "no_eligible_evidence",
              reason_text:
                "Пока нет подходящих наблюдений по этой учебной цели.",
              policy_version: 1,
              evaluated_at: generatedAt,
              last_evidence_at: null,
              freshness_due_at: null,
              evidence: [],
              recommendation: null,
            },
          ],
        },
      },
    ],
    async (repository) => {
      const profile = await repository.getTeacherLearnerActivityProfile(
        uuid(31),
      );
      assert.equal(profile.states[0]?.evidence[0]?.id, evidenceId);
      assert.equal(profile.states[0]?.evidence[1]?.learningRecordId, null);
      assert.equal(
        profile.states[0]?.evidence[1]?.sourceKind,
        "choice_quiz_evaluation",
      );
      assert.equal(
        profile.states[0]?.recommendation?.type,
        "try_without_support",
      );
      assert.deepEqual(profile.states[1], {
        stateId: null,
        learningObjectiveId: uuid(62),
        sourceLearningObjectiveIdAtTime: uuid(62),
        sourceCourseIdAtTime: uuid(32),
        courseTitleAtTime: "Китайский с нуля",
        subjectAtTime: "Китайский язык",
        objectiveTitleAtTime: "Использует приветствие",
        status: "no_data",
        reasonCode: "no_eligible_evidence",
        reasonText: "Пока нет подходящих наблюдений по этой учебной цели.",
        policyVersion: 1,
        evaluatedAt: generatedAt,
        lastEvidenceAt: null,
        freshnessDueAt: null,
        evidence: [],
        recommendation: null,
      });
      assert.equal(
        "privateNote" in (profile.states[0]?.evidence[0] ?? {}),
        false,
      );
    },
  );
});

test("safe profile RPC rejects private notes, raw UUID fields and evaluator payloads", async () => {
  for (const unsafeField of [
    ["private_note", "teacher only"],
    ["recorded_by_account_id", ACCOUNT_ID],
    ["evaluator_payload", { score: 1 }],
  ] as const) {
    await withMockSupabase(
      [
        {
          payload: {
            projection_version: 1,
            generated_at: "2026-08-20T00:00:00.000Z",
            states: [],
            [unsafeField[0]]: unsafeField[1],
          },
        },
      ],
      async (repository) => {
        await assert.rejects(
          repository.getMyLearningActivityProfile(),
          (error: unknown) =>
            error instanceof Error &&
            "code" in error &&
            error.code ===
              "get_my_learning_activity_profile_projection_invalid",
        );
      },
    );
  }
});
