import { z } from "zod";
import {
  componentVisibilitySchema,
  type ComponentVisibility,
} from "../component-visibility";

export const componentTypeKeys = [
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

export const componentTypeKeySchema = z.enum(componentTypeKeys);

export type ComponentTypeKey = z.infer<typeof componentTypeKeySchema>;

export const componentCategorySchema = z.enum([
  "text",
  "layout",
  "media",
  "interactive",
  "attachment",
]);

export type ComponentCategory = z.infer<typeof componentCategorySchema>;

export const componentCapabilitiesSchema = z
  .object({
    teacherSurface: z.boolean(),
    studentSurface: z.boolean(),
    interactive: z.boolean(),
    assessable: z.boolean(),
    aiCreatable: z.boolean(),
    aiEditable: z.boolean(),
  })
  .strict();

export type ComponentCapabilities = z.infer<typeof componentCapabilitiesSchema>;

export type ComponentDefinition<
  TKey extends ComponentTypeKey = ComponentTypeKey,
  TPayloadSchema extends z.ZodType = z.ZodType,
  TPlacementSchema extends z.ZodType = z.ZodType,
> = {
  readonly key: TKey;
  readonly version: number;
  readonly title: string;
  readonly category: ComponentCategory;
  readonly payloadSchema: TPayloadSchema;
  readonly placementSchema: TPlacementSchema;
  readonly capabilities: ComponentCapabilities;
  readonly defaultPayload: z.output<TPayloadSchema>;
  readonly defaultPlacement: z.output<TPlacementSchema>;
  readonly aiInstructions: string;
};

function defineComponent<
  const TKey extends ComponentTypeKey,
  TPayloadSchema extends z.ZodType,
  TPlacementSchema extends z.ZodType,
>(
  definition: Omit<
    ComponentDefinition<TKey, TPayloadSchema, TPlacementSchema>,
    "defaultPayload" | "defaultPlacement"
  > & {
    defaultPayload: z.input<TPayloadSchema>;
    defaultPlacement: z.input<TPlacementSchema>;
  },
): ComponentDefinition<TKey, TPayloadSchema, TPlacementSchema> {
  const capabilities = componentCapabilitiesSchema.parse(
    definition.capabilities,
  );
  const defaultPayload = definition.payloadSchema.parse(
    definition.defaultPayload,
  );
  const defaultPlacement = definition.placementSchema.parse(
    definition.defaultPlacement,
  );

  return {
    ...definition,
    capabilities,
    defaultPayload,
    defaultPlacement,
  };
}

const contentWidthSchema = z.enum(["content", "wide", "full"]);
const textAlignSchema = z.enum(["start", "center", "end"]);
const blockAlignSchema = z.enum(["start", "center", "end", "stretch"]);

export const textPlacementSchema = z
  .object({
    width: contentWidthSchema,
    textAlign: textAlignSchema,
  })
  .strict();

export const calloutPlacementSchema = z
  .object({
    width: contentWidthSchema,
    emphasis: z.enum(["soft", "strong"]),
  })
  .strict();

export const dividerPlacementSchema = z
  .object({
    width: contentWidthSchema,
    style: z.enum(["solid", "dashed", "dotted"]),
  })
  .strict();

export const mediaPlacementSchema = z
  .object({
    width: contentWidthSchema,
    align: blockAlignSchema,
    fit: z.enum(["contain", "cover"]),
    aspectRatio: z.enum(["auto", "square", "4:3", "16:9"]),
  })
  .strict();

export const interactivePlacementSchema = z
  .object({
    width: contentWidthSchema,
    compact: z.boolean(),
  })
  .strict();

export const filePlacementSchema = z
  .object({
    width: contentWidthSchema,
    display: z.enum(["card", "link"]),
  })
  .strict();

export const headingPayloadSchema = z
  .object({
    text: z.string().trim().min(1).max(240),
    level: z.enum(["h2", "h3", "h4"]),
  })
  .strict();

export const richTextPayloadSchema = z
  .object({
    content: z.string().trim().min(1).max(20_000),
    format: z.literal("markdown"),
  })
  .strict();

export const calloutPayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    text: z.string().trim().min(1).max(4_000),
    tone: z.enum(["neutral", "info", "success", "warning"]),
  })
  .strict();

export const quotePayloadSchema = z
  .object({
    text: z.string().trim().min(1).max(4_000),
    attribution: z.string().trim().min(1).max(240).optional(),
  })
  .strict();

export const dividerPayloadSchema = z.object({}).strict();

/**
 * Attachments may be absent while an editor is creating a new component. Once
 * present, the reference is always the UUID of a `stored_file` row; raw URLs
 * and Storage object paths are deliberately not accepted by registry payloads.
 */
