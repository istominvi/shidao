import type { MethodologyLessonHomeworkDefinition } from "@/lib/lesson-content";

export type QuizSingleChoiceOption = {
  id: string;
  label: string;
  description?: string;
  illustrationSrc?: string;
  displayStyle?: "word" | "meaning" | "image" | "mixed";
};

export type QuizSingleChoiceQuestion = {
  id: string;
  title?: string;
  prompt: string;
  helperText?: string;
  illustrationSrc?: string;
  tone?: "sky" | "violet" | "emerald" | "amber" | "rose" | "neutral";
  skillTag?: string;
  sceneLabel?: string;
  options: QuizSingleChoiceOption[];
  correctOptionId: string;
};

export type QuizSingleChoicePayload = {
  id: string;
  version: number;
  title?: string;
  subtitle?: string;
  introText?: string;
  completionTitle?: string;
  completionText?: string;
  illustrationSrc?: string;
  tone?: "sky" | "violet" | "emerald" | "amber" | "rose" | "neutral";
  practiceSections?: QuizPracticeSection[];
  questions: QuizSingleChoiceQuestion[];
};

export type QuizPracticeSection =
  | {
      id: string;
      type: "matching";
      title: string;
      prompt: string;
      items: Array<{
        id: string;
        label: string;
        illustrationSrc?: string;
      }>;
    }
  | {
      id: string;
      type: "audio_review";
      title: string;
      groups: Array<{
        id: string;
        title: string;
        entries: Array<{
          id: string;
          hanzi: string;
          pinyin?: string;
          meaning: string;
          audioAssetId?: string;
          audioUrl?: string;
        }>;
      }>;
    };

export type QuizSubmissionPayload = {
  answers: Array<{
    questionId: string;
    selectedOptionId: string;
  }>;
};

