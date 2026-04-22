import { getMethodologyLessonByIdAdmin, getScheduledLessonByIdAdmin } from "./lesson-content-repository";

type Json = Record<string, unknown>;

type RequestOptions = {
  payload?: Json;
  allowEmpty?: boolean;
  extraHeaders?: Record<string, string>;
};

function isMissingLessonGroupChatSchemaError(message: string) {
  const normalized = message.toLowerCase();
  const missingRelation =
    normalized.includes("does not exist") ||
    normalized.includes("schema cache") ||
    normalized.includes("could not find the table");

  return (
    missingRelation &&
    (normalized.includes("lesson_group_conversation") ||
      normalized.includes("lesson_group_message"))
  );
}

export function isLessonGroupChatSchemaMissingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return isMissingLessonGroupChatSchemaError(message);
}

function isUniqueViolationError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("duplicate key value violates unique constraint") ||
    normalized.includes("23505")
  );
}

type RowLessonGroupConversation = {
  id: string;
  scheduled_lesson_id: string;
  class_id: string;
  title: string;
  created_at: string;
};

type RowLessonGroupMessage = {
  id: string;
  conversation_id: string;
  author_user_id: string | null;
  author_role: "teacher" | "student";
  author_teacher_id: string | null;
  author_student_id: string | null;
  author_login: string;
  author_name: string;
  body: string | null;
  created_at: string;
};

type RowCommunicationMessageAttachment = {
  id: string;
  group_student_message_id: string | null;
  lesson_group_message_id: string | null;
  kind: "voice" | "file";
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  duration_ms: number | null;
  original_filename: string | null;
  metadata: Json;
  created_by_user_id: string | null;
  created_at: string;
};

export type LessonGroupConversation = {
  id: string;
  scheduledLessonId: string;
  classId: string;
  title: string;
  createdAt: string;
};

export type LessonGroupMessage = {
  id: string;
  conversationId: string;
  authorUserId: string | null;
  authorRole: "teacher" | "student";
  authorTeacherId: string | null;
  authorStudentId: string | null;
  authorLogin: string;
  authorName: string;
  body: string | null;
  createdAt: string;
};

export type CommunicationMessageAttachment = {
  id: string;
  groupStudentMessageId: string | null;
  lessonGroupMessageId: string | null;
  kind: "voice" | "file";
  storageBucket: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number | null;
  originalFilename: string | null;
  metadata: Json;
  createdByUserId: string | null;
  createdAt: string;
};

function getServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for lesson group chat repository.");
  }
  return serviceRoleKey;
}

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for lesson group chat repository.");
  }
  return url;
}

