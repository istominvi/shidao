type Json = Record<string, unknown>;

type RequestOptions = {
  payload?: Json | Json[];
  allowEmpty?: boolean;
  extraHeaders?: Record<string, string>;
};

function isMissingCommunicationSchemaError(message: string) {
  const normalized = message.toLowerCase();
  const missingRelation =
    normalized.includes("does not exist") ||
    normalized.includes("schema cache") ||
    normalized.includes("could not find the table");

  return (
    missingRelation &&
    (normalized.includes("group_student_conversation") ||
      normalized.includes("group_student_message"))
  );
}

export function isCommunicationSchemaMissingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return isMissingCommunicationSchemaError(message);
}

type RowConversation = {
  id: string;
  class_id: string;
  student_id: string;
  created_at: string;
};

type RowMessage = {
  id: string;
  conversation_id: string;
  author_user_id: string | null;
  author_role: "teacher" | "student" | "parent";
  body: string;
  scheduled_lesson_id: string | null;
  scheduled_lesson_homework_assignment_id: string | null;
  topic_kind: "general" | "lesson" | "homework" | "progress" | "organizational" | null;
  created_at: string;
};

export type GroupStudentConversation = {
  id: string;
  classId: string;
  studentId: string;
  createdAt: string;
};

export type GroupStudentMessage = {
  id: string;
  conversationId: string;
  authorUserId: string | null;
  authorRole: "teacher" | "student" | "parent";
  body: string;
  scheduledLessonId: string | null;
  scheduledLessonHomeworkAssignmentId: string | null;
  topicKind: "general" | "lesson" | "homework" | "progress" | "organizational" | null;
  createdAt: string;
};

function getServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for communication repository.");
  }
  return serviceRoleKey;
}

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for communication repository.");
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

function mapConversation(row: RowConversation): GroupStudentConversation {
  return {
    id: row.id,
    classId: row.class_id,
    studentId: row.student_id,
    createdAt: row.created_at,
  };
}

function mapMessage(row: RowMessage): GroupStudentMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    authorUserId: row.author_user_id,
    authorRole: row.author_role,
    body: row.body,
    scheduledLessonId: row.scheduled_lesson_id,
    scheduledLessonHomeworkAssignmentId: row.scheduled_lesson_homework_assignment_id,
    topicKind: row.topic_kind,
    createdAt: row.created_at,
  };
}

export async function getConversationByClassAndStudentAdmin(input: {
  classId: string;
  studentId: string;
}) {
  const rows = await adminRequest<RowConversation[]>(
    `/rest/v1/group_student_conversation?select=id,class_id,student_id,created_at&class_id=eq.${input.classId}&student_id=eq.${input.studentId}&limit=1`,
  );

  if (!rows[0]) return null;
  return mapConversation(rows[0]);
}

export async function ensureConversationByClassAndStudentAdmin(input: {
  classId: string;
  studentId: string;
}) {
  const rows = await adminRequest<RowConversation[]>(
    "/rest/v1/group_student_conversation",
    "POST",
    {
      payload: {
        class_id: input.classId,
        student_id: input.studentId,
      },
      extraHeaders: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    },
  );

  if (rows[0]) return mapConversation(rows[0]);
  const existing = await getConversationByClassAndStudentAdmin(input);
  if (!existing) throw new Error("Не удалось создать conversation для ученика в группе.");
  return existing;
}

export async function listMessagesByConversationAdmin(conversationId: string) {
  const rows = await adminRequest<RowMessage[]>(
    `/rest/v1/group_student_message?select=id,conversation_id,author_user_id,author_role,body,scheduled_lesson_id,scheduled_lesson_homework_assignment_id,topic_kind,created_at&conversation_id=eq.${conversationId}&order=created_at.asc`,
  );
  return rows.map(mapMessage);
}

export async function createConversationMessageAdmin(input: {
  conversationId: string;
  authorUserId: string | null;
  authorRole: "teacher" | "student" | "parent";
  body: string;
  scheduledLessonId?: string | null;
  scheduledLessonHomeworkAssignmentId?: string | null;
  topicKind?: "general" | "lesson" | "homework" | "progress" | "organizational" | null;
}) {
  const rows = await adminRequest<RowMessage[]>("/rest/v1/group_student_message", "POST", {
    payload: {
      conversation_id: input.conversationId,
      author_user_id: input.authorUserId,
      author_role: input.authorRole,
      body: input.body,
      scheduled_lesson_id: input.scheduledLessonId ?? null,
      scheduled_lesson_homework_assignment_id:
        input.scheduledLessonHomeworkAssignmentId ?? null,
      topic_kind: input.topicKind ?? null,
    },
  });

  if (!rows[0]) throw new Error("Не удалось отправить сообщение.");
  return mapMessage(rows[0]);
}