const nullableStoredFileIdSchema = z.uuid().nullable();

export const imagePayloadSchema = z
  .object({
    storedFileId: nullableStoredFileIdSchema,
    alt: z.string().trim().max(500),
    caption: z.string().trim().min(1).max(1_000).optional(),
  })
  .strict();

export const slideshowSlideSchema = z
  .object({
    id: z.uuid(),
    storedFileId: z.uuid(),
    alt: z.string().trim().max(500),
    caption: z.string().trim().min(1).max(1_000).optional(),
  })
  .strict();

export const slideshowPayloadSchema = z
  .object({
    slides: z
      .array(slideshowSlideSchema)
      .max(50)
      .superRefine((slides, context) => {
        const ids = new Set<string>();
        for (const [index, slide] of slides.entries()) {
          if (ids.has(slide.id)) {
            context.addIssue({
              code: "custom",
              path: [index, "id"],
              message: "Идентификаторы слайдов должны быть уникальными.",
            });
          }
          ids.add(slide.id);
        }
      }),
    autoplay: z.boolean(),
  })
  .strict();

export const singleChoicePollOptionSchema = z
  .object({
    id: z.uuid(),
    label: z.string().trim().min(1).max(500),
  })
  .strict();

export const singleChoicePollPayloadSchema = z
  .object({
    question: z.string().trim().min(1).max(2_000),
    options: z
      .array(singleChoicePollOptionSchema)
      .min(2)
      .max(20)
      .superRefine((options, context) => {
        const ids = new Set<string>();
        for (const [index, option] of options.entries()) {
          if (ids.has(option.id)) {
            context.addIssue({
              code: "custom",
              path: [index, "id"],
              message: "Идентификаторы вариантов должны быть уникальными.",
            });
          }
          ids.add(option.id);
        }
      }),
    showResults: z.boolean(),
  })
  .strict();

export const matchingGamePairSchema = z
  .object({
    id: z.uuid(),
    left: z.string().trim().min(1).max(500),
    right: z.string().trim().min(1).max(500),
  })
  .strict();

export const matchingGamePayloadSchema = z
  .object({
    instruction: z.string().trim().min(1).max(2_000),
    pairs: z
      .array(matchingGamePairSchema)
      .min(2)
      .max(30)
      .superRefine((pairs, context) => {
        const ids = new Set<string>();
        for (const [index, pair] of pairs.entries()) {
          if (ids.has(pair.id)) {
            context.addIssue({
              code: "custom",
              path: [index, "id"],
              message: "Идентификаторы пар должны быть уникальными.",
            });
          }
          ids.add(pair.id);
        }
      }),
    shuffle: z.boolean(),
  })
  .strict();

export const filePayloadSchema = z
  .object({
    storedFileId: nullableStoredFileIdSchema,
    label: z.string().trim().min(1).max(240),
    description: z.string().trim().min(1).max(2_000).optional(),
    openMode: z.enum(["download", "preview"]),
  })
  .strict();

const defaultCapabilities = {
  teacherSurface: true,
  studentSurface: true,
  interactive: false,
  assessable: false,
  aiCreatable: true,
  aiEditable: true,
} satisfies ComponentCapabilities;

