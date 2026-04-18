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

type LessonOneStepConfig = {
  title: string;
  preferredSectionTypes: MethodologyLessonStudentContentSection["type"][];
  explicitResourceIds?: string[];
};

const worldAroundMeLessonOneConfig: LessonOneStepConfig[] = [
  { title: "Приветствие", preferredSectionTypes: ["lesson_focus"] },
  { title: "Видео: farm animals", preferredSectionTypes: ["media_asset", "presentation"], explicitResourceIds: ["video:farm-animals"] },
  { title: "Фраза 我是…", preferredSectionTypes: ["phrase_cards"] },
  { title: "Карточки животных", preferredSectionTypes: ["vocabulary_cards"], explicitResourceIds: ["flashcards:world-around-me-lesson-1"] },
  { title: "Изображаем животных", preferredSectionTypes: ["action_cards"] },
  { title: "Игра с карточками и мячом", preferredSectionTypes: ["matching_practice"] },
  { title: "Счётные палочки", preferredSectionTypes: ["count_board"] },
  { title: "Приложение 1: считаем и называем", preferredSectionTypes: ["count_board"], explicitResourceIds: ["worksheet:appendix-1"] },
  { title: "Глаголы 跑 и 跳", preferredSectionTypes: ["action_cards"] },
  { title: "Бежим и прыгаем к животным", preferredSectionTypes: ["action_cards"] },
  { title: "Что делает животное?", preferredSectionTypes: ["phrase_cards"] },
  { title: "Рабочая тетрадь, стр. 3–4", preferredSectionTypes: ["worksheet"], explicitResourceIds: ["worksheet:workbook-pages-3-4"] },
  { title: "Слово 农场", preferredSectionTypes: ["word_list"] },
  { title: "Кто живёт на ферме", preferredSectionTypes: ["farm_placement"] },
  { title: "Песня: farm animals", preferredSectionTypes: ["media_asset", "resource_links"], explicitResourceIds: ["song:farm-animals"] },
  { title: "Прощание", preferredSectionTypes: ["recap", "word_list"] },
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
  if (!section) return "Инструкция для ученика появится позже.";
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
    return section.resources.map((resource) => resource.assetId).filter((id): id is string => Boolean(id));
  }
  return [];
}

function makeSectionSelectionKey(section: MethodologyLessonStudentContentSection, index: number) {
  return `${section.type}-${section.title}-${index}`;
}

function selectSectionsByTypes(input: {
  source: MethodologyLessonStudentContent;
  preferredTypes: MethodologyLessonStudentContentSection["type"][];
  usedSectionKeys: Set<string>;
}) {
  const { source, preferredTypes, usedSectionKeys } = input;
  const selected: MethodologyLessonStudentContentSection[] = [];

  source.sections.forEach((section, index) => {
    const key = makeSectionSelectionKey(section, index);
    if (usedSectionKeys.has(key)) return;
    if (!preferredTypes.includes(section.type)) return;
    usedSectionKeys.add(key);
    selected.push(section);
  });

  return selected;
}

function selectFirstUnassignedSection(source: MethodologyLessonStudentContent, usedSectionKeys: Set<string>) {
  for (const [index, section] of source.sections.entries()) {
    const key = makeSectionSelectionKey(section, index);
    if (usedSectionKeys.has(key)) continue;
    usedSectionKeys.add(key);
    return section;
  }
  return null;
}

function resolveLegacyResourceIdsByTitle(input: {
  step: TeacherLessonWorkspacePresentation["lessonFlow"][number];
  assetsById: Record<string, ReusableAsset>;
}) {
  // Legacy fallback for non-normalized lessons where only display title is available in step.resources.
  return input.step.resources
    .map((resource) => Object.values(input.assetsById).find((asset) => asset.title === resource.title)?.id)
    .filter((id): id is string => Boolean(id));
}

