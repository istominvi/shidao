import type {
  LessonBlockInstance,
  MethodologyLesson,
  MethodologyLessonStudentContent,
  ReusableAsset,
} from "../lesson-content";
import {
  getMethodologyLessonByIdAdmin,
  getMethodologyLessonStudentContentByLessonIdAdmin,
  getScheduledLessonByIdAdmin,
  listReusableAssetsByIdsAdmin,
} from "./lesson-content-repository";
import { getParentHomeworkProjection } from "./parent-homework";
import {
  getStudentHomeworkReadModel,
  type StudentHomeworkCard,
} from "./student-homework";

export type LearnerHomeworkCard =
  | {
      role: "student";
      card: StudentHomeworkCard;
    }
  | {
      role: "parent";
      card: {
        lessonTitle: string;
        homeworkTitle: string;
        dueAt: string | null;
        statusLabel: string;
        assignmentComment: string | null;
        reviewNote: string | null;
        score: number | null;
        maxScore: number | null;
      };
    };

export type LearnerLessonRoomReadModel = {
  scheduledLessonId: string;
  classId: string;
  lessonTitle: string;
  lessonSubtitle?: string;
  startsAt: string;
  runtimeStatus: "planned" | "in_progress" | "completed" | "cancelled";
  studentContent: MethodologyLessonStudentContent;
  studentContentMode: "canonical" | "fallback";
  assetsById: Record<string, ReusableAsset>;
  homework: LearnerHomeworkCard | null;
};

type LearnerLessonRoomDeps = {
  getScheduledLessonById: typeof getScheduledLessonByIdAdmin;
  getMethodologyLessonById: typeof getMethodologyLessonByIdAdmin;
  getMethodologyLessonStudentContentByLessonId: typeof getMethodologyLessonStudentContentByLessonIdAdmin;
  listReusableAssetsByIds: typeof listReusableAssetsByIdsAdmin;
  getStudentHomeworkReadModel: typeof getStudentHomeworkReadModel;
  loadParentLearningContextsByUser?: (userId: string) => Promise<
    Array<{
      studentId: string;
      studentName: string;
      login: string;
      classes: Array<{ classId: string; className: string; schoolId: string; schoolName: string }>;
    }>
  >;
  getParentHomeworkProjection: typeof getParentHomeworkProjection;
};

const defaultDeps: LearnerLessonRoomDeps = {
  getScheduledLessonById: getScheduledLessonByIdAdmin,
  getMethodologyLessonById: getMethodologyLessonByIdAdmin,
  getMethodologyLessonStudentContentByLessonId:
    getMethodologyLessonStudentContentByLessonIdAdmin,
  listReusableAssetsByIds: listReusableAssetsByIdsAdmin,
  getStudentHomeworkReadModel,
  getParentHomeworkProjection,
};

