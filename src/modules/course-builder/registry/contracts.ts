import { z } from "zod";

export const componentTypeKeys = [
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

export const componentTypeKeySchema = z.enum(componentTypeKeys);

export type ComponentTypeKey = z.infer<typeof componentTypeKeySchema>;

export type CreatableComponentTypeKey = Exclude<ComponentTypeKey, "heading">;

export const creatableComponentTypeKeys = componentTypeKeys.filter(
  (key): key is CreatableComponentTypeKey => key !== "heading",
);

export const componentCategorySchema = z.enum([
  "text",
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

export const activityRoleSchema = z.enum(["practice", "assessment", "survey"]);

export type ActivityRole = z.infer<typeof activityRoleSchema>;

export const activityResponseModeSchema = z.enum([
  "survey_choice",
  "matching",
  "choice",
  "fill_blanks",
  "word_bank",
  "ordering",
  "categorization",
  "constructed_text",
  "word_construction",
]);

export type ActivityResponseMode = z.infer<typeof activityResponseModeSchema>;

export const activityEvaluatorModeSchema = z.enum([
  "none",
  "deterministic",
  "teacher_review",
]);

export type ActivityEvaluatorMode = z.infer<typeof activityEvaluatorModeSchema>;

export const activityEvidencePolicySchema = z.enum([
  "never",
  "requires_evaluation",
  "requires_teacher_confirmation",
]);

export type ActivityEvidencePolicy = z.infer<
  typeof activityEvidencePolicySchema
>;

export type ComponentActivityFacet<
  TAuthorPayloadSchema extends z.ZodType = z.ZodType,
  TLearnerDeliverySchema extends z.ZodType = z.ZodType,
  TEvaluatorConfigSchema extends z.ZodType = z.ZodType,
> = {
  readonly supportedRoles: readonly ActivityRole[];
  readonly responseMode: ActivityResponseMode;
  readonly evaluatorMode: ActivityEvaluatorMode;
  readonly evidencePolicy: ActivityEvidencePolicy;
  readonly learnerDeliverySchema: TLearnerDeliverySchema;
  readonly evaluatorConfigSchema: TEvaluatorConfigSchema;
  readonly projectLearnerDelivery: (
    payload: z.output<TAuthorPayloadSchema>,
  ) => z.input<TLearnerDeliverySchema>;
  readonly projectEvaluatorConfig: (
    payload: z.output<TAuthorPayloadSchema>,
  ) => z.input<TEvaluatorConfigSchema>;
};

type AnyComponentActivityFacet = {
  readonly supportedRoles: readonly ActivityRole[];
  readonly responseMode: ActivityResponseMode;
  readonly evaluatorMode: ActivityEvaluatorMode;
  readonly evidencePolicy: ActivityEvidencePolicy;
  readonly learnerDeliverySchema: z.ZodType;
  readonly evaluatorConfigSchema: z.ZodType;
  readonly projectLearnerDelivery: (payload: never) => unknown;
  readonly projectEvaluatorConfig: (payload: never) => unknown;
};

export type ComponentDefinition<
  TKey extends ComponentTypeKey = ComponentTypeKey,
  TPayloadSchema extends z.ZodType = z.ZodType,
  TPlacementSchema extends z.ZodType = z.ZodType,
  TActivityFacet extends AnyComponentActivityFacet | undefined =
    AnyComponentActivityFacet | undefined,
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
} & (TActivityFacet extends undefined
  ? { readonly activityFacet?: undefined }
  : { readonly activityFacet: TActivityFacet });

type ComponentDefinitionInput<
  TKey extends ComponentTypeKey,
  TPayloadSchema extends z.ZodType,
  TPlacementSchema extends z.ZodType,
> = {
  readonly key: TKey;
  readonly version: number;
  readonly title: string;
  readonly category: ComponentCategory;
  readonly payloadSchema: TPayloadSchema;
  readonly placementSchema: TPlacementSchema;
  readonly capabilities: ComponentCapabilities;
  readonly defaultPayload: z.input<TPayloadSchema>;
  readonly defaultPlacement: z.input<TPlacementSchema>;
  readonly aiInstructions: string;
};

function defineComponent<
  const TKey extends ComponentTypeKey,
  TPayloadSchema extends z.ZodType,
  TPlacementSchema extends z.ZodType,
  TActivityFacet extends ComponentActivityFacet<
    TPayloadSchema,
    z.ZodType,
    z.ZodType
  >,
>(
  definition: ComponentDefinitionInput<
    TKey,
    TPayloadSchema,
    TPlacementSchema
  > & { readonly activityFacet: TActivityFacet },
): ComponentDefinition<TKey, TPayloadSchema, TPlacementSchema, TActivityFacet>;
function defineComponent<
  const TKey extends ComponentTypeKey,
  TPayloadSchema extends z.ZodType,
  TPlacementSchema extends z.ZodType,
>(
  definition: ComponentDefinitionInput<
    TKey,
    TPayloadSchema,
    TPlacementSchema
  > & { readonly activityFacet?: undefined },
): ComponentDefinition<TKey, TPayloadSchema, TPlacementSchema, undefined>;
function defineComponent<
  const TKey extends ComponentTypeKey,
  TPayloadSchema extends z.ZodType,
  TPlacementSchema extends z.ZodType,
  TActivityFacet extends
    ComponentActivityFacet<TPayloadSchema, z.ZodType, z.ZodType> | undefined,
>(
  definition: ComponentDefinitionInput<
    TKey,
    TPayloadSchema,
    TPlacementSchema
  > & { readonly activityFacet?: TActivityFacet },
): ComponentDefinition<TKey, TPayloadSchema, TPlacementSchema, TActivityFacet> {
  const capabilities = componentCapabilitiesSchema.parse(
    definition.capabilities,
  );
  const defaultPayload = definition.payloadSchema.parse(
    definition.defaultPayload,
  );
  const defaultPlacement = definition.placementSchema.parse(
    definition.defaultPlacement,
  );

  if (definition.activityFacet) {
    activityRoleSchema
      .array()
      .min(1)
      .parse(definition.activityFacet.supportedRoles);
    activityResponseModeSchema.parse(definition.activityFacet.responseMode);
    activityEvaluatorModeSchema.parse(definition.activityFacet.evaluatorMode);
    activityEvidencePolicySchema.parse(definition.activityFacet.evidencePolicy);
    definition.activityFacet.learnerDeliverySchema.parse(
      definition.activityFacet.projectLearnerDelivery(defaultPayload),
    );
    definition.activityFacet.evaluatorConfigSchema.parse(
      definition.activityFacet.projectEvaluatorConfig(defaultPayload),
    );
  }

  return {
    ...definition,
    capabilities,
    defaultPayload,
    defaultPlacement,
  } as ComponentDefinition<
    TKey,
    TPayloadSchema,
    TPlacementSchema,
    TActivityFacet
  >;
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

export const mediaPlacementSchema = z
  .object({
    width: contentWidthSchema,
    align: blockAlignSchema,
    fit: z.enum(["contain", "cover"]),
    aspectRatio: z.enum(["auto", "square", "4:3", "16:9"]),
  })
  .strict();

export const audioPlacementSchema = z
  .object({
    width: contentWidthSchema,
    compact: z.boolean(),
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

export const linkPlacementSchema = z
  .object({
    width: contentWidthSchema,
    align: blockAlignSchema,
    style: z.enum(["card", "button", "text"]),
  })
  .strict();

export const headingPayloadSchema = z
  .object({
    text: z.string().trim().min(1).max(240),
    level: z.enum(["h2", "h3", "h4"]),
  })
  .strict();

const richTextTitleSchema = z.string().trim().min(1).max(240);
const richTextContentSchema = z.string().trim().min(1).max(20_000);

export const richTextPayloadSchema = z.union(
  [
    z
      .object({
        title: richTextTitleSchema,
        content: richTextContentSchema.optional(),
        format: z.literal("markdown"),
      })
      .strict(),
    z
      .object({
        title: richTextTitleSchema.optional(),
        content: richTextContentSchema,
        format: z.literal("markdown"),
      })
      .strict(),
  ],
  {
    error: (issue) => {
      if (!issue.input || typeof issue.input !== "object") return undefined;
      const input = issue.input as Record<string, unknown>;
      const hasTitle =
        typeof input.title === "string" && input.title.trim().length > 0;
      const hasContent =
        typeof input.content === "string" && input.content.trim().length > 0;
      return hasTitle || hasContent
        ? undefined
        : "Заполните заголовок или текст.";
    },
  },
);

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

export const httpsUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => new URL(value).protocol === "https:", {
    message: "Используйте защищённую ссылку HTTPS.",
  });

export const videoPayloadSchema = z
  .object({
    url: httpsUrlSchema,
    title: z.string().trim().min(1).max(240).optional(),
    caption: z.string().trim().min(1).max(1_000).optional(),
    captionsUrl: httpsUrlSchema.optional(),
  })
  .strict();

export const audioPayloadSchema = z
  .object({
    url: httpsUrlSchema,
    title: z.string().trim().min(1).max(240),
    transcript: z.string().trim().min(1).max(20_000).optional(),
    showTranscriptByDefault: z.boolean(),
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

export const choiceQuizOptionSchema = z
  .object({
    id: z.uuid(),
    label: z.string().trim().min(1).max(500),
    isCorrect: z.boolean(),
  })
  .strict();

export const choiceQuizPayloadSchema = z
  .object({
    question: z.string().trim().min(1).max(2_000),
    options: z.array(choiceQuizOptionSchema).min(2).max(20),
    allowMultiple: z.boolean(),
    explanation: z.string().trim().min(1).max(4_000).optional(),
    shuffle: z.boolean(),
  })
  .strict()
  .superRefine((payload, context) => {
    const ids = new Set<string>();
    for (const [index, option] of payload.options.entries()) {
      if (ids.has(option.id)) {
        context.addIssue({
          code: "custom",
          path: ["options", index, "id"],
          message: "Идентификаторы вариантов должны быть уникальными.",
        });
      }
      ids.add(option.id);
    }

    const correctCount = payload.options.filter(
      (option) => option.isCorrect,
    ).length;
    if (correctCount < 1) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Отметьте хотя бы один правильный вариант.",
      });
    } else if (!payload.allowMultiple && correctCount !== 1) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message:
          "В вопросе с одним ответом должен быть ровно один правильный вариант.",
      });
    }
  });

