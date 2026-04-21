import type { AccessResolution } from "./access-policy";
import { getScheduledLessonByIdAdmin, listClassIdsForStudentAdmin } from "./lesson-content-repository";
import {
  createLessonGroupMessageAdmin,
  ensureLessonGroupConversationAdmin,
  isLessonGroupChatSchemaMissingError,
  listLessonGroupMessagesAdmin,
  type LessonGroupMessage,
} from "./lesson-group-chat-repository";
import { loadParentLearningContextsByUser, assertTeacherAssignedToClassAdmin } from "./supabase-admin";
import { notifyLessonGroupMessageCreated } from "./notification-service";

const MESSAGE_MAX_LENGTH = 2000;

type LessonChatPrincipal =
  | { kind: "teacher"; userId: string; teacherId: string; teacherFullName: string | null }
  | {
      kind: "student";
      userId: string;
      studentId: string;
      studentLogin: string;
      studentFirstName: string | null;
      studentLastName: string | null;
    }
  | { kind: "parent"; userId: string };

export type LessonGroupChatMessageView = {
  id: string;
  authorRole: "teacher" | "student";
  authorLogin: string;
  authorName: string;
  body: string;
  createdAt: string;
  isOwn: boolean;
};

export type LessonGroupChatReadModel = {
  thread: {
    id: string;
    scheduledLessonId: string;
    classId: string;
    title: string;
  };
  messages: LessonGroupChatMessageView[];
  canWrite: boolean;
};

async function resolveLessonChatPrincipal(accessResolution: AccessResolution): Promise<LessonChatPrincipal> {
  if (accessResolution.status === "student") {
    const studentId = accessResolution.context.student?.id;
    if (!studentId) {
      throw new Error("Не удалось определить профиль ученика.");
    }
    return {
      kind: "student",
      userId: accessResolution.context.userId,
      studentId,
      studentLogin: accessResolution.context.student?.login?.trim() || "student",
      studentFirstName: accessResolution.context.student?.first_name ?? null,
      studentLastName: accessResolution.context.student?.last_name ?? null,
    };
  }

  if (accessResolution.status !== "adult-with-profile") {
    throw new Error("Требуется авторизация.");
  }

  if (accessResolution.activeProfile === "teacher") {
    const teacherId = accessResolution.context.teacher?.id;
    if (!teacherId) {
      throw new Error("Не удалось определить профиль преподавателя.");
    }
    return {
      kind: "teacher",
      userId: accessResolution.context.userId,
      teacherId,
      teacherFullName: accessResolution.context.teacher?.full_name?.trim() || null,
    };
  }

  if (accessResolution.activeProfile === "parent") {
    return {
      kind: "parent",
      userId: accessResolution.context.userId,
    };
  }

  throw new Error("Недостаточно прав для доступа к чату урока.");
}

function normalizeMessageBody(body: string) {
  const normalized = body.trim();
  if (!normalized) {
    throw new Error("Введите текст сообщения.");
  }
  if (normalized.length > MESSAGE_MAX_LENGTH) {
    throw new Error(`Сообщение слишком длинное. Максимум ${MESSAGE_MAX_LENGTH} символов.`);
  }
  return normalized;
}

async function assertCanReadLessonChat(input: {
  scheduledLessonId: string;
  principal: LessonChatPrincipal;
}) {
  const scheduledLesson = await getScheduledLessonByIdAdmin(input.scheduledLessonId);
  if (!scheduledLesson) {
    throw new Error("Урок не найден.");
  }

  const classId = scheduledLesson.runtimeShell.classId;

  if (input.principal.kind === "teacher") {
    await assertTeacherAssignedToClassAdmin(input.principal.teacherId, classId);
    return { scheduledLesson, classId, canWrite: true as const };
  }

  if (input.principal.kind === "student") {
    const classIds = await listClassIdsForStudentAdmin(input.principal.studentId);
    if (!classIds.includes(classId)) {
      throw new Error("Ученик не состоит в группе урока.");
    }
    return { scheduledLesson, classId, canWrite: true as const };
  }

  const contexts = await loadParentLearningContextsByUser(input.principal.userId);
  const hasChildInClass = contexts.some((child) =>
    child.classes.some((klass) => klass.classId === classId),
  );

  if (!hasChildInClass) {
    throw new Error("Родитель не имеет доступа к этой группе.");
  }

  return { scheduledLesson, classId, canWrite: false as const };
}

function mapMessageForViewer(message: LessonGroupMessage, userId: string) {
  return {
    id: message.id,
    authorRole: message.authorRole,
    authorLogin: message.authorLogin,
    authorName: message.authorName,
    body: message.body,
    createdAt: message.createdAt,
    isOwn: Boolean(message.authorUserId && message.authorUserId === userId),
  } satisfies LessonGroupChatMessageView;
}