export const componentRegistry = {
  heading: defineComponent({
    key: "heading",
    version: 1,
    title: "Заголовок",
    category: "text",
    payloadSchema: headingPayloadSchema,
    placementSchema: textPlacementSchema,
    capabilities: defaultCapabilities,
    defaultPayload: { text: "Новый заголовок", level: "h2" },
    defaultPlacement: { width: "content", textAlign: "start" },
    aiInstructions:
      "Создавай короткий заголовок, который точно описывает текущую часть шага. Не дублируй название Lesson Step без необходимости.",
  }),
  rich_text: defineComponent({
    key: "rich_text",
    version: 1,
    title: "Текст",
    category: "text",
    payloadSchema: richTextPayloadSchema,
    placementSchema: textPlacementSchema,
    capabilities: defaultCapabilities,
    defaultPayload: { content: "Новый текст", format: "markdown" },
    defaultPlacement: { width: "content", textAlign: "start" },
    aiInstructions:
      "Пиши понятный learner-facing текст в Markdown без HTML, скрытых инструкций преподавателю и неподтверждённых утверждений.",
  }),
  callout: defineComponent({
    key: "callout",
    version: 1,
    title: "Сноска",
    category: "text",
    payloadSchema: calloutPayloadSchema,
    placementSchema: calloutPlacementSchema,
    capabilities: defaultCapabilities,
    defaultPayload: { text: "Новая сноска", tone: "info" },
    defaultPlacement: { width: "content", emphasis: "soft" },
    aiInstructions:
      "Используй сноску для одного короткого пояснения, подсказки или предупреждения. Не помещай сюда teacher-private методику.",
  }),
  quote: defineComponent({
    key: "quote",
    version: 1,
    title: "Цитата",
    category: "text",
    payloadSchema: quotePayloadSchema,
    placementSchema: textPlacementSchema,
    capabilities: defaultCapabilities,
    defaultPayload: { text: "Новая цитата" },
    defaultPlacement: { width: "content", textAlign: "start" },
    aiInstructions:
      "Добавляй только предоставленную или проверяемую цитату. Не выдумывай автора; attribution можно не указывать.",
  }),
  divider: defineComponent({
    key: "divider",
    version: 1,
    title: "Разделитель",
    category: "layout",
    payloadSchema: dividerPayloadSchema,
    placementSchema: dividerPlacementSchema,
    capabilities: defaultCapabilities,
    defaultPayload: {},
    defaultPlacement: { width: "full", style: "solid" },
    aiInstructions:
      "Используй разделитель только между смысловыми группами компонентов; он не несёт учебного содержания.",
  }),
  image: defineComponent({
    key: "image",
    version: 1,
    title: "Картинка",
    category: "media",
    payloadSchema: imagePayloadSchema,
    placementSchema: mediaPlacementSchema,
    capabilities: defaultCapabilities,
    defaultPayload: { storedFileId: null, alt: "" },
    defaultPlacement: {
      width: "wide",
      align: "center",
      fit: "contain",
      aspectRatio: "auto",
    },
    aiInstructions:
      "Ссылайся только на существующий storedFileId из вложений владельца. Пиши полезный alt-текст и не утверждай, что изображение проанализировано, если анализа не было.",
  }),
  slideshow: defineComponent({
    key: "slideshow",
    version: 1,
    title: "Слайдшоу",
    category: "media",
    payloadSchema: slideshowPayloadSchema,
    placementSchema: mediaPlacementSchema,
    capabilities: { ...defaultCapabilities, interactive: true },
    defaultPayload: { slides: [], autoplay: false },
    defaultPlacement: {
      width: "wide",
      align: "center",
      fit: "contain",
      aspectRatio: "16:9",
    },
    aiInstructions:
      "Собирай упорядоченные слайды только из существующих storedFileId. Сохраняй стабильные UUID слайдов и не описывай содержимое файлов без фактического анализа.",
  }),
  single_choice_poll: defineComponent({
    key: "single_choice_poll",
    version: 1,
    title: "Опрос",
    category: "interactive",
    payloadSchema: singleChoicePollPayloadSchema,
    placementSchema: interactivePlacementSchema,
    capabilities: { ...defaultCapabilities, interactive: true },
    defaultPayload: {
      question: "Выберите один вариант",
      options: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          label: "Вариант 1",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          label: "Вариант 2",
        },
      ],
      showResults: true,
    },
    defaultPlacement: { width: "content", compact: false },
    aiInstructions:
      "Формулируй один нейтральный вопрос без правильного ответа. Сохраняй UUID существующих вариантов при редактировании; новым вариантам назначай новые UUID.",
  }),
  matching_game: defineComponent({
    key: "matching_game",
    version: 1,
    title: "Игра «Найди пару»",
    category: "interactive",
    payloadSchema: matchingGamePayloadSchema,
    placementSchema: interactivePlacementSchema,
    capabilities: {
      ...defaultCapabilities,
      interactive: true,
      assessable: true,
    },
    defaultPayload: {
      instruction: "Соедините элементы в пары",
      pairs: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          left: "Элемент 1",
          right: "Пара 1",
        },
        {
          id: "44444444-4444-4444-8444-444444444444",
          left: "Элемент 2",
          right: "Пара 2",
        },
      ],
      shuffle: true,
    },
    defaultPlacement: { width: "wide", compact: false },
    aiInstructions:
      "Создавай однозначные пары. Сохраняй UUID существующих пар при редактировании; новым парам назначай новые UUID.",
  }),
  file: defineComponent({
    key: "file",
    version: 1,
    title: "Файл",
    category: "attachment",
    payloadSchema: filePayloadSchema,
    placementSchema: filePlacementSchema,
    capabilities: defaultCapabilities,
    defaultPayload: {
      storedFileId: null,
      label: "Файл",
      openMode: "download",
    },
    defaultPlacement: { width: "content", display: "card" },
    aiInstructions:
      "Ссылайся только на существующий storedFileId из вложений владельца. Не утверждай, что содержимое файла прочитано или проанализировано без отдельного результата parsing/RAG.",
  }),
} as const satisfies Record<ComponentTypeKey, ComponentDefinition>;

