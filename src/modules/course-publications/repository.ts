import "server-only";

import { z, type ZodType } from "zod";
import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import {
  coursePublicationSnapshotSchema,
  COURSE_ASSET_BUCKET,
  COURSE_PUBLICATION_ASSET_BUCKET,
} from "./contracts";
import type {
  ClonedAssetManifestItem,
  CoursePublicationSnapshot,
  PublicationAssetManifestItem,
  PublicationIdMap,
} from "./domain";
import {
  CoursePublicationRepositoryError,
  isTrustedPostgrestRollback,
  publicationRepositoryFailure,
} from "./errors";

export { CoursePublicationRepositoryError } from "./errors";

type JsonObject = Record<string, unknown>;

type PublicationRow = {
  id: string;
  source_course_id: string | null;
  owner_account_id: string;
  publisher_display_name: string;
  is_shidao: boolean;
  status: "published" | "unpublished";
  current_revision_id: string;
  source_content_updated_at: string;
  published_at: string | null;
  unpublished_at: string | null;
  created_at: string;
  updated_at: string;
};

type PublicationRevisionRow = {
  id: string;
  publication_id: string;
  revision_number: number;
  source_course_updated_at: string;
  content_sha256: string;
  snapshot: unknown;
  rights_confirmed_at: string;
  license_code: string;
  published_at: string;
};

type PublicationAssetRow = {
  id: string;
  revision_id: string;
  source_stored_file_id: string | null;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  created_at: string;
};

type CourseAttachmentRow = { stored_file_id: string };

type StoredFileRow = {
  id: string;
  owner_account_id: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  status: "pending" | "ready";
};

export type OwnedPublicationRecord = {
  publicationId: string;
  sourceCourseId: string;
  ownerAccountId: string;
  status: "published" | "unpublished";
  currentRevisionId: string;
  publishedAt: string | null;
  updatedAt: string;
  sourceCourseUpdatedAt: string;
  sourceContentUpdatedAt: string;
  contentSha256: string;
};

export type CatalogPublicationRecord = {
  publicationId: string;
  sourceCourseId: string | null;
  ownerAccountId: string;
  publisherDisplayName: string;
  isShiDao: boolean;
  publishedAt: string;
  revisionId: string;
  snapshot: CoursePublicationSnapshot;
};

export type CatalogListCourseRecord = {
  publicationId: string;
  sourceCourseId: string | null;
  title: string;
  subject: string;
  goal: string;
  level: string;
  audienceDescription: string;
  targetLessonCount: number;
  lessonCount: number;
  materialCount: number;
  publishedAt: string;
  author: {
    displayName: string;
    isShiDao: boolean;
    isCurrentUser: boolean;
  };
};

export type CatalogListPageRecord = {
  courses: CatalogListCourseRecord[];
  facets: { subjects: string[]; levels: string[] };
  nextOffset: number | null;
};

export type CatalogPublicationAsset = {
  publicationAssetId: string;
  storageBucket: typeof COURSE_PUBLICATION_ASSET_BUCKET;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
};

export type CatalogPublicationDetailRecord = CatalogPublicationRecord & {
  assets: CatalogPublicationAsset[];
};

export type PublicationSourceAsset = {
  sourceStoredFileId: string;
  storageBucket: typeof COURSE_ASSET_BUCKET;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  status: "pending" | "ready";
};

export type PublicationRpcRecord = {
  publicationId: string;
  sourceCourseId: string;
  status: "published" | "unpublished";
  currentRevisionId: string;
  publishedAt: string | null;
  updatedAt: string;
  sourceCourseUpdatedAt: string;
  sourceContentUpdatedAt: string;
  contentSha256: string;
};

