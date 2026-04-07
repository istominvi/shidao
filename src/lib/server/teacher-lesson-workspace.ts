import {
  buildTeacherLessonProjection,
  sortLessonBlocks,
  type GuidedActivityBlock,
  type IntroFramingBlock,
  type LessonBlockInstance,
  type MaterialsPrepBlock,
  type ReusableAsset,
  type SongSegmentBlock,
  type TeacherLessonProjection,
  type TeacherPromptPatternBlock,
  type VideoSegmentBlock,
  type VocabularyFocusBlock,
  type WorksheetTaskBlock,
  type WrapUpClosureBlock,
} from "../lesson-content";
import type { MethodologyReadinessStatus } from "../lesson-content/types";
import type { AccessResolution } from "./access-policy";
import {
  getClassDisplayNameByIdAdmin,
  getMethodologyLessonByIdAdmin,
  getScheduledLessonByIdAdmin,
  listReusableAssetsByIdsAdmin,
} from "./lesson-content-repository";
import {
  getTeacherLessonHomeworkReadModel,
  type TeacherLessonHomeworkReadModel,
} from "./teacher-homework";
import {
  getHomeworkScopedTeacherDiscussions,
  getLessonScopedTeacherDiscussions,
} from "./communication-service";

export type TeacherLessonFlowStep = {
  id: string;
  order: number;
  stepLabel: string;
  blockLabel: string;
  accentTone: "sky" | "violet" | "emerald" | "amber";
  title: string;
  description?: string;
  teacherActions: string[];
  studentActions: string[];
  materials: string[];
  resources: Array<{
    title: string;
    kindLabel: string;
    url?: string;
  }>;
};

export type TeacherLessonWorkspacePresentation = {
  hero: {
    lessonTitle: string;
    lessonEssence: string;
    methodologyTitle: string;
    groupLabel: string;
    dateTimeLabel: string;
    statusLabel: string;
    formatLabel: string;
    methodologyLine: string;
  };
  quickSummary: {
    prepChecklist: string[];
    keyWords: string[];
    keyPhrases: string[];
    resources: Array<{
      title: string;
      kindLabel: string;
      url?: string;
    }>;
  };
  methodologyReference: {
    durationLabel: string;
    positionLabel: string;
    readinessLabel: string;
  };
  lessonFlow: TeacherLessonFlowStep[];
  notes: {
    runtimeNotes: string;
    outcomeNotes: string;
  };
};

export type TeacherLessonWorkspaceReadModel = {
  scheduledLessonId: string;
  classId: string;
  classDisplayName: string | null;
  projection: TeacherLessonProjection;
  presentation: TeacherLessonWorkspacePresentation;
  homework: TeacherLessonHomeworkReadModel;
  communication: {
    lessonScoped: Array<{
      studentId: string;
      studentName: string;
      messages: Array<{
        id: string;
        authorRole: "teacher" | "student" | "parent";
        body: string;
        createdAt: string;
      }>;
    }>;
    homeworkScoped: Array<{
      studentId: string;
      messages: Array<{
        id: string;
        authorRole: "teacher" | "student" | "parent";
        body: string;
        createdAt: string;
      }>;
    }>;
    homeworkAssignmentId: string | null;
  };
};

type WorkspaceLoaderDeps = {
  getScheduledLessonById: typeof getScheduledLessonByIdAdmin;
  getMethodologyLessonById: typeof getMethodologyLessonByIdAdmin;
  listReusableAssetsByIds: typeof listReusableAssetsByIdsAdmin;
  getClassDisplayNameById: typeof getClassDisplayNameByIdAdmin;
  getHomeworkReadModel: typeof getTeacherLessonHomeworkReadModel;
  getLessonDiscussions: typeof getLessonScopedTeacherDiscussions;
  getHomeworkDiscussions: typeof getHomeworkScopedTeacherDiscussions;
};

const defaultWorkspaceLoaderDeps: WorkspaceLoaderDeps = {
  getScheduledLessonById: getScheduledLessonByIdAdmin,
  getMethodologyLessonById: getMethodologyLessonByIdAdmin,
  listReusableAssetsByIds: listReusableAssetsByIdsAdmin,
  getClassDisplayNameById: getClassDisplayNameByIdAdmin,
  getHomeworkReadModel: getTeacherLessonHomeworkReadModel,
  getLessonDiscussions: getLessonScopedTeacherDiscussions,
  getHomeworkDiscussions: getHomeworkScopedTeacherDiscussions,
};

export function canAccessTeacherLessonWorkspace(
  resolution: AccessResolution,
): boolean {
  return (
    resolution.status === "adult-with-profile" &&
    resolution.context.actorKind !== "student" &&
    resolution.activeProfile === "teacher"
  );
}

