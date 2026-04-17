import {
  buildTeacherLessonProjection,
  getFixtureStudentContentFallback,
  sortLessonBlocks,
  type GuidedActivityBlock,
  type IntroFramingBlock,
  type LessonBlockInstance,
  type MaterialsPrepBlock,
  type ReusableAsset,
  type SongSegmentBlock,
  type TeacherLessonProjection,
  type TeacherPromptPatternBlock,
  type MethodologyLessonStudentContent,
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
  getMethodologyLessonStudentContentByLessonIdAdmin,
  isLessonStudentContentSchemaReadyAdmin,
  isMissingLessonStudentContentSchemaError,
  getScheduledLessonByIdAdmin,
  listReusableAssetsByIdsAdmin,
} from "./lesson-content-repository";
import { isInvalidLessonStudentContentPayloadError } from "./lesson-content-mappers";
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
  pedagogicalDetails?: {
    vocabularyItems?: Array<{
      term: string;
      pinyin: string;
      meaning: string;
    }>;
    promptPatterns?: string[];
    expectedStudentResponses?: string[];
    fallbackRu?: string;
    activitySteps?: string[];
    successCriteria?: string[];
    answerKeyHint?: string;
    homeExtension?: string;
    recapPoints?: string[];
    exitCheck?: string;
    previewNextLesson?: string;
  };
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
  sourceLesson: {
    methodologySlug: string;
    lessonId: string;
    methodologyTitle: string;
    lessonTitle: string;
  };
  projection: TeacherLessonProjection;
  presentation: TeacherLessonWorkspacePresentation;
  homework: TeacherLessonHomeworkReadModel;
  studentContent: {
    source: MethodologyLessonStudentContent | null;
    assetsById: Record<string, ReusableAsset>;
    unavailableReason:
      | "schema_missing"
      | "invalid_payload"
      | "load_failed"
      | null;
  };
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
  operationalSummary: {
    lessonStatusLabel: string;
    homeworkIssued: boolean;
    assignedCount: number;
    submittedCount: number;
    reviewedCount: number;
    needsRevisionCount: number;
    lessonDiscussionCount: number;
    homeworkDiscussionCount: number;
    studentsNeedingAttention: Array<{
      studentId: string;
      studentName: string;
      reason: "submitted_not_reviewed" | "needs_revision" | "new_messages";
    }>;
  };
};

type WorkspaceLoaderDeps = {
  getScheduledLessonById: typeof getScheduledLessonByIdAdmin;
  getMethodologyLessonById: typeof getMethodologyLessonByIdAdmin;
  getMethodologyLessonStudentContentByLessonId: typeof getMethodologyLessonStudentContentByLessonIdAdmin;
  isLessonStudentContentSchemaReady: typeof isLessonStudentContentSchemaReadyAdmin;
  listReusableAssetsByIds: typeof listReusableAssetsByIdsAdmin;
  getClassDisplayNameById: typeof getClassDisplayNameByIdAdmin;
  getHomeworkReadModel: typeof getTeacherLessonHomeworkReadModel;
  getLessonDiscussions: typeof getLessonScopedTeacherDiscussions;
  getHomeworkDiscussions: typeof getHomeworkScopedTeacherDiscussions;
};