async function adminRequest<T>(
  path: string,
  method = "GET",
  options?: RequestOptions,
): Promise<T> {
  const response = await fetch(`${getSupabaseUrl()}${path}`, {
    method,
    headers: {
      apikey: getServiceRoleKey(),
      Authorization: `Bearer ${getServiceRoleKey()}`,
      "Content-Type": "application/json",
      ...(method !== "GET" ? { Prefer: "return=representation" } : {}),
      ...(options?.extraHeaders ?? {}),
    },
    body: options?.payload ? JSON.stringify(options.payload) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const payloadError = (await response.json().catch(() => null)) as
      | { message?: string; msg?: string }
      | null;
    throw new Error(payloadError?.message ?? payloadError?.msg ?? "Supabase request failed.");
  }

  if (response.status === 204) return null as T;

  const text = await response.text();
  if (!text) {
    if (options?.allowEmpty) return null as T;
    throw new Error("Supabase returned an empty response.");
  }

  return JSON.parse(text) as T;
}

function mapConversation(row: RowLessonGroupConversation): LessonGroupConversation {
  return {
    id: row.id,
    scheduledLessonId: row.scheduled_lesson_id,
    classId: row.class_id,
    title: row.title,
    createdAt: row.created_at,
  };
}

function mapMessage(row: RowLessonGroupMessage): LessonGroupMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    authorUserId: row.author_user_id,
    authorRole: row.author_role,
    authorTeacherId: row.author_teacher_id,
    authorStudentId: row.author_student_id,
    authorLogin: row.author_login,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

function mapAttachment(row: RowCommunicationMessageAttachment): CommunicationMessageAttachment {
  return {
    id: row.id,
    groupStudentMessageId: row.group_student_message_id,
    lessonGroupMessageId: row.lesson_group_message_id,
    kind: row.kind,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    durationMs: row.duration_ms,
    originalFilename: row.original_filename,
    metadata: row.metadata,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  };
}

export async function getLessonGroupConversationAdmin(input: { scheduledLessonId: string }) {
  const rows = await adminRequest<RowLessonGroupConversation[]>(
    `/rest/v1/lesson_group_conversation?select=id,scheduled_lesson_id,class_id,title,created_at&scheduled_lesson_id=eq.${input.scheduledLessonId}&limit=1`,
  );

  if (!rows[0]) return null;
  return mapConversation(rows[0]);
}

export async function ensureLessonGroupConversationAdmin(input: { scheduledLessonId: string }) {
  const scheduledLesson = await getScheduledLessonByIdAdmin(input.scheduledLessonId);
  if (!scheduledLesson) {
    throw new Error("Урок не найден.");
  }

  const methodologyLesson = await getMethodologyLessonByIdAdmin(scheduledLesson.methodologyLessonId);
  const title = methodologyLesson?.shell.title?.trim() || "Чат урока";

  let rows: RowLessonGroupConversation[] = [];
  try {
    rows = await adminRequest<RowLessonGroupConversation[]>(
      "/rest/v1/lesson_group_conversation?on_conflict=scheduled_lesson_id",
      "POST",
      {
        payload: {
          scheduled_lesson_id: scheduledLesson.id,
          class_id: scheduledLesson.runtimeShell.classId,
          title,
        },
        extraHeaders: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isUniqueViolationError(message)) {
      throw error;
    }
  }

  if (rows[0]) return mapConversation(rows[0]);

  const existing = await getLessonGroupConversationAdmin({
    scheduledLessonId: input.scheduledLessonId,
  });
  if (!existing) {
    throw new Error("Не удалось создать чат урока.");
  }
  return existing;
}

export async function listLessonGroupMessagesAdmin(input: { scheduledLessonId: string }) {
  const conversation = await ensureLessonGroupConversationAdmin({
    scheduledLessonId: input.scheduledLessonId,
  });

  const rows = await adminRequest<RowLessonGroupMessage[]>(
    `/rest/v1/lesson_group_message?select=id,conversation_id,author_user_id,author_role,author_teacher_id,author_student_id,author_login,author_name,body,created_at&conversation_id=eq.${conversation.id}&order=created_at.asc`,
  );

  return {
    conversation,
    messages: rows.map(mapMessage),
  };
}

export async function createLessonGroupMessageAdmin(input: {
  conversationId: string;
  authorUserId: string | null;
  authorRole: "teacher" | "student";
  authorTeacherId?: string | null;
  authorStudentId?: string | null;
  authorLogin: string;
  authorName: string;
  body: string | null;
}) {
  const rows = await adminRequest<RowLessonGroupMessage[]>("/rest/v1/lesson_group_message", "POST", {
    payload: {
      conversation_id: input.conversationId,
      author_user_id: input.authorUserId,
      author_role: input.authorRole,
      author_teacher_id: input.authorTeacherId ?? null,
      author_student_id: input.authorStudentId ?? null,
      author_login: input.authorLogin,
      author_name: input.authorName,
      body: input.body,
    },
  });

  if (!rows[0]) throw new Error("Не удалось отправить сообщение в чат урока.");
  return mapMessage(rows[0]);
}

export async function getLessonGroupMessageByIdAdmin(messageId: string) {
  const rows = await adminRequest<RowLessonGroupMessage[]>(
    `/rest/v1/lesson_group_message?select=id,conversation_id,author_user_id,author_role,author_teacher_id,author_student_id,author_login,author_name,body,created_at&id=eq.${messageId}&limit=1`,
  );
  if (!rows[0]) return null;
  return mapMessage(rows[0]);
}

export async function createCommunicationAttachmentAdmin(input: {
  lessonGroupMessageId: string;
  kind: "voice" | "file";
  storageBucket: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number | null;
  originalFilename?: string | null;
  createdByUserId?: string | null;
  metadata?: Json;
}) {
  const rows = await adminRequest<RowCommunicationMessageAttachment[]>(
    "/rest/v1/communication_message_attachment",
    "POST",
    {
      payload: {
        lesson_group_message_id: input.lessonGroupMessageId,
        kind: input.kind,
        storage_bucket: input.storageBucket,
        storage_path: input.storagePath,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        duration_ms: input.durationMs ?? null,
        original_filename: input.originalFilename ?? null,
        created_by_user_id: input.createdByUserId ?? null,
        metadata: input.metadata ?? {},
      },
    },
  );

  if (!rows[0]) throw new Error("Не удалось сохранить вложение сообщения.");
  return mapAttachment(rows[0]);
}

export async function listAttachmentsByLessonGroupMessageIdsAdmin(messageIds: string[]) {
  if (messageIds.length === 0) return [];
  const inClause = messageIds.join(",");
  const rows = await adminRequest<RowCommunicationMessageAttachment[]>(
    `/rest/v1/communication_message_attachment?select=id,group_student_message_id,lesson_group_message_id,kind,storage_bucket,storage_path,mime_type,size_bytes,duration_ms,original_filename,metadata,created_by_user_id,created_at&lesson_group_message_id=in.(${inClause})&order=created_at.asc`,
  );
  return rows.map(mapAttachment);
}

export async function getCommunicationAttachmentByIdAdmin(attachmentId: string) {
  const rows = await adminRequest<RowCommunicationMessageAttachment[]>(
    `/rest/v1/communication_message_attachment?select=id,group_student_message_id,lesson_group_message_id,kind,storage_bucket,storage_path,mime_type,size_bytes,duration_ms,original_filename,metadata,created_by_user_id,created_at&id=eq.${attachmentId}&limit=1`,
  );
  if (!rows[0]) return null;
  return mapAttachment(rows[0]);
}

export async function createSignedStorageObjectUrlAdmin(input: {
  bucket: string;
  path: string;
  expiresInSeconds: number;
}) {
  const payload = await adminRequest<{ signedURL: string }>(
    `/storage/v1/object/sign/${encodeURIComponent(input.bucket)}/${input.path}`,
    "POST",
    {
      payload: { expiresIn: input.expiresInSeconds },
    },
  );
  return `${getSupabaseUrl()}/storage/v1${payload.signedURL}`;
}

export async function uploadStorageObjectAdmin(input: {
  bucket: string;
  path: string;
  mimeType: string;
  payload: ArrayBuffer;
}) {
  const response = await fetch(
    `${getSupabaseUrl()}/storage/v1/object/${encodeURIComponent(input.bucket)}/${input.path}`,
    {
      method: "POST",
      headers: {
        apikey: getServiceRoleKey(),
        Authorization: `Bearer ${getServiceRoleKey()}`,
        "Content-Type": input.mimeType,
        "x-upsert": "false",
      },
      body: input.payload,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const payloadError = (await response.json().catch(() => null)) as
      | { message?: string; error?: string }
      | null;
    throw new Error(
      payloadError?.message ?? payloadError?.error ?? "Не удалось загрузить медиа в Storage.",
    );
  }
}

export async function deleteStorageObjectAdmin(input: { bucket: string; path: string }) {
  await adminRequest<{ message?: string }>(
    `/storage/v1/object/${encodeURIComponent(input.bucket)}/${input.path}`,
    "DELETE",
    { allowEmpty: true },
  );
}
