import {
  createNotificationsAdmin,
  getStudentNotificationTargetByIdAdmin,
  getTeacherNotificationTargetByTeacherIdAdmin,
  listStudentNotificationTargetsByClassIdAdmin,
  listTeacherNotificationTargetsByClassIdAdmin,
  type CreateNotificationInput,
} from "./notification-repository";

type ActorRole = "teacher" | "parent" | "student" | "system";

type Recipient = {
  userId: string | null;
  role: "teacher" | "parent" | "student";
  teacherId?: string | null;
  parentId?: string | null;
  studentId?: string | null;
};

export function createNotificationInput(
  input: {
    recipient: Recipient;
    actorUserId?: string | null;
    actorRole?: ActorRole;
    eventType: CreateNotificationInput["eventType"];
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
  },
): CreateNotificationInput | null {
  if (!input.recipient.userId) return null;
  if (input.actorUserId && input.actorUserId === input.recipient.userId) return null;

  return {
    recipientUserId: input.recipient.userId,
    recipientRole: input.recipient.role,
    recipientTeacherId: input.recipient.teacherId ?? null,
    recipientParentId: input.recipient.parentId ?? null,
    recipientStudentId: input.recipient.studentId ?? null,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    eventType: input.eventType,
    title: input.title,
    body: input.body ?? null,
    href: input.href,
    scheduledLessonId: input.scheduledLessonId ?? null,
    scheduledHomeworkAssignmentId: input.scheduledHomeworkAssignmentId ?? null,
    studentHomeworkAssignmentId: input.studentHomeworkAssignmentId ?? null,
    conversationId: input.conversationId ?? null,
    messageId: input.messageId ?? null,
    metadata: input.metadata ?? {},
    dedupeKey: input.dedupeKey ?? null,
  };
}

async function createBestEffort(inputs: Array<CreateNotificationInput | null>) {
  const payload = inputs.filter((item): item is CreateNotificationInput => Boolean(item));
  if (payload.length === 0) return;

  try {
    await createNotificationsAdmin(payload);
  } catch (error) {
    console.warn("[notifications] failed to create notifications", error);
  }
}

export function toHomeworkReviewEventType(status: "reviewed" | "needs_revision") {
  return status === "needs_revision" ? "homework_needs_revision" : "homework_reviewed";
}

export function isNotificationUnread(readAt: string | null) {
  return !readAt;
}

export async function notifyHomeworkAssigned(input: {
  actorUserId?: string | null;
  scheduledLessonId: string;
  scheduledHomeworkAssignmentId: string;
  studentHomeworkAssignmentId: string;
  studentId: string;
  href: string;
  homeworkTitle: string;
}) {
  const target = await getStudentNotificationTargetByIdAdmin(input.studentId);
  if (!target) return;

  await createBestEffort([
    createNotificationInput({
      recipient: { userId: target.studentUserId, role: "student", studentId: target.studentId },
      actorUserId: input.actorUserId,
      actorRole: "teacher",
      eventType: "homework_assigned",
      title: "Новое домашнее задание",
      body: input.homeworkTitle,
      href: input.href,
      scheduledLessonId: input.scheduledLessonId,
      scheduledHomeworkAssignmentId: input.scheduledHomeworkAssignmentId,
      studentHomeworkAssignmentId: input.studentHomeworkAssignmentId,
      metadata: { studentId: target.studentId },
    }),
    createNotificationInput({
      recipient: { userId: target.parentUserId, role: "parent", parentId: target.parentId },
      actorUserId: input.actorUserId,
      actorRole: "teacher",
      eventType: "homework_assigned",
      title: `Новое домашнее задание для ${target.studentDisplayName}`,
      body: input.homeworkTitle,
      href: input.href,
      scheduledLessonId: input.scheduledLessonId,
      scheduledHomeworkAssignmentId: input.scheduledHomeworkAssignmentId,
      studentHomeworkAssignmentId: input.studentHomeworkAssignmentId,
      metadata: { studentId: target.studentId, studentName: target.studentDisplayName },
    }),
  ]);
}