export type QuizGradeResult = {
  score: number;
  maxScore: number;
  answers: Array<{
    questionId: string;
    selectedOptionId: string;
    correctOptionId: string;
    isCorrect: boolean;
  }>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function cleanTone(value: unknown): QuizSingleChoicePayload["tone"] {
  if (
    value === "sky" ||
    value === "violet" ||
    value === "emerald" ||
    value === "amber" ||
    value === "rose" ||
    value === "neutral"
  ) {
    return value;
  }
  return undefined;
}

function cleanDisplayStyle(value: unknown): QuizSingleChoiceOption["displayStyle"] {
  if (value === "word" || value === "meaning" || value === "image" || value === "mixed") {
    return value;
  }
  return undefined;
}

function normalizeQuestion(input: unknown): QuizSingleChoiceQuestion | null {
  if (!isObject(input)) return null;
  const id = `${input.id ?? ""}`.trim();
  const prompt = `${input.prompt ?? ""}`.trim();
  const correctOptionId = `${input.correctOptionId ?? ""}`.trim();
  const optionsRaw = Array.isArray(input.options) ? input.options : [];
  const options = optionsRaw.flatMap((option): QuizSingleChoiceOption[] => {
    if (!isObject(option)) return [];
    const optionId = `${option.id ?? ""}`.trim();
    const label = `${option.label ?? ""}`.trim();
    if (!optionId || !label) return [];
    return [
      {
        id: optionId,
        label,
        description: cleanText(option.description),
        illustrationSrc: cleanText(option.illustrationSrc),
        displayStyle: cleanDisplayStyle(option.displayStyle),
      },
    ];
  });

  if (!id || !prompt || !correctOptionId || options.length < 2) return null;
  if (!options.some((option) => option.id === correctOptionId)) return null;

  return {
    id,
    title: cleanText(input.title),
    prompt,
    helperText: cleanText(input.helperText),
    illustrationSrc: cleanText(input.illustrationSrc),
    tone: cleanTone(input.tone),
    skillTag: cleanText(input.skillTag),
    sceneLabel: cleanText(input.sceneLabel),
    options,
    correctOptionId,
  };
}

function normalizePracticeSections(input: unknown): QuizPracticeSection[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const sections = input.flatMap((section): QuizPracticeSection[] => {
    if (!isObject(section)) return [];
    const id = `${section.id ?? ""}`.trim();
    const type = `${section.type ?? ""}`.trim();
    const title = `${section.title ?? ""}`.trim();
    if (!id || !title) return [];

    if (type === "matching") {
      const prompt = `${section.prompt ?? ""}`.trim();
      const itemsRaw = Array.isArray(section.items) ? section.items : [];
      const items = itemsRaw.flatMap((item) => {
        if (!isObject(item)) return [];
        const itemId = `${item.id ?? ""}`.trim();
        const label = `${item.label ?? ""}`.trim();
        if (!itemId || !label) return [];
        return [{ id: itemId, label, illustrationSrc: cleanText(item.illustrationSrc) }];
      });
      if (!prompt || items.length < 2) return [];
      return [{ id, type: "matching", title, prompt, items }];
    }

    if (type === "audio_review") {
      const groupsRaw = Array.isArray(section.groups) ? section.groups : [];
      const groups = groupsRaw.flatMap((group) => {
        if (!isObject(group)) return [];
        const groupId = `${group.id ?? ""}`.trim();
        const groupTitle = `${group.title ?? ""}`.trim();
        const entriesRaw = Array.isArray(group.entries) ? group.entries : [];
        const entries = entriesRaw.flatMap((entry) => {
          if (!isObject(entry)) return [];
          const entryId = `${entry.id ?? ""}`.trim();
          const hanzi = `${entry.hanzi ?? ""}`.trim();
          const meaning = `${entry.meaning ?? ""}`.trim();
          if (!entryId || !hanzi || !meaning) return [];
          return [{
            id: entryId,
            hanzi,
            meaning,
            pinyin: cleanText(entry.pinyin),
            audioAssetId: cleanText(entry.audioAssetId),
            audioUrl: cleanText(entry.audioUrl),
          }];
        });
        if (!groupId || !groupTitle || entries.length === 0) return [];
        return [{ id: groupId, title: groupTitle, entries }];
      });
      if (groups.length === 0) return [];
      return [{ id, type: "audio_review", title, groups }];
    }

    return [];
  });

  return sections.length ? sections : undefined;
}

export function normalizeQuizSingleChoicePayload(input: unknown): QuizSingleChoicePayload | null {
  if (!isObject(input)) return null;

  const id = `${input.id ?? ""}`.trim();
  const versionRaw = Number(input.version);
  const questionsRaw = Array.isArray(input.questions) ? input.questions : [];
  const questions = questionsRaw
    .map((question) => normalizeQuestion(question))
    .filter((item): item is QuizSingleChoiceQuestion => Boolean(item));

  if (!id || !Number.isFinite(versionRaw) || versionRaw <= 0 || questions.length === 0) {
    return null;
  }

  const uniqueQuestionIds = new Set<string>();
  for (const question of questions) {
    if (uniqueQuestionIds.has(question.id)) return null;
    uniqueQuestionIds.add(question.id);
  }

  return {
    id,
    version: Math.floor(versionRaw),
    title: cleanText(input.title),
    subtitle: cleanText(input.subtitle),
    introText: cleanText(input.introText),
    completionTitle: cleanText(input.completionTitle),
    completionText: cleanText(input.completionText),
    illustrationSrc: cleanText(input.illustrationSrc),
    tone: cleanTone(input.tone),
    practiceSections: normalizePracticeSections(input.practiceSections),
    questions,
  };
}

export function normalizeQuizSubmissionPayload(input: unknown): QuizSubmissionPayload | null {
  if (!isObject(input)) return null;
  const answersRaw = Array.isArray(input.answers) ? input.answers : [];

  const answers = answersRaw
    .map((answer) => {
      if (!isObject(answer)) return null;
      const questionId = `${answer.questionId ?? ""}`.trim();
      const selectedOptionId = `${answer.selectedOptionId ?? ""}`.trim();
      if (!questionId || !selectedOptionId) return null;
      return { questionId, selectedOptionId };
    })
    .filter((item): item is QuizSubmissionPayload["answers"][number] => Boolean(item));

  if (answers.length === 0) return null;

  const uniqueQuestionIds = new Set<string>();
  for (const answer of answers) {
    if (uniqueQuestionIds.has(answer.questionId)) return null;
    uniqueQuestionIds.add(answer.questionId);
  }

  return { answers };
}

export function resolveHomeworkQuiz(definition: MethodologyLessonHomeworkDefinition): QuizSingleChoicePayload | null {
  if (definition.kind !== "quiz_single_choice") return null;
  return normalizeQuizSingleChoicePayload(definition.quiz ?? null);
}

export function gradeQuizSingleChoice(
  quiz: QuizSingleChoicePayload,
  submission: QuizSubmissionPayload,
): QuizGradeResult {
  const answersByQuestion = new Map(
    submission.answers.map((item) => [item.questionId, item.selectedOptionId]),
  );

  const answers = quiz.questions.map((question) => {
    const selectedOptionId = answersByQuestion.get(question.id) ?? "";
    const validSelected = question.options.some((option) => option.id === selectedOptionId)
      ? selectedOptionId
      : "";
    const isCorrect = validSelected.length > 0 && validSelected === question.correctOptionId;

    return {
      questionId: question.id,
      selectedOptionId: validSelected,
      correctOptionId: question.correctOptionId,
      isCorrect,
    };
  });

  const score = answers.filter((item) => item.isCorrect).length;

  return {
    score,
    maxScore: quiz.questions.length,
    answers,
  };
}