const defaultWorkspaceLoaderDeps: WorkspaceLoaderDeps = {
  getScheduledLessonById: getScheduledLessonByIdAdmin,
  getMethodologyLessonById: getMethodologyLessonByIdAdmin,
  getMethodologyLessonStudentContentByLessonId:
    getMethodologyLessonStudentContentByLessonIdAdmin,
  isLessonStudentContentSchemaReady: isLessonStudentContentSchemaReadyAdmin,
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

function humanizeActivityType(activityType: string) {
  switch (activityType) {
    case "movement_imitation":
      return "Подражание животным в движении";
    case "target_throw_and_name":
      return "Игра с мячом и карточками на стене";
    case "count_and_point":
      return "Счёт и указание по приложению";
    case "movement_commands_with_toys":
      return "Команды 跑/跳 с игрушками";
    case "toy_farm_language_reinforcement":
      return "Закрепление слов на игрушечной ферме";
    default:
      return activityType.replaceAll("_", " ");
  }
}

function humanizePracticeMode(mode: string) {
  if (mode === "cards_two_passes_then_actions") {
    return "Карточки в два прохода, затем отработка в действии";
  }
  return mode.replaceAll("_", " ");
}

function collectAssetIds(blocks: LessonBlockInstance[]) {
  return Array.from(
    new Set(
      blocks.flatMap((block) => block.assetRefs.map((assetRef) => assetRef.id)),
    ),
  );
}

function toStudentContentUnavailableReason(
  error: unknown,
): TeacherLessonWorkspaceReadModel["studentContent"]["unavailableReason"] {
  if (isInvalidLessonStudentContentPayloadError(error)) {
    return "invalid_payload";
  }
  const message = error instanceof Error ? error.message : "";
  if (isMissingLessonStudentContentSchemaError(message)) {
    return "schema_missing";
  }
  return "load_failed";
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
        description: `Режим практики: ${humanizePracticeMode(content.practiceMode)}`,
        teacherActions: ["Проговаривает слова и запускает мини-дрилл"],
        studentActions: normalizeItems([
          `Повторяют слова: ${content.items.map((item) => item.term).join(", ")}`,
        ]),
        pedagogicalDetails: {
          vocabularyItems: content.items,
        },
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
        pedagogicalDetails: {
          promptPatterns: content.promptPatterns,
          expectedStudentResponses: content.expectedStudentResponses,
          fallbackRu: content.fallbackRu,
        },
      };
    }
    case "guided_activity": {
      const content = block.content as GuidedActivityBlock["content"];
      return {
        description: humanizeActivityType(content.activityType),
        teacherActions: normalizeItems(content.steps),
        studentActions: normalizeItems([
          `Цель: ${content.successCriteria.join("; ")}`,
        ]),
        pedagogicalDetails: {
          activitySteps: content.steps,
          successCriteria: content.successCriteria,
        },
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
        pedagogicalDetails: {
          answerKeyHint: content.answerKeyHint,
          homeExtension: content.homeExtension,
        },
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
        pedagogicalDetails: {
          recapPoints: content.recapPoints,
          exitCheck: content.exitCheck,
          previewNextLesson: content.previewNextLesson,
        },
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
        pedagogicalDetails: flowContent.pedagogicalDetails,
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
  sourceLesson: TeacherLessonWorkspaceReadModel["sourceLesson"];
  assets: ReusableAsset[];
  homework: TeacherLessonHomeworkReadModel;
  studentContent?: MethodologyLessonStudentContent | null;
  studentContentUnavailableReason?: TeacherLessonWorkspaceReadModel["studentContent"]["unavailableReason"];
  studentContentAssets?: ReusableAsset[];
  communication?: TeacherLessonWorkspaceReadModel["communication"];
}): TeacherLessonWorkspaceReadModel {
  const sortedProjection: TeacherLessonProjection = {
    ...input.projection,
    orderedBlocks: sortLessonBlocks(input.projection.orderedBlocks),
  };

  const assetsById = Object.fromEntries(
    [...input.assets, ...(input.studentContentAssets ?? [])].map((asset) => [
      asset.id,
      asset,
    ]),
  );

  const communication =
    input.communication ?? {
      lessonScoped: [],
      homeworkScoped: [],
      homeworkAssignmentId: null,
    };

  const lessonDiscussionCount = communication.lessonScoped.reduce(
    (sum, item) => sum + item.messages.length,
    0,
  );
  const homeworkDiscussionCount = communication.homeworkScoped.reduce(
    (sum, item) => sum + item.messages.length,
    0,
  );
  const lessonMessagesByStudentId = new Map(
    communication.lessonScoped.map((item) => [item.studentId, item.messages.length]),
  );
  const homeworkMessagesByStudentId = new Map(
    communication.homeworkScoped.map((item) => [item.studentId, item.messages.length]),
  );

  const attentionRoster = input.homework.roster
    .map((row) => {
      if (row.status === "needs_revision") {
        return {
          studentId: row.studentId,
          studentName: row.studentName,
          reason: "needs_revision",
          priority: 1,
        } as const;
      }
      if (row.status === "submitted") {
        return {
          studentId: row.studentId,
          studentName: row.studentName,
          reason: "submitted_not_reviewed",
          priority: 2,
        } as const;
      }
      const messagesCount =
        (lessonMessagesByStudentId.get(row.studentId) ?? 0) +
        (homeworkMessagesByStudentId.get(row.studentId) ?? 0);
      if (messagesCount > 0) {
        return {
          studentId: row.studentId,
          studentName: row.studentName,
          reason: "new_messages",
          priority: 3,
        } as const;
      }
      return null;
    })
    .filter((item) => item !== null)
    .sort((a, b) => a.priority - b.priority || a.studentName.localeCompare(b.studentName))
    .slice(0, 5)
    .map(({ priority: _priority, ...item }) => item);

  return {
    scheduledLessonId: input.scheduledLessonId,
    classId: input.classId,
    classDisplayName: input.classDisplayName ?? null,
    sourceLesson: input.sourceLesson,
    projection: sortedProjection,
    presentation: buildPresentation({
      projection: sortedProjection,
      classDisplayName: input.classDisplayName ?? null,
      assetsById,
    }),
    homework: input.homework,
    studentContent: {
      source: input.studentContent ?? null,
      assetsById,
      unavailableReason: input.studentContentUnavailableReason ?? null,
    },
    communication,
    operationalSummary: {
      lessonStatusLabel: formatRuntimeStatus(
        sortedProjection.runtimeShell.runtimeStatus,
      ),
      homeworkIssued: Boolean(input.homework.assignment),
      assignedCount: input.homework.stats.assignedCount,
      submittedCount: input.homework.stats.submittedCount,
      reviewedCount: input.homework.stats.reviewedCount,
      needsRevisionCount: input.homework.stats.needsRevisionCount,
      lessonDiscussionCount,
      homeworkDiscussionCount,
      studentsNeedingAttention: attentionRoster,
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
  const coreAssetIds = collectAssetIds(projection.orderedBlocks);
  const [
    assets,
    classDisplayName,
    homework,
    lessonDiscussions,
    homeworkDiscussions,
  ] = await Promise.all([
    coreAssetIds.length
      ? deps.listReusableAssetsByIds(coreAssetIds)
      : Promise.resolve([]),
    deps.getClassDisplayNameById(scheduledLesson.runtimeShell.classId),
    deps.getHomeworkReadModel(scheduledLessonId),
    deps
      .getLessonDiscussions({
        classId: scheduledLesson.runtimeShell.classId,
        scheduledLessonId: scheduledLesson.id,
      })
      .catch(() => []),
    deps
      .getHomeworkDiscussions({
        classId: scheduledLesson.runtimeShell.classId,
        scheduledLessonId: scheduledLesson.id,
      })
      .catch(() => ({ assignmentId: null, items: [] })),
  ]);

  let studentContent: MethodologyLessonStudentContent | null = null;
  let studentContentAssets: ReusableAsset[] = [];
  let studentContentUnavailableReason: TeacherLessonWorkspaceReadModel["studentContent"]["unavailableReason"] =
    null;

  try {
    studentContent = await deps.getMethodologyLessonStudentContentByLessonId(
      methodologyLesson.id,
    );

    if (!studentContent) {
      const studentContentSchemaReady =
        await deps.isLessonStudentContentSchemaReady();
      if (!studentContentSchemaReady) {
        studentContentUnavailableReason = "schema_missing";
      }
    } else {
      const studentContentAssetIds = Array.from(
        new Set(
          studentContent.sections.flatMap((section) => {
            if (section.type === "media_asset") return [section.assetId];
            if (section.type === "worksheet" && section.assetId) {
              return [section.assetId];
            }
            return [];
          }),
        ),
      );

      if (studentContentAssetIds.length > 0) {
        studentContentAssets = await deps.listReusableAssetsByIds(
          studentContentAssetIds,
        );
      }
    }
  } catch (error) {
    studentContent = null;
    studentContentAssets = [];
    studentContentUnavailableReason = toStudentContentUnavailableReason(error);
  }

  if (!studentContent) {
    const fallback = getFixtureStudentContentFallback({
      methodologySlug: methodologyLesson.methodologySlug,
      lessonTitle: methodologyLesson.shell.title,
      moduleIndex: methodologyLesson.shell.position.moduleIndex,
      lessonIndex: methodologyLesson.shell.position.lessonIndex,
    });

    if (fallback) {
      studentContent = fallback.source;
      studentContentAssets = fallback.assets;
      studentContentUnavailableReason = null;
    }
  }

  return buildTeacherLessonWorkspaceReadModel({
    projection,
    scheduledLessonId: scheduledLesson.id,
    classId: scheduledLesson.runtimeShell.classId,
    classDisplayName,
    sourceLesson: {
      methodologySlug: methodologyLesson.methodologySlug,
      lessonId: methodologyLesson.id,
      methodologyTitle: projection.methodologyTitle?.trim() || "Методика",
      lessonTitle: methodologyLesson.shell.title,
    },
    assets,
    studentContentAssets,
    homework,
    studentContent,
    studentContentUnavailableReason,
    communication: {
      lessonScoped:
        lessonDiscussions.length > 0
          ? lessonDiscussions.map((item) => ({
              studentId: item.studentId,
              studentName: item.studentName,
              messages: item.readModel.messages.map((message) => ({
                id: message.id,
                authorRole: message.authorRole,
                body: message.body,
                createdAt: message.createdAt,
              })),
            }))
          : homework.roster.map((row) => ({
              studentId: row.studentId,
              studentName: row.studentName,
              messages: [],
            })),
      homeworkScoped: homeworkDiscussions.items,
      homeworkAssignmentId: homeworkDiscussions.assignmentId,
    },
  });
}

export function getDevTeacherScheduledLessonId() {
  return process.env.DEV_TEACHER_WORKSPACE_SCHEDULED_LESSON_ID?.trim() || "";
}