export const fillBlankAnswerSchema = z
  .object({
    accepted: z
      .array(z.string().trim().min(1).max(500))
      .min(1)
      .max(20)
      .superRefine((alternatives, context) => {
        const normalized = new Set<string>();
        for (const [index, alternative] of alternatives.entries()) {
          const key = alternative.toLocaleLowerCase("ru-RU");
          if (normalized.has(key)) {
            context.addIssue({
              code: "custom",
              path: [index],
              message: "Варианты ответа не должны повторяться.",
            });
          }
          normalized.add(key);
        }
      }),
    hint: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

const acceptedAlternativesLineSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_000)
  .superRefine((value, context) => {
    const alternatives = value.split("|");
    if (alternatives.some((alternative) => alternative.trim().length === 0)) {
      context.addIssue({
        code: "custom",
        message: "Разделяйте непустые варианты ответа символом |.",
      });
    }
  });

function validateDenseTemplateMarkers(
  template: string,
  answerCount: number,
  context: {
    addIssue: (issue: {
      code: "custom";
      path: (string | number)[];
      message: string;
    }) => void;
  },
) {
  const markerIndexes = Array.from(
    template.matchAll(/\[\[(\d+)\]\]/g),
    (match) => Number(match[1]),
  );
  const actualIndexes = new Set(markerIndexes);
  const hasExactDenseRange =
    actualIndexes.size === answerCount &&
    Array.from({ length: answerCount }, (_, index) => index + 1).every(
      (index) => actualIndexes.has(index),
    );

  if (!hasExactDenseRange) {
    context.addIssue({
      code: "custom",
      path: ["template"],
      message:
        "Шаблон должен содержать плотные маркеры [[1]], [[2]] и далее — ровно по числу ответов.",
    });
  }
}

export const fillBlanksPayloadSchema = z
  .object({
    instruction: z.string().trim().min(1).max(2_000),
    template: z.string().trim().min(1).max(10_000),
    answers: z.array(fillBlankAnswerSchema).min(1).max(50),
  })
  .strict()
  .superRefine((payload, context) => {
    validateDenseTemplateMarkers(
      payload.template,
      payload.answers.length,
      context,
    );
  });

export const wordBankPayloadSchema = z
  .object({
    instruction: z.string().trim().min(1).max(2_000),
    template: z.string().trim().min(1).max(10_000),
    answers: z.array(acceptedAlternativesLineSchema).min(1).max(50),
    distractors: z.array(z.string().trim().min(1).max(500)).max(100),
    shuffle: z.boolean(),
  })
  .strict()
  .superRefine((payload, context) => {
    validateDenseTemplateMarkers(
      payload.template,
      payload.answers.length,
      context,
    );
  });

export const sequenceItemSchema = z
  .object({
    id: z.uuid(),
    text: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const sequencePayloadSchema = z
  .object({
    instruction: z.string().trim().min(1).max(2_000),
    items: z.array(sequenceItemSchema).min(2).max(40),
    mode: z.enum(["words", "sentences"]),
    shuffle: z.boolean(),
  })
  .strict()
  .superRefine((payload, context) => {
    const ids = new Set<string>();
    for (const [index, item] of payload.items.entries()) {
      if (ids.has(item.id)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "id"],
          message: "Идентификаторы элементов должны быть уникальными.",
        });
      }
      ids.add(item.id);
    }
  });

