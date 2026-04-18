import type {
  MethodologyLessonHomeworkDefinition,
  MethodologyLessonShell,
  MethodologyLessonStudentContent,
  MethodologyLessonStudentContentSection,
  ReusableAsset,
} from "@/lib/lesson-content";
import type { TeacherLessonWorkspacePresentation } from "@/lib/server/teacher-lesson-workspace";

export type MethodologyLessonStep = {
  id: string;
  order: number;
  title: string;
  phase?: "opening" | "language_input" | "active_practice" | "consolidation" | "closure";
  durationMinutes?: number | null;
  resourceIds?: string[];
  teacher: {
    goal?: string | null;
    description?: string | null;
    teacherActions: string[];
    studentActions: string[];
    teacherScript?: string[];
    expectedResponses?: string[];
    materials: string[];
    successCriteria?: string[];
    notes?: string[];
  };
  student: {
    screenType:
      | "intro"
      | "video"
      | "presentation"
      | "flashcards"
      | "phrase_practice"
      | "counting"
      | "movement"
      | "worksheet"
      | "farm_placement"
      | "song"
      | "placeholder";
    title: string;
    instruction?: string;
    assetIds?: string[];
    payload?: {
      sections?: MethodologyLessonStudentContentSection[];
      chips?: string[];
    };
    allowStudentInteraction?: boolean;
  };
};

export type MethodologyLessonUnifiedReadModel = {
  lesson: {
    id: string;
    title: string;
    durationMinutes: number;
    durationLabel: string;
  };
  quickSummary: TeacherLessonWorkspacePresentation["quickSummary"];
  steps: MethodologyLessonStep[];
  assetsById: Record<string, ReusableAsset>;
  canonicalHomework: MethodologyLessonHomeworkDefinition | null;
};

type LessonFlowStep = TeacherLessonWorkspacePresentation["lessonFlow"][number];

type WorldAroundMeLessonOneCanonicalStep = {
  order: number;
  title: string;
  teacherFlowOrder: number;
  studentInstruction: string;
  selectSection?: (section: MethodologyLessonStudentContentSection) => boolean;
  explicitResourceIds?: string[];
  transformSelectedSection?: (section: MethodologyLessonStudentContentSection) => MethodologyLessonStudentContentSection;
};