function normalizeWorldAroundMeLessonOneStep(input: {
  order: number;
  source: MethodologyLessonStudentContent | null;
  usedSectionKeys: Set<string>;
}) {
  const config = worldAroundMeLessonOneConfig[input.order - 1];
  if (!config) {
    return {
      normalizedTitle: null,
      sections: [] as MethodologyLessonStudentContentSection[],
      explicitResourceIds: [] as string[],
    };
  }

  if (!input.source) {
    return {
      normalizedTitle: config.title,
      sections: [] as MethodologyLessonStudentContentSection[],
      explicitResourceIds: config.explicitResourceIds ?? [],
    };
  }

  const sections = selectSectionsByTypes({
    source: input.source,
    preferredTypes: config.preferredSectionTypes,
    usedSectionKeys: input.usedSectionKeys,
  });

  return {
    normalizedTitle: config.title,
    sections,
    explicitResourceIds: config.explicitResourceIds ?? [],
  };
}

function resolveStepSections(input: {
  lessonShell: MethodologyLessonShell;
  order: number;
  source: MethodologyLessonStudentContent | null;
  usedSectionKeys: Set<string>;
}) {
  if (!input.source) return { sections: [] as MethodologyLessonStudentContentSection[], normalizedTitle: null as string | null, explicitResourceIds: [] as string[] };

  if (isWorldAroundMeLessonOne(input.lessonShell)) {
    return normalizeWorldAroundMeLessonOneStep({
      order: input.order,
      source: input.source,
      usedSectionKeys: input.usedSectionKeys,
    });
  }

  const firstUnassigned = selectFirstUnassignedSection(input.source, input.usedSectionKeys);
  return {
    sections: firstUnassigned ? [firstUnassigned] : [],
    normalizedTitle: null,
    explicitResourceIds: [],
  };
}

export function buildMethodologyLessonUnifiedReadModel(input: {
  lessonId: string;
  lessonShell: MethodologyLessonShell;
  presentation: Pick<TeacherLessonWorkspacePresentation, "quickSummary" | "lessonFlow">;
  studentContent: MethodologyLessonStudentContent | null;
  assetsById: Record<string, ReusableAsset>;
  canonicalHomework: MethodologyLessonHomeworkDefinition | null;
}): MethodologyLessonUnifiedReadModel {
  const filteredFlow = input.presentation.lessonFlow.filter((step) => step.order <= 16);
  const usedSectionKeys = new Set<string>();

  const steps: MethodologyLessonStep[] = filteredFlow.map((step, index) => {
    const order = index + 1;
    const { sections, normalizedTitle, explicitResourceIds } = resolveStepSections({
      lessonShell: input.lessonShell,
      order,
      source: input.studentContent,
      usedSectionKeys,
    });

    const screenType = screenTypeFromSections(sections);
    const firstSection = sections[0];
    const sectionAssetIds = sections.flatMap(collectSectionAssetIds);
    const legacyStepResourceIds = sectionAssetIds.length > 0 ? [] : resolveLegacyResourceIdsByTitle({ step, assetsById: input.assetsById });

    const resourceIds = Array.from(new Set([
      ...sectionAssetIds,
      ...explicitResourceIds,
      ...legacyStepResourceIds,
    ]));

    const title = normalizedTitle ?? step.title;

    return {
      id: step.id,
      order,
      title,
      phase: stepPhase(order),
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
        notes: [step.pedagogicalDetails?.fallbackRu, step.pedagogicalDetails?.homeExtension, step.pedagogicalDetails?.exitCheck].filter((item): item is string => Boolean(item)),
      },
      student: {
        screenType,
        title,
        instruction: instructionFromSection(firstSection),
        assetIds: resourceIds,
        payload: sections.length
          ? {
              sections,
              chips: firstSection?.type === "lesson_focus" ? firstSection.chips : undefined,
            }
          : undefined,
        allowStudentInteraction: screenType !== "placeholder",
      },
    };
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