export const categorizeCategorySchema = z
  .object({
    id: z.uuid(),
    label: z.string().trim().min(1).max(240),
  })
  .strict();

export const categorizeItemSchema = z
  .object({
    id: z.uuid(),
    text: z.string().trim().min(1).max(1_000),
    categoryId: z.uuid(),
  })
  .strict();

export const categorizePayloadSchema = z
  .object({
    instruction: z.string().trim().min(1).max(2_000),
    categories: z.array(categorizeCategorySchema).min(2).max(12),
    items: z.array(categorizeItemSchema).min(2).max(60),
    shuffle: z.boolean(),
  })
  .strict()
  .superRefine((payload, context) => {
    const categoryIds = new Set<string>();
    for (const [index, category] of payload.categories.entries()) {
      if (categoryIds.has(category.id)) {
        context.addIssue({
          code: "custom",
          path: ["categories", index, "id"],
          message: "Идентификаторы категорий должны быть уникальными.",
        });
      }
      categoryIds.add(category.id);
    }

    const itemIds = new Set<string>();
    for (const [index, item] of payload.items.entries()) {
      if (itemIds.has(item.id)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "id"],
          message: "Идентификаторы элементов должны быть уникальными.",
        });
      }
      itemIds.add(item.id);
      if (!categoryIds.has(item.categoryId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "categoryId"],
          message: "Элемент должен ссылаться на существующую категорию.",
        });
      }
    }
  });

export const freeResponsePayloadSchema = z
  .object({
    prompt: z.string().trim().min(1).max(4_000),
    responseType: z.enum(["short", "long"]),
    minChars: z.number().int().min(0).max(20_000),
    maxChars: z.number().int().min(1).max(20_000),
    placeholder: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((payload, context) => {
    if (payload.minChars > payload.maxChars) {
      context.addIssue({
        code: "custom",
        path: ["maxChars"],
        message: "Максимальная длина должна быть не меньше минимальной.",
      });
    }
  });

export const externalLinkPayloadSchema = z
  .object({
    url: httpsUrlSchema,
    label: z.string().trim().min(1).max(240),
    description: z.string().trim().min(1).max(2_000).optional(),
    openInNewTab: z.boolean(),
  })
  .strict();

export const wordBuilderPayloadSchema = z
  .object({
    instruction: z.string().trim().min(1).max(2_000),
    targetWord: z.string().trim().min(1).max(240),
    hint: z.string().trim().min(1).max(500).optional(),
    shuffle: z.boolean(),
  })
  .strict();

export const vocabularyItemSchema = z
  .object({
    id: z.uuid(),
    term: z.string().trim().min(1).max(500),
    definition: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const vocabularyListPayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    items: z.array(vocabularyItemSchema).min(1).max(100),
    display: z.enum(["list", "cards"]),
  })
  .strict()
  .superRefine((payload, context) => {
    const ids = new Set<string>();
    for (const [index, item] of payload.items.entries()) {
      if (ids.has(item.id)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "id"],
          message: "Идентификаторы терминов должны быть уникальными.",
        });
      }
      ids.add(item.id);
    }
  });

export const filePayloadSchema = z
  .object({
    storedFileId: nullableStoredFileIdSchema,
    label: z.string().trim().min(1).max(240),
    description: z.string().trim().min(1).max(2_000).optional(),
    openMode: z.enum(["download", "preview"]),
  })
  .strict();

const learnerMatchingItemIdSchema = z
  .string()
  .regex(/^(?:left|right)-[1-9]\d*$/);

export const matchingGameLearnerItemSchema = z
  .object({
    id: learnerMatchingItemIdSchema,
    text: z.string().trim().min(1).max(500),
  })
  .strict();

export const matchingGameLearnerDeliverySchema = z
  .object({
    instruction: z.string().trim().min(1).max(2_000),
    leftItems: z.array(matchingGameLearnerItemSchema).min(2).max(30),
    rightItems: z.array(matchingGameLearnerItemSchema).min(2).max(30),
  })
  .strict()
  .superRefine((delivery, context) => {
    if (delivery.leftItems.length !== delivery.rightItems.length) {
      context.addIssue({
        code: "custom",
        path: ["rightItems"],
        message: "Обе колонки должны содержать одинаковое число элементов.",
      });
    }
    const ids = [
      ...delivery.leftItems.map((item) => item.id),
      ...delivery.rightItems.map((item) => item.id),
    ];
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["rightItems"],
        message: "Learner-facing идентификаторы должны быть уникальными.",
      });
    }
  });

export const matchingGameEvaluatorConfigSchema = z
  .object({
    pairs: z.array(matchingGamePairSchema).min(2).max(30),
  })
  .strict();

