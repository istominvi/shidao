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
import { buildLessonConnectionInfo, type LessonConnectionInfo } from "../lesson-connection";
import type { MethodologyReadinessStatus } from "../lesson-content/types";
import type { AccessResolution } from "./access-policy";
import {
  getClassDisplayNameByIdAdmin,
  getMethodologyLessonByIdAdmin,
  getMethodologyLessonStudentContentByLessonIdAdmin,
  getScheduledLessonByIdAdmin,
  isLessonStudentContentSchemaReadyAdmin,
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
import {
  buildMethodologyLessonUnifiedReadModel,
  type MethodologyLessonUnifiedReadModel,
} from "./methodology-lesson-unified-read-model";
import {
  mapScheduledLessonLiveState,
  resolveActiveLessonStep,
  type ScheduledLessonLiveState,
} from "./scheduled-lesson-live-state";
import { loadScheduledLessonUnifiedSeedAdmin } from "./scheduled-lesson-unified-context";

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
    connection: LessonConnectionInfo;
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
  unifiedReadModel: MethodologyLessonUnifiedReadModel;
  liveState: ScheduledLessonLiveState;
  liveActiveStepId: string | null;
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
};

type WorkspaceLoaderDeps = {
  getScheduledLessonById: typeof getScheduledLessonByIdAdmin;
  getMethodologyLessonById: typeof getMethodologyLessonByIdAdmin;
  getMethodologyLessonStudentContentByLessonId?: typeof getMethodologyLessonStudentContentByLessonIdAdmin;
  isLessonStudentContentSchemaReady?: typeof isLessonStudentContentSchemaReadyAdmin;
  getClassDisplayNameById: typeof getClassDisplayNameByIdAdmin;
  listReusableAssetsByIds: typeof listReusableAssetsByIdsAdmin;
  loadUnifiedSeed?: typeof loadScheduledLessonUnifiedSeedAdmin;
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
  getClassDisplayNameById: getClassDisplayNameByIdAdmin,
  listReusableAssetsByIds: listReusableAssetsByIdsAdmin,
  loadUnifiedSeed: loadScheduledLessonUnifiedSeedAdmin,
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
    case "lesson_video":
      return "Видео";
    case "song":
    case "song_audio":
      return "Песня";
    case "song_video":
      return "Видео песни";
    case "worksheet":
    case "worksheet_pdf":
      return "Рабочая тетрадь";
    case "presentation":
      return "Презентация";
    case "flashcards_pdf":
      return "Карточки (PDF)";
    case "pronunciation_audio":
      return "Аудио произношения";
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
  const isMeaningful = (value: string) => {
    if (!value) return false;
    if (value === "…" || value === "...") return false;
    if (/^[,.;:!?\-\s]+$/.test(value)) return false;
    if (/^фраза\s+[.…]+$/i.test(value)) return false;
    if (/^фокус:\s*[,.\s]*$/i.test(value)) return false;
    if (/^карточки\s*[,.\s]*$/i.test(value)) return false;
    return true;
  };
  return Array.from(
    new Set(
      items
        .map((item) => item?.trim() ?? "")
        .filter((item) => isMeaningful(item)),
    ),
  );
}