function formatRuntimeDateTime(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })
    .format(new Date(iso))
    .replace(",", " ·");
}

function formatRuntimeStatus(
  status: TeacherLessonProjection["runtimeShell"]["runtimeStatus"],
) {
  switch (status) {
    case "planned":
      return "Запланировано";
    case "in_progress":
      return "Идёт занятие";
    case "completed":
      return "Завершено";
    case "cancelled":
      return "Отменено";
    default:
      return status;
  }
}

function formatReadiness(readiness: MethodologyReadinessStatus) {
  switch (readiness) {
    case "ready":
      return "Урок готов к проведению";
    case "draft":
      return "Урок в подготовке";
    case "archived":
      return "Урок в архиве";
    default:
      return readiness;
  }
}

function formatAssetKind(kind: ReusableAsset["kind"]) {
  switch (kind) {
    case "video":
      return "Видео";
    case "song":
      return "Песня";
    case "worksheet":
      return "Рабочая тетрадь";
    case "vocabulary_set":
      return "Набор слов";
    case "activity_template":
      return "Материал";
    case "media_file":
      return "Медиафайл";
    default:
      return "Материал";
  }
}

function blockTypeLabel(blockType: LessonBlockInstance["blockType"]) {
  switch (blockType) {
    case "intro_framing":
      return "Ввод в занятие";
    case "video_segment":
      return "Работа с видео";
    case "song_segment":
      return "Песенный блок";
    case "vocabulary_focus":
      return "Лексика";
    case "teacher_prompt_pattern":
      return "Речевые шаблоны";
    case "guided_activity":
      return "Практическая активность";
    case "materials_prep":
      return "Подготовка материалов";
    case "worksheet_task":
      return "Задание";
    case "wrap_up_closure":
      return "Завершение урока";
    default:
      return "Этап урока";
  }
}

function blockTone(
  blockType: LessonBlockInstance["blockType"],
): TeacherLessonFlowStep["accentTone"] {
  switch (blockType) {
    case "intro_framing":
    case "video_segment":
      return "sky";
    case "song_segment":
    case "teacher_prompt_pattern":
      return "violet";
    case "guided_activity":
    case "wrap_up_closure":
      return "emerald";
    default:
      return "amber";
  }
}

function normalizeItems(items: Array<string | undefined>) {
  return Array.from(
    new Set(items.map((item) => item?.trim() ?? "").filter(Boolean)),
  );
}

function collectAssetIds(blocks: LessonBlockInstance[]) {
  return Array.from(
    new Set(
      blocks.flatMap((block) => block.assetRefs.map((assetRef) => assetRef.id)),
    ),
  );
}

function collectBlockMaterials(block: LessonBlockInstance) {
  if (block.blockType === "materials_prep") {
    const content = block.content as MaterialsPrepBlock["content"];
    return normalizeItems([
      ...content.materialsChecklist,
      content.printCount ? `Печать: ${content.printCount}` : undefined,
      content.roomSetupNotes,
    ]);
  }

  if (block.blockType === "worksheet_task") {
    const content = block.content as WorksheetTaskBlock["content"];
    return normalizeItems([
      content.completionMode === "in_class"
        ? "Подготовить листы для работы в классе"
        : "Подготовить листы для работы дома",
      content.answerKeyHint,
    ]);
  }

  return [];
}

