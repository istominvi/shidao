import assert from "node:assert/strict";
import test from "node:test";
import {
  componentDefinitions,
  componentJsonSchemas,
  componentRegistry,
  componentTypeKeySchema,
  componentTypeKeys,
  findComponentDefinition,
  getComponentDefinition,
  lessonAddComponentInputJsonSchema,
  lessonAddComponentInputSchema,
  parseComponentPayload,
  parseLessonAddComponentInput,
  type ComponentTypeKey,
} from "./contracts";

const EXPECTED_KEYS = [
  "heading",
  "rich_text",
  "callout",
  "quote",
  "divider",
  "image",
  "slideshow",
  "single_choice_poll",
  "matching_game",
  "file",
] as const;

const STEP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("registry exposes exactly the ten milestone component keys", () => {
  assert.deepEqual(componentTypeKeys, EXPECTED_KEYS);
  assert.deepEqual(componentTypeKeySchema.options, EXPECTED_KEYS);
  assert.deepEqual(Object.keys(componentRegistry), EXPECTED_KEYS);
  assert.deepEqual(
    componentDefinitions.map((definition) => definition.key),
    EXPECTED_KEYS,
  );

  for (const definition of componentDefinitions) {
    assert.equal(definition.version, 1);
    assert.ok(definition.title.length > 0);
    assert.ok(definition.aiInstructions.length > 0);
    assert.equal(getComponentDefinition(definition.key), definition);
  }

  assert.equal(findComponentDefinition("heading"), componentRegistry.heading);
  assert.equal(findComponentDefinition("unknown"), null);
});

test("every definition default payload and placement validates", () => {
  for (const definition of componentDefinitions) {
    assert.equal(
      definition.payloadSchema.safeParse(definition.defaultPayload).success,
      true,
      `${definition.key} default payload must validate`,
    );
    assert.equal(
      definition.placementSchema.safeParse(definition.defaultPlacement).success,
      true,
      `${definition.key} default placement must validate`,
    );
  }

  const pollOptionIds =
    componentRegistry.single_choice_poll.defaultPayload.options.map(
      (option) => option.id,
    );
  assert.equal(new Set(pollOptionIds).size, pollOptionIds.length);

  const matchingPairIds =
    componentRegistry.matching_game.defaultPayload.pairs.map((pair) => pair.id);
  assert.equal(new Set(matchingPairIds).size, matchingPairIds.length);
});

test("malformed payloads are rejected for every component type", () => {
  const malformedPayloadByKey: Record<ComponentTypeKey, unknown> = {
    heading: { text: "", level: "h1" },
    rich_text: { content: 42, format: "html" },
    callout: { text: "", tone: "danger" },
    quote: { text: "" },
    divider: { unexpected: true },
    image: { storedFileId: "not-a-uuid", alt: "Описание" },
    slideshow: {
      slides: [
        {
          id: "not-a-uuid",
          storedFileId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          alt: "Слайд",
        },
      ],
      autoplay: false,
    },
    single_choice_poll: {
      question: "Вопрос",
      options: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          label: "Только один вариант",
        },
      ],
      showResults: true,
    },
    matching_game: {
      instruction: "Найдите пару",
      pairs: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          left: "Один",
          right: "One",
        },
      ],
      shuffle: true,
    },
    file: {
      storedFileId: "/storage/course-assets/file.pdf",
      label: "Файл",
      openMode: "download",
    },
  };

  for (const key of componentTypeKeys) {
    assert.throws(
      () => parseComponentPayload(key, malformedPayloadByKey[key]),
      `${key} malformed payload must be rejected`,
    );
  }
});

test("poll and matching item identifiers are UUIDs and unique", () => {
  const duplicateOptionId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  assert.equal(
    componentRegistry.single_choice_poll.payloadSchema.safeParse({
      question: "Какой вариант выбираете?",
      options: [
        { id: duplicateOptionId, label: "Первый" },
        { id: duplicateOptionId, label: "Второй" },
      ],
      showResults: false,
    }).success,
    false,
  );

  const duplicatePairId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  assert.equal(
    componentRegistry.matching_game.payloadSchema.safeParse({
      instruction: "Соедините пары",
      pairs: [
        { id: duplicatePairId, left: "Один", right: "One" },
        { id: duplicatePairId, left: "Два", right: "Two" },
      ],
      shuffle: true,
    }).success,
    false,
  );
});

test("dynamic add-component schema selects payload and placement by type key", () => {
  const parsed = parseLessonAddComponentInput({
    lessonStepId: STEP_ID,
    typeKey: "heading",
    payload: componentRegistry.heading.defaultPayload,
    placement: componentRegistry.heading.defaultPlacement,
  });

  assert.equal(parsed.typeKey, "heading");
  assert.equal(parsed.payload.text, "Новый заголовок");

  assert.equal(
    lessonAddComponentInputSchema.safeParse({
      lessonStepId: STEP_ID,
      typeKey: "heading",
      position: 1,
      payload: componentRegistry.heading.defaultPayload,
      placement: componentRegistry.heading.defaultPlacement,
    }).success,
    false,
  );

  assert.equal(
    lessonAddComponentInputSchema.safeParse({
      lessonStepId: STEP_ID,
      typeKey: "heading",
      payload: componentRegistry.file.defaultPayload,
      placement: componentRegistry.file.defaultPlacement,
    }).success,
    false,
  );
});

test("JSON Schemas are generated from every registry schema", () => {
  for (const key of componentTypeKeys) {
    const generated = componentJsonSchemas[key];
    assert.equal(
      generated.payload.$schema,
      "https://json-schema.org/draft/2020-12/schema",
    );
    assert.equal(
      generated.placement.$schema,
      "https://json-schema.org/draft/2020-12/schema",
    );
    assert.equal(generated.payload.type, "object");
    assert.equal(generated.placement.type, "object");
    assert.doesNotThrow(() => JSON.stringify(generated));
  }

  assert.equal(
    lessonAddComponentInputJsonSchema.$schema,
    "https://json-schema.org/draft/2020-12/schema",
  );
  assert.doesNotThrow(() => JSON.stringify(lessonAddComponentInputJsonSchema));
});
