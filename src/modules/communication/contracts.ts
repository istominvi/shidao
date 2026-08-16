import { z } from "zod";

const MAX_MESSAGE_LENGTH = 6_000;
const MAX_TITLE_LENGTH = 160;

const nullableQueryString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (value === "" || value == null ? null : value));

const nullablePositiveIntegerQuery = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value, context) => {
    if (value === "" || value == null) return null;
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0) {
      context.addIssue({
        code: "custom",
        message: "Курсор должен быть положительным целым числом.",
      });
      return z.NEVER;
    }
    return number;
  });

const limitQuery = (defaultValue: number) =>
  z
    .union([z.string(), z.number(), z.undefined()])
    .transform((value, context) => {
      const number = value === undefined ? defaultValue : Number(value);
      if (!Number.isSafeInteger(number) || number < 1 || number > 50) {
        context.addIssue({
          code: "custom",
          message: "Лимит должен быть целым числом от 1 до 50.",
        });
        return z.NEVER;
      }
      return number;
    });

export const communicationUuidSchema = z.guid();

export const inboxQuerySchema = z
  .object({
    cursorActivityAt: nullableQueryString.pipe(z.string().max(128).nullable()),
    cursorKind: nullableQueryString.pipe(
      z.enum(["direct", "course", "assistant"]).nullable(),
    ),
    cursorId: nullableQueryString.pipe(z.string().max(200).nullable()),
    limit: limitQuery(30),
  })
  .strict()
  .superRefine((query, context) => {
    const cursorParts = [
      query.cursorActivityAt,
      query.cursorKind,
      query.cursorId,
    ];
    const present = cursorParts.filter((part) => part !== null).length;
    if (present !== 0 && present !== cursorParts.length) {
      context.addIssue({
        code: "custom",
        path: ["cursorActivityAt"],
        message: "Передайте все части курсора входящих сообщений.",
      });
    }
  });

export const messageTargetsQuerySchema = z
  .object({
    q: nullableQueryString.pipe(z.string().trim().max(160).nullable()),
    limit: limitQuery(50),
  })
  .strict();

export const openCommunicationThreadInputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("direct"),
      learnerProfileId: communicationUuidSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("course"),
      courseId: communicationUuidSchema,
    })
    .strict(),
]);

export const messagePageQuerySchema = z
  .object({
    beforeMessageId: nullablePositiveIntegerQuery,
    limit: limitQuery(50),
  })
  .strict();

export const sendCommunicationMessageInputSchema = z
  .object({
    clientMessageId: communicationUuidSchema,
    body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  })
  .strict();

export const markCommunicationThreadReadInputSchema = z
  .object({
    throughMessageId: z.number().int().positive().safe().nullable().optional(),
  })
  .strict();

export const assistantConversationListQuerySchema = z
  .object({
    includeArchived: z
      .union([
        z.literal("true"),
        z.literal("false"),
        z.boolean(),
        z.undefined(),
      ])
      .transform((value) => value === true || value === "true"),
    limit: limitQuery(50),
  })
  .strict();

const assistantConversationContextSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("global") }).strict(),
  z
    .object({
      kind: z.literal("course"),
      courseId: communicationUuidSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("lesson"),
      courseId: communicationUuidSchema,
      lessonId: communicationUuidSchema,
    })
    .strict(),
]);

export const createAssistantConversationInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .max(MAX_TITLE_LENGTH)
      .default("Новый диалог"),
    context: assistantConversationContextSchema.default({ kind: "global" }),
  })
  .strict();

export const updateAssistantConversationInputSchema = z.discriminatedUnion(
  "action",
  [
    z
      .object({
        action: z.literal("rename"),
        title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
      })
      .strict(),
    z.object({ action: z.literal("archive") }).strict(),
  ],
);

export const assistantTurnPageQuerySchema = z
  .object({
    beforeTurnId: nullablePositiveIntegerQuery,
    limit: limitQuery(50),
  })
  .strict();

export const appendAssistantUserTurnInputSchema = z
  .object({
    clientTurnId: communicationUuidSchema,
    body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
    localDate: z.iso.date(),
    utcOffsetMinutes: z
      .number()
      .int()
      .min(-14 * 60)
      .max(14 * 60),
  })
  .strict();

export const markAssistantConversationReadInputSchema = z
  .object({
    throughTurnId: z.number().int().positive().safe().nullable().optional(),
  })
  .strict();

export const systemNotificationPageQuerySchema = z
  .object({
    beforeNotificationId: nullablePositiveIntegerQuery,
    limit: limitQuery(50),
  })
  .strict();

export const markSystemNotificationsReadInputSchema = z
  .object({
    throughNotificationId: z
      .number()
      .int()
      .positive()
      .safe()
      .nullable()
      .optional(),
  })
  .strict();

export type InboxQuery = z.infer<typeof inboxQuerySchema>;
export type MessageTargetsQuery = z.infer<typeof messageTargetsQuerySchema>;
export type OpenCommunicationThreadInput = z.infer<
  typeof openCommunicationThreadInputSchema
>;
export type MessagePageQuery = z.infer<typeof messagePageQuerySchema>;
export type SendCommunicationMessageInput = z.infer<
  typeof sendCommunicationMessageInputSchema
>;
export type MarkCommunicationThreadReadInput = z.infer<
  typeof markCommunicationThreadReadInputSchema
>;
export type AssistantConversationListQuery = z.infer<
  typeof assistantConversationListQuerySchema
>;
export type CreateAssistantConversationInput = z.infer<
  typeof createAssistantConversationInputSchema
>;
export type UpdateAssistantConversationInput = z.infer<
  typeof updateAssistantConversationInputSchema
>;
export type AssistantTurnPageQuery = z.infer<
  typeof assistantTurnPageQuerySchema
>;
export type AppendAssistantUserTurnInput = z.infer<
  typeof appendAssistantUserTurnInputSchema
>;
export type MarkAssistantConversationReadInput = z.infer<
  typeof markAssistantConversationReadInputSchema
>;
export type SystemNotificationPageQuery = z.infer<
  typeof systemNotificationPageQuerySchema
>;
export type MarkSystemNotificationsReadInput = z.infer<
  typeof markSystemNotificationsReadInputSchema
>;

export class CommunicationApplicationError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "CommunicationApplicationError";
  }
}

export function parseCommunicationContract<T>(
  schema: z.ZodType<T>,
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new CommunicationApplicationError(
    result.error.issues[0]?.message ?? "Проверьте данные сообщения.",
    400,
    "communication_validation_error",
  );
}