function buildFlowStepContent(block: LessonBlockInstance) {
  switch (block.blockType) {
    case "intro_framing": {
      const content = block.content as IntroFramingBlock["content"];
      return {
        description: content.goal,
        teacherActions: normalizeItems([
          content.teacherScriptShort,
          content.warmupQuestion
            ? `Разогрев: ${content.warmupQuestion}`
            : undefined,
          content.timeboxMinutes
            ? `Тайминг: ${content.timeboxMinutes} мин`
            : undefined,
        ]),
        studentActions: [],
      };
    }
    case "video_segment": {
      const content = block.content as VideoSegmentBlock["content"];
      return {
        description: content.promptBeforeWatch,
        teacherActions: normalizeItems([
          `Фокус: ${content.focusPoints.join(", ")}`,
          content.questionsAfterWatch?.length
            ? `Вопросы после просмотра: ${content.questionsAfterWatch.join("; ")}`
            : undefined,
        ]),
        studentActions: normalizeItems([
          "Смотрят фрагмент и отвечают на вопросы",
        ]),
      };
    }
    case "song_segment": {
      const content = block.content as SongSegmentBlock["content"];
      return {
        description: content.activityGoal,
        teacherActions: normalizeItems([
          ...content.teacherActions,
          content.repeatCount
            ? `Повторить ${content.repeatCount} раз(а)`
            : undefined,
          content.movementHint,
        ]),
        studentActions: ["Поют и повторяют движения"],
      };
    }
    case "vocabulary_focus": {
      const content = block.content as VocabularyFocusBlock["content"];
      return {
        description: `Режим практики: ${content.practiceMode}`,
        teacherActions: ["Проговаривает слова и запускает мини-дрилл"],
        studentActions: normalizeItems([
          `Повторяют слова: ${content.items.map((item) => item.term).join(", ")}`,
        ]),
      };
    }
    case "teacher_prompt_pattern": {
      const content = block.content as TeacherPromptPatternBlock["content"];
      return {
        description: "Закрепление речевых паттернов",
        teacherActions: normalizeItems([
          `Шаблоны: ${content.promptPatterns.join("; ")}`,
          content.fallbackRu,
        ]),
        studentActions: normalizeItems([
          `Ожидаемые ответы: ${content.expectedStudentResponses.join("; ")}`,
        ]),
      };
    }
    case "guided_activity": {
      const content = block.content as GuidedActivityBlock["content"];
      return {
        description: content.activityType,
        teacherActions: normalizeItems(content.steps),
        studentActions: normalizeItems([
          `Цель: ${content.successCriteria.join("; ")}`,
        ]),
      };
    }
    case "materials_prep": {
      return {
        description: "Организация материалов и пространства до начала",
        teacherActions: ["Проверить чек-лист и подготовить класс"],
        studentActions: [],
      };
    }
    case "worksheet_task": {
      const content = block.content as WorksheetTaskBlock["content"];
      return {
        description: content.taskInstruction,
        teacherActions: normalizeItems([
          content.answerKeyHint,
          content.homeExtension,
        ]),
        studentActions: [
          content.completionMode === "in_class"
            ? "Выполняют задание в классе"
            : "Выполняют задание дома",
        ],
      };
    }
    case "wrap_up_closure": {
      const content = block.content as WrapUpClosureBlock["content"];
      return {
        description: content.exitCheck,
        teacherActions: normalizeItems([
          `Рекап: ${content.recapPoints.join(", ")}`,
          content.previewNextLesson,
        ]),
        studentActions: ["Отвечают на итоговый вопрос"],
      };
    }
    default:
      return { description: undefined, teacherActions: [], studentActions: [] };
  }
}

function buildPresentation(input: {
  projection: TeacherLessonProjection;
  classDisplayName: string | null;
  assetsById: Record<string, ReusableAsset>;
}): TeacherLessonWorkspacePresentation {
  const { projection, classDisplayName, assetsById } = input;
  const methodologyTitle =
    projection.methodologyTitle?.trim() || "Методика курса";
  const lessonEssence =
    projection.methodologyShell.vocabularySummary.slice(0, 4).join(" · ") ||
    "Повторение ключевой лексики и речевых паттернов в игровых активностях.";

  const resourceItems = normalizeItems(
    projection.orderedBlocks.flatMap((block) =>
      block.assetRefs.map((assetRef) => {
        const asset = assetsById[assetRef.id];
        return asset
          ? `${formatAssetKind(asset.kind)}: ${asset.title}`
          : undefined;
      }),
    ),
  );

  const quickResources = Array.from(
    new Map(
      projection.orderedBlocks
        .flatMap((block) => block.assetRefs)
        .map((assetRef) => assetsById[assetRef.id])
        .filter((asset): asset is ReusableAsset => Boolean(asset))
        .map((asset) => [
          asset.id,
          {
            title: asset.title,
            kindLabel: formatAssetKind(asset.kind),
            url: asset.sourceUrl,
          },
        ]),
    ).values(),
  );

  const prepChecklist = normalizeItems([
    ...projection.orderedBlocks.flatMap(collectBlockMaterials),
    ...resourceItems,
  ]);

  return {
    hero: {
      lessonTitle: projection.methodologyShell.title,
      lessonEssence,
      methodologyTitle,
      groupLabel: classDisplayName?.trim() || "Группа",
      dateTimeLabel: formatRuntimeDateTime(projection.runtimeShell.startsAt),
      statusLabel: formatRuntimeStatus(projection.runtimeShell.runtimeStatus),
      formatLabel:
        projection.runtimeShell.format === "online" ? "Онлайн" : "Офлайн",
      methodologyLine: `По методике «${methodologyTitle}»`,
    },
    quickSummary: {
      prepChecklist,
      keyWords: projection.methodologyShell.vocabularySummary,
      keyPhrases: projection.methodologyShell.phraseSummary,
      resources: quickResources,
    },
    methodologyReference: {
      durationLabel: `${projection.methodologyShell.estimatedDurationMinutes} мин`,
      positionLabel: `Модуль ${projection.methodologyShell.position.moduleIndex} · Урок ${projection.methodologyShell.position.lessonIndex}${projection.methodologyShell.position.unitIndex ? ` · Раздел ${projection.methodologyShell.position.unitIndex}` : ""}`,
      readinessLabel: formatReadiness(
        projection.methodologyShell.readinessStatus,
      ),
    },
    lessonFlow: projection.orderedBlocks.map((block) => {
      const flowContent = buildFlowStepContent(block);
      return {
        id: block.id,
        order: block.order,
        stepLabel: `Шаг ${block.order}`,
        blockLabel: blockTypeLabel(block.blockType),
        accentTone: blockTone(block.blockType),
        title: block.title?.trim() || blockTypeLabel(block.blockType),
        description: flowContent.description,
        teacherActions: flowContent.teacherActions,
        studentActions: flowContent.studentActions,
        materials: collectBlockMaterials(block),
        resources: block.assetRefs
          .map((assetRef) => assetsById[assetRef.id])
          .filter((asset): asset is ReusableAsset => Boolean(asset))
          .map((asset) => ({
            title: asset.title,
            kindLabel: formatAssetKind(asset.kind),
            url: asset.sourceUrl,
          })),
      } satisfies TeacherLessonFlowStep;
    }),
    notes: {
      runtimeNotes: projection.runtimeNotes?.trim() || "",
      outcomeNotes: projection.outcomeNotes?.trim() || "",
    },
  };
}

