import { getMethodologyLessonByIdAdmin, getScheduledLessonByIdAdmin } from "./lesson-content-repository";

type Json = Record<string, unknown>;

type RequestOptions = {
  payload?: Json;
  allowEmpty?: boolean;
  extraHeaders?: Record<string, string>;
};

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
  body: string;
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
  body: string;
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

  const rows = await adminRequest<RowLessonGroupConversation[]>(
    "/rest/v1/lesson_group_conversation",
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
  body: string;
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
