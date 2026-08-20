import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import { CourseBuilderRepositoryError } from "@/modules/course-builder/repository";
import {
  observationEntryMethodSchema,
  observationRatingSchema,
  type SaveLessonComponentObservationsInput,
} from "./contracts";
import type {
  LessonComponentObservation,
  ObservationEntryMethod,
} from "./domain";

type JsonObject = Record<string, unknown>;

type LessonComponentObservationRow = {
  id: string;
  learning_record_id: string;
  lesson_component_id: string | null;
  source_lesson_component_id_at_time: string;
  component_position_at_time: number;
  component_type_key_at_time: string;
  component_label_at_time: string;
  observable_criterion_at_time: string;
  rating: string;
  entry_method: string;
  private_note: string | null;
  observed_at: string;
  recorded_by_account_id: string;
  created_at: string;
  updated_at: string;
};

export type SaveRunObservationsRepositoryInput = {
  lessonRunId: string;
  lessonComponentId: string;
  componentLabelAtTime: string;
  observableCriterionAtTime: string | null;
  entryMethod: ObservationEntryMethod;
  entries: SaveLessonComponentObservationsInput["entries"];
};

export interface LearningActivitiesRepository {
  listByLearningRecordIds(
    learningRecordIds: string[],
  ): Promise<LessonComponentObservation[]>;
  saveRunObservations(input: SaveRunObservationsRepositoryInput): Promise<void>;
}

const POSTGREST_IN_FILTER_CHUNK_SIZE = 50;
const POSTGREST_READ_CONCURRENCY = 8;
const POSTGREST_PAGE_SIZE = 500;

function encodeFilter(value: string) {
  return encodeURIComponent(value);
}

function inFilter(values: string[]) {
  return values.map(encodeFilter).join(",");
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

type ExactContentRange =
  | { empty: true; total: 0 }
  | { empty: false; start: number; end: number; total: number };

function invalidContentRange(): never {
  throw new CourseBuilderRepositoryError(
    "Supabase вернул некорректный диапазон наблюдений.",
    502,
    "observation_content_range_invalid",
  );
}

function parseExactContentRange(
  value: string | null,
  expectedStart: number,
  expectedEnd: number,
  rowCount: number,
): ExactContentRange {
  if (value === "*/0") {
    if (expectedStart !== 0 || rowCount !== 0) invalidContentRange();
    return { empty: true, total: 0 };
  }

  const match = /^(\d+)-(\d+)\/(\d+)$/.exec(value ?? "");
  if (!match) invalidContentRange();

  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    !Number.isSafeInteger(total) ||
    start !== expectedStart ||
    end < start ||
    end > expectedEnd ||
    end - start + 1 !== rowCount ||
    total <= end
  ) {
    invalidContentRange();
  }

  return { empty: false, start, end, total };
}

function compareObservations(
  left: LessonComponentObservation,
  right: LessonComponentObservation,
) {
  return (
    left.componentPositionAtTime - right.componentPositionAtTime ||
    left.learningRecordId.localeCompare(right.learningRecordId) ||
    left.id.localeCompare(right.id)
  );
}

