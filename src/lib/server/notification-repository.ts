type Json = Record<string, unknown>;

type RequestOptions = {
  payload?: Json | Json[];
  allowEmpty?: boolean;
  extraHeaders?: Record<string, string>;
};

export type NotificationEventType =
  | "homework_assigned"
  | "homework_submitted"
  | "homework_reviewed"
  | "homework_needs_revision"
  | "message_created"
  | "lesson_group_message_created"
  | "lesson_status_changed";

export type NotificationRecipientRole = "teacher" | "parent" | "student";

export type NotificationRecord = {
  id: string;
  recipientUserId: string | null;
  recipientRole: NotificationRecipientRole;
  recipientTeacherId: string | null;
  recipientParentId: string | null;
  recipientStudentId: string | null;
  actorUserId: string | null;
  actorRole: "teacher" | "parent" | "student" | "system" | null;
  eventType: NotificationEventType;
  title: string;
  body: string | null;
  href: string;
  scheduledLessonId: string | null;
  scheduledHomeworkAssignmentId: string | null;
  studentHomeworkAssignmentId: string | null;
  conversationId: string | null;
  messageId: string | null;
  metadata: Record<string, unknown>;
  dedupeKey: string | null;
  readAt: string | null;
  createdAt: string;
};

type RowNotification = {
  id: string;
  recipient_user_id: string | null;
  recipient_role: NotificationRecipientRole;
  recipient_teacher_id: string | null;
  recipient_parent_id: string | null;
  recipient_student_id: string | null;
  actor_user_id: string | null;
  actor_role: "teacher" | "parent" | "student" | "system" | null;
  event_type: NotificationEventType;
  title: string;
  body: string | null;
  href: string;
  scheduled_lesson_id: string | null;
  scheduled_homework_assignment_id: string | null;
  student_homework_assignment_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  metadata: Record<string, unknown> | null;
  dedupe_key: string | null;
  read_at: string | null;
  created_at: string;
};


type RowStudentTarget = {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  login: string | null;
  parent_id: string | null;
  parent: {
    id: string;
    user_id: string | null;
    full_name: string | null;
  } | null;
};

type RowTeacherUser = {
  id: string;
  user_id: string | null;
  full_name: string | null;
};

export type StudentNotificationTarget = {
  studentId: string;
  studentUserId: string | null;
  studentDisplayName: string;
  parentId: string | null;
  parentUserId: string | null;
  parentDisplayName: string | null;
};

export type TeacherNotificationTarget = {
  teacherId: string;
  teacherUserId: string | null;
  teacherDisplayName: string | null;
};

export type CreateNotificationInput = {
  recipientUserId: string;
  recipientRole: NotificationRecipientRole;
  recipientTeacherId?: string | null;
  recipientParentId?: string | null;
  recipientStudentId?: string | null;
  actorUserId?: string | null;
  actorRole?: "teacher" | "parent" | "student" | "system" | null;
  eventType: NotificationEventType;
  title: string;
  body?: string | null;
  href: string;
  scheduledLessonId?: string | null;
  scheduledHomeworkAssignmentId?: string | null;
  studentHomeworkAssignmentId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  metadata?: Record<string, unknown>;
  dedupeKey?: string | null;
};

function getServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for notification repository.");
  }
  return serviceRoleKey;
}

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for notification repository.");
  }
  return url;
}

function isDuplicateKeyError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("duplicate key") || normalized.includes("23505");
}

async function adminRequest<T>(path: string, method = "GET", options?: RequestOptions): Promise<T> {
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

function mapNotification(row: RowNotification): NotificationRecord {
  return {
    id: row.id,
    recipientUserId: row.recipient_user_id,
    recipientRole: row.recipient_role,
    recipientTeacherId: row.recipient_teacher_id,
    recipientParentId: row.recipient_parent_id,
    recipientStudentId: row.recipient_student_id,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    eventType: row.event_type,
    title: row.title,
    body: row.body,
    href: row.href,
    scheduledLessonId: row.scheduled_lesson_id,
    scheduledHomeworkAssignmentId: row.scheduled_homework_assignment_id,
    studentHomeworkAssignmentId: row.student_homework_assignment_id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    metadata: row.metadata ?? {},
    dedupeKey: row.dedupe_key,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function toStudentDisplayName(row: RowStudentTarget) {
  const fullName = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return fullName || row.login?.trim() || "Ученик";
}

export async function createNotificationsAdmin(input: CreateNotificationInput[]) {
  if (input.length === 0) return [];

  const created: NotificationRecord[] = [];

  for (const item of input) {
    if (!item.recipientUserId) continue;
    try {
      const rows = await adminRequest<RowNotification[]>("/rest/v1/notification", "POST", {
        payload: {
          recipient_user_id: item.recipientUserId,
          recipient_role: item.recipientRole,
          recipient_teacher_id: item.recipientTeacherId ?? null,
          recipient_parent_id: item.recipientParentId ?? null,
          recipient_student_id: item.recipientStudentId ?? null,
          actor_user_id: item.actorUserId ?? null,
          actor_role: item.actorRole ?? null,
          event_type: item.eventType,
          title: item.title,
          body: item.body ?? null,
          href: item.href,
          scheduled_lesson_id: item.scheduledLessonId ?? null,
          scheduled_homework_assignment_id: item.scheduledHomeworkAssignmentId ?? null,
          student_homework_assignment_id: item.studentHomeworkAssignmentId ?? null,
          conversation_id: item.conversationId ?? null,
          message_id: item.messageId ?? null,
          metadata: item.metadata ?? {},
          dedupe_key: item.dedupeKey ?? null,
        },
      });

      if (rows[0]) created.push(mapNotification(rows[0]));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isDuplicateKeyError(message)) {
        throw error;
      }
    }
  }

  return created;
}

export async function listNotificationsForUserAdmin(input: { userId: string; limit?: number }) {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 200));
  const rows = await adminRequest<RowNotification[]>(
    `/rest/v1/notification?select=*&recipient_user_id=eq.${input.userId}&order=created_at.desc&limit=${limit}`,
  );
  return rows.map(mapNotification);
}

