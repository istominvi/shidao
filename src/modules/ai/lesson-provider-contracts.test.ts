import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { RouterAiError } from "./routerai";
import {
  aiLessonProviderPlanSchema,
  providerJsonSchemaFor,
  toCanonicalAiLessonPlan,
} from "./lesson-provider-contracts";

const EMPTY_FIELDS = {
  title: "",
  body: "",
  choices: [] as string[],
  matches: [] as { left: string; right: string }[],
};

test("flat provider lesson converts every supported block to canonical components", () => {
  const plan = toCanonicalAiLessonPlan({
    summary: "Разобрать знакомство и закрепить ключевые фразы.",
    blocks: [
      {
        ...EMPTY_FIELDS,
        kind: "heading",
        title: "Знакомство",
      },
      {
        ...EMPTY_FIELDS,
        kind: "rich_text",
        body: "Прочитайте **диалог** и выделите приветствие.",
      },
      {
        ...EMPTY_FIELDS,
        kind: "callout",
        title: "Подсказка",
        body: "Сначала произнесите реплики медленно.",
      },
      {
        ...EMPTY_FIELDS,
        kind: "single_choice_poll",
        title: "Какую фразу используют при знакомстве?",
        choices: ["你好", "再见", "你好"],
      },
      {
        ...EMPTY_FIELDS,
        kind: "matching_game",
        title: "Соедините фразу и перевод",
        matches: [
          { left: "你好", right: "Здравствуйте" },
          { left: "谢谢", right: "Спасибо" },
          { left: "你好", right: "Здравствуйте" },
        ],
      },
    ],
  });

  assert.deepEqual(
    plan.components.map((component) => component.typeKey),
    ["heading", "rich_text", "callout", "single_choice_poll", "matching_game"],
  );
  const heading = plan.components[0];
  assert.equal(heading?.typeKey, "heading");
  if (heading?.typeKey !== "heading") assert.fail("Expected heading");
  assert.deepEqual(heading.payload, { text: "Знакомство", level: "h2" });

  const richText = plan.components[1];
  assert.equal(richText?.typeKey, "rich_text");
  if (richText?.typeKey !== "rich_text") assert.fail("Expected rich text");
  assert.equal(richText.payload.format, "markdown");

  const callout = plan.components[2];
  assert.equal(callout?.typeKey, "callout");
  if (callout?.typeKey !== "callout") assert.fail("Expected callout");
  assert.equal(callout.payload.tone, "info");

  const poll = plan.components[3];
  assert.equal(poll?.typeKey, "single_choice_poll");
  if (poll?.typeKey !== "single_choice_poll") assert.fail("Expected poll");
  assert.deepEqual(
    poll.payload.options.map((option) => option.label),
    ["你好", "再见"],
  );
  assert.equal(poll.payload.showResults, true);

  const matching = plan.components[4];
  assert.equal(matching?.typeKey, "matching_game");
  if (matching?.typeKey !== "matching_game") {
    assert.fail("Expected matching game");
  }
  assert.equal(matching.payload.pairs.length, 2);
  assert.equal(matching.payload.shuffle, true);

  const ids = [
    ...poll.payload.options.map((option) => option.id),
    ...matching.payload.pairs.map((pair) => pair.id),
  ];
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(
    ids.every((id) => z.uuid().safeParse(id).success),
    true,
  );
});

test("provider conversion rejects invalid content for every content-bearing kind", () => {
  const validBaseBlocks = [
    {
      ...EMPTY_FIELDS,
      kind: "heading",
      body: "Разминка",
    },
    {
      ...EMPTY_FIELDS,
      kind: "rich_text",
      body: "Прочитайте пример.",
    },
    {
      ...EMPTY_FIELDS,
      kind: "callout",
      body: "Обратите внимание на произношение.",
    },
  ];
  const invalidBlocks = [
    { ...EMPTY_FIELDS, kind: "heading" },
    { ...EMPTY_FIELDS, kind: "rich_text" },
    { ...EMPTY_FIELDS, kind: "callout" },
    {
      ...EMPTY_FIELDS,
      kind: "single_choice_poll",
      title: "Выберите вариант",
      choices: ["Один"],
    },
    {
      ...EMPTY_FIELDS,
      kind: "matching_game",
      title: "Соедините пары",
      matches: [{ left: "Один", right: "One" }],
    },
  ];

  for (const invalidBlock of invalidBlocks) {
    assert.throws(
      () =>
        toCanonicalAiLessonPlan({
          summary: "Проверить структуру ответа.",
          blocks: [invalidBlock, ...validBaseBlocks.slice(1)],
        }),
      (error: unknown) => {
        assert.ok(error instanceof RouterAiError);
        assert.equal(error.code, "invalid_output");
        return true;
      },
    );
  }
});

test("provider conversion rejects semantically empty interactive output safely", () => {
  const privateProviderValue = "private-provider-choice";

  assert.throws(
    () =>
      toCanonicalAiLessonPlan(
        {
          summary: "Проверить понимание материала.",
          blocks: [
            {
              ...EMPTY_FIELDS,
              kind: "heading",
              body: "Проверка",
            },
            {
              ...EMPTY_FIELDS,
              kind: "rich_text",
              body: "Вспомните ключевые фразы.",
            },
            {
              ...EMPTY_FIELDS,
              kind: "single_choice_poll",
              title: "Выберите фразу",
              choices: [privateProviderValue, privateProviderValue],
            },
          ],
        },
        "request-safe-1",
      ),
    (error: unknown) => {
      assert.ok(error instanceof RouterAiError);
      assert.equal(error.code, "invalid_output");
      assert.equal(error.requestId, "request-safe-1");
      assert.equal(String(error).includes(privateProviderValue), false);
      return true;
    },
  );
});

test("provider JSON schema keeps structure but omits incompatible size keywords", () => {
  const schema = providerJsonSchemaFor(aiLessonProviderPlanSchema);
  const serialized = JSON.stringify(schema);

  for (const keyword of [
    "$schema",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
  ]) {
    assert.equal(serialized.includes(`\"${keyword}\"`), false);
  }
  assert.equal(serialized.includes("additionalProperties"), true);
  assert.equal(serialized.includes("blocks"), true);
  assert.equal(serialized.includes("matching_game"), true);
  assert.equal(serialized.includes("oneOf"), false);
  assert.equal(serialized.includes("anyOf"), false);

  const properties = schema.properties as Record<
    string,
    Record<string, unknown>
  >;
  const blockItems = properties.blocks?.items as Record<string, unknown>;
  const blockProperties = blockItems.properties as Record<
    string,
    Record<string, unknown>
  >;
  assert.deepEqual(blockItems.required, [
    "kind",
    "title",
    "body",
    "choices",
    "matches",
  ]);
  assert.deepEqual(blockProperties.kind?.enum, [
    "heading",
    "rich_text",
    "callout",
    "single_choice_poll",
    "matching_game",
  ]);
  assert.ok(blockProperties.choices?.items);
  assert.ok(blockProperties.matches?.items);
});
