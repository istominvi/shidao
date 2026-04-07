import type { MethodologyLessonHomeworkDefinition } from "../lesson-content";

type Json = Record<string, unknown>;

type RequestOptions = {
  payload?: Json | Json[];
  allowEmpty?: boolean;
  extraHeaders?: Record<string, string>;
};

type RowMethodologyHomework = {
  id: string;
  methodology_lesson_id: string;
  title: string;
  instructions: string;
  material_links: string[] | null;
  answer_format_hint: string | null;
};

type RowScheduledHomeworkAssignment = {
  id: string;
  scheduled_lesson_id: string;
  methodology_homework_id: string;
  assigned_by_teacher_id: string;
  recipient_mode: "all" | "selected";
  due_at: string | null;
  issued_at: string;
};

type RowStudentHomeworkAssignment = {
  id: string;
  scheduled_homework_assignment_id: string;
  student_id: string;
  status: "assigned" | "submitted" | "reviewed" | "needs_revision";
  submission_text: string | null;
  submitted_at: string | null;
  review_note: string | null;
  reviewed_at: string | null;
};

function getServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for homework repository.");
  }
  return serviceRoleKey;
}

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for homework repository.");
  }
  return url;
}

async function adminRequest<T>(
  path: string,
  method = "GET",
  options?: RequestOptions,
): Promise<T> {
  const url = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();

  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(method !== "GET" ? { Prefer: "return=representation" } : {}),
      ...(options?.extraHeaders ?? {}),
    },
    body: options?.payload ? JSON.stringify(options.payload) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const payloadError = (await response.json().catch(() => null)) as
      | {
          message?: string;
          msg?: string;
        }
      | null;
    throw new Error(payloadError?.message ?? payloadError?.msg ?? "Supabase request failed.");
  }

  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  if (!text) {
    if (options?.allowEmpty) return null as T;
    throw new Error("Supabase returned an empty response.");
  }

  return JSON.parse(text) as T;
}

function mapMethodologyHomework(row: RowMethodologyHomework): MethodologyLessonHomeworkDefinition {
  return {
    id: row.id,
    methodologyLessonId: row.methodology_lesson_id,
    title: row.title,
    instructions: row.instructions,
    materialLinks: row.material_links ?? [],
    answerFormatHint: row.answer_format_hint ?? undefined,
  };
}

export type ScheduledHomeworkAssignment = {
  id: string;
  scheduledLessonId: string;
  methodologyHomeworkId: string;
  assignedByTeacherId: string;
  recipientMode: "all" | "selected";
  dueAt: string | null;
  issuedAt: string;
};

export type StudentHomeworkAssignment = {
  id: string;
  scheduledHomeworkAssignmentId: string;
  studentId: string;
  status: "assigned" | "submitted" | "reviewed" | "needs_revision";
  submissionText: string | null;
  submittedAt: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
};

function mapScheduledAssignment(row: RowScheduledHomeworkAssignment): ScheduledHomeworkAssignment {
  return {
    id: row.id,
    scheduledLessonId: row.scheduled_lesson_id,
    methodologyHomeworkId: row.methodology_homework_id,
    assignedByTeacherId: row.assigned_by_teacher_id,
    recipientMode: row.recipient_mode,
    dueAt: row.due_at,
    issuedAt: row.issued_at,
  };
}

function mapStudentAssignment(row: RowStudentHomeworkAssignment): StudentHomeworkAssignment {
  return {
    id: row.id,
    scheduledHomeworkAssignmentId: row.scheduled_homework_assignment_id,
    studentId: row.student_id,
    status: row.status,
    submissionText: row.submission_text,
    submittedAt: row.submitted_at,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
  };
}

export async function getMethodologyHomeworkByLessonIdAdmin(methodologyLessonId: string) {
  const rows = await adminRequest<RowMethodologyHomework[]>(
    `/rest/v1/methodology_lesson_homework?select=id,methodology_lesson_id,title,instructions,material_links,answer_format_hint&methodology_lesson_id=eq.${methodologyLessonId}&limit=1`,
  );

  if (!rows[0]) return null;
  return mapMethodologyHomework(rows[0]);
}

