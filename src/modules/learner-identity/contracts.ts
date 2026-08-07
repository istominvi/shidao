import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().email().max(320);
const tokenSchema = z.string().trim().min(16).max(2_048);
const fingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/i);
const identifierSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(
    /^[\p{L}\p{N}._-]+$/u,
    "Используйте буквы, цифры, точку, дефис или подчёркивание.",
  );

export const teacherLearnerStatusSchema = z.enum(["active", "archived"]);

export const directoryQuerySchema = z
  .object({ status: teacherLearnerStatusSchema.default("active") })
  .strict();

export const connectionRequestInputSchema = z.discriminatedUnion("method", [
  z
    .object({
      method: z.literal("share_code"),
      shareCode: z.string().trim().min(6).max(64),
      localDisplayName: z.string().trim().min(1).max(160),
    })
    .strict(),
  z
    .object({
      method: z.literal("email"),
      email: emailSchema,
      localDisplayName: z.string().trim().min(1).max(160),
    })
    .strict(),
]);

export const connectionActionSchema = z
  .object({ action: z.enum(["accept", "reject", "cancel"]) })
  .strict();

export const learnerInvitationInputSchema = z
  .object({
    kind: z.enum(["claim", "child_activation"]),
    recipientEmail: emailSchema,
  })
  .strict();

export const invitationTokenInputSchema = z
  .object({ token: tokenSchema })
  .strict();

export const invitationActionInputSchema = z
  .object({
    token: tokenSchema,
    action: z.enum(["preview", "accept", "reject"]),
  })
  .strict();

export const childActivationInputSchema = z
  .object({
    token: tokenSchema,
    learnerLogin: identifierSchema,
    pin: z.string().regex(/^\d{4,8}$/, "PIN должен состоять из 4–8 цифр."),
    acknowledgeRecoveryDelegate: z.literal(true, {
      error: "Подтвердите право восстановить логин и PIN учащегося.",
    }),
    requestObserverInvitation: z.boolean().default(false),
  })
  .strict();

export const learnerCredentialResetInputSchema = z
  .object({
    newLogin: identifierSchema,
    pin: z.string().regex(/^\d{4,8}$/, "PIN должен состоять из 4–8 цифр."),
    idempotencyKey: z.uuid(),
  })
  .strict();

export const mergePreviewInputSchema = z
  .object({ mergeOperationId: z.uuid() })
  .strict();

export const mergeConfirmInputSchema = z
  .object({
    mergeOperationId: z.uuid(),
    previewFingerprint: fingerprintSchema,
  })
  .strict();

export const cursorHistoryQuerySchema = z
  .object({
    cursor: z.string().trim().min(1).max(1_024).nullable().default(null),
    limit: z.number().int().min(1).max(50).default(25),
  })
  .strict();

export const observerInvitationInputSchema = z
  .object({
    recipientEmail: emailSchema,
    relationshipLabel: z.string().trim().max(80).default(""),
  })
  .strict();

export const observerActionInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }).strict(),
  z.object({ action: z.literal("reject") }).strict(),
  z.object({ action: z.literal("revoke") }).strict(),
  z.object({ action: z.literal("leave") }).strict(),
  z
    .object({
      action: z.literal("rename"),
      relationshipLabel: z.string().trim().max(80),
    })
    .strict(),
]);

export const aiConsentRequestInputSchema = z
  .object({
    learnerProfileId: z.uuid(),
    purpose: z.string().trim().min(1).max(400),
    expiresInDays: z.number().int().min(1).max(365).default(90),
  })
  .strict();

export const aiConsentActionInputSchema = z
  .object({
    action: z.enum(["grant", "revoke"]),
    expiresInDays: z.number().int().min(1).max(365).optional(),
    expectedRevision: z.number().int().min(1),
  })
  .strict();

export const confirmFingerprintInputSchema = z
  .object({ previewFingerprint: fingerprintSchema })
  .strict();

export const emptyObjectSchema = z.object({}).strict();

export type ConnectionRequestInput = z.infer<
  typeof connectionRequestInputSchema
>;
export type LearnerInvitationInput = z.infer<
  typeof learnerInvitationInputSchema
>;
export type ChildActivationInput = z.infer<typeof childActivationInputSchema>;
export type LearnerCredentialResetInput = z.infer<
  typeof learnerCredentialResetInputSchema
>;
export type MergePreviewInput = z.infer<typeof mergePreviewInputSchema>;
export type MergeConfirmInput = z.infer<typeof mergeConfirmInputSchema>;
export type CursorHistoryQuery = z.infer<typeof cursorHistoryQuerySchema>;
export type ObserverInvitationInput = z.infer<
  typeof observerInvitationInputSchema
>;
export type ObserverActionInput = z.infer<typeof observerActionInputSchema>;
export type AiConsentRequestInput = z.infer<typeof aiConsentRequestInputSchema>;
export type AiConsentActionInput = z.infer<typeof aiConsentActionInputSchema>;
