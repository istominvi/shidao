import {
  buildTeacherLessonProjection,
  type ScheduledLesson,
} from "../lesson-content";
import type { ReusableAsset } from "../lesson-content";
import type {
  Methodology,
  MethodologyMetadata,
} from "../lesson-content/contracts";
import type { AccessResolution } from "./access-policy";
import { getMethodologyHomeworkByLessonIdAdmin } from "./homework-repository";
import {
  createScheduledLessonAdmin,
  getMethodologyBySlugAdmin,
  getMethodologyLessonByIdAdmin,
  getMethodologyLessonStudentContentByLessonIdAdmin,
  isLessonStudentContentSchemaReadyAdmin,
  isMissingLessonStudentContentSchemaError,
  listMethodologiesWithSlugAdmin,
  listMethodologyLessonsByMethodologyAdmin,
  listReusableAssetsByIdsAdmin,
  listTeacherClassesAdmin,
} from "./lesson-content-repository";
import {
  buildTeacherLessonWorkspaceReadModel,
  canAccessTeacherLessonWorkspace,
} from "./teacher-lesson-workspace";
import { isInvalidLessonStudentContentPayloadError } from "./lesson-content-mappers";

function clean(value: string | null | undefined) {
  return value?.trim() || "";
}

function readinessLabel(readiness: "draft" | "ready" | "archived") {
  if (readiness === "ready") return "Готов";
  if (readiness === "draft") return "В подготовке";
  return "В архиве";
}

function compactText(items: Array<string | undefined>) {
  return Array.from(
    new Set(items.map((item) => item?.trim() ?? "").filter(Boolean)),
  );
}

function teacherFacingMethodologyTitle(methodology: {
  title: string;
  metadata?: MethodologyMetadata | null;
}) {
  const title = clean(methodology.title);
  const titleRu = clean(methodology.metadata?.titleRu);
  const titleNative = clean(methodology.metadata?.titleNative);

  if (titleRu && titleNative) return `${titleRu} — ${titleNative}`;
  if (title.includes("—")) return title;
  if (titleRu && title && title !== titleRu) return `${titleRu} — ${title}`;
  if (titleNative && title && title !== titleNative)
    return `${title} — ${titleNative}`;
  return title || titleRu || titleNative;
}

function withFallbackMetadata(
  methodology: Pick<Methodology, "metadata" | "title">,
) {
  const metadata = methodology.metadata ?? {};
  return {
    ...metadata,
    targetAgeLabel: metadata.targetAgeLabel ?? "5–6 лет",
    lessonDurationLabel: metadata.lessonDurationLabel ?? "45 минут",
    courseDurationLabel: metadata.courseDurationLabel ?? "1 учебный год",
    idealGroupSizeLabel: metadata.idealGroupSizeLabel ?? "4–6 детей",
    activitiesPerLessonLabel:
      metadata.activitiesPerLessonLabel ?? "Обычно 14–16 активностей",
  } satisfies MethodologyMetadata;
}

function inferMaterialsSignals(summary: string | undefined) {
  const text = clean(summary).toLowerCase();
  return {
    hasCards: text.includes("карточ"),
    hasProps: text.includes("реквиз") || text.includes("материал"),
    hasWorksheets:
      text.includes("тетрад") ||
      text.includes("worksheet") ||
      text.includes("рабоч"),
  };
}

function homeworkKindLabel(kind: "practice_text" | "quiz_single_choice") {
  return kind === "quiz_single_choice" ? "Квиз" : "Практика";
}

function toStudentContentUnavailableReason(error: unknown) {
  if (isInvalidLessonStudentContentPayloadError(error)) {
    return "invalid_payload" as const;
  }
  const message = error instanceof Error ? error.message : "";
  if (isMissingLessonStudentContentSchemaError(message)) {
    return "schema_missing" as const;
  }
  return "load_failed" as const;
}

export function canAccessTeacherMethodologies(resolution: AccessResolution) {
  return canAccessTeacherLessonWorkspace(resolution);
}