export function buildTeacherLessonWorkspaceReadModel(input: {
  projection: TeacherLessonProjection;
  scheduledLessonId: string;
  classId: string;
  classDisplayName?: string | null;
  assets: ReusableAsset[];
  homework: TeacherLessonHomeworkReadModel;
  communication?: TeacherLessonWorkspaceReadModel["communication"];
}): TeacherLessonWorkspaceReadModel {
  const sortedProjection: TeacherLessonProjection = {
    ...input.projection,
    orderedBlocks: sortLessonBlocks(input.projection.orderedBlocks),
  };

  const assetsById = Object.fromEntries(
    input.assets.map((asset) => [asset.id, asset]),
  );

  return {
    scheduledLessonId: input.scheduledLessonId,
    classId: input.classId,
    classDisplayName: input.classDisplayName ?? null,
    projection: sortedProjection,
    presentation: buildPresentation({
      projection: sortedProjection,
      classDisplayName: input.classDisplayName ?? null,
      assetsById,
    }),
    homework: input.homework,
    communication: input.communication ?? {
      lessonScoped: [],
      homeworkScoped: [],
      homeworkAssignmentId: null,
    },
  };
}

export async function getTeacherLessonWorkspaceByScheduledLessonId(
  scheduledLessonId: string,
  deps: WorkspaceLoaderDeps = defaultWorkspaceLoaderDeps,
): Promise<TeacherLessonWorkspaceReadModel | null> {
  const scheduledLesson = await deps.getScheduledLessonById(scheduledLessonId);
  if (!scheduledLesson) {
    return null;
  }

  const methodologyLesson = await deps.getMethodologyLessonById(
    scheduledLesson.methodologyLessonId,
  );
  if (!methodologyLesson) {
    return null;
  }

  const projection = buildTeacherLessonProjection(
    methodologyLesson,
    scheduledLesson,
  );
  const assetIds = collectAssetIds(projection.orderedBlocks);
  const [assets, classDisplayName, homework, lessonDiscussions, homeworkDiscussions] =
    await Promise.all([
    assetIds.length
      ? deps.listReusableAssetsByIds(assetIds)
      : Promise.resolve([]),
    deps.getClassDisplayNameById(scheduledLesson.runtimeShell.classId),
    deps.getHomeworkReadModel(scheduledLessonId),
    deps.getLessonDiscussions({
      classId: scheduledLesson.runtimeShell.classId,
      scheduledLessonId: scheduledLesson.id,
    }),
    deps.getHomeworkDiscussions({
      classId: scheduledLesson.runtimeShell.classId,
      scheduledLessonId: scheduledLesson.id,
    }),
    ]);

  return buildTeacherLessonWorkspaceReadModel({
    projection,
    scheduledLessonId: scheduledLesson.id,
    classId: scheduledLesson.runtimeShell.classId,
    classDisplayName,
    assets,
    homework,
    communication: {
      lessonScoped: lessonDiscussions.map((item) => ({
        studentId: item.studentId,
        studentName: item.studentName,
        messages: item.readModel.messages.map((message) => ({
          id: message.id,
          authorRole: message.authorRole,
          body: message.body,
          createdAt: message.createdAt,
        })),
      })),
      homeworkScoped: homeworkDiscussions.items,
      homeworkAssignmentId: homeworkDiscussions.assignmentId,
    },
  });
}

export function getDevTeacherScheduledLessonId() {
  return process.env.DEV_TEACHER_WORKSPACE_SCHEDULED_LESSON_ID?.trim() || "";
}
