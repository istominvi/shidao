import assert from "node:assert/strict";
import test from "node:test";
import {
  LESSON_RUN_SCHEDULE_HARD_LIMIT,
  createLessonRunsRepository,
} from "./repository";

const API_URL = "https://shidao-test.supabase.co";
const ANON_KEY = "test-anon-key";
const ACCESS_TOKEN = "test-access-token";
const NOW = "2026-08-07T00:00:00.000Z";

function uuid(sequence: number) {
  return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`;
}

const ACCOUNT_ID = uuid(101);
const COURSE_ID = uuid(201);
const LESSON_ID = uuid(301);
const RUN_ID = uuid(401);
const LEARNER_ID = uuid(501);
const RECORD_ID = uuid(601);
const GROUP_ID = uuid(701);

type CapturedRequest = {
  url: string;
  method: string;
  headers: Headers;
  body: Record<string, unknown> | null;
};

type MockReply = {
  payload: unknown;
  status?: number;
};

function profileRow() {
  return {
    teacher_account_id: ACCOUNT_ID,
    learner_profile_id: LEARNER_ID,
    display_name: "Анна",
    archived_at: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

function runRow() {
  return {
    id: RUN_ID,
    lesson_id: LESSON_ID,
    scheduled_at: "2026-08-08T01:00:00.000Z",
    planned_duration_minutes: 45,
    started_at: null,
    ended_at: null,
    cancelled_at: null,
    teacher_report: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

function groupRow() {
  return {
    id: GROUP_ID,
    owner_account_id: ACCOUNT_ID,
    name: "Teen Talk",
    created_at: NOW,
    updated_at: NOW,
  };
}

function recordRow() {
  return {
    id: RECORD_ID,
    learner_profile_id: LEARNER_ID,
    recorded_by_account_id: ACCOUNT_ID,
    lesson_run_id: RUN_ID,
    source_course_id: null,
    source_lesson_id: null,
    occurred_at: null,
    was_present: null,
    needs_repeat: null,
    teacher_comment: null,
    course_title_at_time: null,
    lesson_title_at_time: null,
    subject_at_time: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

async function withMockSupabase<T>(
  replies: MockReply[],
  run: (
    repository: ReturnType<typeof createLessonRunsRepository>,
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
    return new Response(JSON.stringify(reply.payload), {
      status: reply.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await run(
      createLessonRunsRepository(ACCESS_TOKEN),
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

test("createLearnerProfile returns the teacher directory projection of a canonical learner", async () => {
  await withMockSupabase(
    [{ payload: profileRow() }],
    async (repository, requests) => {
      const profile = await repository.createLearnerProfile(ACCOUNT_ID, {
        displayName: "Анна",
        learnerGroupIds: [],
      });

      assert.equal(profile.displayName, "Анна");
      assert.equal(profile.teacherAccountId, ACCOUNT_ID);
      assert.equal(
        requests[0]?.url,
        `${API_URL}/rest/v1/rpc/create_learner_profile_with_groups`,
      );
      assert.equal(requests[0]?.method, "POST");
      assert.equal(
        requests[0]?.headers.get("authorization"),
        `Bearer ${ACCESS_TOKEN}`,
      );
      assert.deepEqual(requests[0]?.body, {
        p_display_name: "Анна",
        p_learner_group_ids: [],
      });
    },
  );
});

test("listLearnerProfiles reads active teacher_learner relations, not canonical identity rows", async () => {
  await withMockSupabase(
    [{ payload: [profileRow()] }],
    async (repository, requests) => {
      const profiles = await repository.listLearnerProfiles(ACCOUNT_ID);

      assert.equal(profiles[0]?.id, LEARNER_ID);
      assert.equal(profiles[0]?.teacherAccountId, ACCOUNT_ID);
      assert.match(requests[0]?.url ?? "", /\/rest\/v1\/teacher_learner\?/);
      assert.match(
        requests[0]?.url ?? "",
        new RegExp(`teacher_account_id=eq\\.${ACCOUNT_ID}`),
      );
      assert.match(requests[0]?.url ?? "", /archived_at=is\.null/);
      assert.doesNotMatch(requests[0]?.url ?? "", /\/learner_profile\?/);
    },
  );
});

test("getCourse excludes archived courses from new lesson-run mutations", async () => {
  await withMockSupabase([{ payload: [] }], async (repository, requests) => {
    assert.equal(await repository.getCourse(COURSE_ID), null);
    assert.match(requests[0]?.url ?? "", /archived_at=is\.null/);
  });
});

test("replaceCourseAudience delegates the complete set to the atomic RPC", async () => {
  await withMockSupabase(
    [
      { payload: true },
      {
        payload: [{ course_id: COURSE_ID, learner_profile_id: LEARNER_ID }],
      },
      { payload: [] },
      { payload: [profileRow()] },
    ],
    async (repository, requests) => {
      const audience = await repository.replaceCourseAudience(
        ACCOUNT_ID,
        COURSE_ID,
        [LEARNER_ID],
        [],
      );
      assert.equal(
        requests[0]?.url,
        `${API_URL}/rest/v1/rpc/replace_course_audience`,
      );
      assert.deepEqual(requests[0]?.body, {
        p_course_id: COURSE_ID,
        p_direct_learner_profile_ids: [LEARNER_ID],
        p_learner_group_ids: [],
      });
      assert.deepEqual(
        audience.effectiveLearners.map((profile) => profile.id),
        [LEARNER_ID],
      );
    },
  );
});

test("createLearnerGroup hydrates the atomic RPC result with active members", async () => {
  await withMockSupabase(
    [
      { payload: groupRow() },
      {
        payload: [
          {
            learner_group_id: GROUP_ID,
            learner_profile_id: LEARNER_ID,
          },
        ],
      },
      { payload: [profileRow()] },
    ],
    async (repository, requests) => {
      const group = await repository.createLearnerGroup(ACCOUNT_ID, {
        name: "Teen Talk",
        learnerProfileIds: [LEARNER_ID],
      });

      assert.equal(group.name, "Teen Talk");
      assert.equal(group.members[0]?.displayName, "Анна");
      assert.equal(
        requests[0]?.url,
        `${API_URL}/rest/v1/rpc/create_learner_group`,
      );
      assert.deepEqual(requests[0]?.body, {
        p_name: "Teen Talk",
        p_learner_profile_ids: [LEARNER_ID],
      });
    },
  );
});

test("scheduleRun calls one atomic RPC and hydrates its expected learners", async () => {
  await withMockSupabase(
    [
      { payload: runRow() },
      {
        payload: [{ id: LESSON_ID, course_id: COURSE_ID, title: "Знакомство" }],
      },
      {
        payload: [
          {
            id: COURSE_ID,
            owner_account_id: ACCOUNT_ID,
            title: "Китайский с нуля",
            subject: "Китайский язык",
          },
        ],
      },
      { payload: [recordRow()] },
      { payload: [profileRow()] },
    ],
    async (repository, requests) => {
      const run = await repository.scheduleRun({
        lessonId: LESSON_ID,
        scheduledAt: "2026-08-08T01:00:00.000Z",
        plannedDurationMinutes: 45,
        learnerProfileIds: [LEARNER_ID],
      });

      assert.equal(run.courseId, COURSE_ID);
      assert.equal(run.lessonTitle, "Знакомство");
      assert.equal(run.records[0]?.learnerDisplayName, "Анна");
      assert.equal(
        requests[0]?.url,
        `${API_URL}/rest/v1/rpc/schedule_lesson_run`,
      );
      assert.deepEqual(requests[0]?.body, {
        p_lesson_id: LESSON_ID,
        p_scheduled_at: "2026-08-08T01:00:00.000Z",
        p_planned_duration_minutes: 45,
        p_learner_profile_ids: [LEARNER_ID],
      });
    },
  );
});

test("rescheduleRun sends the expected Run ID to reject a stale target", async () => {
  await withMockSupabase(
    [
      { payload: runRow() },
      {
        payload: [{ id: LESSON_ID, course_id: COURSE_ID, title: "Знакомство" }],
      },
      {
        payload: [
          {
            id: COURSE_ID,
            owner_account_id: ACCOUNT_ID,
            title: "Китайский с нуля",
            subject: "Китайский язык",
          },
        ],
      },
      { payload: [recordRow()] },
      { payload: [profileRow()] },
    ],
    async (repository, requests) => {
      await repository.rescheduleRun({
        runId: RUN_ID,
        lessonId: LESSON_ID,
        scheduledAt: "2026-08-09T01:00:00.000Z",
        plannedDurationMinutes: 60,
        learnerProfileIds: [LEARNER_ID],
      });

      assert.deepEqual(requests[0]?.body, {
        p_lesson_id: LESSON_ID,
        p_scheduled_at: "2026-08-09T01:00:00.000Z",
        p_planned_duration_minutes: 60,
        p_learner_profile_ids: [LEARNER_ID],
        p_expected_lesson_run_id: RUN_ID,
      });
    },
  );
});

test("scheduleRunIfUnchanged sends the complete AI guard to one atomic RPC", async () => {
  await withMockSupabase(
    [
      { payload: runRow() },
      {
        payload: [{ id: LESSON_ID, course_id: COURSE_ID, title: "Знакомство" }],
      },
      {
        payload: [
          {
            id: COURSE_ID,
            owner_account_id: ACCOUNT_ID,
            title: "Китайский с нуля",
            subject: "Китайский язык",
          },
        ],
      },
      { payload: [recordRow()] },
      { payload: [profileRow()] },
    ],
    async (repository, requests) => {
      await repository.scheduleRunIfUnchanged({
        lessonId: LESSON_ID,
        scheduledAt: "2026-08-09T01:00:00.000Z",
        plannedDurationMinutes: 60,
        expectedLessonRunId: RUN_ID,
        expectedLessonRunUpdatedAt: NOW,
        expectedLearnerProfileIds: [LEARNER_ID],
      });

      assert.equal(
        requests[0]?.url,
        `${API_URL}/rest/v1/rpc/schedule_lesson_run_if_unchanged`,
      );
      assert.deepEqual(requests[0]?.body, {
        p_lesson_id: LESSON_ID,
        p_scheduled_at: "2026-08-09T01:00:00.000Z",
        p_planned_duration_minutes: 60,
        p_expected_lesson_run_id: RUN_ID,
        p_expected_lesson_run_updated_at: NOW,
        p_expected_learner_profile_ids: [LEARNER_ID],
      });
    },
  );
});

test("schedule window has a stable hard result limit", async () => {
  await withMockSupabase([{ payload: [] }], async (repository, requests) => {
    await repository.listSchedule(
      ACCOUNT_ID,
      "2026-08-01T00:00:00.000Z",
      "2026-08-08T00:00:00.000Z",
    );
    assert.match(
      requests[0]?.url ?? "",
      new RegExp(
        `order=scheduled_at\\.asc,id\\.asc&limit=${LESSON_RUN_SCHEDULE_HARD_LIMIT}`,
      ),
    );
  });
});

test("learner history keeps its snapshot context when Run links are null", async () => {
  const completedRecord = {
    ...recordRow(),
    lesson_run_id: null,
    source_course_id: null,
    source_lesson_id: null,
    occurred_at: "2026-08-08T01:45:00.000Z",
    was_present: true,
    needs_repeat: false,
    teacher_comment: "Уверенно отвечает",
    course_title_at_time: "Китайский с нуля",
    lesson_title_at_time: "Знакомство",
    subject_at_time: "Китайский язык",
  };
  await withMockSupabase(
    [{ payload: [completedRecord] }, { payload: [profileRow()] }],
    async (repository, requests) => {
      const records = await repository.listLearnerHistory(
        ACCOUNT_ID,
        LEARNER_ID,
      );
      assert.equal(records[0]?.lessonRunId, null);
      assert.equal(records[0]?.lessonTitleAtTime, "Знакомство");
      assert.match(requests[0]?.url ?? "", /occurred_at=not\.is\.null/);
      assert.match(requests[0]?.url ?? "", /superseded_by_record_id=is\.null/);
      assert.match(
        requests[0]?.url ?? "",
        new RegExp(`recorded_by_account_id=eq\\.${ACCOUNT_ID}`),
      );
      assert.match(requests[0]?.url ?? "", /order=occurred_at\.desc,id\.desc/);
      assert.match(requests[0]?.url ?? "", /limit=100/);
    },
  );
});

test("course learning history reads bounded durable records independently of deleted Runs", async () => {
  const completedRecord = {
    ...recordRow(),
    lesson_run_id: null,
    source_course_id: COURSE_ID,
    source_lesson_id: null,
    occurred_at: "2026-08-08T01:45:00.000Z",
    was_present: true,
    needs_repeat: false,
    course_title_at_time: "Китайский с нуля",
    lesson_title_at_time: "Знакомство",
    subject_at_time: "Китайский язык",
  };
  await withMockSupabase(
    [{ payload: [completedRecord] }, { payload: [profileRow()] }],
    async (repository, requests) => {
      const records = await repository.listCourseLearningRecords(
        ACCOUNT_ID,
        COURSE_ID,
        { limit: 8 },
      );
      assert.equal(records[0]?.sourceCourseId, COURSE_ID);
      assert.equal(records[0]?.lessonRunId, null);
      assert.match(
        requests[0]?.url ?? "",
        new RegExp(`source_course_id=eq\\.${COURSE_ID}`),
      );
      assert.match(requests[0]?.url ?? "", /occurred_at=not\.is\.null/);
      assert.match(requests[0]?.url ?? "", /superseded_by_record_id=is\.null/);
      assert.match(requests[0]?.url ?? "", /order=occurred_at\.desc,id\.desc/);
      assert.match(requests[0]?.url ?? "", /limit=8/);
    },
  );
});

test("AI learner history is bounded by effective learner IDs and the current teacher", async () => {
  const completedRecord = {
    ...recordRow(),
    source_course_id: uuid(999),
    occurred_at: "2026-08-08T01:45:00.000Z",
    was_present: true,
    needs_repeat: false,
    course_title_at_time: "Другой курс",
    lesson_title_at_time: "Прошлый урок",
    subject_at_time: "Китайский язык",
  };
  await withMockSupabase(
    [{ payload: [completedRecord] }, { payload: [profileRow()] }],
    async (repository, requests) => {
      const records = await repository.listLearningRecordsForLearners(
        ACCOUNT_ID,
        [LEARNER_ID],
        { limit: 40 },
      );

      assert.equal(records[0]?.courseTitleAtTime, "Другой курс");
      assert.equal(
        (requests[0]?.url ?? "").includes(
          `learner_profile_id=in.(${LEARNER_ID})`,
        ),
        true,
      );
      assert.doesNotMatch(requests[0]?.url ?? "", /source_course_id/);
      assert.match(
        requests[0]?.url ?? "",
        new RegExp(`recorded_by_account_id=eq\\.${ACCOUNT_ID}`),
      );
      assert.match(requests[0]?.url ?? "", /superseded_by_record_id=is\.null/);
      assert.match(requests[0]?.url ?? "", /limit=40/);
    },
  );
});

test("completed Course history is selected by completion time with a stable tie-breaker", async () => {
  await withMockSupabase(
    [
      {
        payload: [{ id: LESSON_ID, course_id: COURSE_ID, title: "Знакомство" }],
      },
      { payload: [] },
    ],
    async (repository, requests) => {
      await repository.listCourseHistory(ACCOUNT_ID, COURSE_ID, {
        completedOnly: true,
        limit: 8,
      });

      assert.match(requests[1]?.url ?? "", /ended_at=not\.is\.null/);
      assert.match(requests[1]?.url ?? "", /order=ended_at\.desc,id\.desc/);
      assert.match(requests[1]?.url ?? "", /limit=8/);
    },
  );
});

test("bounded Course history keeps an overdue open Run ahead of recent closed Runs", async () => {
  const overdueOpen = {
    ...runRow(),
    scheduled_at: "2020-01-01T00:00:00.000Z",
  };
  const completedRows = Array.from({ length: 100 }, (_, index) => {
    const endedAt = new Date(Date.UTC(2026, 7, 1, 0, 0, index)).toISOString();
    return {
      ...runRow(),
      id: uuid(2_000 + index),
      scheduled_at: endedAt,
      started_at: endedAt,
      ended_at: endedAt,
    };
  });
  await withMockSupabase(
    [
      {
        payload: [{ id: LESSON_ID, course_id: COURSE_ID, title: "Знакомство" }],
      },
      { payload: [overdueOpen] },
      { payload: completedRows },
      { payload: [] },
      {
        payload: [{ id: LESSON_ID, course_id: COURSE_ID, title: "Знакомство" }],
      },
      {
        payload: [
          {
            id: COURSE_ID,
            owner_account_id: ACCOUNT_ID,
            title: "Китайский с нуля",
            subject: "Китайский язык",
          },
        ],
      },
      { payload: [] },
      { payload: [] },
    ],
    async (repository, requests) => {
      const runs = await repository.listCourseHistory(ACCOUNT_ID, COURSE_ID);
      assert.equal(runs.length, 100);
      assert.equal(runs[0]?.id, RUN_ID);
      assert.ok(runs.some((run) => run.id === completedRows[99]?.id));
      assert.ok(!runs.some((run) => run.id === completedRows[0]?.id));
      assert.match(
        requests[1]?.url ?? "",
        /ended_at=is\.null&cancelled_at=is\.null.*order=scheduled_at\.asc,id\.asc&limit=50/,
      );
      assert.match(requests[2]?.url ?? "", /order=ended_at\.desc,id\.desc/);
      assert.match(requests[3]?.url ?? "", /order=cancelled_at\.desc,id\.desc/);
    },
  );
});

test("Lesson history has a hard limit and hydrates Run IDs in bounded chunks", async () => {
  const runRows = Array.from({ length: 51 }, (_, index) => ({
    ...runRow(),
    id: uuid(1_000 + index),
  }));
  await withMockSupabase(
    [
      { payload: runRows },
      {
        payload: [{ id: LESSON_ID, course_id: COURSE_ID, title: "Знакомство" }],
      },
      {
        payload: [
          {
            id: COURSE_ID,
            owner_account_id: ACCOUNT_ID,
            title: "Китайский с нуля",
            subject: "Китайский язык",
          },
        ],
      },
      { payload: [] },
      { payload: [] },
    ],
    async (repository, requests) => {
      const runs = await repository.listLessonHistory(ACCOUNT_ID, LESSON_ID);
      assert.equal(runs.length, 51);
      assert.match(
        requests[0]?.url ?? "",
        /order=scheduled_at\.desc,id\.desc&limit=100/,
      );

      const recordRequests = requests.filter((request) =>
        request.url.includes("/rest/v1/learning_record?"),
      );
      assert.equal(recordRequests.length, 2);
      for (const request of recordRequests) {
        const ids = request.url.match(/lesson_run_id=in\.\(([^)]*)\)/)?.[1];
        assert.ok(ids);
        assert.ok(ids.split(",").length <= 50);
      }
    },
  );
});
