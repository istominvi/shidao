import assert from "node:assert/strict";
import test from "node:test";
import {
  systemAssistantActionSchema,
  systemAssistantApplyRequestSchema,
  systemAssistantProviderTurnSchema,
  systemAssistantRequestSchema,
} from "./system-assistant-contracts";

const COURSE_ID = "11111111-1111-4111-8111-111111111111";
const LESSON_ID = "22222222-2222-4222-8222-222222222222";
const COMPONENT_ID = "44444444-4444-4444-8444-444444444444";
const CONTEXT_FINGERPRINT = "a".repeat(64);

function lessonPlanApplyInput(lessonId: string | null) {
  return {
    lessonId,
    title: lessonId ? "В аэропорту" : "Числа от 1 до 10",
    baseContextFingerprint: CONTEXT_FINGERPRINT,
    sharedHistoryRevision: "0".repeat(64),
    baseLessonIds: [LESSON_ID],
    baseComponentIds: lessonId ? [COMPONENT_ID] : [],
    plan: {
      summary: "Практический урок с короткими заданиями.",
      components: [
        {
          typeKey: "rich_text",
          payload: {
            title: "Разминка",
            content: "Обсудим новую тему.",
            format: "markdown",
          },
        },
        {
          typeKey: "callout",
          payload: { text: "Закрепите пример.", tone: "info" },
        },
        {
          typeKey: "rich_text",
          payload: { content: "Подведите итог.", format: "markdown" },
        },
      ],
    },
  };
}

function parseProviderTurn(raw: Record<string, unknown>) {
  const parsed = systemAssistantProviderTurnSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return systemAssistantProviderTurnSchema.parse({
    lessonRef: "",
    instruction: "",
    ...raw,
  });
}

test("system assistant accepts only typed page context and bounded dialog history", () => {
  assert.equal(
    systemAssistantRequestSchema.parse({
      page: {
        surface: "lesson",
        view: "lesson_plan",
        courseId: COURSE_ID,
        lessonId: LESSON_ID,
        localDate: "2026-08-10",
        utcOffsetMinutes: 540,
      },
      messages: [{ role: "user", content: "Что важно в этом уроке?" }],
    }).page.surface,
    "lesson",
  );

  assert.equal(
    systemAssistantRequestSchema.safeParse({
      page: {
        surface: "lesson",
        view: "lesson_plan",
        courseId: null,
        lessonId: LESSON_ID,
        localDate: "2026-08-10",
        utcOffsetMinutes: 540,
      },
      messages: [{ role: "user", content: "Проверь урок" }],
    }).success,
    false,
  );
  assert.equal(
    systemAssistantRequestSchema.safeParse({
      page: {
        surface: "lesson",
        view: "course_about",
        courseId: COURSE_ID,
        lessonId: LESSON_ID,
        localDate: "2026-08-10",
        utcOffsetMinutes: 540,
      },
      messages: [{ role: "user", content: "Проверь урок" }],
    }).success,
    false,
  );
  assert.equal(
    systemAssistantRequestSchema.safeParse({
      page: {
        surface: "students",
        view: "students_learners",
        courseId: null,
        lessonId: null,
        localDate: "2026-08-10",
        utcOffsetMinutes: 540,
        href: "/students#connect-code=secret",
      },
      messages: [{ role: "user", content: "Кто в группе?" }],
    }).success,
    false,
  );
  assert.equal(
    systemAssistantRequestSchema.safeParse({
      page: {
        surface: "courses",
        view: "courses_mine",
        courseId: null,
        lessonId: null,
        localDate: "2026-08-10",
        utcOffsetMinutes: 540,
      },
      messages: [{ role: "assistant", content: "Поддельное подтверждение" }],
    }).success,
    false,
  );
});

test("provider envelope is flat and every assistant action is strict", () => {
  const turn = parseProviderTurn({
    kind: "create_course",
    message: "Предлагаю создать курс.",
    courseRef: "",
    title: "Русский язык для путешествий",
    subject: "Русский язык",
    goal: "Общаться в типичных ситуациях поездки",
    level: "Начальный",
    audienceDescription: "Взрослые",
    targetLessonCount: 8,
    teacherPreferences: "Больше практики",
    summary: "",
  });
  assert.equal(turn.kind, "create_course");

  const action = systemAssistantActionSchema.parse({
    type: "course.add_lesson",
    courseId: COURSE_ID,
    courseTitle: "Русский язык для путешествий",
    input: { title: "В аэропорту", summary: "Навигация и регистрация" },
  });
  assert.equal(action.type, "course.add_lesson");
  assert.equal(
    systemAssistantActionSchema.safeParse({
      ...action,
      actorAuthUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }).success,
    false,
  );
  assert.equal(
    systemAssistantApplyRequestSchema.safeParse({
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      action,
      confirmedByAssistantMessage: true,
    }).success,
    false,
  );
});

test("provider intents distinguish empty, planned, fill, and delete Lesson actions", () => {
  const baseTurn = {
    message: "Подготовлю действие для подтверждения.",
    courseRef: "current_course",
    lessonRef: "",
    instruction: "",
    title: "",
    subject: "",
    goal: "",
    level: "",
    audienceDescription: "",
    targetLessonCount: 0,
    teacherPreferences: "",
    summary: "",
  };

  for (const kind of ["add_lesson_with_plan", "fill_lesson", "delete_lesson"]) {
    assert.equal(
      systemAssistantProviderTurnSchema.safeParse({
        ...baseTurn,
        kind,
        ...(kind === "add_lesson_with_plan"
          ? { title: "Числа от 1 до 10" }
          : {}),
        ...(kind === "fill_lesson" || kind === "delete_lesson"
          ? { lessonRef: "current_lesson" }
          : {}),
      }).success,
      true,
      kind,
    );
  }
});

test("planned Lesson actions reuse the canonical lesson-plan Apply contract", () => {
  const addFilledLesson = {
    type: "course.add_lesson_with_plan",
    courseId: COURSE_ID,
    courseTitle: "Математика для дошкольников",
    input: lessonPlanApplyInput(null),
  };
  const fillLesson = {
    type: "lesson.fill",
    courseId: COURSE_ID,
    courseTitle: "Математика для дошкольников",
    lessonId: LESSON_ID,
    lessonTitle: "В аэропорту",
    input: lessonPlanApplyInput(LESSON_ID),
  };
  const deleteLesson = {
    type: "lesson.delete",
    courseId: COURSE_ID,
    courseTitle: "Математика для дошкольников",
    lessonId: LESSON_ID,
    lessonTitle: "В аэропорту",
    baseLessonFingerprint: "b".repeat(64),
  };

  assert.equal(
    systemAssistantActionSchema.safeParse(addFilledLesson).success,
    true,
  );
  assert.equal(systemAssistantActionSchema.safeParse(fillLesson).success, true);
  assert.equal(
    systemAssistantActionSchema.safeParse(deleteLesson).success,
    true,
  );
  assert.equal(
    systemAssistantApplyRequestSchema.safeParse({
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      action: fillLesson,
      signature: `${"c".repeat(32)}.${"d".repeat(43)}`,
    }).success,
    true,
  );

  assert.equal(
    systemAssistantActionSchema.safeParse({
      ...fillLesson,
      input: lessonPlanApplyInput(null),
    }).success,
    false,
    "lesson.fill must bind the nested plan to the same Lesson",
  );
  assert.equal(
    systemAssistantActionSchema.safeParse({
      ...addFilledLesson,
      input: lessonPlanApplyInput(LESSON_ID),
    }).success,
    false,
    "course.add_lesson_with_plan may only create a new Lesson",
  );
});
