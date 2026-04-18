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

const worldAroundMeLessonOneTitles = [
  "Приветствие",
  "Видео: farm animals",
  "Фраза 我是…",
  "Карточки животных",
  "Изображаем животных",
  "Игра с карточками и мячом",
  "Счётные палочки",
  "Приложение 1: считаем и называем",
  "Глаголы 跑 и 跳",
  "Бежим и прыгаем к животным",
  "Что делает животное?",
  "Рабочая тетрадь, стр. 3–4",
  "Слово 农场",
  "Кто живёт на ферме",
  "Песня: farm animals",
  "Прощание",
] as const;

const lessonOneSectionByStep: Record<number, string[]> = {
  1: ["lesson_focus"],
  2: ["media_asset", "presentation"],
  3: ["phrase_cards"],
  4: ["vocabulary_cards"],
  5: ["action_cards"],
  6: ["matching_practice"],
  7: ["count_board"],
  8: ["count_board"],
  9: ["action_cards"],
  10: ["action_cards"],
  11: ["phrase_cards"],
  12: ["worksheet"],
  13: ["word_list"],
  14: ["farm_placement"],
  15: ["media_asset", "resource_links"],
  16: ["recap", "word_list"],
};

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

function sectionsForStep(input: {
  lessonShell: MethodologyLessonShell;
  order: number;
  studentContent: MethodologyLessonStudentContent | null;
  usedSectionKeys: Set<string>;
}): MethodologyLessonStudentContentSection[] {
  const { lessonShell, order, studentContent, usedSectionKeys } = input;
  if (!studentContent) return [];

  const isLessonOne = lessonShell.position.moduleIndex === 1 && lessonShell.position.lessonIndex === 1;
  if (isLessonOne) {
    const preferredTypes = lessonOneSectionByStep[order] ?? [];
    const selected = studentContent.sections.filter((section, index) => {
      const key = `${section.type}-${section.title}-${index}`;
      if (usedSectionKeys.has(key)) return false;
      return preferredTypes.includes(section.type);
    });
    if (selected.length > 0) {
      selected.forEach((section, index) => usedSectionKeys.add(`${section.type}-${section.title}-${studentContent.sections.indexOf(section) + index}`));
      return selected;
    }
  }

  const section = studentContent.sections.find((candidate, index) => {
    const key = `${candidate.type}-${candidate.title}-${index}`;
    if (usedSectionKeys.has(key)) return false;
    return true;
  });

  if (!section) return [];
  const index = studentContent.sections.indexOf(section);
  usedSectionKeys.add(`${section.type}-${section.title}-${index}`);
  return [section];
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
  const isLessonOne = input.lessonShell.position.moduleIndex === 1 && input.lessonShell.position.lessonIndex === 1;
  const usedSectionKeys = new Set<string>();

  const steps: MethodologyLessonStep[] = filteredFlow.map((step, index) => {
    const order = index + 1;
    const sections = sectionsForStep({
      lessonShell: input.lessonShell,
      order,
      studentContent: input.studentContent,
      usedSectionKeys,
    });

    const screenType = screenTypeFromSections(sections);
    const firstSection = sections[0];
    const resourceIds = Array.from(new Set([
      ...step.resources.map((resource) => {
        const match = Object.values(input.assetsById).find((asset) => asset.title === resource.title);
        return match?.id;
      }),
      ...sections.flatMap(collectSectionAssetIds),
    ].filter((id): id is string => Boolean(id))));

    return {
      id: step.id,
      order,
      title: isLessonOne ? worldAroundMeLessonOneTitles[index] : step.title,
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
        title: isLessonOne ? worldAroundMeLessonOneTitles[index] : step.title,
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