export interface CoursePublicationRepository {
  isActiveAccount(actorAccountId: string): Promise<boolean>;
  getOwnedPublication(
    actorAccountId: string,
    sourceCourseId: string,
  ): Promise<OwnedPublicationRecord | null>;
  listOwnedPublications(
    actorAccountId: string,
    sourceCourseIds: string[],
  ): Promise<OwnedPublicationRecord[]>;
  listCatalog(input: {
    actorAccountId: string;
    q: string;
    subject: string;
    level: string;
    offset: number;
    limit: number;
  }): Promise<CatalogListPageRecord>;
  getCatalogPublication(
    publicationId: string,
  ): Promise<CatalogPublicationDetailRecord | null>;
  listSourceAssets(
    actorAccountId: string,
    sourceCourseId: string,
  ): Promise<PublicationSourceAsset[]>;
  publishCourseRevision(input: {
    actorAccountId: string;
    sourceCourseId: string;
    publicationId: string;
    revisionId: string;
    contentSha256: string;
    snapshot: CoursePublicationSnapshot;
    assetManifest: PublicationAssetManifestItem[];
    rightsConfirmed: true;
  }): Promise<PublicationRpcRecord>;
  unpublishCourse(input: {
    actorAccountId: string;
    sourceCourseId: string;
  }): Promise<PublicationRpcRecord>;
  clonePublication(input: {
    actorAccountId: string;
    publicationId: string;
    targetCourseId: string;
    targetTitle: string | null;
    idMap: PublicationIdMap;
    assetManifest: ClonedAssetManifestItem[];
  }): Promise<{ courseId: string }>;
  duplicateCourse(input: {
    actorAccountId: string;
    sourceCourseId: string;
    targetCourseId: string;
    targetTitle: string | null;
    idMap: PublicationIdMap;
  }): Promise<{ courseId: string }>;
}

const publicationRpcSchema = z
  .object({
    publicationId: z.uuid(),
    sourceCourseId: z.uuid(),
    status: z.enum(["published", "unpublished"]),
    currentRevisionId: z.uuid(),
    publishedAt: z.string().nullable(),
    updatedAt: z.string(),
    sourceCourseUpdatedAt: z.string(),
    sourceContentUpdatedAt: z.string(),
    contentSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  })
  .passthrough();

const clonedCourseRpcSchema = z.object({ courseId: z.uuid() }).passthrough();

const catalogListCourseSchema = z
  .object({
    publicationId: z.uuid(),
    sourceCourseId: z.uuid().nullable(),
    title: z.string(),
    subject: z.string(),
    goal: z.string(),
    level: z.string(),
    audienceDescription: z.string(),
    targetLessonCount: z.number().int().positive(),
    lessonCount: z.number().int().nonnegative(),
    materialCount: z.number().int().nonnegative(),
    publishedAt: z.string(),
    author: z
      .object({
        displayName: z.string(),
        isShiDao: z.boolean(),
        isCurrentUser: z.boolean(),
      })
      .strict(),
  })
  .strict();

const catalogListPageSchema = z
  .object({
    courses: z.array(catalogListCourseSchema),
    facets: z
      .object({
        subjects: z.array(z.string()),
        levels: z.array(z.string()),
      })
      .strict(),
    nextOffset: z.number().int().nonnegative().nullable(),
  })
  .strict();

function encodeFilter(value: string) {
  return encodeURIComponent(value);
}

function inFilter(values: string[]) {
  return values.map(encodeFilter).join(",");
}

