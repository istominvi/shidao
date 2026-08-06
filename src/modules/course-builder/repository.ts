import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import type {
  AssembleCourseResult,
  CourseAsset,
  CourseDraftAssemblyPlan,
  CourseLesson,
  CourseStatus,
  CourseSummary,
  CourseWorkspace,
  LessonComponent,
  LessonStudentSlide,
  StoredFileStatus,
} from "./domain";
import type {
  AddLessonInput,
  CourseDraftInput,
  CourseUpdateInput,
  PrepareCourseAttachmentInput,
  UpdateLessonInput,
  SetComponentStudentScreenInput,
} from "./contracts";
import type { ComponentTypeKey } from "./registry/contracts";

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
  goal: string;
  level: string;
  audience_description: string | null;
  target_lesson_count: number;
  teacher_preferences: string | null;
  audience_type: "none" | "learner_profile";
  assembled_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type LessonRow = {
  id: string;
  course_id: string;
  position: number;
  title: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

type LessonComponentRow = {
  id: string;
  lesson_id: string;
  type_key: string;
  schema_version: number;
  position: number;
  payload: JsonObject;
  placement_config: JsonObject;
  visibility: "learner_visible" | "staff_only";
  student_slide_id: string | null;
  created_at: string;
  updated_at: string;
};

type LessonStudentSlideRow = {
  id: string;
  lesson_id: string;
  position: number;
  created_at: string;
  updated_at: string;
};

type LessonWorkspaceRow = LessonRow & {
  components: LessonComponentRow[];
  studentSlides: LessonStudentSlideRow[];
};

type StoredFileRow = {
  id: string;
  owner_account_id: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  status: StoredFileStatus;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
};

type CourseAttachmentRow = {
  id: string;
  course_id: string;
  stored_file_id: string;
  created_at: string;
};

export class CourseBuilderRepositoryError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = "CourseBuilderRepositoryError";
  }
}

export interface CourseBuilderRepository {
  getSessionInvalidBefore(): Promise<string | null>;
  getAccountId(authUserId: string): Promise<string | null>;
  listCourses(): Promise<CourseSummary[]>;
  getCourseWorkspace(courseId: string): Promise<CourseWorkspace | null>;
  createCourse(
    ownerAccountId: string,
    input: CourseDraftInput,
  ): Promise<CourseSummary>;
  updateCourse(
    courseId: string,
    input: CourseUpdateInput,
  ): Promise<CourseSummary | null>;
  assembleDraft(input: CourseDraftAssemblyPlan): Promise<AssembleCourseResult>;
  addLesson(courseId: string, input: AddLessonInput): Promise<CourseLesson>;
  getLesson(lessonId: string): Promise<CourseLesson | null>;
  updateLesson(
    lessonId: string,
    input: UpdateLessonInput,
  ): Promise<CourseLesson | null>;
  deleteLesson(lessonId: string): Promise<boolean>;
  addComponent(input: {
    lessonId: string;
    typeKey: ComponentTypeKey;
    schemaVersion: number;
    payload: JsonObject;
    placement: JsonObject;
  }): Promise<LessonComponent>;
  getComponent(componentId: string): Promise<LessonComponent | null>;
  updateComponent(input: {
    componentId: string;
    payload?: JsonObject;
    placement?: JsonObject;
  }): Promise<LessonComponent | null>;
  setComponentStudentScreen(
    componentId: string,
    input: SetComponentStudentScreenInput,
  ): Promise<LessonComponent | null>;
  deleteComponent(componentId: string): Promise<boolean>;
  reorderComponent(
    componentId: string,
    toPosition: number,
  ): Promise<LessonComponent | null>;
  createPendingAttachment(input: {
    id: string;
    ownerAccountId: string;
    courseId: string;
    storageBucket: string;
    storagePath: string;
    file: PrepareCourseAttachmentInput;
  }): Promise<CourseAsset>;
  getAttachment(courseId: string, assetId: string): Promise<CourseAsset | null>;
  getAttachmentStorageRef(
    courseId: string,
    assetId: string,
  ): Promise<{
    asset: CourseAsset;
    storageBucket: string;
    storagePath: string;
  } | null>;
  completeAttachment(assetId: string): Promise<CourseAsset | null>;
  deletePendingAttachment(assetId: string): Promise<void>;
}

