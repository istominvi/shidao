import assert from "node:assert/strict";
import test from "node:test";
import {
  componentCategorySchema,
  componentDefinitions,
  componentJsonSchemas,
  componentRegistry,
  componentTypeKeySchema,
  componentTypeKeys,
  creatableComponentDefinitions,
  creatableComponentTypeKeys,
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
  "image",
  "video",
  "audio",
  "slideshow",
  "single_choice_poll",
  "matching_game",
  "choice_quiz",
  "fill_blanks",
  "word_bank",
  "sequence",
  "categorize",
  "free_response",
  "external_link",
  "word_builder",
  "vocabulary_list",
  "file",
] as const;

const LESSON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function testUuid(index: number) {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

test("registry exposes exactly the twenty current component keys", () => {
  assert.deepEqual(componentTypeKeys, EXPECTED_KEYS);
  assert.deepEqual(componentTypeKeySchema.options, EXPECTED_KEYS);
  assert.deepEqual(Object.keys(componentRegistry), EXPECTED_KEYS);
  assert.deepEqual(
    componentDefinitions.map((definition) => definition.key),
    EXPECTED_KEYS,
  );
  assert.deepEqual(
    creatableComponentTypeKeys,
    EXPECTED_KEYS.filter((key) => key !== "heading"),
  );
  assert.deepEqual(
    creatableComponentDefinitions.map((definition) => definition.key),
    creatableComponentTypeKeys,
  );

  for (const definition of componentDefinitions) {
    assert.equal(definition.version, 1);
    assert.ok(definition.title.length > 0);
    assert.ok(definition.aiInstructions.length > 0);
    assert.equal(getComponentDefinition(definition.key), definition);
  }

  assert.equal(findComponentDefinition("heading"), componentRegistry.heading);
  assert.equal(findComponentDefinition("unknown"), null);
  assert.equal(findComponentDefinition("divider"), null);
  assert.equal(componentCategorySchema.safeParse("layout").success, false);
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

  for (const definition of componentDefinitions) {
    const payload = definition.defaultPayload as Record<string, unknown>;
    for (const value of Object.values(payload)) {
      if (
        !Array.isArray(value) ||
        !value.every(
          (item) => typeof item === "object" && item !== null && "id" in item,
        )
      ) {
        continue;
      }
      const ids = value.map((item) => String(item.id));
      assert.equal(
        new Set(ids).size,
        ids.length,
        `${definition.key} default item IDs must be unique`,
      );
    }
  }
});

test("rich text requires either a title or body while keeping both fields independent", () => {
  assert.deepEqual(
    componentRegistry.rich_text.payloadSchema.parse({
      content: "Старый текст без заголовка",
      format: "markdown",
    }),
    { content: "Старый текст без заголовка", format: "markdown" },
  );
  assert.deepEqual(
    componentRegistry.rich_text.payloadSchema.parse({
      title: "  Только заголовок  ",
      format: "markdown",
    }),
    { title: "Только заголовок", format: "markdown" },
  );
  assert.deepEqual(
    componentRegistry.rich_text.payloadSchema.parse({
      title: "  Новая тема  ",
      content: "  Основной текст  ",
      format: "markdown",
    }),
    {
      title: "Новая тема",
      content: "Основной текст",
      format: "markdown",
    },
  );
  assert.equal(
    componentRegistry.rich_text.payloadSchema.safeParse({
      title: "",
      content: "Основной текст",
      format: "markdown",
    }).success,
    false,
  );
  assert.equal(
    componentRegistry.rich_text.payloadSchema.safeParse({
      title: "Т".repeat(241),
      content: "Основной текст",
      format: "markdown",
    }).success,
    false,
  );
  const emptyPayload = componentRegistry.rich_text.payloadSchema.safeParse({
    format: "markdown",
  });
  assert.equal(emptyPayload.success, false);
  assert.ok(
    !emptyPayload.success &&
      emptyPayload.error.issues.some(
        (issue) => issue.message === "Заполните заголовок или текст.",
      ),
  );
  const whitespacePayload = componentRegistry.rich_text.payloadSchema.safeParse(
    {
      title: "  ",
      content: "\n\t",
      format: "markdown",
    },
  );
  assert.equal(whitespacePayload.success, false);
  assert.ok(
    !whitespacePayload.success &&
      whitespacePayload.error.issues.some(
        (issue) => issue.message === "Заполните заголовок или текст.",
      ),
  );
  assert.equal(
    "title" in componentRegistry.rich_text.defaultPayload,
    false,
    "the canonical draft must keep the new heading optional",
  );
  assert.equal(componentRegistry.rich_text.version, 1);
  assert.equal(componentRegistry.heading.capabilities.aiCreatable, false);
  assert.equal(componentRegistry.heading.capabilities.aiEditable, false);
});

test("new component capabilities match the current manual-authoring slice", () => {
  const newKeys = EXPECTED_KEYS.filter((key) =>
    [
      "video",
      "audio",
      "choice_quiz",
      "fill_blanks",
      "word_bank",
      "sequence",
      "categorize",
      "free_response",
      "external_link",
      "word_builder",
      "vocabulary_list",
    ].includes(key),
  );
  const interactiveKeys = new Set<ComponentTypeKey>([
    "choice_quiz",
    "fill_blanks",
    "word_bank",
    "sequence",
    "categorize",
    "free_response",
    "word_builder",
    "vocabulary_list",
  ]);
  const assessableKeys = new Set<ComponentTypeKey>([
    "choice_quiz",
    "fill_blanks",
    "word_bank",
    "sequence",
    "categorize",
    "word_builder",
  ]);

  for (const key of newKeys) {
    const capabilities = componentRegistry[key].capabilities;
    assert.equal(capabilities.teacherSurface, true, key);
    assert.equal(capabilities.studentSurface, true, key);
    assert.equal(capabilities.aiCreatable, false, key);
    assert.equal(capabilities.aiEditable, false, key);
    assert.equal(capabilities.interactive, interactiveKeys.has(key), key);
    assert.equal(capabilities.assessable, assessableKeys.has(key), key);
  }
});

test("malformed payloads are rejected for every component type", () => {
  const malformedPayloadByKey: Record<ComponentTypeKey, unknown> = {
    heading: { text: "", level: "h1" },
    rich_text: { content: 42, format: "html" },
    callout: { text: "", tone: "danger" },
    quote: { text: "" },
    image: { storedFileId: "not-a-uuid", alt: "Описание" },
    video: { url: "http://example.com/video.mp4" },
    audio: {
      url: "http://example.com/audio.mp3",
      title: "Аудио",
      showTranscriptByDefault: false,
    },
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
    choice_quiz: {
      question: "Вопрос",
      options: [
        {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          label: "Первый",
          isCorrect: false,
        },
        {
          id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          label: "Второй",
          isCorrect: false,
        },
      ],
      allowMultiple: false,
      shuffle: true,
    },
    fill_blanks: {
      instruction: "Заполните",
      template: "Пропуск [[2]]",
      answers: [{ accepted: ["ответ"] }],
    },
    word_bank: {
      instruction: "Заполните",
      template: "Пропуск [[1]]",
      answers: ["первый", "второй"],
      distractors: [],
      shuffle: true,
    },
    sequence: {
      instruction: "Расположите",
      items: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          text: "Один",
        },
      ],
      mode: "sentences",
      shuffle: true,
    },
    categorize: {
      instruction: "Распределите",
      categories: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          label: "Одна категория",
        },
      ],
      items: [],
      shuffle: true,
    },
    free_response: {
      prompt: "Ответьте",
      responseType: "long",
      minChars: 500,
      maxChars: 100,
    },
    external_link: {
      url: "http://example.com/",
      label: "Материал",
      openInNewTab: true,
    },
    word_builder: {
      instruction: "Соберите слово",
      targetWord: "",
      shuffle: true,
    },
    vocabulary_list: { items: [], display: "list" },
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

