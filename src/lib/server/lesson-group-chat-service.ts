import crypto from "node:crypto";
import type { AccessResolution } from "./access-policy";
import { getScheduledLessonByIdAdmin, listClassIdsForStudentAdmin } from "./lesson-content-repository";
import {
  createCommunicationAttachmentAdmin,
  createLessonGroupMessageAdmin,
  createSignedStorageObjectUrlAdmin,
  ensureLessonGroupConversationAdmin,
  getCommunicationAttachmentByIdAdmin,
  getLessonGroupConversationAdmin,
  getLessonGroupMessageByIdAdmin,
  isLessonGroupChatSchemaMissingError,
  listAttachmentsByLessonGroupMessageIdsAdmin,
  listLessonGroupMessagesAdmin,
  type LessonGroupMessage,
  uploadStorageObjectAdmin,
} from "./lesson-group-chat-repository";
import { loadParentLearningContextsByUser, assertTeacherAssignedToClassAdmin } from "./supabase-admin";
import { notifyLessonGroupMessageCreated } from "./notification-service";

const MESSAGE_MAX_LENGTH = 2000;
const VOICE_MAX_BYTES = 10 * 1024 * 1024;
const VOICE_MAX_DURATION_MS = 120_000;
const STORAGE_BUCKET = "communication-media";
const SIGNED_URL_TTL_SECONDS = 60 * 10;
const ALLOWED_AUDIO_MIME = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"]);

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
  body: string | null;
  attachments: Array<{
    id: string;
    kind: "voice" | "file";
    mimeType: string;
    sizeBytes: number;
    durationMs: number | null;
  }>;
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

export function validateMessageContent(input: { body?: string | null; hasAttachment: boolean }) {
  const normalized = String(input.body ?? "").trim();
  if (!normalized && !input.hasAttachment) {
    throw new Error("Нельзя отправить пустое сообщение без вложения.");
  }
  if (normalized.length > MESSAGE_MAX_LENGTH) {
    throw new Error(`Сообщение слишком длинное. Максимум ${MESSAGE_MAX_LENGTH} символов.`);
  }
  return normalized || null;
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "audio/webm") return "webm";
  if (mimeType === "audio/ogg") return "ogg";
  if (mimeType === "audio/mp4") return "m4a";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/wav") return "wav";
  throw new Error("Неподдерживаемый формат аудио.");
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
    attachments: [],
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

  const attachments = await listAttachmentsByLessonGroupMessageIdsAdmin(messages.map((item) => item.id));
  const byMessageId = new Map<string, LessonGroupChatMessageView["attachments"]>();
  for (const item of attachments) {
    if (!item.lessonGroupMessageId) continue;
    const list = byMessageId.get(item.lessonGroupMessageId) ?? [];
    list.push({
      id: item.id,
      kind: item.kind,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      durationMs: item.durationMs,
    });
    byMessageId.set(item.lessonGroupMessageId, list);
  }

  return {
    thread: {
      id: conversation.id,
      scheduledLessonId: conversation.scheduledLessonId,
      classId: conversation.classId,
      title: conversation.title,
    },
    messages: messages.map((message) => ({
      ...mapMessageForViewer(message, principal.userId),
      attachments: byMessageId.get(message.id) ?? [],
    })),
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
        body: message.body ?? "[voice]",
        studentName: authorName,
        href: `/lessons/${encodeURIComponent(writeAccess.scheduledLesson.id)}`,
      });
    } catch (error) {
      console.warn("[notifications] notifyLessonGroupMessageCreated(student) failed", error);
    }
    return message;
  }

  const authorLogin = `teacher-${principal.teacherId.slice(0, 8)}`;
  const authorName = principal.teacherFullName || "Преподаватель";

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
      body: message.body ?? "[voice]",
      href: `/lessons/${encodeURIComponent(writeAccess.scheduledLesson.id)}`,
    });
  } catch (error) {
    console.warn("[notifications] notifyLessonGroupMessageCreated(teacher) failed", error);
  }
  return message;
}

