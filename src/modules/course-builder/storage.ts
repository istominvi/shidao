import { getSupabasePublicConfig } from "@/lib/server/auth-config";

type StorageErrorPayload = {
  message?: string;
  error?: string;
  statusCode?: string | number;
};

type StorageObjectInfoPayload = {
  size?: unknown;
  content_type?: unknown;
  metadata?: {
    size?: unknown;
    mimetype?: unknown;
  };
};

function storageHeaders(accessToken: string) {
  const { anonKey } = getSupabasePublicConfig();
  return {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

function encodedObjectPath(bucket: string, path: string) {
  return [bucket, ...path.split("/")]
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function storageError(response: Response) {
  const payload = (await response
    .json()
    .catch(() => null)) as StorageErrorPayload | null;
  return new Error(
    payload?.message ?? payload?.error ?? "Ошибка приватного хранилища.",
  );
}

export async function createCourseAssetSignedUpload(input: {
  accessToken: string;
  bucket: string;
  path: string;
}) {
  const { url } = getSupabasePublicConfig();
  const objectPath = encodedObjectPath(input.bucket, input.path);
  const response = await fetch(
    `${url}/storage/v1/object/upload/sign/${objectPath}`,
    {
      method: "POST",
      headers: storageHeaders(input.accessToken),
      body: JSON.stringify({}),
      cache: "no-store",
    },
  );
  if (!response.ok) throw await storageError(response);

  const payload = (await response.json()) as { url?: string };
  if (!payload.url) throw new Error("Storage не вернул signed upload URL.");
  const signedUrl = new URL(`${url}/storage/v1${payload.url}`).toString();
  const token = new URL(signedUrl).searchParams.get("token");
  if (!token) throw new Error("Storage не вернул upload token.");
  return { signedUrl, token };
}

export async function createCourseAssetSignedDownload(input: {
  accessToken: string;
  bucket: string;
  path: string;
  expiresInSeconds?: number;
}) {
  const { url } = getSupabasePublicConfig();
  const objectPath = encodedObjectPath(input.bucket, input.path);
  const response = await fetch(`${url}/storage/v1/object/sign/${objectPath}`, {
    method: "POST",
    headers: storageHeaders(input.accessToken),
    body: JSON.stringify({ expiresIn: input.expiresInSeconds ?? 600 }),
    cache: "no-store",
  });
  if (!response.ok) throw await storageError(response);
  const payload = (await response.json()) as { signedURL?: string };
  if (!payload.signedURL) {
    throw new Error("Storage не вернул ссылку на вложение.");
  }
  return new URL(`${url}/storage/v1${payload.signedURL}`).toString();
}

export async function assertCourseAssetObjectExists(input: {
  accessToken: string;
  bucket: string;
  path: string;
  expectedSizeBytes: number;
  expectedMimeType: string;
}) {
  const { url } = getSupabasePublicConfig();
  const objectPath = encodedObjectPath(input.bucket, input.path);
  const response = await fetch(`${url}/storage/v1/object/info/${objectPath}`, {
    headers: storageHeaders(input.accessToken),
    cache: "no-store",
  });
  if (!response.ok) throw await storageError(response);

  const payload = (await response.json()) as StorageObjectInfoPayload;
  // Current Supabase Storage returns these fields at the top level. Keep the
  // nested fallback for older self-hosted Storage versions, where the same
  // object metadata was exposed under `metadata`.
  const rawSize = payload.size ?? payload.metadata?.size;
  const rawMime = payload.content_type ?? payload.metadata?.mimetype;
  const actualSize =
    typeof rawSize === "number" && Number.isFinite(rawSize) ? rawSize : null;
  const actualMime =
    typeof rawMime === "string" && rawMime.length > 0 ? rawMime : null;

  if (actualSize === null || actualMime === null) {
    throw new Error("Storage не вернул размер и MIME type загруженного файла.");
  }
  if (actualSize !== input.expectedSizeBytes) {
    throw new Error("Размер загруженного файла не совпадает с заявленным.");
  }
  if (actualMime !== input.expectedMimeType) {
    throw new Error("MIME type загруженного файла не совпадает с заявленным.");
  }
}

export async function deleteCourseAssetObject(input: {
  accessToken: string;
  bucket: string;
  path: string;
}) {
  const { url } = getSupabasePublicConfig();
  const response = await fetch(
    `${url}/storage/v1/object/${encodeURIComponent(input.bucket)}`,
    {
      method: "DELETE",
      headers: storageHeaders(input.accessToken),
      body: JSON.stringify({ prefixes: [input.path] }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw await storageError(response);
}

export function courseAssetExtension(mimeType: string) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "pptx",
    "text/plain": "txt",
    "text/markdown": "md",
  };
  const extension = extensions[mimeType];
  if (!extension) throw new Error("Неподдерживаемый MIME type вложения.");
  return extension;
}