export function assertTeacherMethodologiesAccess(resolution: AccessResolution) {
  if (
    !canAccessTeacherMethodologies(resolution) ||
    resolution.status !== "adult-with-profile"
  ) {
    throw new Error("Только профиль преподавателя может открывать методики.");
  }

  const teacherId = resolution.context.teacher?.id;
  if (!teacherId) {
    throw new Error("Профиль преподавателя не найден.");
  }

  return { teacherId };
}

export async function getTeacherMethodologiesIndexReadModel() {
  const methodologies = await listMethodologiesWithSlugAdmin();
  const cards = await Promise.all(
    methodologies.map(async (item) => {
      const lessons = await listMethodologyLessonsByMethodologyAdmin(item.id);
      const metadata = withFallbackMetadata({
        metadata: item.metadata ?? undefined,
        title: item.title,
      });
      return {
        id: item.id,
        slug: item.slug,
        title: teacherFacingMethodologyTitle(item),
        shortDescription: item.shortDescription,
        lessonCount: lessons.length,
        passport: {
          locale: metadata.locale,
          level: metadata.level,
          audienceLabel: metadata.audienceLabel,
          targetAgeLabel: metadata.targetAgeLabel,
          lessonDurationLabel: metadata.lessonDurationLabel,
          courseDurationLabel: metadata.courseDurationLabel,
          approximateVocabularyCount: metadata.approximateVocabularyCount,
          mediaFormatLabel:
            metadata.songCount || metadata.videoCount
              ? `${metadata.songCount ?? 0} песен · ${metadata.videoCount ?? 0} видео`
              : null,
          groupSizeLabel: metadata.maxGroupSize
            ? `${metadata.idealGroupSizeLabel ?? "Рекомендовано в малых группах"} · максимум ${metadata.maxGroupSize}`
            : (metadata.idealGroupSizeLabel ?? null),
          thematicHighlights: compactText(metadata.thematicModules ?? []).slice(
            0,
            3,
          ),
          learningHighlights: compactText([
            metadata.teachingApproachSummary,
            metadata.lessonFormatSummary,
            ...(metadata.learningOutcomes ?? []),
          ]).slice(0, 4),
          programLessonCount: metadata.programLessonCount ?? null,
        },
      };
    }),
  );

  return { cards };
}

export async function getTeacherMethodologyDetailReadModel(slug: string) {
  const methodology = await getMethodologyBySlugAdmin(slug);
  if (!methodology) return null;

  const lessons = await listMethodologyLessonsByMethodologyAdmin(
    methodology.id,
  );
  const metadata = withFallbackMetadata(methodology);

  const lessonsWithHomework = await Promise.all(
    lessons.map(async (lesson) => ({
      lesson,
      canonicalHomework: await getMethodologyHomeworkByLessonIdAdmin(lesson.id),
    })),
  );

  return {
    methodology: {
      ...methodology,
      title: teacherFacingMethodologyTitle(methodology),
    },
    overview: {
      passport: {
        audienceLabel: metadata.audienceLabel,
        targetAgeLabel: metadata.targetAgeLabel,
        level: metadata.level,
        lessonDurationLabel: metadata.lessonDurationLabel,
        courseDurationLabel: metadata.courseDurationLabel,
        courseScopeLabel: metadata.courseScopeLabel,
        approximateVocabularyCount: metadata.approximateVocabularyCount,
        songCount: metadata.songCount,
        videoCount: metadata.videoCount,
        idealGroupSizeLabel: metadata.idealGroupSizeLabel,
        maxGroupSize: metadata.maxGroupSize,
        activitiesPerLessonLabel: metadata.activitiesPerLessonLabel,
        lessonFormatSummary: metadata.lessonFormatSummary,
      },
      teachingApproachSummary: metadata.teachingApproachSummary,
      learningOutcomes: compactText(metadata.learningOutcomes ?? []),
      thematicModules: compactText(metadata.thematicModules ?? []),
      methodologyNotes: compactText(metadata.methodologyNotes ?? []),
      materialsEcosystemSummary: metadata.materialsEcosystemSummary,
      availableLessonsCount: lessons.length,
      programLessonCount: metadata.programLessonCount ?? null,
      sourceRuntimeNote:
        "Методика — это полный педагогический источник курса. В ShiDao ниже показаны только уже импортированные source-уроки, которые можно назначать группам в runtime-слое.",
    },
    lessons: lessonsWithHomework.map(({ lesson, canonicalHomework }) => {
      const prepSignals = inferMaterialsSignals(
        metadata.materialsEcosystemSummary,
      );
      return {
        id: lesson.id,
        title: lesson.shell.title,
        positionLabel: `Модуль ${lesson.shell.position.moduleIndex} · Урок ${lesson.shell.position.lessonIndex}${lesson.shell.position.unitIndex ? ` · Раздел ${lesson.shell.position.unitIndex}` : ""}`,
        durationLabel: `${lesson.shell.estimatedDurationMinutes} мин`,
        readinessLabel: readinessLabel(lesson.shell.readinessStatus),
        vocabularyPreview: lesson.shell.vocabularySummary.slice(0, 6),
        phrasePreview: lesson.shell.phraseSummary.slice(0, 4),
        mediaSummary: lesson.shell.mediaSummary,
        materialsSignal: prepSignals.hasCards || prepSignals.hasProps,
        homeworkSignal: Boolean(canonicalHomework),
        homeworkLabel: canonicalHomework
          ? `Есть домашнее задание · ${homeworkKindLabel(canonicalHomework.kind)}`
          : null,
      };
    }),
  };
}

