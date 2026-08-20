import assert from "node:assert/strict";
import test from "node:test";
import type { CourseDraftInput } from "./contracts";
import {
  CourseBuilderRepositoryError,
  createCourseBuilderRepository,
} from "./repository";

const API_URL = "https://shidao-test.supabase.co";
const ANON_KEY = "test-anon-key";
const ACCESS_TOKEN = "test-access-token";
const OWNER_ACCOUNT_ID = "00000000-0000-4000-8000-000000000101";
const COURSE_ID = "00000000-0000-4000-8000-000000001001";
const LESSON_ID = "00000000-0000-4000-8000-000000002001";
const COMPONENT_ID = "00000000-0000-4000-8000-000000004001";
const SLIDE_ID = "00000000-0000-4000-8000-000000005001";
const OBJECTIVE_ID = "00000000-0000-4000-8000-000000006001";
const NOW = "2026-08-03T00:00:00.000Z";

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

function courseDraft(): CourseDraftInput {
  return {
    title: "Китайский с нуля",
    learningAudience: "children",
    subject: "Китайский язык",
    goal: "Освоить базовый диалог",
    level: "Начальный",
    audienceDescription: "Взрослый ученик",
    targetLessonCount: 8,
    teacherPreferences: "Короткие устные упражнения",
  };
}

function courseRow() {
  return {
    id: COURSE_ID,
    owner_account_id: OWNER_ACCOUNT_ID,
    title: "Китайский с нуля",
    learning_audience: "children",
    subject: "Китайский язык",
    goal: "Освоить базовый диалог",
    level: "Начальный",
    audience_description: "Взрослый ученик",
    target_lesson_count: 8,
    teacher_preferences: "Короткие устные упражнения",
    audience_type: "none",
    assembled_at: null,
    archived_at: null,
    created_at: NOW,
    publication_content_updated_at: NOW,
    updated_at: NOW,
  };
}

function componentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COMPONENT_ID,
    lesson_id: LESSON_ID,
    type_key: "quote",
    schema_version: 1,
    position: 1,
    payload: { text: "Путь начинается с первого шага." },
    placement_config: { width: "content", textAlign: "left" },
    visibility: "learner_visible",
    student_slide_id: SLIDE_ID,
    primary_learning_objective_id: null,
    activity_role: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function learningObjectiveRow(overrides: Record<string, unknown> = {}) {
  return {
    id: OBJECTIVE_ID,
    course_id: COURSE_ID,
    title: "Различает второй и третий тон",
    description: "Слышит различие в знакомых словах",
    archived_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

test("getCourseWorkspace keeps legacy components unaligned beside ordered Student Screen slides", async () => {
  await withMockSupabase(
    [
      { payload: [courseRow()] },
      {
        payload: [
          {
            id: LESSON_ID,
            course_id: COURSE_ID,
            position: 1,
            title: "Первый урок",
            summary: "Комментарий преподавателя",
            created_at: NOW,
            updated_at: NOW,
            components: [componentRow()],
            studentSlides: [
              {
                id: SLIDE_ID,
                lesson_id: LESSON_ID,
                position: 1,
                created_at: NOW,
                updated_at: NOW,
              },
            ],
          },
        ],
      },
      { payload: [] },
      { payload: [] },
    ],
    async (repository, requests) => {
      const workspace = await repository.getCourseWorkspace(COURSE_ID);

      assert.equal(workspace?.lessons[0]?.studentSlides[0]?.id, SLIDE_ID);
      assert.equal(
        workspace?.lessons[0]?.components[0]?.studentSlideId,
        SLIDE_ID,
      );
      assert.equal(
        workspace?.lessons[0]?.components[0]?.primaryLearningObjectiveId,
        null,
      );
      assert.equal(workspace?.lessons[0]?.components[0]?.activityRole, null);
      assert.deepEqual(workspace?.learningObjectives, []);
      assert.match(
        requests[1]?.url ?? "",
        /components:lesson_component\(\*\).*studentSlides:lesson_student_slide\(\*\)/,
      );
      assert.match(requests[2]?.url ?? "", /\/learning_objective\?select=\*/);
      assert.equal(requests.length, 4);
    },
  );
});

test("getCourseWorkspace reloads Course objectives and Component alignment", async () => {
  await withMockSupabase(
    [
      { payload: [courseRow()] },
      {
        payload: [
          {
            id: LESSON_ID,
            course_id: COURSE_ID,
            position: 1,
            title: "Первый урок",
            summary: "",
            created_at: NOW,
            updated_at: NOW,
            components: [
              componentRow({
                primary_learning_objective_id: OBJECTIVE_ID,
                activity_role: "assessment",
              }),
            ],
            studentSlides: [],
          },
        ],
      },
      { payload: [learningObjectiveRow()] },
      { payload: [] },
    ],
    async (repository) => {
      const workspace = await repository.getCourseWorkspace(COURSE_ID);

      assert.deepEqual(workspace?.learningObjectives, [
        {
          id: OBJECTIVE_ID,
          courseId: COURSE_ID,
          title: "Различает второй и третий тон",
          description: "Слышит различие в знакомых словах",
          archivedAt: null,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ]);
      assert.equal(
        workspace?.lessons[0]?.components[0]?.primaryLearningObjectiveId,
        OBJECTIVE_ID,
      );
      assert.equal(
        workspace?.lessons[0]?.components[0]?.activityRole,
        "assessment",
      );
    },
  );
});

async function withMockSupabase<T>(
  replies: MockReply[],
  run: (
    repository: ReturnType<typeof createCourseBuilderRepository>,
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
      createCourseBuilderRepository(ACCESS_TOKEN),
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

test("createCourse matches the V2 course table and derives draft status", async () => {
  await withMockSupabase(
    [{ payload: [courseRow()] }],
    async (repository, requests) => {
      const created = await repository.createCourse(
        OWNER_ACCOUNT_ID,
        courseDraft(),
      );

      assert.equal(created.status, "draft");
      assert.equal(created.ownerAccountId, OWNER_ACCOUNT_ID);
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.method, "POST");
      assert.equal(requests[0]?.url, `${API_URL}/rest/v1/course`);
      assert.equal(
        requests[0]?.headers.get("authorization"),
        `Bearer ${ACCESS_TOKEN}`,
      );
      assert.deepEqual(requests[0]?.body, {
        owner_account_id: OWNER_ACCOUNT_ID,
        title: "Китайский с нуля",
        learning_audience: "children",
        subject: "Китайский язык",
        goal: "Освоить базовый диалог",
        level: "Начальный",
        audience_description: "Взрослый ученик",
        target_lesson_count: 8,
        teacher_preferences: "Короткие устные упражнения",
        audience_type: "none",
      });
      assert.equal("status" in (requests[0]?.body ?? {}), false);
    },
  );
});

test("session revocation cutoff is read through the auth.uid-scoped RPC", async () => {
  const cutoff = "2026-08-03T12:00:00.000Z";
  await withMockSupabase(
    [{ payload: cutoff }],
    async (repository, requests) => {
      const value = await repository.getSessionInvalidBefore();
      assert.equal(value, cutoff);
      assert.equal(
        requests[0]?.url,
        `${API_URL}/rest/v1/rpc/current_session_invalid_before`,
      );
      assert.deepEqual(requests[0]?.body, {});
      assert.equal(
        requests[0]?.headers.get("authorization"),
        `Bearer ${ACCESS_TOKEN}`,
      );
    },
  );
});

test("deleteLesson uses the history-preserving RPC", async () => {
  await withMockSupabase([{ payload: true }], async (repository, requests) => {
    assert.equal(await repository.deleteLesson(LESSON_ID), true);
    assert.equal(
      requests[0]?.url,
      `${API_URL}/rest/v1/rpc/delete_lesson_with_history`,
    );
    assert.deepEqual(requests[0]?.body, { p_lesson_id: LESSON_ID });
  });
});

test("archiveCourse delegates the recoverable soft archive to one RPC", async () => {
  await withMockSupabase(
    [{ payload: "archived" }],
    async (repository, requests) => {
      assert.equal(await repository.archiveCourse(COURSE_ID), "archived");
      assert.equal(requests[0]?.method, "POST");
      assert.equal(requests[0]?.url, `${API_URL}/rest/v1/rpc/archive_course`);
      assert.deepEqual(requests[0]?.body, { p_course_id: COURSE_ID });
    },
  );
});

test("archiveCourse preserves a conflict outcome returned by the RPC", async () => {
  await withMockSupabase(
    [{ payload: "course_has_open_lesson_runs" }],
    async (repository) => {
      assert.equal(
        await repository.archiveCourse(COURSE_ID),
        "course_has_open_lesson_runs",
      );
    },
  );
});

test("LearningObjective mutations use narrow atomic RPC bodies", async () => {
  await withMockSupabase(
    [
      { payload: [learningObjectiveRow()] },
      {
        payload: [
          learningObjectiveRow({ title: "Различает тоны в знакомых словах" }),
        ],
      },
      {
        payload: [learningObjectiveRow({ description: null })],
      },
      {
        payload: [learningObjectiveRow({ archived_at: NOW })],
      },
    ],
    async (repository, requests) => {
      const created = await repository.createLearningObjective(COURSE_ID, {
        title: "Различает второй и третий тон",
        description: "Слышит различие в знакомых словах",
      });
      const renamed = await repository.updateLearningObjective(OBJECTIVE_ID, {
        title: "Различает тоны в знакомых словах",
        description: undefined,
      });
      const cleared = await repository.updateLearningObjective(OBJECTIVE_ID, {
        description: null,
      });
      const archived = await repository.archiveLearningObjective(OBJECTIVE_ID);

      assert.equal(created.id, OBJECTIVE_ID);
      assert.equal(renamed?.title, "Различает тоны в знакомых словах");
      assert.equal(cleared?.description, null);
      assert.equal(archived?.archivedAt, NOW);
      assert.deepEqual(
        requests.map((request) => [request.url, request.body]),
        [
          [
            `${API_URL}/rest/v1/rpc/create_learning_objective`,
            {
              p_course_id: COURSE_ID,
              p_title: "Различает второй и третий тон",
              p_description: "Слышит различие в знакомых словах",
            },
          ],
          [
            `${API_URL}/rest/v1/rpc/update_learning_objective`,
            {
              p_objective_id: OBJECTIVE_ID,
              p_title: "Различает тоны в знакомых словах",
              p_update_title: true,
              p_description: null,
              p_update_description: false,
            },
          ],
          [
            `${API_URL}/rest/v1/rpc/update_learning_objective`,
            {
              p_objective_id: OBJECTIVE_ID,
              p_title: null,
              p_update_title: false,
              p_description: null,
              p_update_description: true,
            },
          ],
          [
            `${API_URL}/rest/v1/rpc/archive_learning_objective`,
            { p_objective_id: OBJECTIVE_ID },
          ],
        ],
      );
    },
  );
});

test("assembleDraft sends one validated plan to the transactional RPC", async () => {
  const resultPayload = {
    courseId: COURSE_ID,
    lessonIds: [LESSON_ID],
    componentIds: [COMPONENT_ID],
    alreadyAssembled: false,
  };
  await withMockSupabase(
    [{ payload: resultPayload }],
    async (repository, requests) => {
      const result = await repository.assembleDraft({
        courseId: COURSE_ID,
        lesson: { title: "Введение", summary: "Первый урок" },
        components: [
          {
            typeKey: "rich_text",
            schemaVersion: 1,
            payload: { title: "Знакомство", format: "markdown" },
            placement: { width: "content", textAlign: "start" },
          },
        ],
      });

      assert.deepEqual(result, resultPayload);
      assert.equal(requests.length, 1);
      assert.equal(
        requests[0]?.url,
        `${API_URL}/rest/v1/rpc/assemble_course_draft`,
      );
      assert.equal(requests[0]?.method, "POST");
      assert.deepEqual(requests[0]?.body, {
        p_course_id: COURSE_ID,
        p_lesson_title: "Введение",
        p_lesson_summary: "Первый урок",
        p_components: [
          {
            typeKey: "rich_text",
            schemaVersion: 1,
            payload: { title: "Знакомство", format: "markdown" },
            placement: { width: "content", textAlign: "start" },
          },
        ],
      });
    },
  );
});

test("addComponent persists an ordered component directly under Lesson", async () => {
  await withMockSupabase(
    [{ payload: [] }, { payload: [componentRow()] }],
    async (repository, requests) => {
      const component = await repository.addComponent({
        lessonId: LESSON_ID,
        typeKey: "quote",
        schemaVersion: 1,
        payload: { text: "Путь начинается с первого шага." },
        placement: { width: "content", textAlign: "left" },
        primaryLearningObjectiveId: null,
        activityRole: null,
      });

      assert.equal(component.lessonId, LESSON_ID);
      assert.equal(
        requests[0]?.url,
        `${API_URL}/rest/v1/lesson_component?select=position&lesson_id=eq.${LESSON_ID}&order=position.desc&limit=1`,
      );
      assert.equal(requests[1]?.url, `${API_URL}/rest/v1/lesson_component`);
      assert.deepEqual(requests[1]?.body, {
        lesson_id: LESSON_ID,
        type_key: "quote",
        schema_version: 1,
        position: 1,
        payload: { text: "Путь начинается с первого шага." },
        placement_config: { width: "content", textAlign: "left" },
        primary_learning_objective_id: null,
        activity_role: null,
      });
    },
  );
});

test("Component alignment and activity role are persisted in one atomic row mutation", async () => {
  await withMockSupabase(
    [
      {
        payload: [
          componentRow({
            primary_learning_objective_id: OBJECTIVE_ID,
            activity_role: "assessment",
          }),
        ],
      },
    ],
    async (repository, requests) => {
      const component = await repository.updateComponent({
        componentId: COMPONENT_ID,
        primaryLearningObjectiveId: OBJECTIVE_ID,
        activityRole: "assessment",
      });

      assert.equal(component?.primaryLearningObjectiveId, OBJECTIVE_ID);
      assert.equal(component?.activityRole, "assessment");
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.method, "POST");
      assert.equal(
        requests[0]?.url,
        `${API_URL}/rest/v1/rpc/update_lesson_component_v2`,
      );
      assert.deepEqual(requests[0]?.body, {
        p_component_id: COMPONENT_ID,
        p_payload: null,
        p_update_payload: false,
        p_placement_config: null,
        p_update_placement_config: false,
        p_primary_learning_objective_id: OBJECTIVE_ID,
        p_update_primary_learning_objective_id: true,
        p_activity_role: "assessment",
        p_update_activity_role: true,
      });
    },
  );
});

test("updateComponent persists payload fields without changing Student Screen assignment", async () => {
  await withMockSupabase(
    [
      {
        payload: [{ ...componentRow(), payload: { text: "Новая цитата" } }],
      },
    ],
    async (repository, requests) => {
      const component = await repository.updateComponent({
        componentId: COMPONENT_ID,
        payload: { text: "Новая цитата" },
      });

      assert.deepEqual(component?.payload, { text: "Новая цитата" });
      assert.equal(requests[0]?.method, "POST");
      assert.equal(
        requests[0]?.url,
        `${API_URL}/rest/v1/rpc/update_lesson_component_v2`,
      );
      assert.deepEqual(requests[0]?.body, {
        p_component_id: COMPONENT_ID,
        p_payload: { text: "Новая цитата" },
        p_update_payload: true,
        p_placement_config: null,
        p_update_placement_config: false,
        p_primary_learning_objective_id: null,
        p_update_primary_learning_objective_id: false,
        p_activity_role: null,
        p_update_activity_role: false,
      });
    },
  );
});

test("updateComponent sends explicit nulls only when alignment fields are cleared", async () => {
  await withMockSupabase(
    [{ payload: [componentRow()] }],
    async (repository, requests) => {
      await repository.updateComponent({
        componentId: COMPONENT_ID,
        primaryLearningObjectiveId: null,
        activityRole: null,
      });

      assert.deepEqual(requests[0]?.body, {
        p_component_id: COMPONENT_ID,
        p_payload: null,
        p_update_payload: false,
        p_placement_config: null,
        p_update_placement_config: false,
        p_primary_learning_objective_id: null,
        p_update_primary_learning_objective_id: true,
        p_activity_role: null,
        p_update_activity_role: true,
      });
    },
  );
});

test("setComponentStudentScreen delegates existing/new/hide semantics to the atomic RPC", async () => {
  await withMockSupabase(
    [{ payload: [componentRow()] }],
    async (repository, requests) => {
      const component = await repository.setComponentStudentScreen(
        COMPONENT_ID,
        { mode: "new" },
      );

      assert.equal(component?.studentSlideId, componentRow().student_slide_id);
      assert.equal(
        requests[0]?.url,
        `${API_URL}/rest/v1/rpc/set_lesson_component_student_screen`,
      );
      assert.deepEqual(requests[0]?.body, {
        p_component_id: COMPONENT_ID,
        p_mode: "new",
        p_slide_id: null,
      });
      assert.equal(requests.length, 1);
    },
  );
});

test("deleteComponent delegates cleanup and serialization to the atomic RPC", async () => {
  await withMockSupabase([{ payload: true }], async (repository, requests) => {
    assert.equal(await repository.deleteComponent(COMPONENT_ID), true);
    assert.equal(
      requests[0]?.url,
      `${API_URL}/rest/v1/rpc/delete_lesson_component`,
    );
    assert.equal(requests[0]?.method, "POST");
    assert.deepEqual(requests[0]?.body, {
      p_component_id: COMPONENT_ID,
    });
    assert.equal(requests.length, 1);
  });
});

test("reorderComponent maps the full component returned atomically by the RPC", async () => {
  await withMockSupabase(
    [{ payload: [componentRow()] }],
    async (repository, requests) => {
      const component = await repository.reorderComponent(COMPONENT_ID, 1);

      assert.equal(component?.typeKey, "quote");
      assert.deepEqual(component?.payload, {
        text: "Путь начинается с первого шага.",
      });
      assert.equal(
        requests[0]?.url,
        `${API_URL}/rest/v1/rpc/reorder_lesson_component`,
      );
      assert.deepEqual(requests[0]?.body, {
        p_component_id: COMPONENT_ID,
        p_new_position: 1,
      });
      assert.equal(requests.length, 1);
    },
  );
});

test("network failures surface as a stable repository 503", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;
  globalThis.fetch = (async () => {
    throw new TypeError("network unavailable");
  }) as typeof fetch;

  try {
    const repository = createCourseBuilderRepository(ACCESS_TOKEN);
    await assert.rejects(
      () => repository.listCourses(),
      (error: unknown) =>
        error instanceof CourseBuilderRepositoryError &&
        error.status === 503 &&
        error.code === "repository_network_error",
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnonKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
  }
});