function buildFallbackStudentContentFromMethodologyLesson(
  methodologyLesson: MethodologyLesson,
): MethodologyLessonStudentContent {
  const sections: MethodologyLessonStudentContent["sections"] = [];
  const lessonTitle = methodologyLesson.shell.title.trim();

  sections.push({
    type: "lesson_focus",
    title: "Фокус урока",
    body:
      `Сегодня работаем с темой «${lessonTitle}». ` +
      "Повторяем ключевые слова и выражения в простых заданиях.",
    chips: [
      ...methodologyLesson.shell.vocabularySummary.slice(0, 3),
      ...methodologyLesson.shell.phraseSummary.slice(0, 2),
    ],
  });

  const vocabularyBlock = methodologyLesson.blocks.find(
    (block) => block.blockType === "vocabulary_focus",
  );
  if (vocabularyBlock) {
    const items = (
      vocabularyBlock as Extract<LessonBlockInstance, { blockType: "vocabulary_focus" }>
    ).content.items;
    if (items.length > 0) {
      sections.push({
        type: "vocabulary_cards",
        title: "Слова урока",
        items: items.map((item) => ({
          term: item.term,
          pinyin: item.pinyin,
          meaning: item.meaning,
        })),
      });
    }
  }

  const promptBlock = methodologyLesson.blocks.find(
    (block) => block.blockType === "teacher_prompt_pattern",
  );
  if (promptBlock) {
    const content = (
      promptBlock as Extract<
        LessonBlockInstance,
        { blockType: "teacher_prompt_pattern" }
      >
    ).content;
    const phraseItems = content.promptPatterns
      .map((phrase, index) => ({
        phrase,
        meaning: content.expectedStudentResponses[index] ?? "Фраза урока",
      }))
      .filter((item) => item.phrase.trim().length > 0);
    if (phraseItems.length > 0) {
      sections.push({
        type: "phrase_cards",
        title: "Полезные фразы",
        items: phraseItems,
      });
    }
  }

  const mediaRefs = Array.from(
    new Map(
      methodologyLesson.blocks
        .flatMap((block) => block.assetRefs)
        .filter(
          (assetRef) =>
            assetRef.kind === "video" ||
            assetRef.kind === "song" ||
            assetRef.kind === "media_file" ||
            assetRef.kind === "worksheet",
        )
        .map((assetRef) => [assetRef.id, assetRef]),
    ).values(),
  );

  for (const mediaRef of mediaRefs) {
    if (mediaRef.kind === "worksheet") {
      sections.push({
        type: "worksheet",
        title: "Рабочий лист",
        assetId: mediaRef.id,
        instructions: "Открой рабочий лист и выполни задания по теме урока.",
      });
      continue;
    }

    sections.push({
      type: "media_asset",
      title: mediaRef.kind === "song" ? "Песня урока" : "Материал урока",
      assetId: mediaRef.id,
      assetKind:
        mediaRef.kind === "song"
          ? "song"
          : mediaRef.kind === "video"
            ? "video"
            : "media_file",
      studentPrompt:
        mediaRef.kind === "song"
          ? "Послушай и повтори ключевые слова из песни."
          : "Посмотри материал и обрати внимание на ключевые слова урока.",
    });
  }

  const wrapUpBlock = methodologyLesson.blocks.find(
    (block) => block.blockType === "wrap_up_closure",
  );
  const recapBullets =
    wrapUpBlock && wrapUpBlock.blockType === "wrap_up_closure"
      ? [
          ...wrapUpBlock.content.recapPoints,
          wrapUpBlock.content.exitCheck,
          ...(wrapUpBlock.content.previewNextLesson
            ? [wrapUpBlock.content.previewNextLesson]
            : []),
        ]
      : [
          ...methodologyLesson.shell.vocabularySummary.slice(0, 3),
          ...methodologyLesson.shell.phraseSummary.slice(0, 2),
        ];

  sections.push({
    type: "recap",
    title: "Итог урока",
    bullets: recapBullets.filter((item) => item.trim().length > 0),
  });

  return {
    id: `fallback-${methodologyLesson.id}`,
    methodologyLessonId: methodologyLesson.id,
    title: methodologyLesson.shell.title,
    subtitle: "Упрощённая версия контента на основе методического урока.",
    sections,
  };
}

async function getBaseLessonRoom(
  scheduledLessonId: string,
  deps: LearnerLessonRoomDeps,
) {
  const scheduledLesson = await deps.getScheduledLessonById(scheduledLessonId);
  if (!scheduledLesson) return null;

  const methodologyLesson = await deps.getMethodologyLessonById(
    scheduledLesson.methodologyLessonId,
  );
  if (!methodologyLesson) return null;

  const canonicalStudentContent =
    await deps
      .getMethodologyLessonStudentContentByLessonId(methodologyLesson.id)
      .catch(() => null);
  const studentContent =
    canonicalStudentContent ??
    buildFallbackStudentContentFromMethodologyLesson(methodologyLesson);
  if (!studentContent.sections.length) return null;

  const assetIds = Array.from(
    new Set(
      studentContent.sections
        .flatMap((section) => {
          if (section.type === "media_asset") return [section.assetId];
          if (section.type === "worksheet" && section.assetId) return [section.assetId];
          return [];
        })
        .filter(Boolean),
    ),
  );
  const assets = assetIds.length
    ? await deps.listReusableAssetsByIds(assetIds)
    : [];

  const studentContentMode: LearnerLessonRoomReadModel["studentContentMode"] =
    canonicalStudentContent ? "canonical" : "fallback";

  return {
    scheduledLesson,
    methodologyLesson,
    studentContent,
    studentContentMode,
    assetsById: Object.fromEntries(assets.map((asset) => [asset.id, asset])),
  };
}

