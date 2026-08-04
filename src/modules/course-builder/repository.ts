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
  LessonStep,
  StoredFileStatus,
} from "./domain";
import type { ComponentVisibility } from "./component-visibility";
import type {
  AddLessonInput,
  AddLessonStepInput,
  CourseDraftInput,
  CourseUpdateInput,
  PrepareCourseAttachmentInput,
  UpdateLessonInput,
  UpdateLessonStepInput,
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
  audience_type: "none";
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

type LessonStepRow = {
  id: string;
  lesson_id: string;
  position: number;
  title: string;
  teacher_content: JsonObject;
  settings: JsonObject;
  created_at: string;
  updated_at: string;
};

type LessonComponentRow = {
  id: string;
  lesson_step_id: string;
  type_key: string;
  schema_version: number;
  position: number;
  payload: JsonObject;
  placement_config: JsonObject;
  visibility: "learner_visible" | "staff_only";
  created_at: string;
  updated_at: string;
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
  addStep(lessonId: string, input: AddLessonStepInput): Promise<LessonStep>;
  getAuthoringStep(lessonId: string): Promise<LessonStep | null>;
  getStep(stepId: string): Promise<LessonStep | null>;
  updateStep(
    stepId: string,
    input: UpdateLessonStepInput,
  ): Promise<LessonStep | null>;
  addComponent(input: {
    stepId: string;
    typeKey: ComponentTypeKey;
    schemaVersion: number;
    payload: JsonObject;
    placement: JsonObject;
    visibility: ComponentVisibility;
  }): Promise<LessonComponent>;
  getComponent(componentId: string): Promise<LessonComponent | null>;
  updateComponent(input: {
    componentId: string;
    payload?: JsonObject;
    placement?: JsonObject;
    visibility?: ComponentVisibility;
  }): Promise<LessonComponent | null>;
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

function mapLesson(row: LessonRow, steps: LessonStep[] = []): CourseLesson {
  return {
    id: row.id,
    courseId: row.course_id,
    position: row.position,
    title: row.title,
    summary: row.summary ?? "",
    steps,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStep(
  row: LessonStepRow,
  components: LessonComponent[] = [],
): LessonStep {
  const teacherInstructions = row.teacher_content.teacherInstructions;
  const learnerInstruction = row.settings.learnerInstruction;
  return {
    id: row.id,
    lessonId: row.lesson_id,
    position: row.position,
    title: row.title,
    teacherInstructions:
      typeof teacherInstructions === "string" ? teacherInstructions : "",
    learnerInstruction:
      typeof learnerInstruction === "string" ? learnerInstruction : "",
    components,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapComponent(row: LessonComponentRow): LessonComponent {
  return {
    id: row.id,
    stepId: row.lesson_step_id,
    typeKey: row.type_key as ComponentTypeKey,
    schemaVersion: row.schema_version,
    position: row.position,
    payload: row.payload,
    placement: row.placement_config,
    visibility: row.visibility,
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

      const lessons = await request<LessonRow[]>(
        `/rest/v1/lesson?select=*&course_id=eq.${encodeFilter(courseId)}&order=position.asc`,
      );
      const lessonIds = lessons.map((lesson) => lesson.id);
      const steps =
        lessonIds.length === 0
          ? []
          : await request<LessonStepRow[]>(
              `/rest/v1/lesson_step?select=*&lesson_id=in.(${inFilter(lessonIds)})&order=position.asc`,
            );
      const stepIds = steps.map((step) => step.id);
      const components =
        stepIds.length === 0
          ? []
          : await request<LessonComponentRow[]>(
              `/rest/v1/lesson_step_component?select=*&lesson_step_id=in.(${inFilter(stepIds)})&order=position.asc`,
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

      const componentsByStep = new Map<string, LessonComponent[]>();
      for (const component of components) {
        const list = componentsByStep.get(component.lesson_step_id) ?? [];
        list.push(mapComponent(component));
        componentsByStep.set(component.lesson_step_id, list);
      }
      const stepsByLesson = new Map<string, LessonStep[]>();
      for (const step of steps) {
        const list = stepsByLesson.get(step.lesson_id) ?? [];
        list.push(mapStep(step, componentsByStep.get(step.id) ?? []));
        stepsByLesson.set(step.lesson_id, list);
      }
      const mappedLessons = lessons.map((lesson) =>
        mapLesson(lesson, stepsByLesson.get(lesson.id) ?? []),
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
            p_step_title: input.step.title,
            p_teacher_instructions: input.step.teacherInstructions,
            p_learner_instruction: input.step.learnerInstruction,
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
      const rows = await request<LessonRow[]>(
        `/rest/v1/lesson?id=eq.${encodeFilter(lessonId)}`,
        { method: "DELETE" },
      );
      return rows.length > 0;
    },

    async addStep(lessonId, input) {
      const position = await nextPosition("lesson_step", "lesson_id", lessonId);
      const rows = await request<LessonStepRow[]>("/rest/v1/lesson_step", {
        method: "POST",
        body: {
          lesson_id: lessonId,
          position,
          title: input.title,
          teacher_content: {
            teacherInstructions: input.teacherInstructions,
          },
          settings: { learnerInstruction: input.learnerInstruction },
        },
      });
      if (!rows[0]) throw new Error("Не удалось добавить шаг.");
      return mapStep(rows[0]);
    },

    async getAuthoringStep(lessonId) {
      const rows = await request<LessonStepRow[]>(
        `/rest/v1/lesson_step?select=*&lesson_id=eq.${encodeFilter(lessonId)}&order=position.desc&limit=1`,
      );
      return rows[0] ? mapStep(rows[0]) : null;
    },

    async getStep(stepId) {
      const rows = await request<LessonStepRow[]>(
        `/rest/v1/lesson_step?select=*&id=eq.${encodeFilter(stepId)}&limit=1`,
      );
      return rows[0] ? mapStep(rows[0]) : null;
    },

    async updateStep(stepId, input) {
      const body: JsonObject = {};
      if (input.title !== undefined) body.title = input.title;
      if (
        input.teacherInstructions !== undefined ||
        input.learnerInstruction !== undefined
      ) {
        const currentRows = await request<LessonStepRow[]>(
          `/rest/v1/lesson_step?select=*&id=eq.${encodeFilter(stepId)}&limit=1`,
        );
        const current = currentRows[0];
        if (!current) return null;
        if (input.teacherInstructions !== undefined) {
          body.teacher_content = {
            ...current.teacher_content,
            teacherInstructions: input.teacherInstructions,
          };
        }
        if (input.learnerInstruction !== undefined) {
          body.settings = {
            ...current.settings,
            learnerInstruction: input.learnerInstruction,
          };
        }
      }
      const rows = await request<LessonStepRow[]>(
        `/rest/v1/lesson_step?id=eq.${encodeFilter(stepId)}`,
        { method: "PATCH", body },
      );
      return rows[0] ? mapStep(rows[0]) : null;
    },

    async addComponent(input) {
      const position = await nextPosition(
        "lesson_step_component",
        "lesson_step_id",
        input.stepId,
      );
      const rows = await request<LessonComponentRow[]>(
        "/rest/v1/lesson_step_component",
        {
          method: "POST",
          body: {
            lesson_step_id: input.stepId,
            type_key: input.typeKey,
            schema_version: input.schemaVersion,
            position,
            payload: input.payload,
            placement_config: input.placement,
            visibility: input.visibility,
          },
        },
      );
      if (!rows[0]) throw new Error("Не удалось добавить компонент.");
      return mapComponent(rows[0]);
    },

    async getComponent(componentId) {
      const rows = await request<LessonComponentRow[]>(
        `/rest/v1/lesson_step_component?select=*&id=eq.${encodeFilter(componentId)}&limit=1`,
      );
      return rows[0] ? mapComponent(rows[0]) : null;
    },

    async updateComponent(input) {
      const body: JsonObject = {};
      if (input.payload !== undefined) body.payload = input.payload;
      if (input.placement !== undefined)
        body.placement_config = input.placement;
      if (input.visibility !== undefined) body.visibility = input.visibility;
      const rows = await request<LessonComponentRow[]>(
        `/rest/v1/lesson_step_component?id=eq.${encodeFilter(input.componentId)}`,
        { method: "PATCH", body },
      );
      return rows[0] ? mapComponent(rows[0]) : null;
    },

    async deleteComponent(componentId) {
      const rows = await request<LessonComponentRow[]>(
        `/rest/v1/lesson_step_component?id=eq.${encodeFilter(componentId)}`,
        { method: "DELETE" },
      );
      return rows.length > 0;
    },

    async reorderComponent(componentId, toPosition) {
      const reordered = await request<
        Array<{ component_id: string; position: number }>
      >("/rest/v1/rpc/reorder_lesson_step_component", {
        method: "POST",
        body: {
          p_component_id: componentId,
          p_new_position: toPosition,
        },
      });
      if (reordered.length === 0) return null;
      const rows = await request<LessonComponentRow[]>(
        `/rest/v1/lesson_step_component?select=*&id=eq.${encodeFilter(componentId)}&limit=1`,
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