export type ComponentRegistry = typeof componentRegistry;

export type ComponentPayload<TKey extends ComponentTypeKey> = z.output<
  ComponentRegistry[TKey]["payloadSchema"]
>;

export type ComponentPlacement<TKey extends ComponentTypeKey> = z.output<
  ComponentRegistry[TKey]["placementSchema"]
>;

export const componentDefinitions = componentTypeKeys.map(
  (key) => componentRegistry[key],
);

export function isComponentTypeKey(value: unknown): value is ComponentTypeKey {
  return componentTypeKeySchema.safeParse(value).success;
}

export function findComponentDefinition(key: unknown) {
  const parsed = componentTypeKeySchema.safeParse(key);
  return parsed.success ? componentRegistry[parsed.data] : null;
}

export function getComponentDefinition<TKey extends ComponentTypeKey>(
  key: TKey,
): ComponentRegistry[TKey] {
  return componentRegistry[key];
}

export function parseComponentPayload<TKey extends ComponentTypeKey>(
  key: TKey,
  payload: unknown,
): ComponentPayload<TKey> {
  return componentRegistry[key].payloadSchema.parse(
    payload,
  ) as ComponentPayload<TKey>;
}

export function parseComponentPlacement<TKey extends ComponentTypeKey>(
  key: TKey,
  placement: unknown,
): ComponentPlacement<TKey> {
  return componentRegistry[key].placementSchema.parse(
    placement,
  ) as ComponentPlacement<TKey>;
}

export type LessonAddComponentInput = {
  [TKey in ComponentTypeKey]: {
    lessonId: string;
    typeKey: TKey;
    payload: ComponentPayload<TKey>;
    placement: ComponentPlacement<TKey>;
    visibility: ComponentVisibility;
  };
}[ComponentTypeKey];

export type LessonStepAddComponentInput = {
  [TKey in ComponentTypeKey]: {
    lessonStepId: string;
    typeKey: TKey;
    payload: ComponentPayload<TKey>;
    placement: ComponentPlacement<TKey>;
    visibility: ComponentVisibility;
  };
}[ComponentTypeKey];

const addComponentVariantSchemas = componentTypeKeys.map((typeKey) => {
  const definition = componentRegistry[typeKey];
  return z
    .object({
      lessonId: z.uuid(),
      typeKey: z.literal(typeKey),
      payload: definition.payloadSchema,
      placement: definition.placementSchema,
      visibility: componentVisibilitySchema.default("staff_only"),
    })
    .strict();
});

const addStepComponentVariantSchemas = componentTypeKeys.map((typeKey) => {
  const definition = componentRegistry[typeKey];
  return z
    .object({
      lessonStepId: z.uuid(),
      typeKey: z.literal(typeKey),
      payload: definition.payloadSchema,
      placement: definition.placementSchema,
      visibility: componentVisibilitySchema.default("learner_visible"),
    })
    .strict();
});

type AddComponentVariantSchema = (typeof addComponentVariantSchemas)[number];

export const lessonAddComponentInputSchema = z.discriminatedUnion(
  "typeKey",
  addComponentVariantSchemas as [
    AddComponentVariantSchema,
    AddComponentVariantSchema,
    ...AddComponentVariantSchema[],
  ],
) as unknown as z.ZodType<LessonAddComponentInput>;

type AddStepComponentVariantSchema =
  (typeof addStepComponentVariantSchemas)[number];

export const lessonStepAddComponentInputSchema = z.discriminatedUnion(
  "typeKey",
  addStepComponentVariantSchemas as [
    AddStepComponentVariantSchema,
    AddStepComponentVariantSchema,
    ...AddStepComponentVariantSchema[],
  ],
) as unknown as z.ZodType<LessonStepAddComponentInput>;

export function parseLessonAddComponentInput(
  input: unknown,
): LessonAddComponentInput {
  return lessonAddComponentInputSchema.parse(input);
}

export type ComponentJsonSchema = z.core.JSONSchema.JSONSchema;

export const componentJsonSchemas = Object.fromEntries(
  componentTypeKeys.map((key) => {
    const definition = componentRegistry[key];
    return [
      key,
      {
        payload: z.toJSONSchema(definition.payloadSchema),
        placement: z.toJSONSchema(definition.placementSchema),
      },
    ];
  }),
) as unknown as Record<
  ComponentTypeKey,
  { payload: ComponentJsonSchema; placement: ComponentJsonSchema }
>;

export const lessonAddComponentInputJsonSchema = z.toJSONSchema(
  lessonAddComponentInputSchema,
);