export async function notifyHomeworkSubmitted(input: {
  actorUserId?: string | null;
  scheduledLessonId: string;
  studentHomeworkAssignmentId: string;
  assignedTeacherId: string;
  studentId: string;
  href: string;
}) {
  const studentTarget = await getStudentNotificationTargetByIdAdmin(input.studentId);
  const teacher = await getTeacherNotificationTargetByTeacherIdAdmin(input.assignedTeacherId);
  if (!teacher?.teacherUserId) return;
  const studentName = studentTarget?.studentDisplayName ?? "Ученик";

  await createBestEffort([
    createNotificationInput({
      recipient: {
        userId: teacher.teacherUserId,
        role: "teacher",
        teacherId: teacher.teacherId,
      },
      actorUserId: input.actorUserId,
      actorRole: "student",
      eventType: "homework_submitted",
      title: "Сдано домашнее задание",
      body: `${studentName} отправил(а) работу на проверку.`,
      href: input.href,
      scheduledLessonId: input.scheduledLessonId,
      studentHomeworkAssignmentId: input.studentHomeworkAssignmentId,
      metadata: { studentId: input.studentId, studentName },
    }),
  ]);
}

export async function notifyHomeworkReviewed(input: {
  actorUserId?: string | null;
  scheduledLessonId: string;
  scheduledHomeworkAssignmentId: string;
  studentHomeworkAssignmentId: string;
  studentId: string;
  status: "reviewed" | "needs_revision";
  reviewNote?: string | null;
  href: string;
}) {
  const target = await getStudentNotificationTargetByIdAdmin(input.studentId);
  if (!target) return;

  const eventType = toHomeworkReviewEventType(input.status);
  const title =
    input.status === "needs_revision"
      ? "Домашнее задание: нужна доработка"
      : "Домашнее задание проверено";

  await createBestEffort([
    createNotificationInput({
      recipient: { userId: target.studentUserId, role: "student", studentId: target.studentId },
      actorUserId: input.actorUserId,
      actorRole: "teacher",
      eventType,
      title,
      body: input.reviewNote ?? null,
      href: input.href,
      scheduledLessonId: input.scheduledLessonId,
      scheduledHomeworkAssignmentId: input.scheduledHomeworkAssignmentId,
      studentHomeworkAssignmentId: input.studentHomeworkAssignmentId,
    }),
    createNotificationInput({
      recipient: { userId: target.parentUserId, role: "parent", parentId: target.parentId },
      actorUserId: input.actorUserId,
      actorRole: "teacher",
      eventType,
      title: `${title} для ${target.studentDisplayName}`,
      body: input.reviewNote ?? null,
      href: input.href,
      scheduledLessonId: input.scheduledLessonId,
      scheduledHomeworkAssignmentId: input.scheduledHomeworkAssignmentId,
      studentHomeworkAssignmentId: input.studentHomeworkAssignmentId,
      metadata: { studentId: target.studentId, studentName: target.studentDisplayName },
    }),
  ]);
}

export async function notifyTeacherMessageCreated(input: {
  actorUserId?: string | null;
  classId: string;
  studentId: string;
  messageId: string;
  conversationId: string;
  body: string;
  href: string;
  scheduledLessonId?: string;
}) {
  const target = await getStudentNotificationTargetByIdAdmin(input.studentId);
  if (!target) return;

  await createBestEffort([
    createNotificationInput({
      recipient: { userId: target.studentUserId, role: "student", studentId: target.studentId },
      actorUserId: input.actorUserId,
      actorRole: "teacher",
      eventType: "message_created",
      title: "Новое сообщение от преподавателя",
      body: input.body,
      href: input.href,
      scheduledLessonId: input.scheduledLessonId ?? null,
      conversationId: input.conversationId,
      messageId: input.messageId,
      metadata: { classId: input.classId, studentId: input.studentId },
    }),
    createNotificationInput({
      recipient: { userId: target.parentUserId, role: "parent", parentId: target.parentId },
      actorUserId: input.actorUserId,
      actorRole: "teacher",
      eventType: "message_created",
      title: `Новое сообщение для ${target.studentDisplayName}`,
      body: input.body,
      href: input.href,
      scheduledLessonId: input.scheduledLessonId ?? null,
      conversationId: input.conversationId,
      messageId: input.messageId,
      metadata: { classId: input.classId, studentId: input.studentId, studentName: target.studentDisplayName },
    }),
  ]);
}