const worldAroundMeLessonOneCanonicalSteps: WorldAroundMeLessonOneCanonicalStep[] = [
  {
    order: 1,
    title: "Приветствие",
    teacherFlowOrder: 1,
    studentInstruction: "Поздоровайся с преподавателем и героями урока.",
    selectSection: (section) => section.sceneId === "scene-hero" && section.type === "lesson_focus",
  },
  {
    order: 2,
    title: "Видео: farm animals",
    teacherFlowOrder: 2,
    studentInstruction: "Посмотри видео и повтори названия животных.",
    selectSection: (section) => section.sceneId === "scene-presentation" && section.type === "presentation",
    explicitResourceIds: ["video:farm-animals", "presentation:world-around-me-lesson-1"],
  },
  {
    order: 3,
    title: "Фраза 我是…",
    teacherFlowOrder: 3,
    studentInstruction: "Повтори фразу 我是… и назови себя или героя.",
    selectSection: (section) => section.sceneId === "scene-phrases" && section.type === "phrase_cards",
  },
  {
    order: 4,
    title: "Карточки животных",
    teacherFlowOrder: 4,
    studentInstruction: "Посмотри карточки животных и повтори слова.",
    selectSection: (section) => section.sceneId === "scene-flashcards" && section.type === "vocabulary_cards",
    explicitResourceIds: ["flashcards:world-around-me-lesson-1"],
  },
  {
    order: 5,
    title: "Изображаем животных",
    teacherFlowOrder: 5,
    studentInstruction: "Изобрази животное по команде преподавателя.",
  },
  {
    order: 6,
    title: "Игра с карточками и мячом",
    teacherFlowOrder: 6,
    studentInstruction: "Слушай команду и выбери нужную карточку.",
    selectSection: (section) => section.sceneId === "scene-homework-practice" && section.type === "matching_practice",
  },
  {
    order: 7,
    title: "Счётные палочки",
    teacherFlowOrder: 7,
    studentInstruction: "Считай до пяти вместе с преподавателем.",
  },
  {
    order: 8,
    title: "Приложение 1: считаем и называем",
    teacherFlowOrder: 8,
    studentInstruction: "Покажи и посчитай животных в Приложении 1.",
    selectSection: (section) => section.sceneId === "scene-counting" && section.type === "count_board",
    explicitResourceIds: ["worksheet:appendix-1"],
  },
  {
    order: 9,
    title: "Глаголы 跑 и 跳",
    teacherFlowOrder: 9,
    studentInstruction: "Повтори команды с глаголами 跑 и 跳.",
    selectSection: (section) => section.sceneId === "scene-actions" && section.type === "action_cards",
  },
  {
    order: 10,
    title: "Бежим и прыгаем к животным",
    teacherFlowOrder: 10,
    studentInstruction: "Выполни движение по команде преподавателя.",
  },
  {
    order: 11,
    title: "Что делает животное?",
    teacherFlowOrder: 11,
    studentInstruction: "Ответь, что делает животное.",
  },
  {
    order: 12,
    title: "Рабочая тетрадь, стр. 3–4",
    teacherFlowOrder: 12,
    studentInstruction: "Открой рабочую тетрадь на стр. 3–4.",
    selectSection: (section) => section.sceneId === "scene-materials" && section.type === "worksheet",
    explicitResourceIds: ["worksheet:workbook-pages-3-4"],
  },
  {
    order: 13,
    title: "Слово 农场",
    teacherFlowOrder: 13,
    studentInstruction: "Повтори слово 农场 и найди его в словаре урока.",
    selectSection: (section) => section.sceneId === "scene-review" && section.type === "word_list",
  },
  {
    order: 14,
    title: "Кто живёт на ферме",
    teacherFlowOrder: 14,
    studentInstruction: "Скажи, кто живёт на ферме.",
    selectSection: (section) => section.sceneId === "scene-farm" && section.type === "farm_placement",
  },
  {
    order: 15,
    title: "Песня: farm animals",
    teacherFlowOrder: 15,
    studentInstruction: "Послушай и спой песню про животных фермы.",
    selectSection: (section) => section.sceneId === "scene-materials" && section.type === "resource_links",
    explicitResourceIds: ["song:farm-animals"],
    transformSelectedSection: (section) => {
      if (section.type !== "resource_links") return section;
      return {
        ...section,
        resources: section.resources.filter((resource) => resource.assetId === "song:farm-animals"),
      };
    },
  },
  {
    order: 16,
    title: "Прощание",
    teacherFlowOrder: 16,
    studentInstruction: "Попрощайся и повтори слова урока.",
    selectSection: (section) => section.sceneId === "scene-review" && section.type === "recap",
  },
];

function isWorldAroundMeLessonOne(lessonShell: MethodologyLessonShell) {
  return lessonShell.position.moduleIndex === 1 && lessonShell.position.lessonIndex === 1;
}

function stepPhase(order: number): MethodologyLessonStep["phase"] {
  if (order <= 2) return "opening";
  if (order <= 4) return "language_input";
  if (order <= 11) return "active_practice";
  if (order <= 14) return "consolidation";
  return "closure";
}

function screenTypeFromSections(sections: MethodologyLessonStudentContentSection[]) {
  const types = new Set(sections.map((section) => section.type));
  if (types.has("media_asset")) return "video" as const;
  if (types.has("presentation")) return "presentation" as const;
  if (types.has("vocabulary_cards")) return "flashcards" as const;
  if (types.has("phrase_cards")) return "phrase_practice" as const;
  if (types.has("count_board")) return "counting" as const;
  if (types.has("action_cards") || types.has("matching_practice")) return "movement" as const;
  if (types.has("worksheet")) return "worksheet" as const;
  if (types.has("farm_placement")) return "farm_placement" as const;
  if (types.has("lesson_focus")) return "intro" as const;
  if (types.has("resource_links")) return "song" as const;
  return "placeholder" as const;
}

function instructionFromSection(section?: MethodologyLessonStudentContentSection): string {
  if (!section) return "Следуйте инструкции преподавателя.";
  if (section.type === "lesson_focus") return section.body;
  if (section.type === "media_asset") return section.studentPrompt;
  if (section.type === "count_board") return section.prompt;
  if (section.type === "matching_practice") return section.prompt;
  if (section.type === "worksheet") return section.instructions;
  if (section.subtitle) return section.subtitle;
  return "Следуйте инструкции преподавателя.";
}