function collectAssetIds(
  lesson: Awaited<ReturnType<typeof getMethodologyLessonByIdAdmin>>,
) {
  if (!lesson) return [];
  return Array.from(
    new Set(
      lesson.blocks.flatMap((item) => item.assetRefs.map((ref) => ref.id)),
    ),
  );
}

export async function getTeacherMethodologyLessonReadModel(input: {
  teacherId: string;
  methodologySlug: string;
  lessonId: string;
}) {
  const methodology = await getMethodologyBySlugAdmin(input.methodologySlug);
  if (!methodology) return null;

  const lesson = await getMethodologyLessonByIdAdmin(input.lessonId);
  if (!lesson || lesson.methodologyId !== methodology.id) return null;
  const canonicalHomework = await getMethodologyHomeworkByLessonIdAdmin(
    lesson.id,
  );

  const scheduledStub: ScheduledLesson = {
    id: `preview-${lesson.id}`,
    methodologyLessonId: lesson.id,
    runtimeShell: {
      id: `preview-${lesson.id}`,
      classId: "preview",
      startsAt: new Date().toISOString(),
      runtimeStatus: "planned",
      format: "online",
      meetingLink: "https://preview.local",
    },
  };

  const projection = buildTeacherLessonProjection(lesson, scheduledStub);
  const assets = await listReusableAssetsByIdsAdmin(collectAssetIds(lesson));
  let studentContent = null;
  let studentContentUnavailableReason:
    | "schema_missing"
    | "invalid_payload"
    | "load_failed"
    | null = null;
  let studentContentAssets: ReusableAsset[] = [];

  try {
    studentContent = await getMethodologyLessonStudentContentByLessonIdAdmin(
      lesson.id,
    );
    if (!studentContent) {
      const isSchemaReady = await isLessonStudentContentSchemaReadyAdmin();
      if (!isSchemaReady) {
        studentContentUnavailableReason = "schema_missing";
      }
    } else {
      const assetIds = Array.from(
        new Set(
          studentContent.sections.flatMap((section) => {
            if (section.type === "media_asset") return [section.assetId];
            if (section.type === "worksheet" && section.assetId)
              return [section.assetId];
            return [];
          }),
        ),
      );
      studentContentAssets = assetIds.length
        ? await listReusableAssetsByIdsAdmin(assetIds)
        : [];
    }
  } catch (error) {
    studentContent = null;
    studentContentAssets = [];
    studentContentUnavailableReason = toStudentContentUnavailableReason(error);
  }

  const presentation = buildTeacherLessonWorkspaceReadModel({
    projection,
    scheduledLessonId: scheduledStub.id,
    classId: "preview",
    classDisplayName: null,
    sourceLesson: {
      methodologySlug: methodology.slug,
      lessonId: lesson.id,
      methodologyTitle: teacherFacingMethodologyTitle(methodology),
      lessonTitle: lesson.shell.title,
    },
    assets,
    homework: {
      schemaReady: true,
      definition: null,
      assignment: null,
      stats: {
        assignedCount: 0,
        submittedCount: 0,
        reviewedCount: 0,
        needsRevisionCount: 0,
        averageScore: null,
      },
      roster: [],
    },
    studentContent,
    studentContentUnavailableReason,
    studentContentAssets,
  }).presentation;

  const groups = (await listTeacherClassesAdmin(input.teacherId))
    .filter((group) => group.methodologyId === methodology.id)
    .map((group) => ({ id: group.id, label: clean(group.name) || "Группа" }));

  return {
    methodology: {
      ...methodology,
      title: teacherFacingMethodologyTitle(methodology),
    },
    lesson,
    groups,
    presentation,
    metadata: {
      durationLabel: `${lesson.shell.estimatedDurationMinutes} мин`,
    },
    canonicalHomework: canonicalHomework
      ? {
          title: canonicalHomework.title,
          kindLabel: homeworkKindLabel(canonicalHomework.kind),
          instructions: canonicalHomework.instructions,
          estimatedMinutes: canonicalHomework.estimatedMinutes ?? null,
          materialLinks: canonicalHomework.materialLinks,
          answerFormatHint: canonicalHomework.answerFormatHint ?? null,
          sourceLayerNote:
            "Это каноничное домашнее задание из методики. Оно становится реальным назначением только после выдачи урока в группе.",
        }
      : null,
    studentContent: {
      source: studentContent,
      assetsById: Object.fromEntries(
        studentContentAssets.map((asset) => [asset.id, asset]),
      ),
      unavailableReason: studentContentUnavailableReason,
    },
  };
}

