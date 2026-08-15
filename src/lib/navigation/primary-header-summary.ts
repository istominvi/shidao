import { z } from "zod";

export const PRIMARY_HEADER_SUMMARY_TTL_MS = 60_000;
export const PRIMARY_HEADER_SCHEDULE_RESULT_LIMIT = 500;
export const primaryHeaderSummaryOwnerKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/);

export const primaryHeaderScheduleSummarySchema = z
  .object({
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
    resultCount: z.number().int().nonnegative(),
    visibleRunCount: z.number().int().nonnegative(),
    limited: z.boolean(),
  })
  .strict();

export const primaryHeaderStudentsSummarySchema = z
  .object({
    activeCount: z.number().int().nonnegative(),
    archivedCount: z.number().int().nonnegative(),
    pendingCount: z.number().int().nonnegative(),
  })
  .strict();

export const primaryHeaderProfileSummarySchema = z
  .object({
    finalizedRunCount: z.number().int().nonnegative(),
    attendedRunCount: z.number().int().nonnegative(),
    subjectCount: z.number().int().nonnegative(),
  })
  .strict();

export const primaryHeaderSummarySchema = z
  .object({
    generatedAt: z.iso.datetime({ offset: true }),
    ownerKey: primaryHeaderSummaryOwnerKeySchema,
    schedule: primaryHeaderScheduleSummarySchema.nullable(),
    students: primaryHeaderStudentsSummarySchema.nullable(),
    profile: primaryHeaderProfileSummarySchema.nullable(),
  })
  .strict();

export type PrimaryHeaderSummary = z.infer<typeof primaryHeaderSummarySchema>;

const EXACT_CONTENT_RANGE_PATTERN = /^(?:0-(0|[1-9]\d*)\/([1-9]\d*)|\*\/0)$/;

/** Parses only exact PostgREST totals; wildcard totals and malformed ranges fail closed. */
export function parsePrimaryHeaderExactCount(value: string | null) {
  const match = value?.match(EXACT_CONTENT_RANGE_PATTERN);
  if (!match) throw new Error("primary_header_summary_count_invalid");
  if (value === "*/0") return 0;

  const end = Number(match[1]);
  const total = Number(match[2]);
  if (
    !Number.isSafeInteger(end) ||
    !Number.isSafeInteger(total) ||
    end >= total
  ) {
    throw new Error("primary_header_summary_count_invalid");
  }
  return total;
}

export function canCommitPrimaryHeaderSummaryRequest(input: {
  requestGeneration: number;
  currentGeneration: number;
  accountActive: boolean;
  unauthorized: boolean;
}) {
  return (
    input.requestGeneration === input.currentGeneration &&
    input.accountActive &&
    !input.unauthorized
  );
}

/** Matches the default local-week window used by ScheduleWorkspace. */
export function currentPrimaryHeaderScheduleRange(now = new Date()) {
  const localNoon = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
  );
  const weekday = localNoon.getDay() || 7;
  const from = new Date(
    localNoon.getFullYear(),
    localNoon.getMonth(),
    localNoon.getDate() - weekday + 1,
  );
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
  return { from: from.toISOString(), to: to.toISOString() };
}