export async function getLessonGroupChatReadModel(input: {
  scheduledLessonId: string;
  accessResolution: AccessResolution;
}): Promise<LessonGroupChatReadModel> {
  const principal = await resolveLessonChatPrincipal(input.accessResolution);
  const readAccess = await assertCanReadLessonChat({
    scheduledLessonId: input.scheduledLessonId,
    principal,
  });

  let conversation;
  let messages;
  try {
    const payload = await listLessonGroupMessagesAdmin({
      scheduledLessonId: readAccess.scheduledLesson.id,
    });
    conversation = payload.conversation;
    messages = payload.messages;
  } catch (error) {
    if (isLessonGroupChatSchemaMissingError(error)) {
      throw new Error(
        "Чат урока временно недоступен: нужно применить миграции lesson_group_chat.",
      );
    }
    throw error;
  }

  return {
    thread: {
      id: conversation.id,
      scheduledLessonId: conversation.scheduledLessonId,
      classId: conversation.classId,
      title: conversation.title,
    },
    messages: messages.map((message) => mapMessageForViewer(message, principal.userId)),
    canWrite: readAccess.canWrite,
  };
}

export async function sendLessonGroupChatMessage(input: {
  scheduledLessonId: string;
  accessResolution: AccessResolution;
  body: string;
}) {
  const principal = await resolveLessonChatPrincipal(input.accessResolution);
  const writeAccess = await assertCanReadLessonChat({
    scheduledLessonId: input.scheduledLessonId,
    principal,
  });

  if (!writeAccess.canWrite || principal.kind === "parent") {
    throw new Error("Родительский профиль не может отправлять сообщения в чат урока.");
  }

  const body = normalizeMessageBody(input.body);
  let conversation;
  try {
    conversation = await ensureLessonGroupConversationAdmin({
      scheduledLessonId: input.scheduledLessonId,
    });
  } catch (error) {
    if (isLessonGroupChatSchemaMissingError(error)) {
      throw new Error(
        "Чат урока временно недоступен: нужно применить миграции lesson_group_chat.",
      );
    }
    throw error;
  }

  if (principal.kind === "student") {
    const authorLogin = principal.studentLogin;
    const authorName =
      `${principal.studentFirstName ?? ""} ${principal.studentLastName ?? ""}`.trim() ||
      "Ученик";

    try {
      const message = await createLessonGroupMessageAdmin({
        conversationId: conversation.id,
        authorUserId: principal.userId,
        authorRole: "student",
        authorStudentId: principal.studentId,
        authorLogin,
        authorName,
        body,
      });
      try {
        await notifyLessonGroupMessageCreated({
          actorUserId: principal.userId,
          actorRole: "student",
          classId: writeAccess.classId,
          scheduledLessonId: writeAccess.scheduledLesson.id,
          messageId: message.id,
          body: message.body,
          studentName: authorName,
          href: `/lessons/${encodeURIComponent(writeAccess.scheduledLesson.id)}`,
        });
      } catch (error) {
        console.warn("[notifications] notifyLessonGroupMessageCreated(student) failed", error);
      }
      return message;
    } catch (error) {
      if (isLessonGroupChatSchemaMissingError(error)) {
        throw new Error(
          "Чат урока временно недоступен: нужно применить миграции lesson_group_chat.",
        );
      }
      throw error;
    }
  }

  const authorLogin = `teacher-${principal.teacherId.slice(0, 8)}`;
  const authorName = principal.teacherFullName || "Преподаватель";

  try {
    const message = await createLessonGroupMessageAdmin({
      conversationId: conversation.id,
      authorUserId: principal.userId,
      authorRole: "teacher",
      authorTeacherId: principal.teacherId,
      authorLogin,
      authorName,
      body,
    });
    try {
      await notifyLessonGroupMessageCreated({
        actorUserId: principal.userId,
        actorRole: "teacher",
        classId: writeAccess.classId,
        scheduledLessonId: writeAccess.scheduledLesson.id,
        messageId: message.id,
        body: message.body,
        href: `/lessons/${encodeURIComponent(writeAccess.scheduledLesson.id)}`,
      });
    } catch (error) {
      console.warn("[notifications] notifyLessonGroupMessageCreated(teacher) failed", error);
    }
    return message;
  } catch (error) {
    if (isLessonGroupChatSchemaMissingError(error)) {
      throw new Error(
        "Чат урока временно недоступен: нужно применить миграции lesson_group_chat.",
      );
    }
    throw error;
  }
}
