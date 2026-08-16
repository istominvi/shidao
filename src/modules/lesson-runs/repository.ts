import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import { CourseBuilderRepositoryError } from "@/modules/course-builder/repository";
import type {
  CompleteLessonRunInput,
  CreateLearnerGroupInput,
  CreateLearnerProfileInput,
  UpdateLearnerGroupInput,
  UpdateLearnerProfileInput,
} from "./contracts";
import type {
  CourseAudience,
  CourseReference,
  LearnerGroup,
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

type TeacherLearnerRow = {
  teacher_account_id: string;
  learner_profile_id: string;
  display_name: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type LearnerGroupRow = {
  id: string;
  owner_account_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type LearnerGroupMemberRow = {
  learner_group_id: string;
  learner_profile_id: string;
};

type CourseLearnerRow = {
  course_id: string;
  learner_profile_id: string;
};

type CourseLearnerGroupRow = {
  course_id: string;
  learner_group_id: string;
};

type LessonRunRow = {
  id: string;
  lesson_id: string;
  scheduled_at: string;
  planned_duration_minutes: number;
  actual_duration_minutes?: number | null;
  started_at: string | null;
  started_at_is_actual?: boolean;
  ended_at: string | null;
  cancelled_at: string | null;
  teacher_report: string | null;
  created_at: string;
  updated_at: string;
};

type LearningRecordRow = {
  id: string;
  learner_profile_id: string;
  recorded_by_account_id: string;
  lesson_run_id: string | null;
  source_course_id: string | null;
  source_lesson_id: string | null;
  occurred_at: string | null;
  was_present: boolean | null;
  needs_repeat: boolean | null;
  teacher_comment: string | null;
  shared_with_learner_at?: string | null;
  actual_duration_minutes_at_time?: number | null;
  superseded_by_record_id?: string | null;
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
  getLearnerProfile(
    teacherAccountId: string,
    learnerProfileId: string,
  ): Promise<LearnerProfile | null>;
  listLearnerProfiles(teacherAccountId: string): Promise<LearnerProfile[]>;
  createLearnerProfile(
    teacherAccountId: string,
    input: CreateLearnerProfileInput,
  ): Promise<LearnerProfile>;
  updateLearnerProfile(
    teacherAccountId: string,
    learnerProfileId: string,
    input: UpdateLearnerProfileInput,
  ): Promise<LearnerProfile>;
  archiveLearnerProfile(
    teacherAccountId: string,
    learnerProfileId: string,
  ): Promise<LearnerProfile>;
  getLearnerGroup(learnerGroupId: string): Promise<LearnerGroup | null>;
  listLearnerGroups(ownerAccountId: string): Promise<LearnerGroup[]>;
  createLearnerGroup(
    ownerAccountId: string,
    input: CreateLearnerGroupInput,
  ): Promise<LearnerGroup>;
  updateLearnerGroup(
    learnerGroupId: string,
    input: UpdateLearnerGroupInput,
  ): Promise<LearnerGroup>;
  deleteLearnerGroup(learnerGroupId: string): Promise<void>;
  getCourseAudience(
    teacherAccountId: string,
    courseId: string,
  ): Promise<CourseAudience>;
  replaceCourseAudience(
    teacherAccountId: string,
    courseId: string,
    directLearnerProfileIds: string[],
    learnerGroupIds: string[],
  ): Promise<CourseAudience>;
  replaceDirectCourseAudience(
    teacherAccountId: string,
    courseId: string,
    learnerProfileIds: string[],
  ): Promise<CourseAudience>;
  listSchedule(
    ownerAccountId: string,
    from: string,
    to: string,
  ): Promise<LessonRun[]>;
  listLessonHistory(
    teacherAccountId: string,
    lessonId: string,
    options?: LearningRecordHistoryOptions,
  ): Promise<LessonRun[]>;
  listCourseHistory(
    teacherAccountId: string,
    courseId: string,
    options?: CourseHistoryOptions,
  ): Promise<LessonRun[]>;
  listCourseLearningRecords(
    teacherAccountId: string,
    courseId: string,
    options?: LearningRecordHistoryOptions,
  ): Promise<LearningRecord[]>;
  listLearningRecordsForLearners(
    teacherAccountId: string,
    learnerProfileIds: string[],
    options?: LearningRecordHistoryOptions,
  ): Promise<LearningRecord[]>;
  listLearnerHistory(
    teacherAccountId: string,
    learnerProfileId: string,
    options?: LearningRecordHistoryOptions,
  ): Promise<LearningRecord[]>;
  getRun(
    teacherAccountId: string,
    runId: string,
  ): Promise<LessonRunContext | null>;
  scheduleRun(input: {
    lessonId: string;
    scheduledAt: string;
    plannedDurationMinutes: number | null;
    learnerProfileIds: string[] | null;
  }): Promise<LessonRun>;
  rescheduleRun(input: {
    runId: string;
    lessonId: string;
    scheduledAt: string;
    plannedDurationMinutes: number;
    learnerProfileIds: string[] | null;
  }): Promise<LessonRun>;
  scheduleRunIfUnchanged(input: {
    lessonId: string;
    scheduledAt: string;
    plannedDurationMinutes: number;
    expectedLessonRunId: string | null;
    expectedLessonRunUpdatedAt: string | null;
    expectedLearnerProfileIds: string[];
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

function mapLearnerProfile(row: TeacherLearnerRow): LearnerProfile {
  return {
    id: row.learner_profile_id,
    teacherAccountId: row.teacher_account_id,
    displayName: row.display_name,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function compareLearnerProfiles(left: LearnerProfile, right: LearnerProfile) {
  return (
    left.displayName.localeCompare(right.displayName, "ru") ||
    left.id.localeCompare(right.id)
  );
}

function compareLearnerGroups(left: LearnerGroup, right: LearnerGroup) {
  return (
    left.name.localeCompare(right.name, "ru") || left.id.localeCompare(right.id)
  );
}

function mapLearningRecord(
  row: LearningRecordRow,
  learnerDisplayName: string,
): LearningRecord {
  return {
    id: row.id,
    learnerProfileId: row.learner_profile_id,
    recordedByAccountId: row.recorded_by_account_id,
    learnerDisplayName,
    lessonRunId: row.lesson_run_id,
    sourceCourseId: row.source_course_id,
    sourceLessonId: row.source_lesson_id,
    occurredAt: row.occurred_at,
    wasPresent: row.was_present,
    needsRepeat: row.needs_repeat,
    teacherComment: row.teacher_comment ?? "",
    sharedWithLearnerAt: row.shared_with_learner_at ?? null,
    actualDurationMinutesAtTime: row.actual_duration_minutes_at_time ?? null,
    supersededByRecordId: row.superseded_by_record_id ?? null,
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

  async function learnerProfilesByIds(teacherAccountId: string, ids: string[]) {
    if (ids.length === 0) return new Map<string, LearnerProfile>();
    const rows = (
      await Promise.all(
        chunks([...new Set(ids)], POSTGREST_IN_FILTER_CHUNK_SIZE).map((batch) =>
          request<TeacherLearnerRow[]>(
            `/rest/v1/teacher_learner?select=*&teacher_account_id=eq.${encodeFilter(teacherAccountId)}&learner_profile_id=in.(${inFilter(batch)})&order=display_name.asc,learner_profile_id.asc`,
          ),
        ),
      )
    ).flat();
    return new Map(
      rows.map((row) => [row.learner_profile_id, mapLearnerProfile(row)]),
    );
  }

  async function hydrateLearnerGroups(rows: LearnerGroupRow[]) {
    if (rows.length === 0) return [];
    const memberships = (
      await Promise.all(
        chunks(
          rows.map((row) => row.id),
          POSTGREST_IN_FILTER_CHUNK_SIZE,
        ).map((batch) =>
          request<LearnerGroupMemberRow[]>(
            `/rest/v1/learner_group_member?select=learner_group_id,learner_profile_id&learner_group_id=in.(${inFilter(batch)})&order=created_at.asc,learner_profile_id.asc`,
          ),
        ),
      )
    ).flat();
    const memberIds = memberships.map(
      (membership) => membership.learner_profile_id,
    );
    const profilesByTeacher = new Map(
      await Promise.all(
        [...new Set(rows.map((row) => row.owner_account_id))].map(
          async (teacherAccountId) =>
            [
              teacherAccountId,
              await learnerProfilesByIds(teacherAccountId, memberIds),
            ] as const,
        ),
      ),
    );
    const memberIdsByGroup = new Map<string, string[]>();
    for (const membership of memberships) {
      const current = memberIdsByGroup.get(membership.learner_group_id) ?? [];
      current.push(membership.learner_profile_id);
      memberIdsByGroup.set(membership.learner_group_id, current);
    }
    return rows
      .map((row): LearnerGroup => ({
        id: row.id,
        ownerAccountId: row.owner_account_id,
        name: row.name,
        members: (memberIdsByGroup.get(row.id) ?? [])
          .map((id) => profilesByTeacher.get(row.owner_account_id)?.get(id))
          .filter(
            (profile): profile is LearnerProfile =>
              profile !== undefined && profile.archivedAt === null,
          )
          .sort(compareLearnerProfiles),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
      .sort(compareLearnerGroups);
  }

  async function learnerGroupsByIds(ids: string[]) {
    if (ids.length === 0) return new Map<string, LearnerGroup>();
    const rows = (
      await Promise.all(
        chunks([...new Set(ids)], POSTGREST_IN_FILTER_CHUNK_SIZE).map((batch) =>
          request<LearnerGroupRow[]>(
            `/rest/v1/learner_group?select=*&id=in.(${inFilter(batch)})&order=name.asc,id.asc`,
          ),
        ),
      )
    ).flat();
    const groups = await hydrateLearnerGroups(rows);
    return new Map(groups.map((group) => [group.id, group]));
  }

  async function entityFromRpc<T>(
    path: string,
    body: JsonObject,
    missingMessage: string,
  ) {
    const payload = await request<T | T[]>(path, { method: "POST", body });
    const row = Array.isArray(payload) ? payload[0] : payload;
    if (!row) {
      throw new CourseBuilderRepositoryError(missingMessage, 502, null);
    }
    return row;
  }

  async function readCourseAudience(
    teacherAccountId: string,
    courseId: string,
  ): Promise<CourseAudience> {
    const [directLinks, groupLinks] = await Promise.all([
      request<CourseLearnerRow[]>(
        `/rest/v1/course_learner?select=course_id,learner_profile_id&course_id=eq.${encodeFilter(courseId)}&order=created_at.asc,learner_profile_id.asc`,
      ),
      request<CourseLearnerGroupRow[]>(
        `/rest/v1/course_learner_group?select=course_id,learner_group_id&course_id=eq.${encodeFilter(courseId)}&order=created_at.asc,learner_group_id.asc`,
      ),
    ]);
    const [profiles, groups] = await Promise.all([
      learnerProfilesByIds(
        teacherAccountId,
        directLinks.map((link) => link.learner_profile_id),
      ),
      learnerGroupsByIds(groupLinks.map((link) => link.learner_group_id)),
    ]);
    const directLearners = directLinks
      .map((link) => profiles.get(link.learner_profile_id))
      .filter(
        (profile): profile is LearnerProfile =>
          profile !== undefined && profile.archivedAt === null,
      )
      .sort(compareLearnerProfiles);
    const selectedGroups = groupLinks
      .map((link) => groups.get(link.learner_group_id))
      .filter((group): group is LearnerGroup => Boolean(group))
      .sort(compareLearnerGroups);
    const effectiveById = new Map<string, LearnerProfile>();
    for (const profile of directLearners)
      effectiveById.set(profile.id, profile);
    for (const group of selectedGroups) {
      for (const profile of group.members)
        effectiveById.set(profile.id, profile);
    }
    return {
      directLearners,
      groups: selectedGroups,
      effectiveLearners: [...effectiveById.values()].sort(
        compareLearnerProfiles,
      ),
    };
  }

  async function hydrateRecords(
    teacherAccountId: string,
    rows: LearningRecordRow[],
  ) {
    const profiles = await learnerProfilesByIds(teacherAccountId, [
      ...new Set(rows.map((row) => row.learner_profile_id)),
    ]);
    return rows.map((row) =>
      mapLearningRecord(
        row,
        profiles.get(row.learner_profile_id)?.displayName ?? "",
      ),
    );
  }

  async function hydrateRuns(rows: LessonRunRow[], teacherAccountId?: string) {
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
            `/rest/v1/learning_record?select=*&lesson_run_id=in.(${inFilter(batch)})${teacherAccountId ? `&recorded_by_account_id=eq.${encodeFilter(teacherAccountId)}` : ""}&order=created_at.asc,id.asc`,
          ),
        ),
      ).then((batches) => batches.flat()),
    ]);
    const coursesById = new Map(courses.map((course) => [course.id, course]));
    const recordTeacherAccountId =
      teacherAccountId ?? courses[0]?.owner_account_id;
    const hydratedRecords = recordTeacherAccountId
      ? await hydrateRecords(recordTeacherAccountId, records)
      : [];
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
            actualDurationMinutes: row.actual_duration_minutes ?? null,
            startedAt: row.started_at,
            startedAtIsActual: row.started_at_is_actual ?? false,
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
        `/rest/v1/course?select=id,owner_account_id,title,subject&id=eq.${encodeFilter(courseId)}&archived_at=is.null&limit=1`,
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

    async getLearnerProfile(teacherAccountId, learnerProfileId) {
      const rows = await request<TeacherLearnerRow[]>(
        `/rest/v1/teacher_learner?select=*&teacher_account_id=eq.${encodeFilter(teacherAccountId)}&learner_profile_id=eq.${encodeFilter(learnerProfileId)}&limit=1`,
      );
      return rows[0] ? mapLearnerProfile(rows[0]) : null;
    },

    async listLearnerProfiles(teacherAccountId) {
      const rows = await request<TeacherLearnerRow[]>(
        `/rest/v1/teacher_learner?select=*&teacher_account_id=eq.${encodeFilter(teacherAccountId)}&archived_at=is.null&order=display_name.asc,learner_profile_id.asc`,
      );
      return rows.map(mapLearnerProfile);
    },

    async createLearnerProfile(_teacherAccountId, input) {
      const row = await entityFromRpc<TeacherLearnerRow>(
        "/rest/v1/rpc/create_learner_profile_with_groups",
        {
          p_display_name: input.displayName,
          p_learner_group_ids: input.learnerGroupIds,
        },
        "Не удалось создать профиль ученика.",
      );
      return mapLearnerProfile(row);
    },

    async updateLearnerProfile(_teacherAccountId, learnerProfileId, input) {
      const row = await entityFromRpc<TeacherLearnerRow>(
        "/rest/v1/rpc/update_learner_profile_with_groups",
        {
          p_learner_profile_id: learnerProfileId,
          p_display_name: input.displayName,
          p_learner_group_ids: input.learnerGroupIds,
        },
        "Не удалось обновить профиль ученика.",
      );
      return mapLearnerProfile(row);
    },

    async archiveLearnerProfile(_teacherAccountId, learnerProfileId) {
      const row = await entityFromRpc<TeacherLearnerRow>(
        "/rest/v1/rpc/archive_learner_profile",
        { p_learner_profile_id: learnerProfileId },
        "Не удалось архивировать профиль ученика.",
      );
      return mapLearnerProfile(row);
    },

    async getLearnerGroup(learnerGroupId) {
      const rows = await request<LearnerGroupRow[]>(
        `/rest/v1/learner_group?select=*&id=eq.${encodeFilter(learnerGroupId)}&limit=1`,
      );
      return (await hydrateLearnerGroups(rows))[0] ?? null;
    },

    async listLearnerGroups(ownerAccountId) {
      const rows = await request<LearnerGroupRow[]>(
        `/rest/v1/learner_group?select=*&owner_account_id=eq.${encodeFilter(ownerAccountId)}&order=name.asc,id.asc`,
      );
      return hydrateLearnerGroups(rows);
    },

    async createLearnerGroup(_ownerAccountId, input) {
      const row = await entityFromRpc<LearnerGroupRow>(
        "/rest/v1/rpc/create_learner_group",
        {
          p_name: input.name,
          p_learner_profile_ids: input.learnerProfileIds,
        },
        "Не удалось создать группу.",
      );
      return (await hydrateLearnerGroups([row]))[0]!;
    },

    async updateLearnerGroup(learnerGroupId, input) {
      const row = await entityFromRpc<LearnerGroupRow>(
        "/rest/v1/rpc/update_learner_group",
        {
          p_learner_group_id: learnerGroupId,
          p_name: input.name,
          p_learner_profile_ids: input.learnerProfileIds,
        },
        "Не удалось обновить группу.",
      );
      return (await hydrateLearnerGroups([row]))[0]!;
    },

    async deleteLearnerGroup(learnerGroupId) {
      await request<unknown>("/rest/v1/rpc/delete_learner_group", {
        method: "POST",
        body: { p_learner_group_id: learnerGroupId },
        allowEmpty: true,
      });
    },

    getCourseAudience(teacherAccountId, courseId) {
      return readCourseAudience(teacherAccountId, courseId);
    },

    async replaceCourseAudience(
      teacherAccountId,
      courseId,
      directLearnerProfileIds,
      learnerGroupIds,
    ) {
      await request<unknown>("/rest/v1/rpc/replace_course_audience", {
        method: "POST",
        body: {
          p_course_id: courseId,
          p_direct_learner_profile_ids: directLearnerProfileIds,
          p_learner_group_ids: learnerGroupIds,
        },
        allowEmpty: true,
      });
      return readCourseAudience(teacherAccountId, courseId);
    },

    async replaceDirectCourseAudience(
      teacherAccountId,
      courseId,
      learnerProfileIds,
    ) {
      await request<unknown>("/rest/v1/rpc/replace_course_learners", {
        method: "POST",
        body: {
          p_course_id: courseId,
          p_learner_profile_ids: learnerProfileIds,
        },
        allowEmpty: true,
      });
      return readCourseAudience(teacherAccountId, courseId);
    },

    async listSchedule(ownerAccountId, from, to) {
      const rows = await request<LessonRunRow[]>(
        `/rest/v1/lesson_run?select=*&scheduled_at=gte.${encodeFilter(from)}&scheduled_at=lt.${encodeFilter(to)}&cancelled_at=is.null&order=scheduled_at.asc,id.asc&limit=${LESSON_RUN_SCHEDULE_HARD_LIMIT}`,
      );
      const contexts = await hydrateRuns(rows, ownerAccountId);
      return contexts
        .filter((context) => context.ownerAccountId === ownerAccountId)
        .map((context) => context.run);
    },

    async listLessonHistory(teacherAccountId, lessonId, options) {
      const limit = historyLimit(options?.limit);
      const rows = await request<LessonRunRow[]>(
        `/rest/v1/lesson_run?select=*&lesson_id=eq.${encodeFilter(lessonId)}&order=scheduled_at.desc,id.desc&limit=${limit}`,
      );
      return (await hydrateRuns(rows, teacherAccountId)).map(
        (context) => context.run,
      );
    },

    async listCourseHistory(teacherAccountId, courseId, options) {
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
      return (await hydrateRuns(rows, teacherAccountId)).map(
        (context) => context.run,
      );
    },

    async listCourseLearningRecords(teacherAccountId, courseId, options) {
      const limit = historyLimit(options?.limit);
      const rows = await request<LearningRecordRow[]>(
        `/rest/v1/learning_record?select=*&recorded_by_account_id=eq.${encodeFilter(teacherAccountId)}&source_course_id=eq.${encodeFilter(courseId)}&occurred_at=not.is.null&superseded_by_record_id=is.null&order=occurred_at.desc,id.desc&limit=${limit}`,
      );
      return hydrateRecords(teacherAccountId, rows);
    },

    async listLearningRecordsForLearners(
      teacherAccountId,
      learnerProfileIds,
      options,
    ) {
      if (learnerProfileIds.length === 0) return [];
      const limit = historyLimit(options?.limit);
      const rows = (
        await Promise.all(
          chunks(
            [...new Set(learnerProfileIds)],
            POSTGREST_IN_FILTER_CHUNK_SIZE,
          ).map((batch) =>
            request<LearningRecordRow[]>(
              `/rest/v1/learning_record?select=*&recorded_by_account_id=eq.${encodeFilter(teacherAccountId)}&learner_profile_id=in.(${inFilter(batch)})&occurred_at=not.is.null&superseded_by_record_id=is.null&order=occurred_at.desc,id.desc&limit=${limit}`,
            ),
          ),
        )
      )
        .flat()
        .sort(
          (left, right) =>
            compareNullableIsoDesc(left.occurred_at, right.occurred_at) ||
            right.id.localeCompare(left.id),
        )
        .slice(0, limit);
      return hydrateRecords(teacherAccountId, rows);
    },

    async listLearnerHistory(teacherAccountId, learnerProfileId, options) {
      const limit = historyLimit(options?.limit);
      const rows = await request<LearningRecordRow[]>(
        `/rest/v1/learning_record?select=*&recorded_by_account_id=eq.${encodeFilter(teacherAccountId)}&learner_profile_id=eq.${encodeFilter(learnerProfileId)}&occurred_at=not.is.null&superseded_by_record_id=is.null&order=occurred_at.desc,id.desc&limit=${limit}`,
      );
      return hydrateRecords(teacherAccountId, rows);
    },

    async getRun(teacherAccountId, runId) {
      const rows = await request<LessonRunRow[]>(
        `/rest/v1/lesson_run?select=*&id=eq.${encodeFilter(runId)}&limit=1`,
      );
      return (await hydrateRuns(rows, teacherAccountId))[0] ?? null;
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

    scheduleRunIfUnchanged(input) {
      return runFromRpc("/rest/v1/rpc/schedule_lesson_run_if_unchanged", {
        p_lesson_id: input.lessonId,
        p_scheduled_at: input.scheduledAt,
        p_planned_duration_minutes: input.plannedDurationMinutes,
        p_expected_lesson_run_id: input.expectedLessonRunId,
        p_expected_lesson_run_updated_at: input.expectedLessonRunUpdatedAt,
        p_expected_learner_profile_ids: input.expectedLearnerProfileIds,
      });
    },

    startRun(runId) {
      return runFromRpc("/rest/v1/rpc/start_lesson_run", {
        p_lesson_run_id: runId,
      });
    },

    completeRun(runId, input) {
      return runFromRpc("/rest/v1/rpc/complete_lesson_run_v2", {
        p_lesson_run_id: runId,
        p_teacher_report: input.teacherReport,
        p_actual_duration_minutes: input.actualDurationMinutes ?? null,
        p_records: input.records.map((record) => ({
          learnerProfileId: record.learnerProfileId,
          wasPresent: record.wasPresent,
          needsRepeat: record.needsRepeat,
          teacherComment: record.teacherComment,
          shareWithLearner: record.shareWithLearner,
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
