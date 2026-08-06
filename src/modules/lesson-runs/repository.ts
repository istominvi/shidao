import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import { CourseBuilderRepositoryError } from "@/modules/course-builder/repository";
import type {
  CompleteLessonRunInput,
  CreateLearnerProfileInput,
} from "./contracts";
import type {
  CourseReference,
  LearnerProfile,
  LearningRecord,
  LessonReference,
  LessonRun,
  LessonRunContext,
} from "./domain";

type JsonObject = Record<string, unknown>;

type AccountRow = {
  id: string;
  auth_user_id: string;
};

type CourseRow = {
  id: string;
  owner_account_id: string;
  title: string;
  subject: string;
};

type LessonRow = {
  id: string;
  course_id: string;
  title: string;
};

type LearnerProfileRow = {
  id: string;
  owner_account_id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

type CourseLearnerRow = {
  course_id: string;
  learner_profile_id: string;
};

type LessonRunRow = {
  id: string;
  lesson_id: string;
  scheduled_at: string;
  planned_duration_minutes: number;
  started_at: string | null;
  ended_at: string | null;
  cancelled_at: string | null;
  teacher_report: string | null;
  created_at: string;
  updated_at: string;
};

type LearningRecordRow = {
  id: string;
  learner_profile_id: string;
  lesson_run_id: string | null;
  source_course_id: string | null;
  source_lesson_id: string | null;
  occurred_at: string | null;
  was_present: boolean | null;
  needs_repeat: boolean | null;
  teacher_comment: string | null;
  course_title_at_time: string | null;
  lesson_title_at_time: string | null;
  subject_at_time: string | null;
  created_at: string;
  updated_at: string;
};

export interface LessonRunsRepository {
  getSessionInvalidBefore(): Promise<string | null>;
  getAccountId(authUserId: string): Promise<string | null>;
  getCourse(courseId: string): Promise<CourseReference | null>;
  getLesson(lessonId: string): Promise<LessonReference | null>;
  getLearnerProfile(learnerProfileId: string): Promise<LearnerProfile | null>;
  listLearnerProfiles(ownerAccountId: string): Promise<LearnerProfile[]>;
  createLearnerProfile(
    ownerAccountId: string,
    input: CreateLearnerProfileInput,
  ): Promise<LearnerProfile>;
  listCourseAudience(courseId: string): Promise<LearnerProfile[]>;
  replaceCourseAudience(
    courseId: string,
    learnerProfileIds: string[],
  ): Promise<LearnerProfile[]>;
  listSchedule(
    ownerAccountId: string,
    from: string,
    to: string,
  ): Promise<LessonRun[]>;
  listLessonHistory(
    lessonId: string,
    options?: LearningRecordHistoryOptions,
  ): Promise<LessonRun[]>;
  listCourseHistory(
    courseId: string,
    options?: CourseHistoryOptions,
  ): Promise<LessonRun[]>;
  listCourseLearningRecords(
    courseId: string,
    options?: LearningRecordHistoryOptions,
  ): Promise<LearningRecord[]>;
  listLearnerHistory(
    learnerProfileId: string,
    options?: LearningRecordHistoryOptions,
  ): Promise<LearningRecord[]>;
  getRun(runId: string): Promise<LessonRunContext | null>;
  scheduleRun(input: {
    lessonId: string;
    scheduledAt: string;
    plannedDurationMinutes: number | null;
    learnerProfileIds: string[];
  }): Promise<LessonRun>;
  rescheduleRun(input: {
    runId: string;
    lessonId: string;
    scheduledAt: string;
    plannedDurationMinutes: number;
    learnerProfileIds: string[];
  }): Promise<LessonRun>;
  startRun(runId: string): Promise<LessonRun>;
  completeRun(runId: string, input: CompleteLessonRunInput): Promise<LessonRun>;
  cancelRun(runId: string): Promise<LessonRun>;
}

export type CourseHistoryOptions = {
  limit?: number;
  completedOnly?: boolean;
};

export type LearningRecordHistoryOptions = {
  limit?: number;
};

export const LESSON_RUN_HISTORY_HARD_LIMIT = 100;
export const LESSON_RUN_SCHEDULE_HARD_LIMIT = 500;
const POSTGREST_IN_FILTER_CHUNK_SIZE = 50;

function encodeFilter(value: string) {
  return encodeURIComponent(value);
}

function inFilter(values: string[]) {
  return values.map(encodeFilter).join(",");
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function historyLimit(value: number | undefined) {
  return Math.max(
    1,
    Math.min(
      value ?? LESSON_RUN_HISTORY_HARD_LIMIT,
      LESSON_RUN_HISTORY_HARD_LIMIT,
    ),
  );
}

function compareNullableIsoDesc(left: string | null, right: string | null) {
  return new Date(right ?? 0).getTime() - new Date(left ?? 0).getTime();
}

function compareRunRows(
  left: LessonRunRow,
  right: LessonRunRow,
  completedOnly: boolean,
) {
  const byDate = compareNullableIsoDesc(
    completedOnly ? left.ended_at : left.scheduled_at,
    completedOnly ? right.ended_at : right.scheduled_at,
  );
  return byDate || right.id.localeCompare(left.id);
}

function compareOpenRunRows(left: LessonRunRow, right: LessonRunRow) {
  const byDate =
    new Date(left.scheduled_at).getTime() -
    new Date(right.scheduled_at).getTime();
  return byDate || left.id.localeCompare(right.id);
}

function compareClosedRunRows(left: LessonRunRow, right: LessonRunRow) {
  const byDate = compareNullableIsoDesc(
    left.ended_at ?? left.cancelled_at,
    right.ended_at ?? right.cancelled_at,
  );
  return byDate || right.id.localeCompare(left.id);
}

function mapLearnerProfile(row: LearnerProfileRow): LearnerProfile {
  return {
    id: row.id,
    ownerAccountId: row.owner_account_id,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLearningRecord(
  row: LearningRecordRow,
  learnerDisplayName: string,
): LearningRecord {
  return {
    id: row.id,
    learnerProfileId: row.learner_profile_id,
    learnerDisplayName,
    lessonRunId: row.lesson_run_id,
    sourceCourseId: row.source_course_id,
    sourceLessonId: row.source_lesson_id,
    occurredAt: row.occurred_at,
    wasPresent: row.was_present,
    needsRepeat: row.needs_repeat,
    teacherComment: row.teacher_comment ?? "",
    courseTitleAtTime: row.course_title_at_time,
    lessonTitleAtTime: row.lesson_title_at_time,
    subjectAtTime: row.subject_at_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createLessonRunsRepository(
  accessToken: string,
): LessonRunsRepository {
  const { url, anonKey } = getSupabasePublicConfig();

  async function request<T>(
    path: string,
    init: {
      method?: "GET" | "POST" | "PATCH" | "DELETE";
      body?: JsonObject;
      allowEmpty?: boolean;
    } = {},
  ): Promise<T> {
    const method = init.method ?? "GET";
    let response: Response;
    try {
      response = await fetch(`${url}${path}`, {
        method,
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...(method === "GET" ? {} : { Prefer: "return=representation" }),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        cache: "no-store",
      });
    } catch {
      throw new CourseBuilderRepositoryError(
        "Не удалось связаться с Supabase.",
        503,
        "repository_network_error",
      );
    }

    if (!response.ok) {
      const details = (await response.json().catch(() => null)) as {
        message?: string;
        error?: string;
        code?: string;
      } | null;
      throw new CourseBuilderRepositoryError(
        details?.message ?? details?.error ?? "Ошибка сохранения занятия.",
        response.status,
        details?.code ?? null,
      );
    }

    if (response.status === 204) return null as T;
    const text = await response.text();
    if (!text) {
      if (init.allowEmpty) return null as T;
      throw new CourseBuilderRepositoryError(
        "Supabase вернул пустой ответ.",
        502,
        null,
      );
    }
    return JSON.parse(text) as T;
  }

  async function learnerProfilesByIds(ids: string[]) {
    if (ids.length === 0) return new Map<string, LearnerProfile>();
    const rows = (
      await Promise.all(
        chunks([...new Set(ids)], POSTGREST_IN_FILTER_CHUNK_SIZE).map((batch) =>
          request<LearnerProfileRow[]>(
            `/rest/v1/learner_profile?select=*&id=in.(${inFilter(batch)})&order=display_name.asc,id.asc`,
          ),
        ),
      )
    ).flat();
    return new Map(rows.map((row) => [row.id, mapLearnerProfile(row)]));
  }

  async function hydrateRecords(rows: LearningRecordRow[]) {
    const profiles = await learnerProfilesByIds([
      ...new Set(rows.map((row) => row.learner_profile_id)),
    ]);
    return rows.map((row) =>
      mapLearningRecord(
        row,
        profiles.get(row.learner_profile_id)?.displayName ?? "",
      ),
    );
  }

  async function hydrateRuns(rows: LessonRunRow[]) {
    if (rows.length === 0) return [];

    const lessons = (
      await Promise.all(
        chunks(
          [...new Set(rows.map((row) => row.lesson_id))],
          POSTGREST_IN_FILTER_CHUNK_SIZE,
        ).map((batch) =>
          request<LessonRow[]>(
            `/rest/v1/lesson?select=id,course_id,title&id=in.(${inFilter(batch)})`,
          ),
        ),
      )
    ).flat();
    const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
    const courseIds = [...new Set(lessons.map((lesson) => lesson.course_id))];
    const [courses, records] = await Promise.all([
      courseIds.length === 0
        ? Promise.resolve([] as CourseRow[])
        : Promise.all(
            chunks(courseIds, POSTGREST_IN_FILTER_CHUNK_SIZE).map((batch) =>
              request<CourseRow[]>(
                `/rest/v1/course?select=id,owner_account_id,title,subject&id=in.(${inFilter(batch)})`,
              ),
            ),
          ).then((batches) => batches.flat()),
      Promise.all(
        chunks(
          [...new Set(rows.map((row) => row.id))],
          POSTGREST_IN_FILTER_CHUNK_SIZE,
        ).map((batch) =>
          request<LearningRecordRow[]>(
            `/rest/v1/learning_record?select=*&lesson_run_id=in.(${inFilter(batch)})&order=created_at.asc,id.asc`,
          ),
        ),
      ).then((batches) => batches.flat()),
    ]);
    const coursesById = new Map(courses.map((course) => [course.id, course]));
    const hydratedRecords = await hydrateRecords(records);
    const recordsByRun = new Map<string, LearningRecord[]>();
    for (const record of hydratedRecords) {
      if (!record.lessonRunId) continue;
      const current = recordsByRun.get(record.lessonRunId) ?? [];
      current.push(record);
      recordsByRun.set(record.lessonRunId, current);
    }

    return rows.flatMap((row): Array<LessonRunContext> => {
      const lesson = lessonsById.get(row.lesson_id);
      const course = lesson ? coursesById.get(lesson.course_id) : undefined;
      if (!lesson || !course) return [];
      return [
        {
          ownerAccountId: course.owner_account_id,
          run: {
            id: row.id,
            lessonId: row.lesson_id,
            courseId: course.id,
            lessonTitle: lesson.title,
            courseTitle: course.title,
            scheduledAt: row.scheduled_at,
            plannedDurationMinutes: row.planned_duration_minutes,
            startedAt: row.started_at,
            endedAt: row.ended_at,
            cancelledAt: row.cancelled_at,
            teacherReport: row.teacher_report ?? "",
            records: recordsByRun.get(row.id) ?? [],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          },
        },
      ];
    });
  }

  async function runFromRpc(path: string, body: JsonObject) {
    const payload = await request<LessonRunRow | LessonRunRow[]>(path, {
      method: "POST",
      body,
    });
    const row = Array.isArray(payload) ? payload[0] : payload;
    if (!row) {
      throw new CourseBuilderRepositoryError(
        "Supabase не вернул занятие.",
        502,
        null,
      );
    }
    const contexts = await hydrateRuns([row]);
    const context = contexts[0];
    if (!context) {
      throw new CourseBuilderRepositoryError(
        "Не удалось прочитать созданное занятие.",
        502,
        null,
      );
    }
    return context.run;
  }

  return {
    async getSessionInvalidBefore() {
      return request<string | null>(
        "/rest/v1/rpc/current_session_invalid_before",
        { method: "POST", body: {} },
      );
    },

    async getAccountId(authUserId) {
      const rows = await request<AccountRow[]>(
        `/rest/v1/account?select=id,auth_user_id&auth_user_id=eq.${encodeFilter(authUserId)}&limit=1`,
      );
      return rows[0]?.id ?? null;
    },

    async getCourse(courseId) {
      const rows = await request<CourseRow[]>(
        `/rest/v1/course?select=id,owner_account_id,title,subject&id=eq.${encodeFilter(courseId)}&limit=1`,
      );
      const row = rows[0];
      return row
        ? {
            id: row.id,
            ownerAccountId: row.owner_account_id,
            title: row.title,
            subject: row.subject,
          }
        : null;
    },

    async getLesson(lessonId) {
      const rows = await request<LessonRow[]>(
        `/rest/v1/lesson?select=id,course_id,title&id=eq.${encodeFilter(lessonId)}&limit=1`,
      );
      const row = rows[0];
      return row
        ? { id: row.id, courseId: row.course_id, title: row.title }
        : null;
    },

    async getLearnerProfile(learnerProfileId) {
      const rows = await request<LearnerProfileRow[]>(
        `/rest/v1/learner_profile?select=*&id=eq.${encodeFilter(learnerProfileId)}&limit=1`,
      );
      return rows[0] ? mapLearnerProfile(rows[0]) : null;
    },

    async listLearnerProfiles(ownerAccountId) {
      const rows = await request<LearnerProfileRow[]>(
        `/rest/v1/learner_profile?select=*&owner_account_id=eq.${encodeFilter(ownerAccountId)}&order=display_name.asc`,
      );
      return rows.map(mapLearnerProfile);
    },

    async createLearnerProfile(ownerAccountId, input) {
      const rows = await request<LearnerProfileRow[]>(
        "/rest/v1/learner_profile",
        {
          method: "POST",
          body: {
            owner_account_id: ownerAccountId,
            display_name: input.displayName,
          },
        },
      );
      const row = rows[0];
      if (!row) throw new Error("Не удалось создать профиль ученика.");
      return mapLearnerProfile(row);
    },

    async listCourseAudience(courseId) {
      const links = await request<CourseLearnerRow[]>(
        `/rest/v1/course_learner?select=course_id,learner_profile_id&course_id=eq.${encodeFilter(courseId)}`,
      );
      const profiles = await learnerProfilesByIds(
        links.map((link) => link.learner_profile_id),
      );
      return links
        .map((link) => profiles.get(link.learner_profile_id))
        .filter((profile): profile is LearnerProfile => Boolean(profile))
        .sort((left, right) =>
          left.displayName.localeCompare(right.displayName, "ru"),
        );
    },

    async replaceCourseAudience(courseId, learnerProfileIds) {
      const rows = await request<LearnerProfileRow[]>(
        "/rest/v1/rpc/replace_course_learners",
        {
          method: "POST",
          body: {
            p_course_id: courseId,
            p_learner_profile_ids: learnerProfileIds,
          },
        },
      );
      return rows.map(mapLearnerProfile);
    },

    async listSchedule(ownerAccountId, from, to) {
      const rows = await request<LessonRunRow[]>(
        `/rest/v1/lesson_run?select=*&scheduled_at=gte.${encodeFilter(from)}&scheduled_at=lt.${encodeFilter(to)}&cancelled_at=is.null&order=scheduled_at.asc,id.asc&limit=${LESSON_RUN_SCHEDULE_HARD_LIMIT}`,
      );
      const contexts = await hydrateRuns(rows);
      return contexts
        .filter((context) => context.ownerAccountId === ownerAccountId)
        .map((context) => context.run);
    },

    async listLessonHistory(lessonId, options) {
      const limit = historyLimit(options?.limit);
      const rows = await request<LessonRunRow[]>(
        `/rest/v1/lesson_run?select=*&lesson_id=eq.${encodeFilter(lessonId)}&order=scheduled_at.desc,id.desc&limit=${limit}`,
      );
      return (await hydrateRuns(rows)).map((context) => context.run);
    },

    async listCourseHistory(courseId, options) {
      const limit = historyLimit(options?.limit);
      const lessons = await request<LessonRow[]>(
        `/rest/v1/lesson?select=id,course_id,title&course_id=eq.${encodeFilter(courseId)}`,
      );
      if (lessons.length === 0) return [];
      const completedOnly = options?.completedOnly === true;
      const lessonBatches = chunks(
        lessons.map((lesson) => lesson.id),
        POSTGREST_IN_FILTER_CHUNK_SIZE,
      );
      const readBatches = (filter: string, order: string, batchLimit: number) =>
        Promise.all(
          lessonBatches.map((batch) =>
            request<LessonRunRow[]>(
              `/rest/v1/lesson_run?select=*&lesson_id=in.(${inFilter(batch)})${filter}&order=${order}&limit=${batchLimit}`,
            ),
          ),
        ).then((batches) => batches.flat());

      let rows: LessonRunRow[];
      if (completedOnly) {
        rows = (
          await readBatches(
            "&ended_at=not.is.null",
            "ended_at.desc,id.desc",
            limit,
          )
        )
          .sort((left, right) => compareRunRows(left, right, true))
          .slice(0, limit);
      } else {
        const [open, completed, cancelled] = await Promise.all([
          readBatches(
            "&ended_at=is.null&cancelled_at=is.null",
            "scheduled_at.asc,id.asc",
            Math.min(limit, POSTGREST_IN_FILTER_CHUNK_SIZE),
          ),
          readBatches("&ended_at=not.is.null", "ended_at.desc,id.desc", limit),
          readBatches(
            "&cancelled_at=not.is.null",
            "cancelled_at.desc,id.desc",
            limit,
          ),
        ]);
        const openRows = open.sort(compareOpenRunRows).slice(0, limit);
        const openIds = new Set(openRows.map((row) => row.id));
        const recentClosedRows = [...completed, ...cancelled]
          .filter((row) => !openIds.has(row.id))
          .sort(compareClosedRunRows);
        rows = [
          ...openRows,
          ...recentClosedRows.slice(0, limit - openRows.length),
        ];
      }
      return (await hydrateRuns(rows)).map((context) => context.run);
    },

    async listCourseLearningRecords(courseId, options) {
      const limit = historyLimit(options?.limit);
      const rows = await request<LearningRecordRow[]>(
        `/rest/v1/learning_record?select=*&source_course_id=eq.${encodeFilter(courseId)}&occurred_at=not.is.null&order=occurred_at.desc,id.desc&limit=${limit}`,
      );
      return hydrateRecords(rows);
    },

    async listLearnerHistory(learnerProfileId, options) {
      const limit = historyLimit(options?.limit);
      const rows = await request<LearningRecordRow[]>(
        `/rest/v1/learning_record?select=*&learner_profile_id=eq.${encodeFilter(learnerProfileId)}&occurred_at=not.is.null&order=occurred_at.desc,id.desc&limit=${limit}`,
      );
      return hydrateRecords(rows);
    },

    async getRun(runId) {
      const rows = await request<LessonRunRow[]>(
        `/rest/v1/lesson_run?select=*&id=eq.${encodeFilter(runId)}&limit=1`,
      );
      return (await hydrateRuns(rows))[0] ?? null;
    },

    scheduleRun(input) {
      return runFromRpc("/rest/v1/rpc/schedule_lesson_run", {
        p_lesson_id: input.lessonId,
        p_scheduled_at: input.scheduledAt,
        p_planned_duration_minutes: input.plannedDurationMinutes,
        p_learner_profile_ids: input.learnerProfileIds,
      });
    },

    rescheduleRun(input) {
      return runFromRpc("/rest/v1/rpc/schedule_lesson_run", {
        p_lesson_id: input.lessonId,
        p_scheduled_at: input.scheduledAt,
        p_planned_duration_minutes: input.plannedDurationMinutes,
        p_learner_profile_ids: input.learnerProfileIds,
        p_expected_lesson_run_id: input.runId,
      });
    },

    startRun(runId) {
      return runFromRpc("/rest/v1/rpc/start_lesson_run", {
        p_lesson_run_id: runId,
      });
    },

    completeRun(runId, input) {
      return runFromRpc("/rest/v1/rpc/complete_lesson_run", {
        p_lesson_run_id: runId,
        p_teacher_report: input.teacherReport,
        p_records: input.records.map((record) => ({
          learnerProfileId: record.learnerProfileId,
          wasPresent: record.wasPresent,
          needsRepeat: record.needsRepeat,
          teacherComment: record.teacherComment,
        })),
      });
    },

    cancelRun(runId) {
      return runFromRpc("/rest/v1/rpc/cancel_lesson_run", {
        p_lesson_run_id: runId,
      });
    },
  };
}
