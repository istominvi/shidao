import "server-only";

import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import {
  coursePublicationStorageCopyBody,
  resolveCoursePublicationSignedUrl,
} from "./storage-contract";
import { CoursePublicationStorageError } from "./errors";

export { CoursePublicationStorageError } from "./errors";

type StorageErrorPayload = {
  message?: string;
  error?: string;
  statusCode?: string | number;
};

type StorageObjectInfoPayload = {
  size?: unknown;
  content_type?: unknown;
  metadata?: { size?: unknown; mimetype?: unknown };
};

export interface CoursePublicationStorageBroker {
  copyObject(input: {
    sourceBucket: string;
    sourcePath: string;
    destinationBucket: string;
    destinationPath: string;
    expectedSizeBytes: number;
    expectedMimeType: string;
  }): Promise<void>;
  deleteObjects(bucket: string, paths: string[]): Promise<void>;
  createSignedDownload(input: {
    bucket: string;
    path: string;
    expiresInSeconds?: number;
  }): Promise<string>;
}

function requireServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Supabase service-role auth is not configured.");
  return key;
}

function encodedObjectPath(bucket: string, path: string) {
  return [bucket, ...path.split("/")]
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function createCoursePublicationStorageBroker(
  options: {
    fetcher?: typeof fetch;
  } = {},
): CoursePublicationStorageBroker {
  const fetcher = options.fetcher ?? fetch;

  function config() {
    const { url } = getSupabasePublicConfig();
    const serviceRoleKey = requireServiceRoleKey();
    return {
      url: url.replace(/\/+$/, ""),
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    };
  }

  async function storageError(response: Response) {
    const payload = (await response
      .json()
      .catch(() => null)) as StorageErrorPayload | null;
    return new CoursePublicationStorageError(
      payload?.message ?? payload?.error ?? "Ошибка хранилища публикаций.",
      response.status,
    );
  }

  return {
    async copyObject(input) {
      const { url, headers } = config();
      let response: Response;
      try {
        response = await fetcher(`${url}/storage/v1/object/copy`, {
          method: "POST",
          headers,
          body: JSON.stringify(coursePublicationStorageCopyBody(input)),
          cache: "no-store",
        });
      } catch {
        throw new CoursePublicationStorageError(
          "Не удалось связаться с хранилищем публикаций.",
          503,
        );
      }
      if (!response.ok) throw await storageError(response);

      const objectPath = encodedObjectPath(
        input.destinationBucket,
        input.destinationPath,
      );
      let infoResponse: Response;
      try {
        infoResponse = await fetcher(
          `${url}/storage/v1/object/info/${objectPath}`,
          { headers, cache: "no-store" },
        );
      } catch {
        throw new CoursePublicationStorageError(
          "Не удалось проверить скопированный материал.",
          503,
        );
      }
      if (!infoResponse.ok) throw await storageError(infoResponse);
      const info = (await infoResponse.json()) as StorageObjectInfoPayload;
      const rawSize = info.size ?? info.metadata?.size;
      const rawMime = info.content_type ?? info.metadata?.mimetype;
      if (
        rawSize !== input.expectedSizeBytes ||
        rawMime !== input.expectedMimeType
      ) {
        throw new CoursePublicationStorageError(
          "Проверка скопированного материала не пройдена.",
          409,
        );
      }
    },

    async deleteObjects(bucket, paths) {
      if (paths.length === 0) return;
      const { url, headers } = config();
      let response: Response;
      try {
        response = await fetcher(
          `${url}/storage/v1/object/${encodeURIComponent(bucket)}`,
          {
            method: "DELETE",
            headers,
            body: JSON.stringify({ prefixes: paths }),
            cache: "no-store",
          },
        );
      } catch {
        throw new CoursePublicationStorageError(
          "Не удалось очистить файлы незавершённой операции.",
          503,
        );
      }
      if (!response.ok) throw await storageError(response);
    },

    async createSignedDownload(input) {
      const { url, headers } = config();
      const objectPath = encodedObjectPath(input.bucket, input.path);
      let response: Response;
      try {
        response = await fetcher(
          `${url}/storage/v1/object/sign/${objectPath}`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ expiresIn: input.expiresInSeconds ?? 600 }),
            cache: "no-store",
          },
        );
      } catch {
        throw new CoursePublicationStorageError(
          "Не удалось создать ссылку на материал.",
          503,
        );
      }
      if (!response.ok) throw await storageError(response);
      const payload = (await response.json()) as {
        signedURL?: string;
        signedUrl?: string;
      };
      const signedPath = payload.signedURL ?? payload.signedUrl;
      if (!signedPath) {
        throw new CoursePublicationStorageError(
          "Хранилище не вернуло ссылку на материал.",
          502,
        );
      }
      return resolveCoursePublicationSignedUrl(url, signedPath);
    },
  };
}
