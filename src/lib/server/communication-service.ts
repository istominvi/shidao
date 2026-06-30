import { listClassIdsForStudentAdmin, listStudentsForClassesAdmin } from "./lesson-content-repository";
import {
  createConversationMessageAdmin,
  ensureConversationByClassAndStudentAdmin,
  isCommunicationSchemaMissingError,
  listMessagesByConversationAdmin,
  type GroupStudentMessage,
} from "./communication-repository";
import { getScheduledHomeworkAssignmentByLessonIdAdmin } from "./homework-repository";
import {
  notifyStudentMessageCreated,
  notifyTeacherMessageCreated,
} from "./notification-service";

export type CommunicationFilter = "all" | "lesson" | "homework" | "general";

type ConversationReadModel = {
  conversationId: string;
  classId: string;
  studentId: string;
  messages: GroupStudentMessage[];
};

async function getConversationReadModelByClassStudent(input: {
  classId: string;
  studentId: string;
  filter?: CommunicationFilter;
  scopedLessonId?: string;
  scopedHomeworkAssignmentId?: string;
}): Promise<ConversationReadModel> {
  try {
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
  classId: string;
  studentId: string;
  filter?: CommunicationFilter;
  scopedLessonId?: string;
  scopedHomeworkAssignmentId?: string;
}): Promise<ConversationReadModel> {
  const studentsByClass = await listStudentsForClassesAdmin([input.classId]);
  const allowed = (studentsByClass[input.classId] ?? []).some((s) => s.id === input.studentId);
  if (!allowed) throw new Error("Ученик не состоит в выбранной группе.");

  return getConversationReadModelByClassStudent({
    classId: input.classId,
    studentId: input.studentId,
    filter: input.filter,
    scopedLessonId: input.scopedLessonId,
    scopedHomeworkAssignmentId: input.scopedHomeworkAssignmentId,
  });
}

async function assertTeacherAssignedToClassAdminDefault(
  teacherId: string,
  classId: string,
) {
  const { assertTeacherAssignedToClassAdmin } = await import("./supabase-admin");
  await assertTeacherAssignedToClassAdmin(teacherId, classId);
}

export type AuthorizedTeacherConversationDeps = {
  assertTeacherAssignedToClass: (teacherId: string, classId: string) => Promise<void>;
};

/**
 * Teacher-facing conversation reader that first verifies the caller is actually
 * assigned to the requested class (class_teacher), mirroring the write path in
 * `src/app/api/teacher/communication/route.ts`. Without this gate any teacher
 * could read another class's thread by enumerating class/student UUIDs, since
 * `getTeacherConversationReadModel` only checks student-in-class membership and
 * the app runs as service_role (RLS bypassed).
 */
export async function getAuthorizedTeacherConversationReadModel(
  input: {
    teacherId: string;
    classId: string;
    studentId: string;
    filter?: CommunicationFilter;
    scopedLessonId?: string;
    scopedHomeworkAssignmentId?: string;
  },
  deps: AuthorizedTeacherConversationDeps = {
    assertTeacherAssignedToClass: assertTeacherAssignedToClassAdminDefault,
  },
): Promise<ConversationReadModel> {
  await deps.assertTeacherAssignedToClass(input.teacherId, input.classId);

  return getTeacherConversationReadModel({
    classId: input.classId,
    studentId: input.studentId,
    filter: input.filter,
    scopedLessonId: input.scopedLessonId,
    scopedHomeworkAssignmentId: input.scopedHomeworkAssignmentId,
  });
}

export async function getLearnerConversationPreviewReadModel(input: {
  classId: string;
  studentId: string;
  filter?: CommunicationFilter;
  scopedLessonId?: string;
  scopedHomeworkAssignmentId?: string;
}) {
  return getConversationReadModelByClassStudent(input);
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
    const message = await createConversationMessageAdmin({
      conversationId: conversation.id,
      authorUserId: input.authorUserId,
      authorRole: "teacher",
      body: normalized,
      scheduledLessonId: input.scheduledLessonId,
      scheduledLessonHomeworkAssignmentId: input.scheduledLessonHomeworkAssignmentId,
      topicKind: input.topicKind,
    });
    try {
      await notifyTeacherMessageCreated({
        actorUserId: input.authorUserId,
        classId: input.classId,
        studentId: input.studentId,
        body: normalized,
        conversationId: conversation.id,
        messageId: message.id,
        scheduledLessonId: input.scheduledLessonId,
        href: input.scheduledLessonId
          ? `/lessons/${encodeURIComponent(input.scheduledLessonId)}`
          : "/dashboard",
      });
    } catch (error) {
      console.warn("[notifications] notifyTeacherMessageCreated failed", error);
    }
    return message;
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
    const message = await createConversationMessageAdmin({
      conversationId: conversation.id,
      authorUserId: input.authorUserId,
      authorRole: "student",
      body: normalized,
      scheduledLessonId: input.scheduledLessonId,
      scheduledLessonHomeworkAssignmentId: input.scheduledLessonHomeworkAssignmentId,
      topicKind: input.topicKind,
    });
    try {
      await notifyStudentMessageCreated({
        actorUserId: input.authorUserId,
        classId: input.classId,
        studentId: input.studentId,
        body: normalized,
        conversationId: conversation.id,
        messageId: message.id,
        scheduledLessonId: input.scheduledLessonId,
        href: input.scheduledLessonId
          ? `/lessons/${encodeURIComponent(input.scheduledLessonId)}`
          : "/dashboard",
      });
    } catch (error) {
      console.warn("[notifications] notifyStudentMessageCreated failed", error);
    }
    return message;
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

type ParentLearningChild = {
  studentId: string;
  studentName: string;
  classes: Array<{ classId: string }>;
};

export type ParentCommunicationDeps = {
  loadParentLearningContexts: (userId: string) => Promise<ParentLearningChild[]>;
  readConversation: (input: {
    classId: string;
    studentId: string;
    filter?: CommunicationFilter;
  }) => Promise<{ messages: GroupStudentMessage[] }>;
};

async function loadParentLearningContextsByUserDefault(
  userId: string,
): Promise<ParentLearningChild[]> {
  const { loadParentLearningContextsByUser } = await import("./supabase-admin");
  return loadParentLearningContextsByUser(userId);
}

export async function getParentCommunicationProjection(
  input: { userId: string },
  deps: ParentCommunicationDeps = {
    loadParentLearningContexts: loadParentLearningContextsByUserDefault,
    readConversation: getTeacherConversationReadModel,
  },
) {
  const children = await deps.loadParentLearningContexts(input.userId);
  const result = await Promise.all(
    children.map(async (child) => {
      // A child can be enrolled in several classes, and every (class, student)
      // pair is a distinct conversation thread. Aggregate across ALL of the
      // child's classes instead of only the first one, mirroring the student
      // reader `getStudentConversationReadModels`. Threads are disjoint by
      // conversation id, so concatenation never double-counts; we re-sort the
      // merged list because each thread is only individually chronological.
      const threadsByClass = await Promise.all(
        child.classes.map(async ({ classId }) => {
          const thread = await deps.readConversation({
            classId,
            studentId: child.studentId,
            filter: "all",
          });
          return thread.messages;
        }),
      );

      const messages = threadsByClass
        .flat()
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      return {
        studentId: child.studentId,
        studentName: child.studentName,
        messages,
      };
    }),
  );

  return result;
}
