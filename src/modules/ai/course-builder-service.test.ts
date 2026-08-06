import assert from "node:assert/strict";
import test from "node:test";
import type {
  CourseBuilderActor,
  CourseLesson,
  CourseWorkspace,
  LessonComponent,
} from "@/modules/course-builder/domain";
import { CourseBuilderAccessError } from "@/modules/course-builder/contracts";
import type { LessonAddComponentInput } from "@/modules/course-builder/registry/contracts";
import type { RouterAiClient, RouterAiJsonCompletionInput } from "./routerai";
import {
  createAiCourseBuilderService,
  type AiCourseBuilderApplicationService,
} from "./course-builder-service";
import type { AiLessonPlan } from "./course-builder-contracts";

const ACTOR: CourseBuilderActor = {
  authUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  accessToken: "test-user-token",
};
const COURSE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LESSON_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = "2026-08-05T00:00:00.000Z";

function emptyCourse(targetLessonCount = 2): CourseWorkspace {
  return {
    id: COURSE_ID,
    ownerAccountId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    title: "Китайский для путешествий",
    subject: "Китайский язык",
    goal: "Научиться решать бытовые задачи в поездке",
    level: "С нуля",
    audienceDescription: "Взрослый ученик",
    targetLessonCount,
    teacherPreferences: "Больше диалогов",
    status: "draft",
    lessonCount: 0,
    assembledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    lessons: [],
    attachments: [],
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function inMemoryService(
  course: CourseWorkspace,
  options: { failComponentAt?: number } = {},
) {
  let lessonSequence = 1;
  let componentSequence = 1;
  let componentAttempts = 0;

  const service: AiCourseBuilderApplicationService = {
    async getCourse() {
      course.lessonCount = course.lessons.length;
      return clone(course);
    },
    async addLesson(_actor, courseId, rawInput) {
      assert.equal(courseId, COURSE_ID);
      const input = rawInput as { title: string; summary: string };
      const id =
        course.lessons.length === 0 && lessonSequence === 1
          ? LESSON_ID
          : `10000000-0000-4000-8000-${String(lessonSequence).padStart(12, "0")}`;
      lessonSequence += 1;
      const lesson: CourseLesson = {
        id,
        courseId,
        position: course.lessons.length + 1,
        title: input.title,
        summary: input.summary,
        components: [],
        studentSlides: [],
        createdAt: NOW,
        updatedAt: NOW,
      };
      course.lessons.push(lesson);
      course.lessonCount = course.lessons.length;
      return clone(lesson);
    },
    async updateLesson(_actor, lessonId, rawInput) {
      const lesson = course.lessons.find((item) => item.id === lessonId);
      if (!lesson) throw new CourseBuilderAccessError("Урок не найден.");
      const input = rawInput as { title?: string; summary?: string };
      if (input.title !== undefined) lesson.title = input.title;
      if (input.summary !== undefined) lesson.summary = input.summary;
      lesson.updatedAt = NOW;
      return clone(lesson);
    },
    async deleteLesson(_actor, lessonId) {
      const index = course.lessons.findIndex((item) => item.id === lessonId);
      if (index < 0) throw new CourseBuilderAccessError("Урок не найден.");
      course.lessons.splice(index, 1);
      course.lessons.forEach((lesson, position) => {
        lesson.position = position + 1;
      });
      course.lessonCount = course.lessons.length;
      return { lessonId };
    },
    async addComponent(_actor, rawInput) {
      componentAttempts += 1;
      if (componentAttempts === options.failComponentAt) {
        throw new Error("simulated component failure");
      }
      const input = rawInput as LessonAddComponentInput;
      const lesson = course.lessons.find((item) => item.id === input.lessonId);
      if (!lesson) throw new CourseBuilderAccessError("Урок не найден.");
      const component: LessonComponent = {
        id: `20000000-0000-4000-8000-${String(componentSequence++).padStart(12, "0")}`,
        lessonId: lesson.id,
        typeKey: input.typeKey,
        schemaVersion: 1,
        position: lesson.components.length + 1,
        payload: clone(input.payload),
        placement: clone(input.placement),
        visibility: "staff_only",
        studentSlideId: null,
        createdAt: NOW,
        updatedAt: NOW,
      };
      lesson.components.push(component);
      return clone(component);
    },
    async deleteComponent(_actor, componentId) {
      for (const lesson of course.lessons) {
        const index = lesson.components.findIndex(
          (component) => component.id === componentId,
        );
        if (index >= 0) {
          lesson.components.splice(index, 1);
          return { componentId };
        }
      }
      throw new CourseBuilderAccessError("Компонент не найден.");
    },
  };

  return { service, course };
}

const METADATA = {
  requestId: "request-1",
  model: "qwen/qwen3-30b-a3b-instruct-2507",
  provider: "test-provider",
  finishReason: "stop",
  usage: {
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    cachedInputTokens: 0,
    reasoningTokens: 0,
  },
} as const;

function jsonProvider(value: unknown, onCall?: () => void): RouterAiClient {
  return {
    async completeText() {
      throw new Error("Unexpected text completion");
    },
    async completeJson<T>(input: RouterAiJsonCompletionInput<T>) {
      onCall?.();
      return {
        ...METADATA,
        value: input.outputSchema.parse(value) as T,
      };
    },
  };
}

const LESSON_PLAN: AiLessonPlan = {
  summary: "Научиться знакомиться и представляться.",
  components: [
    {
      typeKey: "heading",
      payload: { text: "Приветствие", level: "h2" },
    },
    {
      typeKey: "rich_text",
      payload: {
        content: "Разберите короткий диалог знакомства.",
        format: "markdown",
      },
    },
    {
      typeKey: "callout",
      payload: {
        title: "Подсказка",
        text: "Сначала произнесите фразу медленно.",
        tone: "info",
      },
    },
  ],
};

test("ownership is checked before RouterAI is invoked", async () => {
  let providerCalls = 0;
  const service = {
    ...inMemoryService(emptyCourse()).service,
    async getCourse() {
      throw new CourseBuilderAccessError();
    },
  } satisfies AiCourseBuilderApplicationService;

  await assert.rejects(
    createAiCourseBuilderService({
      actor: ACTOR,
      service,
      provider: jsonProvider({}, () => {
        providerCalls += 1;
      }),
    }).planCourse(COURSE_ID, { instruction: "" }),
    CourseBuilderAccessError,
  );
  assert.equal(providerCalls, 0);
});

test("course generation previews without writes and applies idempotently", async () => {
  const state = inMemoryService(emptyCourse(2));
  const outline = {
    lessons: [
      { title: "Знакомство", summary: "Базовые фразы знакомства." },
      { title: "В аэропорту", summary: "Регистрация и навигация." },
    ],
  };
  const ai = createAiCourseBuilderService({
    actor: ACTOR,
    service: state.service,
    provider: jsonProvider(outline),
    audit: () => undefined,
  });

  const preview = await ai.planCourse(COURSE_ID, { instruction: "" });
  assert.deepEqual(preview.plan, outline);
  assert.equal(state.course.lessons.length, 0);

  const first = await ai.applyCoursePlan(COURSE_ID, {
    baseContextFingerprint: preview.baseContextFingerprint,
    plan: preview.plan,
  });
  assert.equal(first.createdLessonIds.length, 2);
  assert.equal(state.course.lessons.length, 2);

  const retry = await ai.applyCoursePlan(COURSE_ID, {
    baseContextFingerprint: preview.baseContextFingerprint,
    plan: preview.plan,
  });
  assert.equal(retry.alreadyApplied, true);
  assert.equal(state.course.lessons.length, 2);
});

test("course apply rejects a preview after the course context changes", async () => {
  const state = inMemoryService(emptyCourse(1));
  const outline = {
    lessons: [{ title: "Знакомство", summary: "Базовые фразы знакомства." }],
  };
  const ai = createAiCourseBuilderService({
    actor: ACTOR,
    service: state.service,
    provider: jsonProvider(outline),
    audit: () => undefined,
  });
  const preview = await ai.planCourse(COURSE_ID, { instruction: "" });
  state.course.goal = "Новая цель после предпросмотра";

  await assert.rejects(
    ai.applyCoursePlan(COURSE_ID, {
      baseContextFingerprint: preview.baseContextFingerprint,
      plan: preview.plan,
    }),
    /изменился после предпросмотра/,
  );
  assert.equal(state.course.lessons.length, 0);
});

test("lesson plan applies canonical private components after preview", async () => {
  const course = emptyCourse(1);
  const state = inMemoryService(course);
  const lesson = await state.service.addLesson(ACTOR, COURSE_ID, {
    title: "Знакомство",
    summary: "",
  });
  const ai = createAiCourseBuilderService({
    actor: ACTOR,
    service: state.service,
    provider: jsonProvider(LESSON_PLAN),
    audit: () => undefined,
  });

  const preview = await ai.planLesson(COURSE_ID, {
    lessonId: lesson.id,
    title: lesson.title,
    instruction: "",
  });
  assert.equal(state.course.lessons[0]?.components.length, 0);
  const result = await ai.applyLessonPlan(COURSE_ID, {
    lessonId: preview.lessonId,
    title: preview.title,
    baseContextFingerprint: preview.baseContextFingerprint,
    baseLessonIds: preview.baseLessonIds,
    baseComponentIds: preview.baseComponentIds,
    plan: preview.plan,
  });
  assert.equal(result.componentIds.length, 3);
  assert.equal(state.course.lessons[0]?.summary, LESSON_PLAN.summary);
  assert.deepEqual(
    state.course.lessons[0]?.components.map(
      (component) => component.visibility,
    ),
    ["staff_only", "staff_only", "staff_only"],
  );
});

test("failed new lesson apply compensates the partial database writes", async () => {
  const state = inMemoryService(emptyCourse(1), { failComponentAt: 2 });
  const ai = createAiCourseBuilderService({
    actor: ACTOR,
    service: state.service,
    provider: jsonProvider(LESSON_PLAN),
    audit: () => undefined,
  });
  const preview = await ai.planLesson(COURSE_ID, {
    lessonId: null,
    title: "Знакомство",
    instruction: "",
  });

  await assert.rejects(
    ai.applyLessonPlan(COURSE_ID, {
      lessonId: preview.lessonId,
      title: preview.title,
      baseContextFingerprint: preview.baseContextFingerprint,
      baseLessonIds: preview.baseLessonIds,
      baseComponentIds: preview.baseComponentIds,
      plan: preview.plan,
    }),
    /simulated component failure/,
  );
  assert.equal(state.course.lessons.length, 0);
});

test("lesson apply rejects a preview after the lesson content changes", async () => {
  const state = inMemoryService(emptyCourse(1));
  const lesson = await state.service.addLesson(ACTOR, COURSE_ID, {
    title: "Знакомство",
    summary: "Первая версия",
  });
  const ai = createAiCourseBuilderService({
    actor: ACTOR,
    service: state.service,
    provider: jsonProvider(LESSON_PLAN),
    audit: () => undefined,
  });
  const preview = await ai.planLesson(COURSE_ID, {
    lessonId: lesson.id,
    title: lesson.title,
    instruction: "",
  });

  await state.service.updateLesson(ACTOR, lesson.id, {
    summary: "Свежая ручная правка",
  });

  await assert.rejects(
    ai.applyLessonPlan(COURSE_ID, {
      lessonId: preview.lessonId,
      title: preview.title,
      baseContextFingerprint: preview.baseContextFingerprint,
      baseLessonIds: preview.baseLessonIds,
      baseComponentIds: preview.baseComponentIds,
      plan: preview.plan,
    }),
    /изменились после предпросмотра/,
  );
  assert.equal(state.course.lessons[0]?.summary, "Свежая ручная правка");
  assert.equal(state.course.lessons[0]?.components.length, 0);
});