export function parseAssignLessonFromMethodologyFormData(formData: FormData) {
  const classId = clean(formData.get("classId") as string | null);
  const date = clean(formData.get("date") as string | null);
  const time = clean(formData.get("time") as string | null);
  const format = clean(formData.get("format") as string | null);

  if (!classId) throw new Error("Выберите группу.");
  if (!date || !time) throw new Error("Укажите дату и время.");
  if (format !== "online" && format !== "offline")
    throw new Error("Выберите формат занятия.");

  const startsAt = `${date}T${time}:00Z`;
  if (Number.isNaN(Date.parse(startsAt)))
    throw new Error("Дата или время указаны неверно.");

  if (format === "online") {
    const meetingLink = clean(formData.get("meetingLink") as string | null);
    if (!meetingLink) throw new Error("Для онлайн-урока нужна ссылка.");
    return { classId, startsAt, format: "online" as const, meetingLink };
  }

  const place = clean(formData.get("place") as string | null);
  if (!place) throw new Error("Для офлайн-урока укажите место.");
  return { classId, startsAt, format: "offline" as const, place };
}

export async function createScheduledLessonFromMethodology(input: {
  teacherId: string;
  methodologyLessonId: string;
  payload: ReturnType<typeof parseAssignLessonFromMethodologyFormData>;
}) {
  const groups = await listTeacherClassesAdmin(input.teacherId);
  const group = groups.find((item) => item.id === input.payload.classId);
  if (!group) throw new Error("Группа недоступна преподавателю.");

  const lesson = await getMethodologyLessonByIdAdmin(input.methodologyLessonId);
  if (!lesson) throw new Error("Урок методики не найден.");

  if (group.methodologyId !== lesson.methodologyId) {
    throw new Error(
      "Этот урок нельзя назначить в выбранную группу: у группы другая методика.",
    );
  }

  if (input.payload.format === "online") {
    return createScheduledLessonAdmin({
      classId: input.payload.classId,
      methodologyLessonId: input.methodologyLessonId,
      startsAt: input.payload.startsAt,
      format: "online",
      meetingLink: input.payload.meetingLink,
    });
  }

  return createScheduledLessonAdmin({
    classId: input.payload.classId,
    methodologyLessonId: input.methodologyLessonId,
    startsAt: input.payload.startsAt,
    format: "offline",
    place: input.payload.place,
  });
}