export const choiceQuizLearnerDeliverySchema = z
  .object({
    question: z.string().trim().min(1).max(2_000),
    options: z.array(singleChoicePollOptionSchema).min(2).max(20),
    allowMultiple: z.boolean(),
  })
  .strict()
  .superRefine((delivery, context) => {
    const ids = delivery.options.map((option) => option.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Идентификаторы вариантов должны быть уникальными.",
      });
    }
  });

export const choiceQuizEvaluatorConfigSchema = z
  .object({
    correctOptionIds: z.array(z.uuid()).min(1).max(20),
    allowMultiple: z.boolean(),
    explanation: z.string().trim().min(1).max(4_000).optional(),
  })
  .strict();

const fillBlankHintSchema = z.string().trim().min(1).max(500).nullable();

export const fillBlanksLearnerDeliverySchema = z
  .object({
    instruction: z.string().trim().min(1).max(2_000),
    template: z.string().trim().min(1).max(10_000),
    hints: z.array(fillBlankHintSchema).min(1).max(50),
  })
  .strict()
  .superRefine((delivery, context) => {
    validateDenseTemplateMarkers(
      delivery.template,
      delivery.hints.length,
      context,
    );
  });

export const fillBlanksEvaluatorConfigSchema = z
  .object({
    answers: z
      .array(
        z
          .object({
            accepted: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();

export const wordBankLearnerDeliverySchema = z
  .object({
    instruction: z.string().trim().min(1).max(2_000),
    template: z.string().trim().min(1).max(10_000),
    blankCount: z.number().int().min(1).max(50),
    options: z.array(z.string().trim().min(1).max(500)).min(1).max(150),
  })
  .strict()
  .superRefine((delivery, context) => {
    validateDenseTemplateMarkers(
      delivery.template,
      delivery.blankCount,
      context,
    );
  });

export const wordBankEvaluatorConfigSchema = z
  .object({
    answers: z.array(acceptedAlternativesLineSchema).min(1).max(50),
  })
  .strict();

export const sequenceLearnerDeliverySchema = z
  .object({
    instruction: z.string().trim().min(1).max(2_000),
    items: z.array(sequenceItemSchema).min(2).max(40),
    mode: z.enum(["words", "sentences"]),
  })
  .strict();

export const sequenceEvaluatorConfigSchema = z
  .object({
    orderedItemIds: z.array(z.uuid()).min(2).max(40),
  })
  .strict();

export const categorizeLearnerItemSchema = z
  .object({
    id: z.uuid(),
    text: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const categorizeLearnerDeliverySchema = z
  .object({
    instruction: z.string().trim().min(1).max(2_000),
    categories: z.array(categorizeCategorySchema).min(2).max(12),
    items: z.array(categorizeLearnerItemSchema).min(2).max(60),
  })
  .strict();

export const categorizeEvaluatorConfigSchema = z
  .object({
    assignments: z
      .array(
        z
          .object({
            itemId: z.uuid(),
            categoryId: z.uuid(),
          })
          .strict(),
      )
      .min(2)
      .max(60),
  })
  .strict();

export const wordBuilderLearnerTokenSchema = z
  .object({
    id: z.string().regex(/^letter-[1-9]\d*$/),
    text: z.string().min(1).max(8),
  })
  .strict();

export const wordBuilderLearnerDeliverySchema = z
  .object({
    instruction: z.string().trim().min(1).max(2_000),
    tokens: z.array(wordBuilderLearnerTokenSchema).min(1).max(240),
    hint: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const wordBuilderEvaluatorConfigSchema = z
  .object({
    targetWord: z.string().trim().min(1).max(240),
  })
  .strict();

export const singleChoicePollLearnerDeliverySchema =
  singleChoicePollPayloadSchema;

export const singleChoicePollEvaluatorConfigSchema = z
  .object({ mode: z.literal("survey") })
  .strict();

export const freeResponseLearnerDeliverySchema = freeResponsePayloadSchema;

export const freeResponseEvaluatorConfigSchema = z
  .object({
    reviewMode: z.literal("teacher"),
    responseType: z.enum(["short", "long"]),
    minChars: z.number().int().min(0).max(20_000),
    maxChars: z.number().int().min(1).max(20_000),
  })
  .strict();

function stableOpaqueHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stableDeliveryOrder<T>(
  items: readonly T[],
  key: (item: T) => string,
  forceDifferentFromSource = false,
) {
  const source = [...items];
  const ordered = [...items].sort((left, right) => {
    const leftKey = key(left);
    const rightKey = key(right);
    const leftHash = stableOpaqueHash(leftKey);
    const rightHash = stableOpaqueHash(rightKey);
    if (leftHash !== rightHash) return leftHash < rightHash ? -1 : 1;
    if (leftKey === rightKey) return 0;
    return leftKey < rightKey ? -1 : 1;
  });

  if (
    forceDifferentFromSource &&
    ordered.length > 1 &&
    ordered.every((item, index) => item === source[index])
  ) {
    return [...ordered.slice(1), ordered[0]];
  }
  return ordered;
}

function projectMatchingGameLearnerDelivery(
  payload: z.output<typeof matchingGamePayloadSchema>,
) {
  const leftOrder = stableDeliveryOrder(
    payload.pairs,
    (pair) => `matching-left:${pair.id}`,
    true,
  );
  const initialRightOrder = stableDeliveryOrder(
    payload.pairs,
    (pair) => `matching-right:${pair.id}`,
    true,
  );
  const rightOrder = [...initialRightOrder];
  const fixedIndexes = rightOrder.flatMap((pair, index) =>
    pair.id === leftOrder[index]?.id ? [index] : [],
  );

  if (fixedIndexes.length > 1) {
    const fixedValues = fixedIndexes.map((index) => rightOrder[index]);
    fixedIndexes.forEach((index, fixedIndex) => {
      rightOrder[index] = fixedValues[(fixedIndex + 1) % fixedValues.length];
    });
  } else if (fixedIndexes.length === 1) {
    const fixedIndex = fixedIndexes[0];
    const swapIndex = rightOrder.findIndex(
      (pair, index) =>
        index !== fixedIndex &&
        pair.id !== leftOrder[fixedIndex]?.id &&
        rightOrder[fixedIndex]?.id !== leftOrder[index]?.id,
    );
    if (swapIndex < 0) {
      throw new Error("Unable to build a learner-safe matching delivery.");
    }
    [rightOrder[fixedIndex], rightOrder[swapIndex]] = [
      rightOrder[swapIndex],
      rightOrder[fixedIndex],
    ];
  }

  return {
    instruction: payload.instruction,
    leftItems: leftOrder.map((pair, index) => ({
      id: `left-${index + 1}`,
      text: pair.left,
    })),
    rightItems: rightOrder.map((pair, index) => ({
      id: `right-${index + 1}`,
      text: pair.right,
    })),
  };
}

function splitAcceptedAlternatives(value: string) {
  return value.split("|").map((alternative) => alternative.trim());
}

const singleChoicePollActivityFacet = {
  supportedRoles: ["survey"],
  responseMode: "survey_choice",
  evaluatorMode: "none",
  evidencePolicy: "never",
  learnerDeliverySchema: singleChoicePollLearnerDeliverySchema,
  evaluatorConfigSchema: singleChoicePollEvaluatorConfigSchema,
  projectLearnerDelivery: (
    payload: z.output<typeof singleChoicePollPayloadSchema>,
  ) => payload,
  projectEvaluatorConfig: () => ({ mode: "survey" as const }),
} as const satisfies ComponentActivityFacet<
  typeof singleChoicePollPayloadSchema,
  typeof singleChoicePollLearnerDeliverySchema,
  typeof singleChoicePollEvaluatorConfigSchema
>;

const matchingGameActivityFacet = {
  supportedRoles: ["practice", "assessment"],
  responseMode: "matching",
  evaluatorMode: "deterministic",
  evidencePolicy: "requires_evaluation",
  learnerDeliverySchema: matchingGameLearnerDeliverySchema,
  evaluatorConfigSchema: matchingGameEvaluatorConfigSchema,
  projectLearnerDelivery: projectMatchingGameLearnerDelivery,
  projectEvaluatorConfig: (
    payload: z.output<typeof matchingGamePayloadSchema>,
  ) => ({ pairs: payload.pairs }),
} as const satisfies ComponentActivityFacet<
  typeof matchingGamePayloadSchema,
  typeof matchingGameLearnerDeliverySchema,
  typeof matchingGameEvaluatorConfigSchema
>;

const choiceQuizActivityFacet = {
  supportedRoles: ["practice", "assessment"],
  responseMode: "choice",
  evaluatorMode: "deterministic",
  evidencePolicy: "requires_evaluation",
  learnerDeliverySchema: choiceQuizLearnerDeliverySchema,
  evaluatorConfigSchema: choiceQuizEvaluatorConfigSchema,
  projectLearnerDelivery: (
    payload: z.output<typeof choiceQuizPayloadSchema>,
  ) => ({
    question: payload.question,
    options: (payload.shuffle
      ? stableDeliveryOrder(
          payload.options,
          (option) => `quiz:${option.id}`,
          true,
        )
      : payload.options
    ).map(({ id, label }) => ({ id, label })),
    allowMultiple: payload.allowMultiple,
  }),
  projectEvaluatorConfig: (
    payload: z.output<typeof choiceQuizPayloadSchema>,
  ) => ({
    correctOptionIds: payload.options
      .filter((option) => option.isCorrect)
      .map((option) => option.id),
    allowMultiple: payload.allowMultiple,
    ...(payload.explanation ? { explanation: payload.explanation } : {}),
  }),
} as const satisfies ComponentActivityFacet<
  typeof choiceQuizPayloadSchema,
  typeof choiceQuizLearnerDeliverySchema,
  typeof choiceQuizEvaluatorConfigSchema
>;

const fillBlanksActivityFacet = {
  supportedRoles: ["practice", "assessment"],
  responseMode: "fill_blanks",
  evaluatorMode: "deterministic",
  evidencePolicy: "requires_evaluation",
  learnerDeliverySchema: fillBlanksLearnerDeliverySchema,
  evaluatorConfigSchema: fillBlanksEvaluatorConfigSchema,
  projectLearnerDelivery: (
    payload: z.output<typeof fillBlanksPayloadSchema>,
  ) => ({
    instruction: payload.instruction,
    template: payload.template,
    hints: payload.answers.map((answer) => answer.hint ?? null),
  }),
  projectEvaluatorConfig: (
    payload: z.output<typeof fillBlanksPayloadSchema>,
  ) => ({
    answers: payload.answers.map((answer) => ({ accepted: answer.accepted })),
  }),
} as const satisfies ComponentActivityFacet<
  typeof fillBlanksPayloadSchema,
  typeof fillBlanksLearnerDeliverySchema,
  typeof fillBlanksEvaluatorConfigSchema
>;

const wordBankActivityFacet = {
  supportedRoles: ["practice", "assessment"],
  responseMode: "word_bank",
  evaluatorMode: "deterministic",
  evidencePolicy: "requires_evaluation",
  learnerDeliverySchema: wordBankLearnerDeliverySchema,
  evaluatorConfigSchema: wordBankEvaluatorConfigSchema,
  projectLearnerDelivery: (payload: z.output<typeof wordBankPayloadSchema>) => {
    const options = new Map<string, string>();
    for (const option of [
      ...payload.answers.flatMap(splitAcceptedAlternatives),
      ...payload.distractors,
    ]) {
      const normalized = option.toLocaleLowerCase("ru-RU");
      if (!options.has(normalized)) options.set(normalized, option);
    }
    return {
      instruction: payload.instruction,
      template: payload.template,
      blankCount: payload.answers.length,
      options: stableDeliveryOrder(
        [...options.values()],
        (option) => `word-bank:${option.toLocaleLowerCase("ru-RU")}`,
        true,
      ),
    };
  },
  projectEvaluatorConfig: (
    payload: z.output<typeof wordBankPayloadSchema>,
  ) => ({ answers: payload.answers }),
} as const satisfies ComponentActivityFacet<
  typeof wordBankPayloadSchema,
  typeof wordBankLearnerDeliverySchema,
  typeof wordBankEvaluatorConfigSchema
>;

const sequenceActivityFacet = {
  supportedRoles: ["practice", "assessment"],
  responseMode: "ordering",
  evaluatorMode: "deterministic",
  evidencePolicy: "requires_evaluation",
  learnerDeliverySchema: sequenceLearnerDeliverySchema,
  evaluatorConfigSchema: sequenceEvaluatorConfigSchema,
  projectLearnerDelivery: (
    payload: z.output<typeof sequencePayloadSchema>,
  ) => ({
    instruction: payload.instruction,
    items: stableDeliveryOrder(
      payload.items,
      (item) => `sequence:${item.id}`,
      true,
    ),
    mode: payload.mode,
  }),
  projectEvaluatorConfig: (
    payload: z.output<typeof sequencePayloadSchema>,
  ) => ({ orderedItemIds: payload.items.map((item) => item.id) }),
} as const satisfies ComponentActivityFacet<
  typeof sequencePayloadSchema,
  typeof sequenceLearnerDeliverySchema,
  typeof sequenceEvaluatorConfigSchema
>;

const categorizeActivityFacet = {
  supportedRoles: ["practice", "assessment"],
  responseMode: "categorization",
  evaluatorMode: "deterministic",
  evidencePolicy: "requires_evaluation",
  learnerDeliverySchema: categorizeLearnerDeliverySchema,
  evaluatorConfigSchema: categorizeEvaluatorConfigSchema,
  projectLearnerDelivery: (
    payload: z.output<typeof categorizePayloadSchema>,
  ) => ({
    instruction: payload.instruction,
    categories: payload.categories,
    items: stableDeliveryOrder(
      payload.items,
      (item) => `categorize:${item.id}`,
      true,
    ).map(({ id, text }) => ({ id, text })),
  }),
  projectEvaluatorConfig: (
    payload: z.output<typeof categorizePayloadSchema>,
  ) => ({
    assignments: payload.items.map((item) => ({
      itemId: item.id,
      categoryId: item.categoryId,
    })),
  }),
} as const satisfies ComponentActivityFacet<
  typeof categorizePayloadSchema,
  typeof categorizeLearnerDeliverySchema,
  typeof categorizeEvaluatorConfigSchema
>;

const freeResponseActivityFacet = {
  supportedRoles: ["practice", "assessment"],
  responseMode: "constructed_text",
  evaluatorMode: "teacher_review",
  evidencePolicy: "requires_teacher_confirmation",
  learnerDeliverySchema: freeResponseLearnerDeliverySchema,
  evaluatorConfigSchema: freeResponseEvaluatorConfigSchema,
  projectLearnerDelivery: (
    payload: z.output<typeof freeResponsePayloadSchema>,
  ) => payload,
  projectEvaluatorConfig: (
    payload: z.output<typeof freeResponsePayloadSchema>,
  ) => ({
    reviewMode: "teacher" as const,
    responseType: payload.responseType,
    minChars: payload.minChars,
    maxChars: payload.maxChars,
  }),
} as const satisfies ComponentActivityFacet<
  typeof freeResponsePayloadSchema,
  typeof freeResponseLearnerDeliverySchema,
  typeof freeResponseEvaluatorConfigSchema
>;

const wordBuilderActivityFacet = {
  supportedRoles: ["practice", "assessment"],
  responseMode: "word_construction",
  evaluatorMode: "deterministic",
  evidencePolicy: "requires_evaluation",
  learnerDeliverySchema: wordBuilderLearnerDeliverySchema,
  evaluatorConfigSchema: wordBuilderEvaluatorConfigSchema,
  projectLearnerDelivery: (
    payload: z.output<typeof wordBuilderPayloadSchema>,
  ) => ({
    instruction: payload.instruction,
    tokens: stableDeliveryOrder(
      Array.from(payload.targetWord).map((text, sourceIndex) => ({
        text,
        sourceIndex,
      })),
      (token) => `word-builder:${token.sourceIndex}:${token.text}`,
      true,
    ).map((token, deliveryIndex) => ({
      id: `letter-${deliveryIndex + 1}`,
      text: token.text,
    })),
    ...(payload.hint ? { hint: payload.hint } : {}),
  }),
  projectEvaluatorConfig: (
    payload: z.output<typeof wordBuilderPayloadSchema>,
  ) => ({ targetWord: payload.targetWord }),
} as const satisfies ComponentActivityFacet<
  typeof wordBuilderPayloadSchema,
  typeof wordBuilderLearnerDeliverySchema,
  typeof wordBuilderEvaluatorConfigSchema
>;

const defaultCapabilities = {
  teacherSurface: true,
  studentSurface: true,
  interactive: false,
  assessable: false,
  aiCreatable: true,
  aiEditable: true,
} satisfies ComponentCapabilities;

const manualOnlyCapabilities = {
  ...defaultCapabilities,
  aiCreatable: false,
  aiEditable: false,
} satisfies ComponentCapabilities;

const manualInteractiveCapabilities = {
  ...manualOnlyCapabilities,
  interactive: true,
} satisfies ComponentCapabilities;

const manualAssessableCapabilities = {
  ...manualInteractiveCapabilities,
  assessable: true,
} satisfies ComponentCapabilities;

export const componentRegistry = {
  heading: defineComponent({
    key: "heading",
    version: 1,
    title: "Заголовок",
    category: "text",
    payloadSchema: headingPayloadSchema,
    placementSchema: textPlacementSchema,
    capabilities: manualOnlyCapabilities,
    defaultPayload: { text: "Новый заголовок", level: "h2" },
    defaultPlacement: { width: "content", textAlign: "start" },
    aiInstructions:
      "Legacy-тип только для чтения и ручного редактирования исторических данных. Новые заголовки создавай в поле title компонента rich_text.",
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
      "Заполняй title, content или оба поля: короткий заголовок помогает структуре, а content содержит понятный learner-facing Markdown без HTML, скрытых инструкций преподавателю и неподтверждённых утверждений.",
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
      "Используй сноску для одного короткого пояснения, подсказки или предупреждения. Инструкции только для преподавателя сохраняй с видимостью staff_only.",
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
  video: defineComponent({
    key: "video",
    version: 1,
    title: "Видео",
    category: "media",
    payloadSchema: videoPayloadSchema,
    placementSchema: mediaPlacementSchema,
    capabilities: manualOnlyCapabilities,
    defaultPayload: { url: "https://example.com/video.mp4" },
    defaultPlacement: {
      width: "wide",
      align: "center",
      fit: "contain",
      aspectRatio: "16:9",
    },
    aiInstructions:
      "Сохраняй только HTTPS-ссылки на разрешённое видео и, если доступны, отдельные HTTPS-субтитры. Автоматическое создание и редактирование этого типа пока отключено.",
  }),
  audio: defineComponent({
    key: "audio",
    version: 1,
    title: "Аудио",
    category: "media",
    payloadSchema: audioPayloadSchema,
    placementSchema: audioPlacementSchema,
    capabilities: manualOnlyCapabilities,
    defaultPayload: {
      url: "https://example.com/audio.mp3",
      title: "Аудиозапись",
      showTranscriptByDefault: false,
    },
    defaultPlacement: { width: "content", compact: false },
    aiInstructions:
      "Сохраняй только HTTPS-ссылки на разрешённое аудио. Транскрипт добавляй лишь из проверенного источника; автоматическое создание и редактирование пока отключено.",
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
    activityFacet: singleChoicePollActivityFacet,
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
    activityFacet: matchingGameActivityFacet,
    aiInstructions:
      "Создавай однозначные пары. Сохраняй UUID существующих пар при редактировании; новым парам назначай новые UUID.",
  }),
  choice_quiz: defineComponent({
    key: "choice_quiz",
    version: 1,
    title: "Тест с выбором ответа",
    category: "interactive",
    payloadSchema: choiceQuizPayloadSchema,
    placementSchema: interactivePlacementSchema,
    capabilities: manualAssessableCapabilities,
    defaultPayload: {
      question: "Выберите правильный ответ",
      options: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          label: "Правильный ответ",
          isCorrect: true,
        },
        {
          id: "66666666-6666-4666-8666-666666666666",
          label: "Другой вариант",
          isCorrect: false,
        },
      ],
      allowMultiple: false,
      shuffle: true,
    },
    defaultPlacement: { width: "content", compact: false },
    activityFacet: choiceQuizActivityFacet,
    aiInstructions:
      "Сохраняй стабильные UUID вариантов и явно отмечай правильные ответы. Автоматическое создание и редактирование этого типа пока отключено.",
  }),
  fill_blanks: defineComponent({
    key: "fill_blanks",
    version: 1,
    title: "Заполни пропуски",
    category: "interactive",
    payloadSchema: fillBlanksPayloadSchema,
    placementSchema: interactivePlacementSchema,
    capabilities: manualAssessableCapabilities,
    defaultPayload: {
      instruction: "Впишите ответ вместо пропуска",
      template: "Столица Франции — [[1]].",
      answers: [{ accepted: ["Париж"] }],
    },
    defaultPlacement: { width: "content", compact: false },
    activityFacet: fillBlanksActivityFacet,
    aiInstructions:
      "Связывай маркеры [[1]], [[2]] и далее с ответами без пропусков индексов. Автоматическое создание и редактирование этого типа пока отключено.",
  }),
  word_bank: defineComponent({
    key: "word_bank",
    version: 1,
    title: "Банк слов",
    category: "interactive",
    payloadSchema: wordBankPayloadSchema,
    placementSchema: interactivePlacementSchema,
    capabilities: manualAssessableCapabilities,
    defaultPayload: {
      instruction: "Перетащите подходящее слово в пропуск",
      template: "Столица Франции — [[1]].",
      answers: ["Париж"],
      distractors: ["Лион"],
      shuffle: true,
    },
    defaultPlacement: { width: "content", compact: false },
    activityFacet: wordBankActivityFacet,
    aiInstructions:
      "Связывай маркеры [[1]], [[2]] и далее с ответами без пропусков индексов и отделяй альтернативы символом |. Автоматическое редактирование пока отключено.",
  }),
  sequence: defineComponent({
    key: "sequence",
    version: 1,
    title: "Расставь по порядку",
    category: "interactive",
    payloadSchema: sequencePayloadSchema,
    placementSchema: interactivePlacementSchema,
    capabilities: manualAssessableCapabilities,
    defaultPayload: {
      instruction: "Расположите элементы в правильном порядке",
      items: [
        {
          id: "77777777-7777-4777-8777-777777777777",
          text: "Первый элемент",
        },
        {
          id: "88888888-8888-4888-8888-888888888888",
          text: "Второй элемент",
        },
      ],
      mode: "sentences",
      shuffle: true,
    },
    defaultPlacement: { width: "content", compact: false },
    activityFacet: sequenceActivityFacet,
    aiInstructions:
      "Порядок массива считается правильным ответом; сохраняй стабильные UUID элементов. Автоматическое создание и редактирование пока отключено.",
  }),
  categorize: defineComponent({
    key: "categorize",
    version: 1,
    title: "Распредели по категориям",
    category: "interactive",
    payloadSchema: categorizePayloadSchema,
    placementSchema: interactivePlacementSchema,
    capabilities: manualAssessableCapabilities,
    defaultPayload: {
      instruction: "Распределите элементы по категориям",
      categories: [
        {
          id: "99999999-9999-4999-8999-999999999999",
          label: "Категория 1",
        },
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab",
          label: "Категория 2",
        },
      ],
      items: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc",
          text: "Элемент 1",
          categoryId: "99999999-9999-4999-8999-999999999999",
        },
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccd",
          text: "Элемент 2",
          categoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab",
        },
      ],
      shuffle: true,
    },
    defaultPlacement: { width: "wide", compact: false },
    activityFacet: categorizeActivityFacet,
    aiInstructions:
      "Каждый элемент должен ссылаться на UUID существующей категории; сохраняй стабильные UUID. Автоматическое создание и редактирование пока отключено.",
  }),
  free_response: defineComponent({
    key: "free_response",
    version: 1,
    title: "Свободный ответ",
    category: "interactive",
    payloadSchema: freeResponsePayloadSchema,
    placementSchema: interactivePlacementSchema,
    capabilities: manualInteractiveCapabilities,
    defaultPayload: {
      prompt: "Напишите ответ",
      responseType: "long",
      minChars: 0,
      maxChars: 2_000,
    },
    defaultPlacement: { width: "content", compact: false },
    activityFacet: freeResponseActivityFacet,
    aiInstructions:
      "Свободный ответ не оценивается автоматически. Автоматическое создание и редактирование этого типа пока отключено.",
  }),
  external_link: defineComponent({
    key: "external_link",
    version: 1,
    title: "Внешняя ссылка",
    category: "attachment",
    payloadSchema: externalLinkPayloadSchema,
    placementSchema: linkPlacementSchema,
    capabilities: manualOnlyCapabilities,
    defaultPayload: {
      url: "https://example.com/",
      label: "Открыть материал",
      openInNewTab: true,
    },
    defaultPlacement: { width: "content", align: "start", style: "card" },
    aiInstructions:
      "Сохраняй только проверенные HTTPS-ссылки. Автоматическое создание и редактирование этого типа пока отключено.",
  }),
  word_builder: defineComponent({
    key: "word_builder",
    version: 1,
    title: "Собери слово",
    category: "interactive",
    payloadSchema: wordBuilderPayloadSchema,
    placementSchema: interactivePlacementSchema,
    capabilities: manualAssessableCapabilities,
    defaultPayload: {
      instruction: "Соберите слово из букв",
      targetWord: "слово",
      shuffle: true,
    },
    defaultPlacement: { width: "content", compact: false },
    activityFacet: wordBuilderActivityFacet,
    aiInstructions:
      "Целевое слово является правильным ответом. Автоматическое создание и редактирование этого типа пока отключено.",
  }),
  vocabulary_list: defineComponent({
    key: "vocabulary_list",
    version: 1,
    title: "Словарь",
    category: "interactive",
    payloadSchema: vocabularyListPayloadSchema,
    placementSchema: interactivePlacementSchema,
    capabilities: manualInteractiveCapabilities,
    defaultPayload: {
      title: "Новые слова",
      items: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-ddddddddddde",
          term: "Термин",
          definition: "Определение",
        },
      ],
      display: "list",
    },
    defaultPlacement: { width: "content", compact: false },
    aiInstructions:
      "Сохраняй стабильные UUID терминов и проверенные определения. Автоматическое создание и редактирование этого типа пока отключено.",
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

export const creatableComponentDefinitions = creatableComponentTypeKeys.map(
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

type ComponentActivityFacetFor<TKey extends ComponentTypeKey> = NonNullable<
  ComponentRegistry[TKey]["activityFacet"]
>;

export type ComponentLearnerDelivery<TKey extends ComponentTypeKey> = [
  ComponentActivityFacetFor<TKey>,
] extends [never]
  ? ComponentPayload<TKey>
  : ComponentActivityFacetFor<TKey> extends {
        learnerDeliverySchema: infer TLearnerDeliverySchema extends z.ZodType;
      }
    ? z.output<TLearnerDeliverySchema>
    : never;

export type ComponentEvaluatorConfig<TKey extends ComponentTypeKey> = [
  ComponentActivityFacetFor<TKey>,
] extends [never]
  ? never
  : ComponentActivityFacetFor<TKey> extends {
        evaluatorConfigSchema: infer TEvaluatorConfigSchema extends z.ZodType;
      }
    ? z.output<TEvaluatorConfigSchema>
    : never;

/**
 * Converts a validated author payload into the only shape that may cross a
 * learner-facing boundary. Both the source and projected values are parsed;
 * malformed data throws and is never returned as a raw fallback.
 */
export function projectLearnerComponentPayload<TKey extends ComponentTypeKey>(
  key: TKey,
  payload: unknown,
): ComponentLearnerDelivery<TKey> {
  const definition = componentRegistry[key] as ComponentDefinition;
  const authorPayload = definition.payloadSchema.parse(payload);
  const facet = definition.activityFacet;
  if (!facet) {
    return authorPayload as ComponentLearnerDelivery<TKey>;
  }
  const projectLearnerDelivery = facet.projectLearnerDelivery as (
    source: unknown,
  ) => unknown;
  return facet.learnerDeliverySchema.parse(
    projectLearnerDelivery(authorPayload),
  ) as ComponentLearnerDelivery<TKey>;
}

/**
 * Extracts server-private evaluator configuration. Calling this for a passive
 * Component is an integration error and therefore fails closed.
 */
export function projectComponentEvaluatorConfig<TKey extends ComponentTypeKey>(
  key: TKey,
  payload: unknown,
): ComponentEvaluatorConfig<TKey> {
  const definition = componentRegistry[key] as ComponentDefinition;
  const authorPayload = definition.payloadSchema.parse(payload);
  const facet = definition.activityFacet;
  if (!facet) {
    throw new Error(`Component type ${key} has no activity facet.`);
  }
  const projectEvaluatorConfig = facet.projectEvaluatorConfig as (
    source: unknown,
  ) => unknown;
  return facet.evaluatorConfigSchema.parse(
    projectEvaluatorConfig(authorPayload),
  ) as ComponentEvaluatorConfig<TKey>;
}

type SupportedActivityRole<TKey extends ComponentTypeKey> = [
  ComponentActivityFacetFor<TKey>,
] extends [never]
  ? never
  : ComponentActivityFacetFor<TKey>["supportedRoles"][number];

export type LessonAddComponentInput = {
  [TKey in CreatableComponentTypeKey]: {
    lessonId: string;
    typeKey: TKey;
    payload: ComponentPayload<TKey>;
    placement: ComponentPlacement<TKey>;
    primaryLearningObjectiveId: string | null;
    activityRole: SupportedActivityRole<TKey> | null;
  };
}[CreatableComponentTypeKey];

const addComponentVariantSchemas = creatableComponentTypeKeys.map((typeKey) => {
  const definition = componentRegistry[typeKey];
  const activityFacet = definition.activityFacet;
  const roleSchema = activityFacet
    ? z
        .enum(
          activityFacet.supportedRoles as unknown as [
            ActivityRole,
            ...ActivityRole[],
          ],
        )
        .nullable()
        .default(null)
    : z.null().default(null);
  return z
    .object({
      // PostgreSQL UUID values are not guaranteed to carry an RFC version bit
      // (for example, deterministic md5::uuid fixtures), so persisted ids use
      // the generic GUID shape at this boundary.
      lessonId: z.guid(),
      typeKey: z.literal(typeKey),
      payload: definition.payloadSchema,
      placement: definition.placementSchema,
      primaryLearningObjectiveId: z.guid().nullable().default(null),
      activityRole: roleSchema,
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
