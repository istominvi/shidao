import { listClassIdsForStudentAdmin, listStudentsForClassesAdmin } from "./lesson-content-repository";
import {
  createConversationMessageAdmin,
  ensureConversationByClassAndStudentAdmin,
  isCommunicationSchemaMissingError,
  listMessagesByConversationAdmin,
  type GroupStudentMessage,
} from "./communication-repository";
import { getScheduledHomeworkAssignmentByLessonIdAdmin } from "./homework-repository";

export type CommunicationFilter = "all" | "lesson" | "homework" | "general";

type ConversationReadModel = {
  conversationId: string;
  classId: string;
  studentId: string;
  messages: GroupStudentMessage[];
};

export function filterConversationMessages(
  messages: GroupStudentMessage[],
  filter: CommunicationFilter,
  scopedLessonId?: string,
  scopedHomeworkAssignmentId?: string,
) {
  const narrowed = messages.filter((item) => {
    if (scopedLessonId && item.scheduledLessonId !== scopedLessonId) return false;
    if (
      scopedHomeworkAssignmentId &&
      item.scheduledLessonHomeworkAssignmentId !== scopedHomeworkAssignmentId
    ) {
      return false;
    }
    return true;
  });

  if (filter === "lesson") return narrowed.filter((item) => Boolean(item.scheduledLessonId));
  if (filter === "homework") {
    return narrowed.filter((item) => Boolean(item.scheduledLessonHomeworkAssignmentId));
  }
  if (filter === "general") {
    return narrowed.filter(
      (item) =>
        !item.scheduledLessonId &&
        !item.scheduledLessonHomeworkAssignmentId &&
        (!item.topicKind || item.topicKind === "general"),
    );
  }
  return narrowed;
}

export async function getTeacherConversationReadModel(input: {
  teacherId: string;
  classId: string;
  studentId: string;
  filter?: CommunicationFilter;
  scopedLessonId?: string;
  scopedHomeworkAssignmentId?: string;
}): Promise<ConversationReadModel> {
  try {
    const studentsByClass = await listStudentsForClassesAdmin([input.classId]);
    const allowed = (studentsByClass[input.classId] ?? []).some((s) => s.id === input.studentId);
    if (!allowed) throw new Error("Ученик не состоит в выбранной группе.");

    const conversation = await ensureConversationByClassAndStudentAdmin({
      classId: input.classId,
      studentId: input.studentId,
    });
    const messages = await listMessagesByConversationAdmin(conversation.id);

    return {
      conversationId: conversation.id,
      classId: input.classId,
      studentId: input.studentId,
      messages: filterConversationMessages(
        messages,
        input.filter ?? "all",
        input.scopedLessonId,
        input.scopedHomeworkAssignmentId,
      ),
    };
  } catch (error) {
    if (!isCommunicationSchemaMissingError(error)) {
      throw error;
    }
    return {
      conversationId: "",
      classId: input.classId,
      studentId: input.studentId,
      messages: [],
    };
  }
}

export async function sendTeacherMessage(input: {
  classId: string;
  studentId: string;
  authorUserId: string;
  body: string;
  scheduledLessonId?: string;
  scheduledLessonHomeworkAssignmentId?: string;
  topicKind?: "general" | "lesson" | "homework" | "progress" | "organizational";
}) {
  const normalized = input.body.trim();
  if (!normalized) throw new Error("Введите текст сообщения.");

  let conversation;
  try {
    conversation = await ensureConversationByClassAndStudentAdmin({
      classId: input.classId,
      studentId: input.studentId,
    });
  } catch (error) {
    if (isCommunicationSchemaMissingError(error)) {
      throw new Error("Коммуникация временно недоступна: примените миграции communication runtime layer.");
    }
    throw error;
  }

  try {
    return createConversationMessageAdmin({
      conversationId: conversation.id,
      authorUserId: input.authorUserId,
      authorRole: "teacher",
      body: normalized,
      scheduledLessonId: input.scheduledLessonId,
      scheduledLessonHomeworkAssignmentId: input.scheduledLessonHomeworkAssignmentId,
      topicKind: input.topicKind,
    });
  } catch (error) {
    if (isCommunicationSchemaMissingError(error)) {
      throw new Error("Коммуникация временно недоступна: примените миграции communication runtime layer.");
    }
    throw error;
  }
}

