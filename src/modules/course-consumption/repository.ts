import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import { coursePublicationProgressSchema } from "./contracts";
import type { CoursePublicationProgress } from "./domain";

type JsonObject = Record<string, unknown>;

export class CourseConsumptionRepositoryError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly databaseCode: string | null,
  ) {
    super(message);
    this.name = "CourseConsumptionRepositoryError";
  }
}

function camelKey(key: string) {
  return key.replace(/_([a-z0-9])/g, (_match, character: string) =>
    character.toUpperCase(),
  );
}

function camelize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      camelKey(key),
      camelize(nested),
    ]),
  );
}

function unwrapRpc(value: unknown) {
  const camel = camelize(value);
  if (Array.isArray(camel) && camel.length === 1) {
    const first = camel[0];
    if (first && typeof first === "object" && "result" in first) {
      return (first as JsonObject).result;
    }
    return first;
  }
  if (camel && typeof camel === "object" && "result" in camel) {
    return (camel as JsonObject).result;
  }
  return camel;
}

export interface CourseConsumptionRepository {
  getProgress(publicationId: string): Promise<CoursePublicationProgress>;
  setLessonProgress(input: {
    publicationId: string;
    expectedRevisionId: string;
    lessonRef: string;
    completed: boolean;
  }): Promise<CoursePublicationProgress>;
}

export function createCourseConsumptionRepository(
  accessToken: string,
  options: { fetcher?: typeof fetch } = {},
): CourseConsumptionRepository {
  const fetcher = options.fetcher ?? fetch;

  async function rpc(name: string, body: JsonObject) {
    const { url, anonKey } = getSupabasePublicConfig();
    let response: Response;
    try {
      response = await fetcher(
        `${url.replace(/\/+$/, "")}/rest/v1/rpc/${name}`,
        {
          method: "POST",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          cache: "no-store",
        },
      );
    } catch {
      throw new CourseConsumptionRepositoryError(
        "Не удалось связаться с сервисом обучения.",
        503,
        "course_consumption_network_error",
      );
    }

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const details =
        payload && typeof payload === "object"
          ? (payload as { message?: unknown; code?: unknown })
          : null;
      throw new CourseConsumptionRepositoryError(
        typeof details?.message === "string"
          ? details.message
          : "Не удалось сохранить прогресс курса.",
        response.status,
        typeof details?.code === "string" ? details.code : null,
      );
    }

    const parsed = coursePublicationProgressSchema.safeParse(
      unwrapRpc(payload),
    );
    if (!parsed.success) {
      throw new CourseConsumptionRepositoryError(
        `${name}_response_invalid`,
        502,
        null,
      );
    }
    return parsed.data;
  }

  return {
    getProgress(publicationId) {
      return rpc("get_my_course_publication_progress", {
        p_publication_id: publicationId,
      });
    },

    setLessonProgress(input) {
      return rpc("set_my_course_publication_lesson_progress", {
        p_publication_id: input.publicationId,
        p_expected_revision_id: input.expectedRevisionId,
        p_lesson_ref: input.lessonRef,
        p_completed: input.completed,
      });
    },
  };
}