export async function countUnreadNotificationsForUserAdmin(userId: string) {
  const response = await fetch(
    `${getSupabaseUrl()}/rest/v1/notification?select=id&recipient_user_id=eq.${userId}&read_at=is.null`,
    {
      method: "HEAD",
      headers: {
        apikey: getServiceRoleKey(),
        Authorization: `Bearer ${getServiceRoleKey()}`,
        Prefer: "count=exact",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to count unread notifications.");
  }

  const contentRange = response.headers.get("content-range");
  const total = contentRange?.split("/")?.[1];
  return total ? Number(total) || 0 : 0;
}

export async function markNotificationReadAdmin(input: { userId: string; notificationId: string }) {
  await adminRequest<RowNotification[]>(
    `/rest/v1/notification?id=eq.${input.notificationId}&recipient_user_id=eq.${input.userId}&read_at=is.null`,
    "PATCH",
    {
      payload: { read_at: new Date().toISOString() },
      allowEmpty: true,
    },
  );
}

export async function markAllNotificationsReadAdmin(userId: string) {
  await adminRequest<RowNotification[]>(
    `/rest/v1/notification?recipient_user_id=eq.${userId}&read_at=is.null`,
    "PATCH",
    {
      payload: { read_at: new Date().toISOString() },
      allowEmpty: true,
    },
  );
}

export async function getStudentNotificationTargetByIdAdmin(studentId: string) {
  const rows = await adminRequest<RowStudentTarget[]>(
    `/rest/v1/student?select=id,user_id,first_name,last_name,login,parent_id,parent:parent_id(id,user_id,full_name)&id=eq.${studentId}&limit=1`,
  );

  if (!rows[0]) return null;
  const row = rows[0];

  return {
    studentId: row.id,
    studentUserId: row.user_id,
    studentDisplayName: toStudentDisplayName(row),
    parentId: row.parent_id,
    parentUserId: row.parent?.user_id ?? null,
    parentDisplayName: row.parent?.full_name?.trim() || null,
  } satisfies StudentNotificationTarget;
}

export async function listStudentNotificationTargetsByClassIdAdmin(classId: string) {
  const rows = await adminRequest<Array<{ student: RowStudentTarget | null }>>(
    `/rest/v1/class_student?select=student:student_id(id,user_id,first_name,last_name,login,parent_id,parent:parent_id(id,user_id,full_name))&class_id=eq.${classId}`,
  );

  const targets = rows
    .map((row) => row.student)
    .filter((row): row is RowStudentTarget => Boolean(row))
    .map((row) => ({
      studentId: row.id,
      studentUserId: row.user_id,
      studentDisplayName: toStudentDisplayName(row),
      parentId: row.parent_id,
      parentUserId: row.parent?.user_id ?? null,
      parentDisplayName: row.parent?.full_name?.trim() || null,
    } satisfies StudentNotificationTarget));

  return Array.from(new Map(targets.map((item) => [item.studentId, item])).values());
}

export async function getTeacherNotificationTargetByTeacherIdAdmin(teacherId: string) {
  const rows = await adminRequest<RowTeacherUser[]>(
    `/rest/v1/teacher?select=id,user_id,full_name&id=eq.${teacherId}&limit=1`,
  );
  const row = rows[0];
  if (!row) return null;
  return {
    teacherId: row.id,
    teacherUserId: row.user_id,
    teacherDisplayName: row.full_name,
  } satisfies TeacherNotificationTarget;
}

export async function listTeacherNotificationTargetsByClassIdAdmin(classId: string) {
  const rows = await adminRequest<Array<{ teacher: RowTeacherUser | null }>>(
    `/rest/v1/class_teacher?select=teacher:teacher_id(id,user_id,full_name)&class_id=eq.${classId}`,
  );

  const targets = rows
    .map((row) => row.teacher)
    .filter((row): row is RowTeacherUser => Boolean(row))
    .map((row) => ({
      teacherId: row.id,
      teacherUserId: row.user_id,
      teacherDisplayName: row.full_name,
    } satisfies TeacherNotificationTarget));

  return Array.from(new Map(targets.map((item) => [item.teacherId, item])).values());
}
