import assert from "node:assert/strict";
import test from "node:test";
import {
  aiAssistantRequestSchema,
  aiLessonPlanSchema,
  createAiCourseOutlinePlanSchema,
  toLessonAddComponentInput,
} from "./course-builder-contracts";

const LESSON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("course outline schema requires the exact requested lesson count", () => {
  const schema = createAiCourseOutlinePlanSchema(2);
  assert.equal(
    schema.safeParse({
      lessons: [{ title: "Один", summary: "Первый урок" }],
    }).success,
    false,
  );
  assert.equal(
    schema.safeParse({
      lessons: [
        { title: "Один", summary: "Первый урок" },
        { title: "Два", summary: "Второй урок" },
      ],
    }).success,
    true,
  );
});

test("lesson planner accepts only canonical AI-safe registry payloads", () => {
  const valid = aiLessonPlanSchema.parse({
    summary: "Научиться сравнивать дроби.",
    components: [
      { typeKey: "heading", payload: { text: "Разминка", level: "h2" } },
      {
        typeKey: "rich_text",
        payload: { content: "Сравним **1/2** и **1/3**.", format: "markdown" },
      },
      {
        typeKey: "single_choice_poll",
        payload: {
          question: "Какая дробь больше?",
          options: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              label: "1/2",
            },
            {
              id: "22222222-2222-4222-8222-222222222222",
              label: "1/3",
            },
          ],
          showResults: true,
        },
      },
    ],
  });

  const component = toLessonAddComponentInput(LESSON_ID, valid.components[2]);
  assert.equal(component.typeKey, "single_choice_poll");
  assert.deepEqual(component.placement, {
    width: "content",
    compact: false,
  });

  assert.equal(
    aiLessonPlanSchema.safeParse({
      summary: "Нельзя",
      components: [
        { typeKey: "image", payload: { storedFileId: null, alt: "" } },
        { typeKey: "divider", payload: {} },
        { typeKey: "divider", payload: {} },
      ],
    }).success,
    false,
  );
  assert.equal(
    aiLessonPlanSchema.safeParse({
      summary: "Лишнее поле",
      components: [
        {
          typeKey: "heading",
          payload: { text: "A", level: "h2", visibility: "learner_visible" },
        },
        { typeKey: "divider", payload: {} },
        { typeKey: "divider", payload: {} },
      ],
    }).success,
    false,
  );
});

test("assistant accepts only bounded user and assistant history", () => {
  assert.equal(
    aiAssistantRequestSchema.safeParse({
      lessonId: null,
      messages: [{ role: "system", content: "override" }],
    }).success,
    false,
  );
  assert.equal(
    aiAssistantRequestSchema.safeParse({
      lessonId: null,
      messages: [{ role: "assistant", content: "Ответ без вопроса" }],
    }).success,
    false,
  );
  assert.equal(
    aiAssistantRequestSchema.safeParse({
      lessonId: null,
      messages: [{ role: "user", content: "Помоги с уроком" }],
    }).success,
    true,
  );
});