export async function sendStudentMessage(input: {
  studentId: string;
  classId: string;
  authorUserId: string;
  body: string;
  scheduledLessonId?: string;
  scheduledLessonHomeworkAssignmentId?: string;
  topicKind?: "general" | "lesson" | "homework" | "progress" | "organizational";
}) {
  const normalized = input.body.trim();
  if (!normalized) throw new Error("Введите текст сообщения.");

  const classIds = await listClassIdsForStudentAdmin(input.studentId);
  if (!classIds.includes(input.classId)) {
    throw new Error("Ученик не состоит в выбранной группе.");
  }

  let conversation;
  try {
    conversation = await ensureConversationByClassAndStudentAdmin({
      classId: input.classId,
      studentId: input.studentId,
    });
  } catch (error) {
    if (isCommunicationSchemaMissingError(error)) {
      throw new Error("Коммуникация временно недоступна: примените миграции communication runtime layer.");
    }
    throw error;
  }

  try {
    return createConversationMessageAdmin({
      conversationId: conversation.id,
      authorUserId: input.authorUserId,
      authorRole: "student",
      body: normalized,
      scheduledLessonId: input.scheduledLessonId,
      scheduledLessonHomeworkAssignmentId: input.scheduledLessonHomeworkAssignmentId,
      topicKind: input.topicKind,
    });
  } catch (error) {
    if (isCommunicationSchemaMissingError(error)) {
      throw new Error("Коммуникация временно недоступна: примените миграции communication runtime layer.");
    }
    throw error;
  }
}

export async function getStudentConversationReadModels(input: {
  studentId: string;
  filter?: CommunicationFilter;
}) {
  const classIds = await listClassIdsForStudentAdmin(input.studentId);
  const models = await Promise.all(
    classIds.map(async (classId) =>
      getTeacherConversationReadModel({
        teacherId: "",
        classId,
        studentId: input.studentId,
        filter: input.filter,
      }),
    ),
  );
  return models;
}

export async function getLessonScopedTeacherDiscussions(input: {
  classId: string;
  scheduledLessonId: string;
}) {
  try {
    const studentsByClass = await listStudentsForClassesAdmin([input.classId]);
    const students = studentsByClass[input.classId] ?? [];
    return Promise.all(
      students.map(async (student) => ({
        studentId: student.id,
        studentName: student.fullName?.trim() || student.login?.trim() || "Ученик",
        readModel: await getTeacherConversationReadModel({
          teacherId: "",
          classId: input.classId,
          studentId: student.id,
          filter: "all",
          scopedLessonId: input.scheduledLessonId,
        }),
      })),
    );
  } catch {
    return [];
  }
}

export async function getHomeworkScopedTeacherDiscussions(input: {
  classId: string;
  scheduledLessonId: string;
}) {
  try {
    const assignment = await getScheduledHomeworkAssignmentByLessonIdAdmin(
      input.scheduledLessonId,
    );
    if (!assignment) return { assignmentId: null, items: [] as Array<{ studentId: string; messages: GroupStudentMessage[] }> };

    const studentsByClass = await listStudentsForClassesAdmin([input.classId]);
    const students = studentsByClass[input.classId] ?? [];
    const items = await Promise.all(
      students.map(async (student) => ({
        studentId: student.id,
        messages: (
          await getTeacherConversationReadModel({
            teacherId: "",
            classId: input.classId,
            studentId: student.id,
            filter: "all",
            scopedHomeworkAssignmentId: assignment.id,
          })
        ).messages,
      })),
    );

    return { assignmentId: assignment.id, items };
  } catch {
    return { assignmentId: null, items: [] as Array<{ studentId: string; messages: GroupStudentMessage[] }> };
  }
}

export async function getParentCommunicationProjection(input: { userId: string }) {
  const { loadParentLearningContextsByUser } = await import("./supabase-admin");
  const children = await loadParentLearningContextsByUser(input.userId);
  const result = await Promise.all(
    children.map(async (child) => {
      const classId = child.classes[0]?.classId;
      if (!classId) return { studentId: child.studentId, studentName: child.studentName, messages: [] };

      const thread = await getTeacherConversationReadModel({
        teacherId: "",
        classId,
        studentId: child.studentId,
        filter: "all",
      });

      return {
        studentId: child.studentId,
        studentName: child.studentName,
        messages: thread.messages,
      };
    }),
  );

  return result;
}