function collectSectionAssetIds(section: MethodologyLessonStudentContentSection): string[] {
  if (section.type === "media_asset") return [section.assetId];
  if (section.type === "presentation") return [section.assetId];
  if (section.type === "worksheet" && section.assetId) return [section.assetId];
  if (section.type === "count_board" && section.assetId) return [section.assetId];
  if (section.type === "resource_links") {
    return section.resources
      .map((resource) => resource.assetId)
      .filter((id): id is string => Boolean(id));
  }
  return [];
}

function makeSectionSelectionKey(section: MethodologyLessonStudentContentSection, index: number) {
  if (section.sceneId?.trim()) {
    return `${section.sceneId.trim()}::${section.type}::${section.title}`;
  }
  return `idx:${index}`;
}

function findAndClaimSection(input: {
  source: MethodologyLessonStudentContent | null;
  usedSectionKeys: Set<string>;
  predicate: (section: MethodologyLessonStudentContentSection) => boolean;
  transform?: (section: MethodologyLessonStudentContentSection) => MethodologyLessonStudentContentSection;
}) {
  if (!input.source) return null;
  for (const [index, section] of input.source.sections.entries()) {
    const key = makeSectionSelectionKey(section, index);
    if (input.usedSectionKeys.has(key)) continue;
    if (!input.predicate(section)) continue;
    input.usedSectionKeys.add(key);
    return input.transform ? input.transform(section) : section;
  }
  return null;
}

function resolveLegacyResourceIdsByTitle(input: {
  step: LessonFlowStep;
  assetsById: Record<string, ReusableAsset>;
}) {
  // Legacy fallback for non-normalized lessons where only display title is available in step.resources.
  return input.step.resources
    .map((resource) =>
      Object.values(input.assetsById).find((asset) => asset.title === resource.title)
        ?.id,
    )
    .filter((id): id is string => Boolean(id));
}

function buildTeacherSideForCanonicalStep(input: {
  canonicalStep: WorldAroundMeLessonOneCanonicalStep;
  lessonFlow: LessonFlowStep[];
}) {
  const matched = input.lessonFlow.find(
    (step) =>
      step.order === input.canonicalStep.teacherFlowOrder &&
      !step.blockLabel.toLowerCase().includes("подготов"),
  );

  if (!matched) {
    return {
      goal: null,
      description: "Шаг ведётся по каноническому сценарию методики.",
      teacherActions: [],
      studentActions: [],
      teacherScript: undefined,
      expectedResponses: undefined,
      materials: [],
      successCriteria: undefined,
      notes: ["Педагогические детали будут уточнены в source-плане."],
    } satisfies MethodologyLessonStep["teacher"];
  }

  return {
    goal: matched.description ?? null,
    description: matched.description ?? null,
    teacherActions: matched.teacherActions,
    studentActions: matched.studentActions,
    expectedResponses: matched.pedagogicalDetails?.expectedStudentResponses,
    teacherScript: matched.pedagogicalDetails?.promptPatterns,
    materials: matched.materials,
    successCriteria: matched.pedagogicalDetails?.successCriteria,
    notes: [
      matched.pedagogicalDetails?.fallbackRu,
      matched.pedagogicalDetails?.homeExtension,
      matched.pedagogicalDetails?.exitCheck,
    ].filter((item): item is string => Boolean(item)),
  } satisfies MethodologyLessonStep["teacher"];
}

function buildWorldAroundMeLessonOneSteps(input: {
  lessonFlow: LessonFlowStep[];
  studentContent: MethodologyLessonStudentContent | null;
  usedSectionKeys: Set<string>;
  assetsById: Record<string, ReusableAsset>;
}) {
  return worldAroundMeLessonOneCanonicalSteps.map((canonicalStep) => {
    const selectedSection = canonicalStep.selectSection
      ? findAndClaimSection({
          source: input.studentContent,
          usedSectionKeys: input.usedSectionKeys,
          predicate: canonicalStep.selectSection,
          transform: canonicalStep.transformSelectedSection,
        })
      : null;

    const sections = selectedSection ? [selectedSection] : [];
    const sectionAssetIds = sections.flatMap(collectSectionAssetIds);

    const resourceIds = Array.from(
      new Set([...(canonicalStep.explicitResourceIds ?? []), ...sectionAssetIds]),
    );

    const teacher = buildTeacherSideForCanonicalStep({
      canonicalStep,
      lessonFlow: input.lessonFlow,
    });

    const studentInstruction =
      sections.length > 0
        ? instructionFromSection(sections[0])
        : canonicalStep.studentInstruction;

    const screenType =
      canonicalStep.order === 15
        ? "song"
        : screenTypeFromSections(sections);

    return {
      id: `canonical-world-around-me-lesson-1-step-${canonicalStep.order}`,
      order: canonicalStep.order,
      title: canonicalStep.title,
      phase: stepPhase(canonicalStep.order),
      durationMinutes: null,
      resourceIds,
      teacher,
      student: {
        screenType,
        title: canonicalStep.title,
        instruction: studentInstruction,
        assetIds: resourceIds,
        payload: sections.length
          ? {
              sections,
              chips:
                sections[0]?.type === "lesson_focus" ? sections[0].chips : undefined,
            }
          : undefined,
        allowStudentInteraction: screenType !== "placeholder",
      },
    } satisfies MethodologyLessonStep;
  });
}

