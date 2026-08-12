import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import {
  parseAccountAttestationCredentials,
  parseCourseAttestationState,
} from "./contracts";
import type {
  AccountAttestationCredential,
  CourseAttestationState,
} from "./domain";

type JsonObject = Record<string, unknown>;

export class CourseAttestationRepositoryError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly databaseCode: string | null,
  ) {
    super(message);
    this.name = "CourseAttestationRepositoryError";
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
  }
  if (camel && typeof camel === "object" && "result" in camel) {
    return (camel as JsonObject).result;
  }
  return camel;
}

export interface CourseAttestationRepository {
  getPublicationAttestation(
    publicationId: string,
  ): Promise<CourseAttestationState>;
  submitPublicationAttestation(
    publicationId: string,
    expectedRevisionId: string,
    selectedOptionByQuestionId: Record<string, string>,
  ): Promise<CourseAttestationState>;
  listAccountAttestations(): Promise<AccountAttestationCredential[]>;
}

export function createCourseAttestationRepository(
  accessToken: string,
  options: { fetcher?: typeof fetch } = {},
): CourseAttestationRepository {
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
      throw new CourseAttestationRepositoryError(
        "Не удалось связаться с сервисом аттестации.",
        503,
        "course_attestation_network_error",
      );
    }

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const details =
        payload && typeof payload === "object"
          ? (payload as { message?: unknown; code?: unknown })
          : null;
      throw new CourseAttestationRepositoryError(
        typeof details?.message === "string"
          ? details.message
          : "Операция аттестации не выполнена.",
        response.status,
        typeof details?.code === "string" ? details.code : null,
      );
    }
    return unwrapRpc(payload);
  }

  return {
    async getPublicationAttestation(publicationId) {
      return parseCourseAttestationState(
        await rpc("get_my_course_publication_attestation", {
          p_publication_id: publicationId,
        }),
      );
    },

    async submitPublicationAttestation(
      publicationId,
      expectedRevisionId,
      selectedOptionByQuestionId,
    ) {
      return parseCourseAttestationState(
        await rpc("submit_my_course_publication_attestation", {
          p_publication_id: publicationId,
          p_expected_revision_id: expectedRevisionId,
          p_selected_option_by_question_id: selectedOptionByQuestionId,
        }),
      );
    },

    async listAccountAttestations() {
      return parseAccountAttestationCredentials(
        await rpc("list_my_course_publication_attestations", {}),
      );
    },
  };
}
