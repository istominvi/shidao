import {
  getMethodologyByIdAdmin,
  listMethodologiesAdmin,
  listMethodologyLessonsByMethodologyAdmin,
  listReusableAssetsByIdsAdmin,
} from "./lesson-content-repository";

function cleanText(value: string | null | undefined) {
  return value?.trim() || "";
}

export type TeacherMethodologyCatalogItem = {
  id: string;
  title: string;
  shortDescription: string | null;
  lessonCount: number;
  moduleCount: number;
};

export async function getTeacherMethodologiesCatalog(): Promise<TeacherMethodologyCatalogItem[]> {
  const methodologies = await listMethodologiesAdmin();

  const rows = await Promise.all(
    methodologies.map(async (methodology) => {
      const lessons = await listMethodologyLessonsByMethodologyAdmin(methodology.id);
      return {
        id: methodology.id,
        title: cleanText(methodology.title) || "Без названия",
        shortDescription: cleanText(methodology.shortDescription) || null,
        lessonCount: lessons.length,
        moduleCount: new Set(lessons.map((lesson) => lesson.shell.position.moduleIndex)).size,
      };
    }),
  );

  return rows;
}

export type TeacherMethodologyLessonDetail = {
  id: string;
  moduleIndex: number;
  unitIndex: number | null;
  lessonIndex: number;
  title: string;
  durationMinutes: number | null;
  readinessLabel: string;
  vocabularySummary: string[];
  phraseSummary: string[];
  blocks: Array<{
    id: string;
    title: string | null;
    blockTypeLabel: string;
    contentPreview: string | null;
    contentJson: string | null;
    assets: Array<{ id: string; title: string; kindLabel: string; sourceUrl: string | null }>;
  }>;
};

export type TeacherMethodologyDetailReadModel = {
  id: string;
  title: string;
  shortDescription: string | null;
  lessonCount: number;
  moduleCount: number;
  modules: Array<{
    moduleIndex: number;
    lessons: TeacherMethodologyLessonDetail[];
  }>;
};

function readinessLabel(value: "draft" | "ready" | "archived") {
  switch (value) {
    case "ready":
      return "Готов";
    case "archived":
      return "В архиве";
    default:
      return "Черновик";
  }
}

function blockTypeLabel(blockType: string) {
  return blockType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function assetKindLabel(kind: string) {
  switch (kind) {
    case "video":
      return "Видео";
    case "song":
      return "Песня";
    case "worksheet":
      return "Worksheet";
    case "vocabulary_set":
      return "Словарь";
    case "activity_template":
      return "Шаблон активности";
    default:
      return "Материал";
  }
}

function toContentPreview(content: Record<string, unknown>) {
  for (const value of Object.values(content)) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}


export function groupMethodologyLessonsByModule(lessons: TeacherMethodologyLessonDetail[]) {
  const groupedModules = new Map<number, TeacherMethodologyLessonDetail[]>();
  for (const lesson of lessons) {
    groupedModules.set(lesson.moduleIndex, [...(groupedModules.get(lesson.moduleIndex) ?? []), lesson]);
  }

  return Array.from(groupedModules.entries())
    .sort(([a], [b]) => a - b)
    .map(([moduleIndex, moduleLessons]) => ({
      moduleIndex,
      lessons: moduleLessons.sort((a, b) => {
        if ((a.unitIndex ?? 0) !== (b.unitIndex ?? 0)) {
          return (a.unitIndex ?? 0) - (b.unitIndex ?? 0);
        }
        return a.lessonIndex - b.lessonIndex;
      }),
    }));
}

export async function getTeacherMethodologyDetail(
  methodologyId: string,
): Promise<TeacherMethodologyDetailReadModel | null> {
  const [methodology, lessons] = await Promise.all([
    getMethodologyByIdAdmin(methodologyId),
    listMethodologyLessonsByMethodologyAdmin(methodologyId),
  ]);

  if (!methodology) {
    return null;
  }

  const assetIds = Array.from(
    new Set(
      lessons.flatMap((lesson) =>
        lesson.blocks.flatMap((block) => block.assetRefs.map((assetRef) => assetRef.id)),
      ),
    ),
  );
  const assets = await listReusableAssetsByIdsAdmin(assetIds);
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  const lessonDetails: TeacherMethodologyLessonDetail[] = lessons.map((lesson) => ({
    id: lesson.id,
    moduleIndex: lesson.shell.position.moduleIndex,
    unitIndex: lesson.shell.position.unitIndex ?? null,
    lessonIndex: lesson.shell.position.lessonIndex,
    title: lesson.shell.title,
    durationMinutes: lesson.shell.estimatedDurationMinutes || null,
    readinessLabel: readinessLabel(lesson.shell.readinessStatus),
    vocabularySummary: lesson.shell.vocabularySummary,
    phraseSummary: lesson.shell.phraseSummary,
    blocks: lesson.blocks.map((block) => ({
      id: block.id,
      title: cleanText(block.title) || null,
      blockTypeLabel: blockTypeLabel(block.blockType),
      contentPreview: toContentPreview(block.content),
      contentJson: Object.keys(block.content).length
        ? JSON.stringify(block.content, null, 2)
        : null,
      assets: block.assetRefs.map((assetRef) => {
        const asset = assetsById.get(assetRef.id);
        return {
          id: assetRef.id,
          title: cleanText(asset?.title) || assetRef.id,
          kindLabel: assetKindLabel(assetRef.kind),
          sourceUrl: asset?.sourceUrl?.trim() || null,
        };
      }),
    })),
  }));

  return {
    id: methodology.id,
    title: cleanText(methodology.title) || "Без названия",
    shortDescription: cleanText(methodology.shortDescription) || null,
    lessonCount: lessons.length,
    moduleCount: new Set(lessons.map((lesson) => lesson.shell.position.moduleIndex)).size,
    modules: groupMethodologyLessonsByModule(lessonDetails),
  };
}