function camelKey(key: string) {
  return key.replace(/_([a-z])/g, (_match, letter: string) =>
    letter.toUpperCase(),
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

function parseRpc<T>(operation: string, value: unknown, schema: ZodType<T>): T {
  const parsed = schema.safeParse(unwrapRpc(value));
  if (parsed.success) return parsed.data;
  throw new CoursePublicationRepositoryError(
    `${operation}_response_invalid`,
    502,
    null,
  );
}

function parseSnapshot(value: unknown) {
  const parsed = coursePublicationSnapshotSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new CoursePublicationRepositoryError(
    "course_publication_snapshot_invalid",
    502,
    null,
  );
}

function mapCatalogRecord(
  publication: PublicationRow,
  revision: PublicationRevisionRow,
): CatalogPublicationRecord {
  if (!publication.published_at) {
    throw new CoursePublicationRepositoryError(
      "course_publication_published_at_missing",
      502,
      null,
    );
  }
  return {
    publicationId: publication.id,
    sourceCourseId: publication.source_course_id,
    ownerAccountId: publication.owner_account_id,
    publisherDisplayName: publication.publisher_display_name,
    isShiDao: publication.is_shidao,
    publishedAt: publication.published_at,
    revisionId: revision.id,
    snapshot: parseSnapshot(revision.snapshot),
  };
}

function mapOwnedRecord(
  publication: PublicationRow,
  revision: PublicationRevisionRow,
): OwnedPublicationRecord {
  if (!publication.source_course_id) {
    throw new CoursePublicationRepositoryError(
      "course_publication_source_missing",
      502,
      null,
    );
  }
  return {
    publicationId: publication.id,
    sourceCourseId: publication.source_course_id,
    ownerAccountId: publication.owner_account_id,
    status: publication.status,
    currentRevisionId: publication.current_revision_id,
    publishedAt: publication.published_at,
    updatedAt: publication.updated_at,
    sourceCourseUpdatedAt: revision.source_course_updated_at,
    sourceContentUpdatedAt: publication.source_content_updated_at,
    contentSha256: revision.content_sha256,
  };
}

function requireServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Supabase service-role auth is not configured.");
  return key;
}

export function createCoursePublicationRepository(
  options: {
    fetcher?: typeof fetch;
  } = {},
): CoursePublicationRepository {
  const fetcher = options.fetcher ?? fetch;

  function config() {
    const { url } = getSupabasePublicConfig();
    return {
      url: url.replace(/\/+$/, ""),
      serviceRoleKey: requireServiceRoleKey(),
    };
  }

  async function request<T>(
    path: string,
    init: { method?: "GET" | "POST"; body?: JsonObject } = {},
  ): Promise<T> {
    const { url, serviceRoleKey } = config();
    let response: Response;
    try {
      response = await fetcher(`${url}${path}`, {
        method: init.method ?? "GET",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        cache: "no-store",
      });
    } catch {
      throw new CoursePublicationRepositoryError(
        "course_publication_network_error",
        503,
        "repository_network_error",
      );
    }
    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new CoursePublicationRepositoryError(
        "Не удалось прочитать ответ каталога курсов.",
        503,
        "repository_response_read_error",
      );
    }
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        throw new CoursePublicationRepositoryError(
          "Каталог курсов вернул некорректный ответ.",
          502,
          "repository_response_parse_error",
        );
      }
    }
    if (!response.ok) {
      const details =
        payload && typeof payload === "object" ? (payload as JsonObject) : null;
      throw publicationRepositoryFailure({
        message:
          typeof details?.message === "string"
            ? details.message
            : "course_publication_repository_error",
        status: response.status,
        databaseCode: typeof details?.code === "string" ? details.code : null,
        definitelyNotCommitted: isTrustedPostgrestRollback(
          response.status,
          payload,
          response.headers.get("content-type"),
        ),
      });
    }
    return payload as T;
  }

  async function rpc<T>(
    name: string,
    args: JsonObject,
    schema: ZodType<T>,
  ): Promise<T> {
    const payload = await request<unknown>(`/rest/v1/rpc/${name}`, {
      method: "POST",
      body: args,
    });
    return parseRpc(name, payload, schema);
  }

  async function revisionsByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return request<PublicationRevisionRow[]>(
      `/rest/v1/course_publication_revision?select=*&id=in.(${inFilter(ids)})`,
    );
  }

  async function isActiveAccount(actorAccountId: string) {
    const rows = await request<Array<{ id: string }>>(
      `/rest/v1/account?select=id&id=eq.${encodeFilter(actorAccountId)}&status=eq.active&limit=1`,
    );
    return rows.some((row) => row.id === actorAccountId);
  }

  return {
    isActiveAccount,

    async getOwnedPublication(actorAccountId, sourceCourseId) {
      const rows = await request<PublicationRow[]>(
        `/rest/v1/course_publication?select=*&owner_account_id=eq.${encodeFilter(actorAccountId)}&source_course_id=eq.${encodeFilter(sourceCourseId)}&limit=1`,
      );
      const publication = rows[0];
      if (!publication) return null;
      const revisions = await revisionsByIds([publication.current_revision_id]);
      const revision = revisions[0];
      if (!revision) {
        throw new CoursePublicationRepositoryError(
          "course_publication_revision_missing",
          502,
          null,
        );
      }
      return mapOwnedRecord(publication, revision);
    },

    async listOwnedPublications(actorAccountId, sourceCourseIds) {
      if (sourceCourseIds.length === 0) return [];
      const publications = await request<PublicationRow[]>(
        `/rest/v1/course_publication?select=*&owner_account_id=eq.${encodeFilter(actorAccountId)}&source_course_id=in.(${inFilter(sourceCourseIds)})`,
      );
      const revisions = await revisionsByIds(
        publications.map((publication) => publication.current_revision_id),
      );
      const revisionById = new Map(
        revisions.map((revision) => [revision.id, revision]),
      );
      return publications.map((publication) => {
        const revision = revisionById.get(publication.current_revision_id);
        if (!revision) {
          throw new CoursePublicationRepositoryError(
            "course_publication_revision_missing",
            502,
            null,
          );
        }
        return mapOwnedRecord(publication, revision);
      });
    },

    listCatalog(input) {
      return rpc(
        "list_course_publication_catalog_admin",
        {
          p_actor_account_id: input.actorAccountId,
          p_q: input.q,
          p_subject: input.subject,
          p_level: input.level,
          p_offset: input.offset,
          p_limit: input.limit,
        },
        catalogListPageSchema,
      );
    },

    async getCatalogPublication(publicationId) {
      const publications = await request<PublicationRow[]>(
        `/rest/v1/course_publication?select=*&id=eq.${encodeFilter(publicationId)}&status=eq.published&limit=1`,
      );
      const publication = publications[0];
      if (!publication) return null;
      if (!(await isActiveAccount(publication.owner_account_id))) return null;
      const revisions = await revisionsByIds([publication.current_revision_id]);
      const revision = revisions[0];
      if (!revision) {
        throw new CoursePublicationRepositoryError(
          "course_publication_revision_missing",
          502,
          null,
        );
      }
      const assets = await request<PublicationAssetRow[]>(
        `/rest/v1/course_publication_asset?select=*&revision_id=eq.${encodeFilter(revision.id)}&order=created_at.asc`,
      );
      return {
        ...mapCatalogRecord(publication, revision),
        assets: assets.map((asset) => {
          if (asset.storage_bucket !== COURSE_PUBLICATION_ASSET_BUCKET) {
            throw new CoursePublicationRepositoryError(
              "course_publication_asset_bucket_invalid",
              502,
              null,
            );
          }
          return {
            publicationAssetId: asset.id,
            storageBucket: COURSE_PUBLICATION_ASSET_BUCKET,
            storagePath: asset.storage_path,
            originalFilename: asset.original_filename,
            mimeType: asset.mime_type,
            sizeBytes: asset.size_bytes,
            checksumSha256: asset.checksum_sha256,
          };
        }),
      };
    },

    async listSourceAssets(actorAccountId, sourceCourseId) {
      const links = await request<CourseAttachmentRow[]>(
        `/rest/v1/course_attachment?select=stored_file_id&course_id=eq.${encodeFilter(sourceCourseId)}`,
      );
      if (links.length === 0) return [];
      const files = await request<StoredFileRow[]>(
        `/rest/v1/stored_file?select=id,owner_account_id,storage_bucket,storage_path,original_filename,mime_type,size_bytes,checksum_sha256,status&id=in.(${inFilter(links.map((link) => link.stored_file_id))})`,
      );
      const byId = new Map(files.map((file) => [file.id, file]));
      return links.map((link) => {
        const file = byId.get(link.stored_file_id);
        if (
          !file ||
          file.owner_account_id !== actorAccountId ||
          file.storage_bucket !== COURSE_ASSET_BUCKET
        ) {
          throw new CoursePublicationRepositoryError(
            "course_publication_source_asset_invalid",
            409,
            "source_asset_invalid",
            true,
          );
        }
        return {
          sourceStoredFileId: file.id,
          storageBucket: COURSE_ASSET_BUCKET,
          storagePath: file.storage_path,
          originalFilename: file.original_filename,
          mimeType: file.mime_type,
          sizeBytes: file.size_bytes,
          checksumSha256: file.checksum_sha256,
          status: file.status,
        };
      });
    },

    publishCourseRevision(input) {
      return rpc(
        "publish_course_revision_admin",
        {
          p_actor_account_id: input.actorAccountId,
          p_source_course_id: input.sourceCourseId,
          p_publication_id: input.publicationId,
          p_revision_id: input.revisionId,
          p_content_sha256: input.contentSha256,
          p_snapshot: input.snapshot,
          p_asset_manifest: input.assetManifest,
          p_rights_confirmed: input.rightsConfirmed,
        },
        publicationRpcSchema,
      );
    },

    unpublishCourse(input) {
      return rpc(
        "unpublish_course_publication_admin",
        {
          p_actor_account_id: input.actorAccountId,
          p_source_course_id: input.sourceCourseId,
        },
        publicationRpcSchema,
      );
    },

    clonePublication(input) {
      return rpc(
        "clone_course_publication_admin",
        {
          p_actor_account_id: input.actorAccountId,
          p_publication_id: input.publicationId,
          p_target_course_id: input.targetCourseId,
          p_target_title: input.targetTitle,
          p_id_map: input.idMap,
          p_asset_manifest: input.assetManifest,
        },
        clonedCourseRpcSchema,
      );
    },

    duplicateCourse(input) {
      return rpc(
        "duplicate_course_admin",
        {
          p_actor_account_id: input.actorAccountId,
          p_source_course_id: input.sourceCourseId,
          p_target_course_id: input.targetCourseId,
          p_target_title: input.targetTitle,
          p_id_map: input.idMap,
        },
        clonedCourseRpcSchema,
      );
    },
  };
}