function isWorldAroundMeLessonOne(
  projection: TeacherLessonProjection,
) {
  return (
    projection.methodologyShell.position.moduleIndex === 1 &&
    projection.methodologyShell.position.lessonIndex === 1
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
  const isLessonOne = isWorldAroundMeLessonOne(projection);
  const lessonEssence = isLessonOne
    ? "Первый урок знакомит детей с животными фермы через видео, карточки, движение, счёт, игрушечную ферму и песню. План следует методике: учитель ведёт детей от первых слов к коротким моделям 我是… / 这是… / 在…里."
    : projection.methodologyShell.vocabularySummary.slice(0, 4).join(" · ") ||
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

  const prepChecklist = isLessonOne
    ? [
        "Активность 1: герои курса",
        "Активность 3: герои курса",
        "Активность 4: карточки 狗，猫，兔子，马",
        "Активность 6: малярный скотч, карточки 狗，猫，兔子，马, мяч",
        "Активность 7: палочки для счета",
        "Активность 8: приложение 1, указка",
        "Активность 10: мягкие игрушки (собака, кот, кролик, лошадь)",
        "Активность 11: мягкие игрушки (собака, кот, кролик, лошадь)",
        "Активность 12: рабочая тетрадь",
        "Активность 13: карточка 农场",
        "Активность 14: игрушечная ферма",
        "Активность 16: герои курса",
      ]
    : normalizeItems([
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
      connection: buildLessonConnectionInfo(projection.runtimeShell, {
        onlineCtaLabel: "Открыть встречу",
        offlineDisplayPrefix: "Место: ",
      }),
    },
    quickSummary: {
      prepChecklist,
      keyWords: normalizeItems(projection.methodologyShell.vocabularySummary),
      keyPhrases: normalizeItems(projection.methodologyShell.phraseSummary),
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
  liveState?: ScheduledLessonLiveState;
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
  const presentation = buildPresentation({
    projection: sortedProjection,
    classDisplayName: input.classDisplayName ?? null,
    assetsById,
  });

  const unifiedReadModel = buildMethodologyLessonUnifiedReadModel({
    lessonId: input.sourceLesson.lessonId,
    lessonShell: sortedProjection.methodologyShell,
    presentation: {
      quickSummary: presentation.quickSummary,
      lessonFlow: presentation.lessonFlow,
    },
    studentContent: input.studentContent ?? null,
    assetsById,
    canonicalHomework: null,
  });
  const liveState =
    input.liveState ??
    ({
      runtimeStatus: sortedProjection.runtimeShell.runtimeStatus,
      currentStepId: sortedProjection.runtimeShell.runtimeCurrentStepId ?? null,
      currentStepOrder: sortedProjection.runtimeShell.runtimeCurrentStepOrder ?? null,
      studentNavigationLocked:
        sortedProjection.runtimeShell.runtimeStudentNavigationLocked ?? true,
      stepUpdatedAt: sortedProjection.runtimeShell.runtimeStepUpdatedAt ?? null,
      startedAt: sortedProjection.runtimeShell.runtimeStartedAt ?? null,
      completedAt: sortedProjection.runtimeShell.runtimeCompletedAt ?? null,
    } satisfies ScheduledLessonLiveState);
  const liveActiveStepId =
    resolveActiveLessonStep(unifiedReadModel.steps, liveState)?.id ?? null;

  return {
    scheduledLessonId: input.scheduledLessonId,
    classId: input.classId,
    classDisplayName: input.classDisplayName ?? null,
    sourceLesson: input.sourceLesson,
    projection: sortedProjection,
    presentation,
    unifiedReadModel,
    liveState,
    liveActiveStepId,
    homework: input.homework,
    studentContent: {
      source: input.studentContent ?? null,
      assetsById,
      unavailableReason: input.studentContentUnavailableReason ?? null,
    },
    communication: input.communication ?? {
      lessonScoped: [],
      homeworkScoped: [],
      homeworkAssignmentId: null,
    },
  };
}

export async function getTeacherLessonWorkspaceByScheduledLessonId(
  scheduledLessonId: string,
  deps: Partial<WorkspaceLoaderDeps> = {},
): Promise<TeacherLessonWorkspaceReadModel | null> {
  const runtimeDeps = { ...defaultWorkspaceLoaderDeps, ...deps };
  const scheduledLesson = await runtimeDeps.getScheduledLessonById(scheduledLessonId);
  if (!scheduledLesson) {
    return null;
  }

  const [seed, homework, lessonDiscussions, homeworkDiscussions] = await Promise.all([
    (deps.loadUnifiedSeed
      ? deps.loadUnifiedSeed(scheduledLessonId)
      : (async () => {
          const methodologyLesson = await runtimeDeps.getMethodologyLessonById(
            scheduledLesson.methodologyLessonId,
          );
          if (!methodologyLesson) return null;
          const projection = buildTeacherLessonProjection(
            methodologyLesson,
            scheduledLesson,
          );
          const coreAssetIds = Array.from(
            new Set(
              projection.orderedBlocks.flatMap((block) =>
                block.assetRefs.map((assetRef) => assetRef.id),
              ),
            ),
          );
          let studentContent: MethodologyLessonStudentContent | null = null;
          let studentContentAssets: ReusableAsset[] = [];
          let studentContentUnavailableReason:
            | "schema_missing"
            | "invalid_payload"
            | "load_failed"
            | null = null;
          if (runtimeDeps.getMethodologyLessonStudentContentByLessonId) {
            try {
              studentContent =
                await runtimeDeps.getMethodologyLessonStudentContentByLessonId(
                  methodologyLesson.id,
                );
              if (!studentContent) {
                const schemaReady =
                  (await runtimeDeps.isLessonStudentContentSchemaReady?.()) ?? true;
                if (!schemaReady) {
                  studentContentUnavailableReason = "schema_missing";
                }
              } else {
                const studentAssetIds = Array.from(
                  new Set(
                    studentContent.sections.flatMap((section) => {
                      if (section.type === "media_asset") return [section.assetId];
                      if (section.type === "worksheet" && section.assetId)
                        return [section.assetId];
                      if (section.type === "presentation") return [section.assetId];
                      if (section.type === "count_board" && section.assetId)
                        return [section.assetId];
                      return [];
                    }),
                  ),
                ).filter((id): id is string => Boolean(id));
                studentContentAssets = studentAssetIds.length
                  ? await runtimeDeps.listReusableAssetsByIds(studentAssetIds)
                  : [];
              }
            } catch {
              studentContent = null;
              studentContentAssets = [];
              studentContentUnavailableReason = "load_failed";
            }
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
          return {
            scheduledLesson,
            methodologyLesson,
            projection,
            sourceLesson: {
              methodologySlug: methodologyLesson.methodologySlug,
              lessonId: methodologyLesson.id,
              methodologyTitle: projection.methodologyTitle?.trim() || "Методика",
              lessonTitle: methodologyLesson.shell.title,
            },
            classDisplayName: await runtimeDeps.getClassDisplayNameById(
              scheduledLesson.runtimeShell.classId,
            ),
            coreAssets: coreAssetIds.length
              ? await runtimeDeps.listReusableAssetsByIds(coreAssetIds)
              : [],
            studentContent,
            studentContentAssets,
            studentContentUnavailableReason,
            liveState: mapScheduledLessonLiveState(scheduledLesson),
          };
        })()),
    runtimeDeps.getHomeworkReadModel(scheduledLessonId),
    runtimeDeps
      .getLessonDiscussions({
        classId: scheduledLesson.runtimeShell.classId,
        scheduledLessonId: scheduledLesson.id,
      })
      .catch(() => []),
    runtimeDeps
      .getHomeworkDiscussions({
        classId: scheduledLesson.runtimeShell.classId,
        scheduledLessonId: scheduledLesson.id,
      })
      .catch(() => ({ assignmentId: null, items: [] })),
  ]);
  if (!seed) {
    return null;
  }

  return buildTeacherLessonWorkspaceReadModel({
    projection: seed.projection,
    scheduledLessonId: seed.scheduledLesson.id,
    classId: seed.scheduledLesson.runtimeShell.classId,
    classDisplayName: seed.classDisplayName,
    sourceLesson: seed.sourceLesson,
    assets: seed.coreAssets,
    studentContentAssets: seed.studentContentAssets,
    homework,
    studentContent: seed.studentContent,
    liveState: seed.liveState,
    studentContentUnavailableReason: seed.studentContentUnavailableReason,
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