function mapObservation(
  row: LessonComponentObservationRow,
): LessonComponentObservation {
  const rating = observationRatingSchema.safeParse(row.rating);
  const entryMethod = observationEntryMethodSchema.safeParse(row.entry_method);
  if (
    !row.component_type_key_at_time.trim() ||
    row.component_type_key_at_time.length > 80 ||
    !rating.success ||
    !entryMethod.success
  ) {
    throw new CourseBuilderRepositoryError(
      "Supabase вернул неподдерживаемое наблюдение.",
      502,
      "observation_projection_invalid",
    );
  }
  return {
    id: row.id,
    learningRecordId: row.learning_record_id,
    lessonComponentId: row.lesson_component_id,
    sourceComponentIdAtTime: row.source_lesson_component_id_at_time,
    componentPositionAtTime: row.component_position_at_time,
    componentTypeAtTime: row.component_type_key_at_time,
    componentLabelAtTime: row.component_label_at_time,
    observableCriterionAtTime: row.observable_criterion_at_time,
    rating: rating.data,
    entryMethod: entryMethod.data,
    privateNote: row.private_note,
    observedAt: row.observed_at,
    recordedByAccountId: row.recorded_by_account_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createLearningActivitiesRepository(
  accessToken: string,
): LearningActivitiesRepository {
  const { url, anonKey } = getSupabasePublicConfig();

  async function request<T>(
    path: string,
    init: {
      method?: "GET" | "POST";
      body?: JsonObject;
      allowEmpty?: boolean;
      headers?: Record<string, string>;
      inspectResponse?: (response: Response, value: T) => void;
    } = {},
  ): Promise<T> {
    const method = init.method ?? "GET";
    let response: Response;
    try {
      response = await fetch(`${url}${path}`, {
        method,
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...(method === "GET" ? {} : { Prefer: "return=minimal" }),
          ...init.headers,
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        cache: "no-store",
      });
    } catch {
      throw new CourseBuilderRepositoryError(
        "Не удалось связаться с Supabase.",
        503,
        "repository_network_error",
      );
    }

    if (!response.ok) {
      const details = (await response.json().catch(() => null)) as {
        message?: string;
        error?: string;
        code?: string;
      } | null;
      throw new CourseBuilderRepositoryError(
        details?.message ??
          details?.error ??
          "Supabase отклонил операцию с наблюдением.",
        response.status,
        details?.code ?? null,
      );
    }

    const text = await response.text();
    if (!text) {
      if (init.allowEmpty) return undefined as T;
      throw new CourseBuilderRepositoryError(
        "Supabase вернул пустой ответ.",
        502,
        "repository_empty_response",
      );
    }
    const value = JSON.parse(text) as T;
    init.inspectResponse?.(response, value);
    return value;
  }

  async function listBatch(batch: string[]) {
    const rows: LessonComponentObservationRow[] = [];
    const path = `/rest/v1/lesson_component_observation?select=*&learning_record_id=in.(${inFilter(batch)})&order=component_position_at_time.asc,learning_record_id.asc,id.asc`;
    let expectedStart = 0;
    let exactTotal: number | null = null;

    while (exactTotal === null || expectedStart < exactTotal) {
      const expectedEnd = expectedStart + POSTGREST_PAGE_SIZE - 1;
      const contentRanges: ExactContentRange[] = [];
      const page = await request<LessonComponentObservationRow[]>(path, {
        headers: {
          Prefer: "count=exact",
          Range: `${expectedStart}-${expectedEnd}`,
          "Range-Unit": "items",
        },
        inspectResponse(response, value) {
          if (!Array.isArray(value)) invalidContentRange();
          contentRanges.push(
            parseExactContentRange(
              response.headers.get("content-range"),
              expectedStart,
              expectedEnd,
              value.length,
            ),
          );
        },
      });

      const contentRange = contentRanges[0];
      if (!contentRange) invalidContentRange();
      if (exactTotal !== null && contentRange.total !== exactTotal) {
        invalidContentRange();
      }
      exactTotal = contentRange.total;

      if (contentRange.empty) return rows;
      rows.push(...page);
      expectedStart = contentRange.end + 1;
    }

    if (rows.length !== exactTotal) invalidContentRange();
    return rows;
  }

  return {
    async listByLearningRecordIds(learningRecordIds) {
      const uniqueIds = [...new Set(learningRecordIds)];
      if (uniqueIds.length === 0) return [];
      const rows: LessonComponentObservationRow[] = [];
      const batches = chunks(uniqueIds, POSTGREST_IN_FILTER_CHUNK_SIZE);
      for (const window of chunks(batches, POSTGREST_READ_CONCURRENCY)) {
        rows.push(
          ...(
            await Promise.all(window.map((batch) => listBatch(batch)))
          ).flat(),
        );
      }
      return rows.map(mapObservation).sort(compareObservations);
    },

    async saveRunObservations(input) {
      await request<undefined>(
        "/rest/v1/rpc/save_lesson_component_observations",
        {
          method: "POST",
          body: {
            p_lesson_run_id: input.lessonRunId,
            p_lesson_component_id: input.lessonComponentId,
            p_component_label_at_time: input.componentLabelAtTime,
            p_observable_criterion_at_time: input.observableCriterionAtTime,
            p_entry_method: input.entryMethod,
            p_observations: input.entries.map((entry) => ({
              learningRecordId: entry.learningRecordId,
              rating: entry.rating,
              privateNote: entry.privateNote,
            })),
          },
          allowEmpty: true,
        },
      );
    },
  };
}
