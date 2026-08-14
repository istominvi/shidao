import { getSupabasePublicConfig } from "@/lib/server/auth-config";

export const PROFILE_AVATAR_BUCKET = "profile-avatars";
export const PROFILE_AVATAR_OUTPUT_MIME_TYPE = "image/webp";
export const PROFILE_AVATAR_OUTPUT_BYTES_LIMIT = 1024 * 1024;

const CANONICAL_UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_V4_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const PROFILE_AVATAR_PATH_PATTERN = new RegExp(
  `^(${CANONICAL_UUID_PATTERN})/(${UUID_V4_PATTERN})\\.webp$`,
);

type Fetcher = typeof fetch;

function getServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Profile avatar Storage is not configured.");
  }
  return serviceRoleKey;
}

function storageHeaders() {
  const serviceRoleKey = getServiceRoleKey();
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

function encodedObjectPath(path: string) {
  return [PROFILE_AVATAR_BUCKET, ...path.split("/")]
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function storageFailure(action: string, response: Response) {
  // Storage error bodies can expose implementation details. Keep the thrown
  // error intentionally limited to the operation and status code.
  return new Error(
    `Profile avatar Storage ${action} failed (${response.status}).`,
  );
}

async function readBoundedAvatarBytes(response: Response) {
  const contentLengthValue = response.headers.get("content-length");
  if (contentLengthValue !== null) {
    const contentLength = Number(contentLengthValue);
    if (
      !Number.isSafeInteger(contentLength) ||
      contentLength < 1 ||
      contentLength > PROFILE_AVATAR_OUTPUT_BYTES_LIMIT
    ) {
      throw new Error("Stored profile avatar is invalid.");
    }
  }
  if (!response.body) {
    throw new Error("Stored profile avatar is invalid.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    totalBytes += chunk.value.byteLength;
    if (totalBytes > PROFILE_AVATAR_OUTPUT_BYTES_LIMIT) {
      await reader.cancel().catch(() => undefined);
      throw new Error("Stored profile avatar is invalid.");
    }
    chunks.push(chunk.value);
  }

  if (totalBytes < 1) {
    throw new Error("Stored profile avatar is invalid.");
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function isOwnProfileAvatarStoragePath(
  path: unknown,
  accountId: string,
): path is string {
  if (typeof path !== "string") return false;
  const match = PROFILE_AVATAR_PATH_PATTERN.exec(path);
  return match?.[1] === accountId;
}

export function createProfileAvatarStoragePath(
  accountId: string,
  objectId: string,
) {
  const path = `${accountId}/${objectId}.webp`;
  if (!isOwnProfileAvatarStoragePath(path, accountId)) {
    throw new Error("Profile avatar Storage path is invalid.");
  }
  return path;
}

export async function uploadProfileAvatarObject(
  input: {
    accountId: string;
    path: string;
    bytes: Uint8Array;
  },
  options: { fetcher?: Fetcher } = {},
) {
  if (!isOwnProfileAvatarStoragePath(input.path, input.accountId)) {
    throw new Error("Profile avatar Storage path is invalid.");
  }
  if (
    input.bytes.byteLength < 1 ||
    input.bytes.byteLength > PROFILE_AVATAR_OUTPUT_BYTES_LIMIT
  ) {
    throw new Error("Profile avatar output size is invalid.");
  }

  const { url } = getSupabasePublicConfig();
  const response = await (options.fetcher ?? fetch)(
    `${url.replace(/\/+$/, "")}/storage/v1/object/${encodedObjectPath(input.path)}`,
    {
      method: "POST",
      headers: {
        ...storageHeaders(),
        "Content-Type": PROFILE_AVATAR_OUTPUT_MIME_TYPE,
        "x-upsert": "false",
      },
      body: new Uint8Array(input.bytes).buffer,
      cache: "no-store",
    },
  );
  if (!response.ok) throw storageFailure("upload", response);
}

export async function downloadProfileAvatarObject(
  input: { accountId: string; path: string },
  options: { fetcher?: Fetcher } = {},
) {
  if (!isOwnProfileAvatarStoragePath(input.path, input.accountId)) {
    throw new Error("Profile avatar Storage path is invalid.");
  }

  const { url } = getSupabasePublicConfig();
  const response = await (options.fetcher ?? fetch)(
    `${url.replace(/\/+$/, "")}/storage/v1/object/authenticated/${encodedObjectPath(input.path)}`,
    {
      headers: storageHeaders(),
      cache: "no-store",
    },
  );
  if (!response.ok) throw storageFailure("download", response);

  const contentType = response.headers.get("content-type")?.split(";", 1)[0];
  if (contentType !== PROFILE_AVATAR_OUTPUT_MIME_TYPE) {
    throw new Error("Stored profile avatar is invalid.");
  }
  return readBoundedAvatarBytes(response);
}

export async function deleteProfileAvatarObject(
  input: { accountId: string; path: string },
  options: { fetcher?: Fetcher } = {},
) {
  if (!isOwnProfileAvatarStoragePath(input.path, input.accountId)) {
    throw new Error("Profile avatar Storage path is invalid.");
  }

  const { url } = getSupabasePublicConfig();
  const response = await (options.fetcher ?? fetch)(
    `${url.replace(/\/+$/, "")}/storage/v1/object/${encodeURIComponent(PROFILE_AVATAR_BUCKET)}`,
    {
      method: "DELETE",
      headers: {
        ...storageHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: [input.path] }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw storageFailure("delete", response);
}
