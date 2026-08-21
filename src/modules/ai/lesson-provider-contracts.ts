import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  aiLessonPlanSchema,
  type AiLessonPlan,
} from "./course-builder-contracts";
import { RouterAiError } from "./routerai";

const aiLessonProviderBlockKindSchema = z.enum([
  "rich_text",
  "callout",
  "single_choice_poll",
  "matching_game",
  "choice_quiz",
]);

const aiLessonProviderMatchSchema = z
  .object({
    left: z.string().trim().min(1).max(500),
    right: z.string().trim().min(1).max(500),
  })
  .strict();

/**
 * Provider-facing lesson shape. Every block uses the same required fields so
 * providers do not have to resolve a large discriminated JSON-schema union.
 * It is converted to the canonical component registry shape before it can be
 * previewed or persisted.
 */
export const aiLessonProviderPlanSchema = z
  .object({
    summary: z.string().trim().min(1).max(1_200),
    blocks: z
      .array(
        z
          .object({
            kind: aiLessonProviderBlockKindSchema,
            title: z.string().trim().max(160),
            body: z.string().trim().max(4_000),
            choices: z.array(z.string().trim().min(1).max(500)).max(8),
            correctChoices: z.array(z.string().trim().min(1).max(500)).max(8),
            allowMultiple: z.boolean(),
            explanation: z.string().trim().max(4_000),
            matches: z.array(aiLessonProviderMatchSchema).max(8),
          })
          .strict(),
      )
      .min(3)
      .max(20),
  })
  .strict();

export type AiLessonProviderPlan = z.infer<typeof aiLessonProviderPlanSchema>;

const unsupportedProviderSchemaKeywords = new Set([
  "$schema",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
]);

function simplifyProviderSchemaValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(simplifyProviderSchemaValue);
  }
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !unsupportedProviderSchemaKeywords.has(key))
      .map(([key, nestedValue]) => [
        key,
        simplifyProviderSchemaValue(nestedValue),
      ]),
  );
}

/**
 * RouterAI forwards JSON Schema to providers with different supported
 * subsets. Runtime Zod validation remains authoritative for all removed size
 * constraints.
 */
export function providerJsonSchemaFor(schema: z.ZodType) {
  return simplifyProviderSchemaValue(z.toJSONSchema(schema)) as Record<
    string,
    unknown
  >;
}

function invalidProviderOutput(requestId?: string): never {
  throw new RouterAiError(
    "invalid_output",
    "ИИ вернул ответ, который не соответствует ожидаемой структуре.",
    requestId ? { requestId } : {},
  );
}

function firstContent(...values: string[]) {
  return values.find((value) => value.length > 0) ?? "";
}

function uniqueStrings(values: readonly string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLocaleLowerCase("ru-RU");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueMatches(matches: readonly { left: string; right: string }[]) {
  const seen = new Set<string>();
  return matches.filter(({ left, right }) => {
    const key = `${left.toLocaleLowerCase("ru-RU")}\u0000${right.toLocaleLowerCase("ru-RU")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function toCanonicalAiLessonPlan(
  rawPlan: unknown,
  requestId?: string,
): AiLessonPlan {
  try {
    const providerPlan = aiLessonProviderPlanSchema.parse(rawPlan);
    const components: AiLessonPlan["components"] = providerPlan.blocks.map(
      (block): AiLessonPlan["components"][number] => {
        switch (block.kind) {
          case "rich_text": {
            if (!block.title && !block.body) {
              return invalidProviderOutput(requestId);
            }
            if (!block.title) {
              return {
                typeKey: "rich_text",
                payload: {
                  content: block.body,
                  format: "markdown",
                },
              };
            }
            return {
              typeKey: "rich_text",
              payload: {
                title: block.title,
                ...(block.body ? { content: block.body } : {}),
                format: "markdown",
              },
            };
          }
          case "callout":
            if (!block.body) return invalidProviderOutput(requestId);
            return {
              typeKey: "callout",
              payload: {
                ...(block.title ? { title: block.title } : {}),
                text: block.body,
                tone: "info",
              },
            };
          case "single_choice_poll": {
            const question = firstContent(block.title, block.body);
            const choices = uniqueStrings(block.choices);
            if (!question || choices.length < 2) {
              return invalidProviderOutput(requestId);
            }
            return {
              typeKey: "single_choice_poll",
              payload: {
                question,
                options: choices.map((label) => ({
                  id: randomUUID(),
                  label,
                })),
                showResults: true,
              },
            };
          }
          case "matching_game": {
            const instruction = firstContent(block.title, block.body);
            const matches = uniqueMatches(block.matches);
            if (!instruction || matches.length < 2) {
              return invalidProviderOutput(requestId);
            }
            return {
              typeKey: "matching_game",
              payload: {
                instruction,
                pairs: matches.map(({ left, right }) => ({
                  id: randomUUID(),
                  left,
                  right,
                })),
                shuffle: true,
              },
            };
          }
          case "choice_quiz": {
            const question = firstContent(block.title, block.body);
            const choices = uniqueStrings(block.choices);
            const correctChoices = uniqueStrings(block.correctChoices);
            const correctChoiceKeys = new Set(
              correctChoices.map((choice) => choice.toLocaleLowerCase("ru-RU")),
            );
            const matchedCorrectChoices = choices.filter((choice) =>
              correctChoiceKeys.has(choice.toLocaleLowerCase("ru-RU")),
            );
            if (
              !question ||
              choices.length < 2 ||
              correctChoices.length < 1 ||
              matchedCorrectChoices.length !== correctChoices.length ||
              (!block.allowMultiple && matchedCorrectChoices.length !== 1)
            ) {
              return invalidProviderOutput(requestId);
            }
            return {
              typeKey: "choice_quiz",
              payload: {
                question,
                options: choices.map((label) => ({
                  id: randomUUID(),
                  label,
                  isCorrect: correctChoiceKeys.has(
                    label.toLocaleLowerCase("ru-RU"),
                  ),
                })),
                allowMultiple: block.allowMultiple,
                ...(block.explanation
                  ? { explanation: block.explanation }
                  : {}),
                shuffle: true,
              },
            };
          }
        }
      },
    );

    return aiLessonPlanSchema.parse({
      summary: providerPlan.summary,
      components,
    });
  } catch (error) {
    if (error instanceof RouterAiError) throw error;
    return invalidProviderOutput(requestId);
  }
}