function buildGenericUnifiedSteps(input: {
  lessonFlow: LessonFlowStep[];
  studentContent: MethodologyLessonStudentContent | null;
  assetsById: Record<string, ReusableAsset>;
}) {
  const usedSectionKeys = new Set<string>();

  return input.lessonFlow
    .filter((step) => !step.blockLabel.toLowerCase().includes("подготов"))
    .map((step, index) => {
      const section = findAndClaimSection({
        source: input.studentContent,
        usedSectionKeys,
        predicate: () => true,
      });

      const sections = section ? [section] : [];
      const sectionAssetIds = sections.flatMap(collectSectionAssetIds);
      const legacyResourceIds =
        sectionAssetIds.length > 0
          ? []
          : resolveLegacyResourceIdsByTitle({ step, assetsById: input.assetsById });

      const resourceIds = Array.from(new Set([...sectionAssetIds, ...legacyResourceIds]));

      return {
        id: step.id,
        order: index + 1,
        title: step.title,
        phase: stepPhase(index + 1),
        durationMinutes: null,
        resourceIds,
        teacher: {
          goal: step.description ?? null,
          description: step.description ?? null,
          teacherActions: step.teacherActions,
          studentActions: step.studentActions,
          expectedResponses: step.pedagogicalDetails?.expectedStudentResponses,
          teacherScript: step.pedagogicalDetails?.promptPatterns,
          materials: step.materials,
          successCriteria: step.pedagogicalDetails?.successCriteria,
          notes: [
            step.pedagogicalDetails?.fallbackRu,
            step.pedagogicalDetails?.homeExtension,
            step.pedagogicalDetails?.exitCheck,
          ].filter((item): item is string => Boolean(item)),
        },
        student: {
          screenType: screenTypeFromSections(sections),
          title: step.title,
          instruction: instructionFromSection(sections[0]),
          assetIds: resourceIds,
          payload: sections.length ? { sections } : undefined,
          allowStudentInteraction: screenTypeFromSections(sections) !== "placeholder",
        },
      } satisfies MethodologyLessonStep;
    });
}

export function buildMethodologyLessonUnifiedReadModel(input: {
  lessonId: string;
  lessonShell: MethodologyLessonShell;
  presentation: Pick<
    TeacherLessonWorkspacePresentation,
    "quickSummary" | "lessonFlow"
  >;
  studentContent: MethodologyLessonStudentContent | null;
  assetsById: Record<string, ReusableAsset>;
  canonicalHomework: MethodologyLessonHomeworkDefinition | null;
}): MethodologyLessonUnifiedReadModel {
  const baseLessonFlow = input.presentation.lessonFlow.filter(
    (step) => !step.blockLabel.toLowerCase().includes("подготов"),
  );

  const steps = isWorldAroundMeLessonOne(input.lessonShell)
    ? buildWorldAroundMeLessonOneSteps({
        lessonFlow: baseLessonFlow,
        studentContent: input.studentContent,
        usedSectionKeys: new Set<string>(),
        assetsById: input.assetsById,
      })
    : buildGenericUnifiedSteps({
        lessonFlow: baseLessonFlow,
        studentContent: input.studentContent,
        assetsById: input.assetsById,
      });

  return {
    lesson: {
      id: input.lessonId,
      title: input.lessonShell.title,
      durationMinutes: input.lessonShell.estimatedDurationMinutes,
      durationLabel: `${input.lessonShell.estimatedDurationMinutes} мин`,
    },
    quickSummary: input.presentation.quickSummary,
    steps,
    assetsById: input.assetsById,
    canonicalHomework: input.canonicalHomework,
  };
}
