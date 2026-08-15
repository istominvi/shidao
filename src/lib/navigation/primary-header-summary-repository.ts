import "server-only";

import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import { parsePrimaryHeaderExactCount } from "@/lib/navigation/primary-header-summary";

type TeacherLearnerCountStatus = "active" | "archived";

type PrimaryHeaderSummaryRepositoryOptions = {
  fetcher?: typeof fetch;
  getConfig?: () => { url: string; anonKey: string };
};

export class PrimaryHeaderSummaryRepositoryError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "PrimaryHeaderSummaryRepositoryError";
    this.status = status;
    this.code = code;
  }
}

function encodeFilter(value: string) {
  return encodeURIComponent(value);
}

export function createPrimaryHeaderSummaryRepository(
  accessToken: string,
  options: PrimaryHeaderSummaryRepositoryOptions = {},
) {
  const fetcher = options.fetcher ?? fetch;
  const getConfig = options.getConfig ?? getSupabasePublicConfig;

  async function exactCount(path: string) {
    const { url, anonKey } = getConfig();
    let response: Response;
    try {
      response = await fetcher(`${url.replace(/\/+$/, "")}${path}`, {
        method: "HEAD",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          Prefer: "count=exact",
          Range: "0-0",
          "Range-Unit": "items",
        },
        cache: "no-store",
      });
    } catch {
      throw new PrimaryHeaderSummaryRepositoryError(
        "Не удалось получить метрики разделов.",
        503,
        "primary_header_summary_network_error",
      );
    }

    if (!response.ok) {
      throw new PrimaryHeaderSummaryRepositoryError(
        "Не удалось получить метрики разделов.",
        response.status,
        response.status === 401
          ? "primary_header_summary_unauthorized"
          : "primary_header_summary_repository_error",
      );
    }

    try {
      // Some self-hosted PostgREST versions ignore Range for HEAD and return
      // e.g. `0-5/6`; the exact count is still the validated denominator.
      return parsePrimaryHeaderExactCount(
        response.headers.get("content-range"),
      );
    } catch {
      throw new PrimaryHeaderSummaryRepositoryError(
        "Сервис вернул некорректный счётчик раздела.",
        502,
        "primary_header_summary_count_invalid",
      );
    }
  }

  return {
    countScheduleWindow(from: string, to: string) {
      return exactCount(
        `/rest/v1/lesson_run?select=id&scheduled_at=gte.${encodeFilter(from)}&scheduled_at=lt.${encodeFilter(to)}&cancelled_at=is.null`,
      );
    },

    countTeacherLearners(status: TeacherLearnerCountStatus) {
      const archivedFilter =
        status === "active" ? "archived_at=is.null" : "archived_at=not.is.null";
      return exactCount(
        `/rest/v1/teacher_learner?select=learner_profile_id&${archivedFilter}`,
      );
    },
  };
}