test("existing poll and matching item identifiers are UUIDs and unique", () => {
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

test("choice quiz enforces unique IDs and correct-answer invariants", () => {
  const firstId = "11111111-1111-4111-8111-111111111111";
  const secondId = "22222222-2222-4222-8222-222222222222";
  const base = {
    question: "Какие варианты верны?",
    options: [
      { id: firstId, label: "Первый", isCorrect: true },
      { id: secondId, label: "Второй", isCorrect: false },
    ],
    allowMultiple: false,
    shuffle: true,
  };

  assert.equal(
    componentRegistry.choice_quiz.payloadSchema.safeParse(base).success,
    true,
  );
  assert.equal(
    componentRegistry.choice_quiz.payloadSchema.safeParse({
      ...base,
      options: base.options.map((option) => ({ ...option, id: firstId })),
    }).success,
    false,
  );
  assert.equal(
    componentRegistry.choice_quiz.payloadSchema.safeParse({
      ...base,
      options: base.options.map((option) => ({
        ...option,
        isCorrect: true,
      })),
    }).success,
    false,
  );
  assert.equal(
    componentRegistry.choice_quiz.payloadSchema.safeParse({
      ...base,
      allowMultiple: true,
      options: base.options.map((option) => ({
        ...option,
        isCorrect: true,
      })),
    }).success,
    true,
  );
});

test("blank exercises require dense template markers and accepted alternatives", () => {
  const fill = {
    instruction: "Заполните пропуски",
    template: "[[1]] и [[2]], затем снова [[1]]",
    answers: [
      { accepted: ["один", "раз"] },
      { accepted: ["два"], hint: "После одного" },
    ],
  };
  assert.equal(
    componentRegistry.fill_blanks.payloadSchema.safeParse(fill).success,
    true,
  );
  assert.equal(
    componentRegistry.fill_blanks.payloadSchema.safeParse({
      ...fill,
      template: "[[1]] и [[3]]",
    }).success,
    false,
  );
  assert.equal(
    componentRegistry.fill_blanks.payloadSchema.safeParse({
      ...fill,
      answers: [{ accepted: ["один", "ОДИН"] }, fill.answers[1]],
    }).success,
    false,
  );

  const bank = {
    instruction: "Выберите слова",
    template: "[[1]] и [[2]]",
    answers: ["один|раз", "два"],
    distractors: ["три"],
    shuffle: true,
  };
  assert.equal(
    componentRegistry.word_bank.payloadSchema.safeParse(bank).success,
    true,
  );
  assert.equal(
    componentRegistry.word_bank.payloadSchema.safeParse({
      ...bank,
      answers: ["один|", "два"],
    }).success,
    false,
  );
  assert.equal(
    componentRegistry.word_bank.payloadSchema.safeParse({
      ...bank,
      template: "[[1]]",
    }).success,
    false,
  );
});

test("ordered, categorized and vocabulary items use unique valid IDs", () => {
  const duplicateId = "33333333-3333-4333-8333-333333333333";
  assert.equal(
    componentRegistry.sequence.payloadSchema.safeParse({
      ...componentRegistry.sequence.defaultPayload,
      items: componentRegistry.sequence.defaultPayload.items.map((item) => ({
        ...item,
        id: duplicateId,
      })),
    }).success,
    false,
  );

  const categoryPayload = componentRegistry.categorize.defaultPayload;
  assert.equal(
    componentRegistry.categorize.payloadSchema.safeParse({
      ...categoryPayload,
      items: categoryPayload.items.map((item, index) =>
        index === 0
          ? { ...item, categoryId: "44444444-4444-4444-8444-444444444444" }
          : item,
      ),
    }).success,
    false,
  );
  assert.equal(
    componentRegistry.categorize.payloadSchema.safeParse({
      ...categoryPayload,
      items: categoryPayload.items.map((item) => ({
        ...item,
        id: duplicateId,
      })),
    }).success,
    false,
  );

  const vocabularyItem =
    componentRegistry.vocabulary_list.defaultPayload.items[0];
  assert.equal(
    componentRegistry.vocabulary_list.payloadSchema.safeParse({
      display: "cards",
      items: [vocabularyItem, { ...vocabularyItem }],
    }).success,
    false,
  );
});

test("exercise collection sizes stay within their authored limits", () => {
  assert.equal(
    componentRegistry.choice_quiz.payloadSchema.safeParse({
      ...componentRegistry.choice_quiz.defaultPayload,
      options: Array.from({ length: 21 }, (_, index) => ({
        id: testUuid(index + 1),
        label: `Вариант ${index + 1}`,
        isCorrect: index === 0,
      })),
    }).success,
    false,
  );
  assert.equal(
    componentRegistry.sequence.payloadSchema.safeParse({
      ...componentRegistry.sequence.defaultPayload,
      items: Array.from({ length: 41 }, (_, index) => ({
        id: testUuid(index + 100),
        text: `Элемент ${index + 1}`,
      })),
    }).success,
    false,
  );

  const categories = Array.from({ length: 13 }, (_, index) => ({
    id: testUuid(index + 200),
    label: `Категория ${index + 1}`,
  }));
  assert.equal(
    componentRegistry.categorize.payloadSchema.safeParse({
      ...componentRegistry.categorize.defaultPayload,
      categories,
      items: componentRegistry.categorize.defaultPayload.items.map(
        (item, index) => ({ ...item, categoryId: categories[index].id }),
      ),
    }).success,
    false,
  );
  assert.equal(
    componentRegistry.categorize.payloadSchema.safeParse({
      ...componentRegistry.categorize.defaultPayload,
      items: Array.from({ length: 61 }, (_, index) => ({
        id: testUuid(index + 300),
        text: `Элемент ${index + 1}`,
        categoryId:
          componentRegistry.categorize.defaultPayload.categories[0].id,
      })),
    }).success,
    false,
  );
  assert.equal(
    componentRegistry.vocabulary_list.payloadSchema.safeParse({
      ...componentRegistry.vocabulary_list.defaultPayload,
      items: Array.from({ length: 101 }, (_, index) => ({
        id: testUuid(index + 400),
        term: `Термин ${index + 1}`,
        definition: `Определение ${index + 1}`,
      })),
    }).success,
    false,
  );
});

test("media and external links accept HTTPS only", () => {
  for (const key of ["video", "audio", "external_link"] as const) {
    const definition = componentRegistry[key];
    assert.equal(
      definition.payloadSchema.safeParse(definition.defaultPayload).success,
      true,
    );
    assert.equal(
      definition.payloadSchema.safeParse({
        ...definition.defaultPayload,
        url: "http://example.com/resource",
      }).success,
      false,
      key,
    );
  }

  assert.equal(
    componentRegistry.video.payloadSchema.safeParse({
      url: "https://example.com/video.mp4",
      captionsUrl: "http://example.com/captions.vtt",
    }).success,
    false,
  );
});

test("free response keeps minimum length within maximum length", () => {
  const definition = componentRegistry.free_response;
  assert.equal(
    definition.payloadSchema.safeParse(definition.defaultPayload).success,
    true,
  );
  assert.equal(
    definition.payloadSchema.safeParse({
      ...definition.defaultPayload,
      minChars: 101,
      maxChars: 100,
    }).success,
    false,
  );
});

test("dynamic add-component schema selects payload and placement by type key", () => {
  const parsed = parseLessonAddComponentInput({
    lessonId: LESSON_ID,
    typeKey: "rich_text",
    payload: { title: "Только заголовок", format: "markdown" },
    placement: componentRegistry.rich_text.defaultPlacement,
  });

  assert.equal(parsed.typeKey, "rich_text");
  assert.equal(parsed.payload.title, "Только заголовок");
  assert.equal("visibility" in parsed, false);

  assert.equal(
    lessonAddComponentInputSchema.safeParse({
      lessonId: LESSON_ID,
      typeKey: "heading",
      payload: componentRegistry.heading.defaultPayload,
      placement: componentRegistry.heading.defaultPlacement,
    }).success,
    false,
  );

  assert.equal(
    lessonAddComponentInputSchema.safeParse({
      lessonId: LESSON_ID,
      typeKey: "rich_text",
      payload: componentRegistry.rich_text.defaultPayload,
      placement: componentRegistry.rich_text.defaultPlacement,
      visibility: "learner_visible",
    }).success,
    false,
  );

  assert.equal(
    lessonAddComponentInputSchema.safeParse({
      lessonId: LESSON_ID,
      typeKey: "rich_text",
      position: 1,
      payload: componentRegistry.rich_text.defaultPayload,
      placement: componentRegistry.rich_text.defaultPlacement,
    }).success,
    false,
  );

  assert.equal(
    lessonAddComponentInputSchema.safeParse({
      lessonId: LESSON_ID,
      typeKey: "rich_text",
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
    if (key === "rich_text") {
      assert.ok(Array.isArray(generated.payload.anyOf));
    } else {
      assert.equal(generated.payload.type, "object");
    }
    assert.equal(generated.placement.type, "object");
    assert.doesNotThrow(() => JSON.stringify(generated));
  }

  const richTextJsonSchema = componentJsonSchemas.rich_text.payload as {
    anyOf?: Array<{
      additionalProperties?: boolean;
      properties?: Record<string, unknown>;
      required?: string[];
    }>;
  };
  assert.equal(richTextJsonSchema.anyOf?.length, 2);
  assert.ok(
    richTextJsonSchema.anyOf?.every(
      (branch) =>
        branch.additionalProperties === false &&
        branch.properties?.title &&
        branch.properties?.content &&
        branch.properties?.format &&
        branch.required?.includes("format"),
    ),
  );
  assert.ok(
    richTextJsonSchema.anyOf?.some(
      (branch) =>
        branch.properties?.title &&
        branch.required?.includes("title") &&
        !branch.required.includes("content"),
    ),
  );
  assert.ok(
    richTextJsonSchema.anyOf?.some(
      (branch) =>
        branch.properties?.content &&
        branch.required?.includes("content") &&
        !branch.required.includes("title"),
    ),
  );

  assert.equal(
    lessonAddComponentInputJsonSchema.$schema,
    "https://json-schema.org/draft/2020-12/schema",
  );
  const addComponentJson = JSON.stringify(lessonAddComponentInputJsonSchema);
  assert.doesNotThrow(() => JSON.parse(addComponentJson));
  for (const typeKey of creatableComponentTypeKeys) {
    assert.match(addComponentJson, new RegExp(`"const":"${typeKey}"`));
  }
  assert.doesNotMatch(addComponentJson, /"const":"heading"/);
});