export async function sendLessonGroupVoiceMessage(input: {
  scheduledLessonId: string;
  accessResolution: AccessResolution;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number | null;
  payload: ArrayBuffer;
}) {
  const principal = await resolveLessonChatPrincipal(input.accessResolution);
  const writeAccess = await assertCanReadLessonChat({
    scheduledLessonId: input.scheduledLessonId,
    principal,
  });

  if (!writeAccess.canWrite || principal.kind === "parent") {
    throw new Error("Родительский профиль не может отправлять сообщения в чат урока.");
  }

  const mimeType = input.mimeType.toLowerCase().split(";")[0].trim();
  if (!ALLOWED_AUDIO_MIME.has(mimeType)) {
    throw new Error("Неподдерживаемый формат аудио.");
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new Error("Аудиофайл пустой.");
  }
  if (input.sizeBytes > VOICE_MAX_BYTES) {
    throw new Error("Аудиофайл слишком большой. Максимум 10 МБ.");
  }
  if (
    typeof input.durationMs === "number" &&
    (input.durationMs < 0 || input.durationMs > VOICE_MAX_DURATION_MS)
  ) {
    throw new Error("Голосовое сообщение слишком длинное. Максимум 120 секунд.");
  }

  const conversation = await ensureLessonGroupConversationAdmin({
    scheduledLessonId: input.scheduledLessonId,
  });

  const messageBase =
    principal.kind === "student"
      ? {
          authorRole: "student" as const,
          authorStudentId: principal.studentId,
          authorTeacherId: null,
          authorLogin: principal.studentLogin,
          authorName:
            `${principal.studentFirstName ?? ""} ${principal.studentLastName ?? ""}`.trim() ||
            "Ученик",
        }
      : {
          authorRole: "teacher" as const,
          authorStudentId: null,
          authorTeacherId: principal.teacherId,
          authorLogin: `teacher-${principal.teacherId.slice(0, 8)}`,
          authorName: principal.teacherFullName || "Преподаватель",
        };

  const message = await createLessonGroupMessageAdmin({
    conversationId: conversation.id,
    authorUserId: principal.userId,
    authorRole: messageBase.authorRole,
    authorTeacherId: messageBase.authorTeacherId,
    authorStudentId: messageBase.authorStudentId,
    authorLogin: messageBase.authorLogin,
    authorName: messageBase.authorName,
    body: null,
  });

  const storagePath = `classes/${writeAccess.classId}/lessons/${writeAccess.scheduledLesson.id}/group-chat/messages/${message.id}/${crypto.randomUUID()}.${extensionForMimeType(mimeType)}`;

  await uploadStorageObjectAdmin({
    bucket: STORAGE_BUCKET,
    path: storagePath,
    mimeType,
    payload: input.payload,
  });

  await createCommunicationAttachmentAdmin({
    lessonGroupMessageId: message.id,
    kind: "voice",
    storageBucket: STORAGE_BUCKET,
    storagePath,
    mimeType,
    sizeBytes: input.sizeBytes,
    durationMs: input.durationMs ?? null,
    createdByUserId: principal.userId,
    metadata: { source: "lesson-group-chat-voice" },
  });
}

export async function getCommunicationAttachmentSignedUrl(input: {
  attachmentId: string;
  scheduledLessonId: string;
  accessResolution: AccessResolution;
}) {
  const principal = await resolveLessonChatPrincipal(input.accessResolution);
  const readAccess = await assertCanReadLessonChat({
    scheduledLessonId: input.scheduledLessonId,
    principal,
  });
  const conversation = await getLessonGroupConversationAdmin({
    scheduledLessonId: readAccess.scheduledLesson.id,
  });
  if (!conversation) throw new Error("Чат урока не найден.");

  const attachment = await getCommunicationAttachmentByIdAdmin(input.attachmentId);
  if (!attachment || !attachment.lessonGroupMessageId) {
    throw new Error("Вложение не найдено.");
  }

  const message = await getLessonGroupMessageByIdAdmin(attachment.lessonGroupMessageId);
  if (!message || message.conversationId !== conversation.id) {
    throw new Error("Недостаточно прав для доступа к вложению.");
  }

  const signedUrl = await createSignedStorageObjectUrlAdmin({
    bucket: attachment.storageBucket,
    path: attachment.storagePath,
    expiresInSeconds: SIGNED_URL_TTL_SECONDS,
  });

  return {
    signedUrl,
    expiresInSeconds: SIGNED_URL_TTL_SECONDS,
  };
}
