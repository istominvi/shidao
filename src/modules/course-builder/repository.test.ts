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

function componentRow() {
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
    created_at: NOW,
    updated_at: NOW,
  };
}

test("getCourseWorkspace loads ordered Student Screen slides beside the canonical component list", async () => {
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
    ],
    async (repository, requests) => {
      const workspace = await repository.getCourseWorkspace(COURSE_ID);

      assert.equal(workspace?.lessons[0]?.studentSlides[0]?.id, SLIDE_ID);
      assert.equal(
        workspace?.lessons[0]?.components[0]?.studentSlideId,
        SLIDE_ID,
      );
      assert.match(
        requests[1]?.url ?? "",
        /components:lesson_component\(\*\).*studentSlides:lesson_student_slide\(\*\)/,
      );
      assert.equal(requests.length, 3);
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
      assert.equal(requests[0]?.method, "PATCH");
      assert.deepEqual(requests[0]?.body, {
        payload: { text: "Новая цитата" },
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
