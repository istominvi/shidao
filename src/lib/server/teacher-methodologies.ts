import {
  buildTeacherLessonProjection,
  type Methodology,
  type ScheduledLesson,
} from "../lesson-content";
import type { AccessResolution } from "./access-policy";
import {
  createScheduledLessonAdmin,
  getMethodologyBySlugAdmin,
  getMethodologyLessonByIdAdmin,
  listMethodologiesWithSlugAdmin,
  listMethodologyLessonsByMethodologyAdmin,
  listReusableAssetsByIdsAdmin,
  listTeacherClassesAdmin,
} from "./lesson-content-repository";
import {
  buildTeacherLessonWorkspaceReadModel,
  canAccessTeacherLessonWorkspace,
} from "./teacher-lesson-workspace";

function clean(value: string | null | undefined) {
  return value?.trim() || "";
}

function readinessLabel(readiness: "draft" | "ready" | "archived") {
  if (readiness === "ready") return "Готов";
  if (readiness === "draft") return "В подготовке";
  return "В архиве";
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)),
  );
}

function resolvePassport(metadata: Methodology["metadata"] | null | undefined) {
  return {
    locale: clean(metadata?.locale),
    level: clean(metadata?.level),
    targetAgeLabel: clean(metadata?.targetAgeLabel),
    lessonDurationLabel: clean(metadata?.lessonDurationLabel),
    courseDurationLabel: clean(metadata?.courseDurationLabel),
    approximateVocabularyCount:
      typeof metadata?.approximateVocabularyCount === "number"
        ? metadata.approximateVocabularyCount
        : null,
    songsCount:
      typeof metadata?.songsCount === "number" ? metadata.songsCount : null,
    videosCount:
      typeof metadata?.videosCount === "number" ? metadata.videosCount : null,
    idealGroupSizeLabel: clean(metadata?.idealGroupSizeLabel),
    maxGroupSize:
      typeof metadata?.maxGroupSize === "number" ? metadata.maxGroupSize : null,
    teachingApproachSummary: clean(metadata?.teachingApproachSummary),
    learningOutcomes: normalizeArray(metadata?.learningOutcomes),
    thematicModules: normalizeArray(metadata?.thematicModules),
    methodologyNotes: normalizeArray(metadata?.methodologyNotes),
    materialsEcosystemSummary: clean(metadata?.materialsEcosystemSummary),
    lessonActivityLoadLabel: clean(metadata?.lessonActivityLoadLabel),
    lessonFormatSummary: clean(metadata?.lessonFormatSummary),
    courseScopeLabel: clean(metadata?.courseScopeLabel),
    availableLessonsLabel: clean(metadata?.availableLessonsLabel),
  };
}

export function canAccessTeacherMethodologies(resolution: AccessResolution) {
  return canAccessTeacherLessonWorkspace(resolution);
}

export function assertTeacherMethodologiesAccess(resolution: AccessResolution) {
  if (!canAccessTeacherMethodologies(resolution) || resolution.status !== "adult-with-profile") {
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
      const passport = resolvePassport(item.metadata);
      return {
        id: item.id,
        slug: item.slug,
        title: item.title,
        shortDescription: item.shortDescription,
        lessonCount: lessons.length,
        passport,
      };
    }),
  );

  return { cards };
}

export async function getTeacherMethodologyDetailReadModel(slug: string) {
  const methodology = await getMethodologyBySlugAdmin(slug);
  if (!methodology) return null;

  const lessons = await listMethodologyLessonsByMethodologyAdmin(methodology.id);
  const passport = resolvePassport(methodology.metadata);

  return {
    methodology,
    passport,
    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.shell.title,
      positionLabel: `Модуль ${lesson.shell.position.moduleIndex} · Урок ${lesson.shell.position.lessonIndex}${lesson.shell.position.unitIndex ? ` · Раздел ${lesson.shell.position.unitIndex}` : ""}`,
      durationLabel: `${lesson.shell.estimatedDurationMinutes} мин`,
      readinessLabel: readinessLabel(lesson.shell.readinessStatus),
      vocabularyPreview: lesson.shell.vocabularySummary.slice(0, 5),
      phrasePreview: lesson.shell.phraseSummary.slice(0, 4),
      mediaSummary: lesson.shell.mediaSummary,
      hasMaterialsPrep: lesson.blocks.some((block) => block.blockType === "materials_prep"),
      hasHomeworkSignal: lesson.blocks.some((block) => block.blockType === "worksheet_task"),
    })),
  };
}

function collectAssetIds(lesson: Awaited<ReturnType<typeof getMethodologyLessonByIdAdmin>>) {
  if (!lesson) return [];
  return Array.from(new Set(lesson.blocks.flatMap((item) => item.assetRefs.map((ref) => ref.id))));
}

export async function getTeacherMethodologyLessonReadModel(input: { teacherId: string; methodologySlug: string; lessonId: string }) {
  const methodology = await getMethodologyBySlugAdmin(input.methodologySlug);
  if (!methodology) return null;

  const lesson = await getMethodologyLessonByIdAdmin(input.lessonId);
  if (!lesson || lesson.methodologyId !== methodology.id) return null;

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
  const presentation = buildTeacherLessonWorkspaceReadModel({
    projection,
    scheduledLessonId: scheduledStub.id,
    classId: "preview",
    classDisplayName: null,
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
  }).presentation;

  const groups = (await listTeacherClassesAdmin(input.teacherId))
    .filter((group) => group.methodologyId === methodology.id)
    .map((group) => ({ id: group.id, label: clean(group.name) || "Группа" }));

  return {
    methodology,
    passport: resolvePassport(methodology.metadata),
    lesson,
    groups,
    presentation,
    metadata: {
      positionLabel: `Модуль ${lesson.shell.position.moduleIndex} · Урок ${lesson.shell.position.lessonIndex}${lesson.shell.position.unitIndex ? ` · Раздел ${lesson.shell.position.unitIndex}` : ""}`,
      durationLabel: `${lesson.shell.estimatedDurationMinutes} мин`,
      readinessLabel: readinessLabel(lesson.shell.readinessStatus),
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
  if (format !== "online" && format !== "offline") throw new Error("Выберите формат занятия.");

  const startsAt = `${date}T${time}:00Z`;
  if (Number.isNaN(Date.parse(startsAt))) throw new Error("Дата или время указаны неверно.");

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
    throw new Error("Этот урок нельзя назначить в выбранную группу: у группы другая методика.");
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