function encodeFilter(value: string) {
  return encodeURIComponent(value);
}

function inFilter(values: string[]) {
  return values.map(encodeFilter).join(",");
}

function mapCourse(row: CourseRow, lessonCount = 0): CourseSummary {
  return {
    id: row.id,
    ownerAccountId: row.owner_account_id,
    title: row.title,
    subject: row.subject,
    goal: row.goal,
    level: row.level,
    audienceDescription: row.audience_description ?? "",
    targetLessonCount: row.target_lesson_count,
    teacherPreferences: row.teacher_preferences ?? "",
    status: "draft" satisfies CourseStatus,
    lessonCount,
    assembledAt: row.assembled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLesson(
  row: LessonRow,
  components: LessonComponent[] = [],
  studentSlides: LessonStudentSlide[] = [],
): CourseLesson {
  return {
    id: row.id,
    courseId: row.course_id,
    position: row.position,
    title: row.title,
    summary: row.summary ?? "",
    components,
    studentSlides,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapComponent(row: LessonComponentRow): LessonComponent {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    typeKey: row.type_key as ComponentTypeKey,
    schemaVersion: row.schema_version,
    position: row.position,
    payload: row.payload,
    placement: row.placement_config,
    visibility: row.visibility,
    studentSlideId: row.student_slide_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStudentSlide(row: LessonStudentSlideRow): LessonStudentSlide {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAsset(row: StoredFileRow): CourseAsset {
  return {
    id: row.id,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    checksumSha256: row.checksum_sha256,
    status: row.status,
    signedUrl: null,
    createdAt: row.created_at,
  };
}

export function createCourseBuilderRepository(
  accessToken: string,
): CourseBuilderRepository {
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
        details?.message ?? details?.error ?? "Ошибка сохранения курса.",
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

  async function nextPosition(table: string, foreignKey: string, id: string) {
    const rows = await request<Array<{ position: number }>>(
      `/rest/v1/${table}?select=position&${foreignKey}=eq.${encodeFilter(id)}&order=position.desc&limit=1`,
    );
    return (rows[0]?.position ?? 0) + 1;
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

    async listCourses() {
      const courses = await request<CourseRow[]>(
        "/rest/v1/course?select=*&archived_at=is.null&order=updated_at.desc",
      );
      if (courses.length === 0) return [];
      const lessons = await request<Array<{ id: string; course_id: string }>>(
        `/rest/v1/lesson?select=id,course_id&course_id=in.(${inFilter(courses.map((course) => course.id))})`,
      );
      const counts = new Map<string, number>();
      for (const lesson of lessons) {
        counts.set(lesson.course_id, (counts.get(lesson.course_id) ?? 0) + 1);
      }
      return courses.map((course) =>
        mapCourse(course, counts.get(course.id) ?? 0),
      );
    },

    async getCourseWorkspace(courseId) {
      const courseRows = await request<CourseRow[]>(
        `/rest/v1/course?select=*&id=eq.${encodeFilter(courseId)}&archived_at=is.null&limit=1`,
      );
      const course = courseRows[0];
      if (!course) return null;

      const lessons = await request<LessonWorkspaceRow[]>(
        `/rest/v1/lesson?select=*,components:lesson_component(*),studentSlides:lesson_student_slide(*)&course_id=eq.${encodeFilter(courseId)}&order=position.asc&components.order=position.asc&studentSlides.order=position.asc`,
      );
      const links = await request<CourseAttachmentRow[]>(
        `/rest/v1/course_attachment?select=*&course_id=eq.${encodeFilter(courseId)}&order=created_at.asc`,
      );
      const fileIds = links.map((link) => link.stored_file_id);
      const assets =
        fileIds.length === 0
          ? []
          : await request<StoredFileRow[]>(
              `/rest/v1/stored_file?select=*&id=in.(${inFilter(fileIds)})&order=created_at.asc`,
            );

      const mappedLessons = lessons.map((lesson) =>
        mapLesson(
          lesson,
          lesson.components.map(mapComponent),
          lesson.studentSlides.map(mapStudentSlide),
        ),
      );

      return {
        ...mapCourse(course, mappedLessons.length),
        lessons: mappedLessons,
        attachments: assets.map(mapAsset),
      };
    },

    async createCourse(ownerAccountId, input) {
      const rows = await request<CourseRow[]>("/rest/v1/course", {
        method: "POST",
        body: {
          owner_account_id: ownerAccountId,
          title: input.title,
          subject: input.subject,
          goal: input.goal,
          level: input.level,
          audience_description: input.audienceDescription,
          target_lesson_count: input.targetLessonCount,
          teacher_preferences: input.teacherPreferences,
          audience_type: "none",
        },
      });
      const row = rows[0];
      if (!row) throw new Error("Не удалось создать курс.");
      return mapCourse(row);
    },

    async updateCourse(courseId, input) {
      const body: JsonObject = {};
      if (input.title !== undefined) body.title = input.title;
      if (input.subject !== undefined) body.subject = input.subject;
      if (input.goal !== undefined) body.goal = input.goal;
      if (input.level !== undefined) body.level = input.level;
      if (input.audienceDescription !== undefined)
        body.audience_description = input.audienceDescription;
      if (input.targetLessonCount !== undefined)
        body.target_lesson_count = input.targetLessonCount;
      if (input.teacherPreferences !== undefined)
        body.teacher_preferences = input.teacherPreferences;
      const rows = await request<CourseRow[]>(
        `/rest/v1/course?id=eq.${encodeFilter(courseId)}`,
        { method: "PATCH", body },
      );
      return rows[0] ? mapCourse(rows[0]) : null;
    },

    async assembleDraft(input) {
      return request<AssembleCourseResult>(
        "/rest/v1/rpc/assemble_course_draft",
        {
          method: "POST",
          body: {
            p_course_id: input.courseId,
            p_lesson_title: input.lesson.title,
            p_lesson_summary: input.lesson.summary,
            p_components: input.components.map((component) => ({
              typeKey: component.typeKey,
              schemaVersion: component.schemaVersion,
              payload: component.payload,
              placement: component.placement,
            })),
          },
        },
      );
    },

    async addLesson(courseId, input) {
      const position = await nextPosition("lesson", "course_id", courseId);
      const rows = await request<LessonRow[]>("/rest/v1/lesson", {
        method: "POST",
        body: {
          course_id: courseId,
          position,
          title: input.title,
          summary: input.summary,
        },
      });
      if (!rows[0]) throw new Error("Не удалось добавить урок.");
      return mapLesson(rows[0]);
    },

    async getLesson(lessonId) {
      const rows = await request<LessonRow[]>(
        `/rest/v1/lesson?select=*&id=eq.${encodeFilter(lessonId)}&limit=1`,
      );
      return rows[0] ? mapLesson(rows[0]) : null;
    },

    async updateLesson(lessonId, input) {
      const body: JsonObject = {};
      if (input.title !== undefined) body.title = input.title;
      if (input.summary !== undefined) body.summary = input.summary;
      const rows = await request<LessonRow[]>(
        `/rest/v1/lesson?id=eq.${encodeFilter(lessonId)}`,
        { method: "PATCH", body },
      );
      return rows[0] ? mapLesson(rows[0]) : null;
    },

    async deleteLesson(lessonId) {
      return request<boolean>("/rest/v1/rpc/delete_lesson_with_history", {
        method: "POST",
        body: { p_lesson_id: lessonId },
      });
    },

    async addComponent(input) {
      const position = await nextPosition(
        "lesson_component",
        "lesson_id",
        input.lessonId,
      );
      const rows = await request<LessonComponentRow[]>(
        "/rest/v1/lesson_component",
        {
          method: "POST",
          body: {
            lesson_id: input.lessonId,
            type_key: input.typeKey,
            schema_version: input.schemaVersion,
            position,
            payload: input.payload,
            placement_config: input.placement,
          },
        },
      );
      if (!rows[0]) throw new Error("Не удалось добавить компонент.");
      return mapComponent(rows[0]);
    },

    async getComponent(componentId) {
      const rows = await request<LessonComponentRow[]>(
        `/rest/v1/lesson_component?select=*&id=eq.${encodeFilter(componentId)}&limit=1`,
      );
      return rows[0] ? mapComponent(rows[0]) : null;
    },

    async updateComponent(input) {
      const body: JsonObject = {};
      if (input.payload !== undefined) body.payload = input.payload;
      if (input.placement !== undefined)
        body.placement_config = input.placement;
      const rows = await request<LessonComponentRow[]>(
        `/rest/v1/lesson_component?id=eq.${encodeFilter(input.componentId)}`,
        { method: "PATCH", body },
      );
      return rows[0] ? mapComponent(rows[0]) : null;
    },

    async setComponentStudentScreen(componentId, input) {
      const rows = await request<LessonComponentRow[]>(
        "/rest/v1/rpc/set_lesson_component_student_screen",
        {
          method: "POST",
          body: {
            p_component_id: componentId,
            p_mode: input.mode,
            p_slide_id: input.mode === "existing" ? input.slideId : null,
          },
        },
      );
      return rows[0] ? mapComponent(rows[0]) : null;
    },

    async deleteComponent(componentId) {
      return request<boolean>("/rest/v1/rpc/delete_lesson_component", {
        method: "POST",
        body: { p_component_id: componentId },
      });
    },

    async reorderComponent(componentId, toPosition) {
      const rows = await request<LessonComponentRow[]>(
        "/rest/v1/rpc/reorder_lesson_component",
        {
          method: "POST",
          body: {
            p_component_id: componentId,
            p_new_position: toPosition,
          },
        },
      );
      return rows[0] ? mapComponent(rows[0]) : null;
    },

    async createPendingAttachment(input) {
      const files = await request<StoredFileRow[]>("/rest/v1/stored_file", {
        method: "POST",
        body: {
          id: input.id,
          owner_account_id: input.ownerAccountId,
          storage_bucket: input.storageBucket,
          storage_path: input.storagePath,
          original_filename: input.file.originalFilename,
          mime_type: input.file.mimeType,
          size_bytes: input.file.sizeBytes,
          checksum_sha256: input.file.checksumSha256.toLowerCase(),
          status: "pending",
          metadata: { checksum_source: "browser_sha256" },
        },
      });
      if (!files[0]) throw new Error("Не удалось подготовить вложение.");
      try {
        await request<CourseAttachmentRow[]>("/rest/v1/course_attachment", {
          method: "POST",
          body: {
            course_id: input.courseId,
            stored_file_id: input.id,
          },
        });
      } catch (error) {
        await request<StoredFileRow[]>(
          `/rest/v1/stored_file?id=eq.${encodeFilter(input.id)}&status=eq.pending`,
          { method: "DELETE" },
        ).catch(() => null);
        throw error;
      }
      return mapAsset(files[0]);
    },

    async getAttachment(courseId, assetId) {
      const links = await request<CourseAttachmentRow[]>(
        `/rest/v1/course_attachment?select=*&course_id=eq.${encodeFilter(courseId)}&stored_file_id=eq.${encodeFilter(assetId)}&limit=1`,
      );
      if (!links[0]) return null;
      const rows = await request<StoredFileRow[]>(
        `/rest/v1/stored_file?select=*&id=eq.${encodeFilter(assetId)}&limit=1`,
      );
      return rows[0] ? mapAsset(rows[0]) : null;
    },

    async getAttachmentStorageRef(courseId, assetId) {
      const links = await request<CourseAttachmentRow[]>(
        `/rest/v1/course_attachment?select=*&course_id=eq.${encodeFilter(courseId)}&stored_file_id=eq.${encodeFilter(assetId)}&limit=1`,
      );
      if (!links[0]) return null;
      const rows = await request<StoredFileRow[]>(
        `/rest/v1/stored_file?select=*&id=eq.${encodeFilter(assetId)}&limit=1`,
      );
      const row = rows[0];
      if (!row) return null;
      return {
        asset: mapAsset(row),
        storageBucket: row.storage_bucket,
        storagePath: row.storage_path,
      };
    },

    async completeAttachment(assetId) {
      const rows = await request<StoredFileRow[]>(
        `/rest/v1/stored_file?id=eq.${encodeFilter(assetId)}&status=eq.pending`,
        { method: "PATCH", body: { status: "ready" } },
      );
      return rows[0] ? mapAsset(rows[0]) : null;
    },

    async deletePendingAttachment(assetId) {
      await request<StoredFileRow[]>(
        `/rest/v1/stored_file?id=eq.${encodeFilter(assetId)}&status=eq.pending`,
        { method: "DELETE", allowEmpty: true },
      );
    },
  };
}