export async function getLessonRoomPreviewByScheduledLessonId(
  scheduledLessonId: string,
  deps: LearnerLessonRoomDeps = defaultDeps,
): Promise<Omit<LearnerLessonRoomReadModel, "homework"> | null> {
  const base = await getBaseLessonRoom(scheduledLessonId, deps);
  if (!base) return null;

  return {
    scheduledLessonId,
    classId: base.scheduledLesson.runtimeShell.classId,
    lessonTitle: base.methodologyLesson.shell.title,
    lessonSubtitle: base.studentContent.subtitle,
    startsAt: base.scheduledLesson.runtimeShell.startsAt,
    runtimeStatus: base.scheduledLesson.runtimeShell.runtimeStatus,
    studentContent: base.studentContent,
    studentContentMode: base.studentContentMode,
    assetsById: base.assetsById,
  };
}

export async function getStudentLessonRoomReadModel(input: {
  studentId: string;
  classIds: string[];
  scheduledLessonId: string;
}, deps: LearnerLessonRoomDeps = defaultDeps): Promise<LearnerLessonRoomReadModel | null> {
  const base = await getBaseLessonRoom(input.scheduledLessonId, deps);
  if (!base) return null;

  if (!input.classIds.includes(base.scheduledLesson.runtimeShell.classId)) {
    return null;
  }

  const homeworkCards = await deps.getStudentHomeworkReadModel({
    studentId: input.studentId,
    classIds: input.classIds,
  });

  const homeworkCard =
    homeworkCards.find(
      (item) => item.scheduledLessonId === input.scheduledLessonId,
    ) ?? null;

  return {
    scheduledLessonId: input.scheduledLessonId,
    classId: base.scheduledLesson.runtimeShell.classId,
    lessonTitle: base.methodologyLesson.shell.title,
    lessonSubtitle: base.studentContent.subtitle,
    startsAt: base.scheduledLesson.runtimeShell.startsAt,
    runtimeStatus: base.scheduledLesson.runtimeShell.runtimeStatus,
    studentContent: base.studentContent,
    studentContentMode: base.studentContentMode,
    assetsById: base.assetsById,
    homework: homeworkCard ? { role: "student", card: homeworkCard } : null,
  };
}

export async function getParentLessonRoomReadModel(input: {
  userId: string;
  studentId: string;
  scheduledLessonId: string;
}, deps: LearnerLessonRoomDeps = defaultDeps): Promise<LearnerLessonRoomReadModel | null> {
  const loadParentContexts =
    deps.loadParentLearningContextsByUser ??
    (async (userId: string) => {
      const mod = await import("./supabase-admin");
      return mod.loadParentLearningContextsByUser(userId);
    });
  const contexts = await loadParentContexts(input.userId);
  const child = contexts.find((item) => item.studentId === input.studentId);
  if (!child) return null;

  const base = await getBaseLessonRoom(input.scheduledLessonId, deps);
  if (!base) return null;

  const childClassIds = child.classes.map((item) => item.classId);
  if (!childClassIds.includes(base.scheduledLesson.runtimeShell.classId)) {
    return null;
  }

  const homeworkProjection = await deps.getParentHomeworkProjection({
    children: [
      {
        studentId: child.studentId,
        classIds: childClassIds,
      },
    ],
  });

  const lessonHomework =
    homeworkProjection
      .flatMap((item) => item.items)
      .find((item) => item.scheduledLessonId === input.scheduledLessonId) ?? null;

  return {
    scheduledLessonId: input.scheduledLessonId,
    classId: base.scheduledLesson.runtimeShell.classId,
    lessonTitle: base.methodologyLesson.shell.title,
    lessonSubtitle: base.studentContent.subtitle,
    startsAt: base.scheduledLesson.runtimeShell.startsAt,
    runtimeStatus: base.scheduledLesson.runtimeShell.runtimeStatus,
    studentContent: base.studentContent,
    studentContentMode: base.studentContentMode,
    assetsById: base.assetsById,
    homework: lessonHomework
      ? {
          role: "parent",
          card: {
            lessonTitle: lessonHomework.lessonTitle,
            homeworkTitle: lessonHomework.homeworkTitle,
            dueAt: lessonHomework.dueAt,
            statusLabel: lessonHomework.statusLabel,
            assignmentComment: lessonHomework.assignmentComment,
            reviewNote: lessonHomework.reviewNote,
            score: lessonHomework.score,
            maxScore: lessonHomework.maxScore,
          },
        }
      : null,
  };
}
