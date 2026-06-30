import {
  lessonContentFixtureAssets,
  lessonContentFixtureHomeworkDefinitions,
  lessonContentFixtureMethodology,
  lessonContentFixtureMethodologyLessons,
  type Methodology,
  type MethodologyLesson,
  type MethodologyLessonHomeworkDefinition,
  type ReusableAsset,
} from "../lesson-content";
import { buildFixtureBootstrapRows } from "./lesson-content-bootstrap";

type MethodologyIdentity = Pick<Methodology, "id" | "slug" | "title">;

const fixtureBootstrapRows = buildFixtureBootstrapRows();

const bootstrapLessonIdByFixtureLessonId = new Map(
  fixtureBootstrapRows.methodologyLessonRows.map((lesson) => [
    lesson.fixtureLessonId,
    lesson.id,
  ]),
);

const fixtureLessonIdByBootstrapLessonId = new Map(
  fixtureBootstrapRows.methodologyLessonRows.map((lesson) => [
    lesson.id,
    lesson.fixtureLessonId,
  ]),
);

const bootstrapHomeworkIdByFixtureHomeworkId = new Map(
  fixtureBootstrapRows.homeworkDefinitionRows.map((homework, index) => [
    lessonContentFixtureHomeworkDefinitions[index]?.id,
    homework.id,
  ]),
);

const fixtureAssetsById = new Map(
  lessonContentFixtureAssets.map((asset) => [asset.id, asset]),
);

function isCanonicalFixtureMethodology(methodology: MethodologyIdentity) {
  return methodology.slug === lessonContentFixtureMethodology.slug;
}

function lessonPositionKey(lesson: MethodologyLesson) {
  const position = lesson.shell.position;
  return [
    position.moduleIndex,
    position.unitIndex ?? "none",
    position.lessonIndex,
  ].join(":");
}

function compareLessonsByPosition(
  left: MethodologyLesson,
  right: MethodologyLesson,
) {
  const leftPosition = left.shell.position;
  const rightPosition = right.shell.position;

  if (leftPosition.moduleIndex !== rightPosition.moduleIndex) {
    return leftPosition.moduleIndex - rightPosition.moduleIndex;
  }

  const leftUnit = leftPosition.unitIndex ?? Number.MAX_SAFE_INTEGER;
  const rightUnit = rightPosition.unitIndex ?? Number.MAX_SAFE_INTEGER;
  if (leftUnit !== rightUnit) return leftUnit - rightUnit;

  if (leftPosition.lessonIndex !== rightPosition.lessonIndex) {
    return leftPosition.lessonIndex - rightPosition.lessonIndex;
  }

  return left.shell.title.localeCompare(right.shell.title);
}

function resolveFixtureLessonByLessonIdentity(lesson: MethodologyLesson) {
  const mappedFixtureLessonId =
    fixtureLessonIdByBootstrapLessonId.get(lesson.id) ??
    (lessonContentFixtureMethodologyLessons.some((item) => item.id === lesson.id)
      ? lesson.id
      : null);

  if (mappedFixtureLessonId) {
    return (
      lessonContentFixtureMethodologyLessons.find(
        (item) => item.id === mappedFixtureLessonId,
      ) ?? null
    );
  }

  return (
    lessonContentFixtureMethodologyLessons.find(
      (item) => lessonPositionKey(item) === lessonPositionKey(lesson),
    ) ?? null
  );
}

function materializeFixtureLesson(input: {
  fixtureLesson: MethodologyLesson;
  methodology: MethodologyIdentity;
  methodologyTitle?: string;
}) {
  const resolvedLessonId =
    bootstrapLessonIdByFixtureLessonId.get(input.fixtureLesson.id) ??
    input.fixtureLesson.id;

  return {
    ...input.fixtureLesson,
    id: resolvedLessonId,
    methodologyId: input.methodology.id,
    methodologySlug: input.methodology.slug,
    methodologyTitle: input.methodologyTitle ?? input.methodology.title,
    shell: {
      ...input.fixtureLesson.shell,
      id: resolvedLessonId,
      methodologyId: input.methodology.id,
    },
  } satisfies MethodologyLesson;
}

export function mergeCanonicalMethodologyLessonFallbacks(
  methodology: MethodologyIdentity,
  lessons: MethodologyLesson[],
  options?: { methodologyTitle?: string },
) {
  if (!isCanonicalFixtureMethodology(methodology)) return lessons;

  const existingPositions = new Set(lessons.map(lessonPositionKey));
  const fallbackLessons = lessonContentFixtureMethodologyLessons
    .filter((lesson) => !existingPositions.has(lessonPositionKey(lesson)))
    .map((fixtureLesson) =>
      materializeFixtureLesson({
        fixtureLesson,
        methodology,
        methodologyTitle: options?.methodologyTitle,
      }),
    );

  return [...lessons, ...fallbackLessons].sort(compareLessonsByPosition);
}

export function resolveCanonicalMethodologyLessonFallback(
  methodology: MethodologyIdentity,
  lessonId: string,
  options?: { methodologyTitle?: string },
) {
  if (!isCanonicalFixtureMethodology(methodology)) return null;

  const fixtureLessonId =
    fixtureLessonIdByBootstrapLessonId.get(lessonId) ??
    (lessonContentFixtureMethodologyLessons.some((lesson) => lesson.id === lessonId)
      ? lessonId
      : null);
  if (!fixtureLessonId) return null;

  const fixtureLesson =
    lessonContentFixtureMethodologyLessons.find(
      (lesson) => lesson.id === fixtureLessonId,
    ) ?? null;
  if (!fixtureLesson) return null;

  return materializeFixtureLesson({
    fixtureLesson,
    methodology,
    methodologyTitle: options?.methodologyTitle,
  });
}

export function getCanonicalFixtureHomeworkFallback(
  lesson: MethodologyLesson,
): MethodologyLessonHomeworkDefinition | null {
  if (lesson.methodologySlug !== lessonContentFixtureMethodology.slug) {
    return null;
  }

  const fixtureLesson = resolveFixtureLessonByLessonIdentity(lesson);
  if (!fixtureLesson) return null;

  const homework =
    lessonContentFixtureHomeworkDefinitions.find(
      (item) => item.methodologyLessonId === fixtureLesson.id,
    ) ?? null;
  if (!homework) return null;

  return {
    ...homework,
    id: bootstrapHomeworkIdByFixtureHomeworkId.get(homework.id) ?? homework.id,
    methodologyLessonId: lesson.id,
  };
}

export function getCanonicalFixtureAssetsFallback(
  assetIds: string[],
): ReusableAsset[] {
  const seen = new Set<string>();
  const assets: ReusableAsset[] = [];

  for (const assetId of assetIds) {
    if (seen.has(assetId)) continue;
    seen.add(assetId);

    const asset = fixtureAssetsById.get(assetId);
    if (asset) assets.push(asset);
  }

  return assets;
}