export async function getScheduledHomeworkAssignmentByLessonIdAdmin(scheduledLessonId: string) {
  const rows = await adminRequest<RowScheduledHomeworkAssignment[]>(
    `/rest/v1/scheduled_lesson_homework_assignment?select=id,scheduled_lesson_id,methodology_homework_id,assigned_by_teacher_id,recipient_mode,due_at,issued_at&scheduled_lesson_id=eq.${scheduledLessonId}&limit=1`,
  );

  if (!rows[0]) return null;
  return mapScheduledAssignment(rows[0]);
}

export async function listStudentHomeworkAssignmentsByScheduledAssignmentAdmin(
  scheduledHomeworkAssignmentId: string,
) {
  const rows = await adminRequest<RowStudentHomeworkAssignment[]>(
    `/rest/v1/student_homework_assignment?select=id,scheduled_homework_assignment_id,student_id,status,submission_text,submitted_at,review_note,reviewed_at&scheduled_homework_assignment_id=eq.${scheduledHomeworkAssignmentId}`,
  );

  return rows.map(mapStudentAssignment);
}

export async function getStudentHomeworkAssignmentByIdAdmin(
  studentHomeworkAssignmentId: string,
) {
  const rows = await adminRequest<RowStudentHomeworkAssignment[]>(
    `/rest/v1/student_homework_assignment?select=id,scheduled_homework_assignment_id,student_id,status,submission_text,submitted_at,review_note,reviewed_at&id=eq.${studentHomeworkAssignmentId}&limit=1`,
  );

  if (!rows[0]) return null;
  return mapStudentAssignment(rows[0]);
}

export async function createScheduledHomeworkAssignmentAdmin(input: {
  scheduledLessonId: string;
  methodologyHomeworkId: string;
  assignedByTeacherId: string;
  recipientMode: "all" | "selected";
  dueAt: string | null;
}) {
  const rows = await adminRequest<RowScheduledHomeworkAssignment[]>(
    "/rest/v1/scheduled_lesson_homework_assignment",
    "POST",
    {
      payload: {
        scheduled_lesson_id: input.scheduledLessonId,
        methodology_homework_id: input.methodologyHomeworkId,
        assigned_by_teacher_id: input.assignedByTeacherId,
        recipient_mode: input.recipientMode,
        due_at: input.dueAt,
      },
    },
  );

  if (!rows[0]) throw new Error("Не удалось создать назначение домашнего задания.");
  return mapScheduledAssignment(rows[0]);
}

export async function createStudentHomeworkAssignmentsAdmin(
  assignments: Array<{ scheduledHomeworkAssignmentId: string; studentId: string }>,
) {
  if (assignments.length === 0) return [];

  const rows = await adminRequest<RowStudentHomeworkAssignment[]>(
    "/rest/v1/student_homework_assignment",
    "POST",
    {
      payload: assignments.map((item) => ({
        scheduled_homework_assignment_id: item.scheduledHomeworkAssignmentId,
        student_id: item.studentId,
        status: "assigned",
      })),
      extraHeaders: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    },
  );

  return rows.map(mapStudentAssignment);
}

export async function updateStudentHomeworkSubmissionAdmin(input: {
  studentHomeworkAssignmentId: string;
  status: "submitted";
  submissionText: string | null;
  submittedAt: string;
}) {
  const rows = await adminRequest<RowStudentHomeworkAssignment[]>(
    `/rest/v1/student_homework_assignment?id=eq.${input.studentHomeworkAssignmentId}`,
    "PATCH",
    {
      payload: {
        status: input.status,
        submission_text: input.submissionText,
        submitted_at: input.submittedAt,
      },
    },
  );

  if (!rows[0]) throw new Error("Не удалось обновить отправку домашнего задания.");
  return mapStudentAssignment(rows[0]);
}

export async function updateStudentHomeworkReviewAdmin(input: {
  studentHomeworkAssignmentId: string;
  status: "reviewed" | "needs_revision";
  reviewNote: string | null;
  reviewedAt: string;
}) {
  const rows = await adminRequest<RowStudentHomeworkAssignment[]>(
    `/rest/v1/student_homework_assignment?id=eq.${input.studentHomeworkAssignmentId}`,
    "PATCH",
    {
      payload: {
        status: input.status,
        review_note: input.reviewNote,
        reviewed_at: input.reviewedAt,
      },
    },
  );

  if (!rows[0]) throw new Error("Не удалось сохранить ревью домашнего задания.");
  return mapStudentAssignment(rows[0]);
}