export async function notifyStudentMessageCreated(input: {
  actorUserId?: string | null;
  classId: string;
  studentId: string;
  studentName?: string;
  messageId: string;
  conversationId: string;
  body: string;
  href: string;
  scheduledLessonId?: string;
}) {
  const studentTarget = await getStudentNotificationTargetByIdAdmin(input.studentId);
  const studentName = input.studentName ?? studentTarget?.studentDisplayName ?? "Ученик";
  const teachers = await listTeacherNotificationTargetsByClassIdAdmin(input.classId);

  await createBestEffort(
    teachers.map((teacher) =>
      createNotificationInput({
        recipient: {
          userId: teacher.teacherUserId,
          role: "teacher",
          teacherId: teacher.teacherId,
        },
        actorUserId: input.actorUserId,
        actorRole: "student",
        eventType: "message_created",
        title: "Новое сообщение от ученика",
        body: `${studentName}: ${input.body}`,
        href: input.href,
        scheduledLessonId: input.scheduledLessonId ?? null,
        conversationId: input.conversationId,
        messageId: input.messageId,
        metadata: { classId: input.classId, studentId: input.studentId, studentName },
      }),
    ),
  );
}

export async function notifyLessonGroupMessageCreated(input: {
  actorUserId?: string | null;
  actorRole: "teacher" | "student";
  classId: string;
  scheduledLessonId: string;
  messageId: string;
  body: string;
  studentName?: string;
  href: string;
}) {
  if (input.actorRole === "teacher") {
    const students = await listStudentNotificationTargetsByClassIdAdmin(input.classId);
    await createBestEffort(
      students.flatMap((student) => [
        createNotificationInput({
          recipient: { userId: student.studentUserId, role: "student", studentId: student.studentId },
          actorUserId: input.actorUserId,
          actorRole: "teacher",
          eventType: "lesson_group_message_created",
          title: "Новое сообщение в чате урока",
          body: input.body,
          href: input.href,
          scheduledLessonId: input.scheduledLessonId,
          messageId: input.messageId,
          metadata: { classId: input.classId, studentId: student.studentId },
        }),
        createNotificationInput({
          recipient: { userId: student.parentUserId, role: "parent", parentId: student.parentId },
          actorUserId: input.actorUserId,
          actorRole: "teacher",
          eventType: "lesson_group_message_created",
          title: `Новое сообщение в чате урока для ${student.studentDisplayName}`,
          body: input.body,
          href: input.href,
          scheduledLessonId: input.scheduledLessonId,
          messageId: input.messageId,
          metadata: { classId: input.classId, studentId: student.studentId, studentName: student.studentDisplayName },
        }),
      ]),
    );
    return;
  }

  const teachers = await listTeacherNotificationTargetsByClassIdAdmin(input.classId);
  await createBestEffort(
    teachers.map((teacher) =>
      createNotificationInput({
        recipient: {
          userId: teacher.teacherUserId,
          role: "teacher",
          teacherId: teacher.teacherId,
        },
        actorUserId: input.actorUserId,
        actorRole: "student",
        eventType: "lesson_group_message_created",
        title: "Новое сообщение ученика в чате урока",
        body: input.studentName ? `${input.studentName}: ${input.body}` : input.body,
        href: input.href,
        scheduledLessonId: input.scheduledLessonId,
        messageId: input.messageId,
        metadata: { classId: input.classId },
      }),
    ),
  );
}
