import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  lessonContentFixtureMethodology,
  lessonContentFixtureMethodologyLessons,
  type MethodologyLesson,
} from "../../lesson-content";
import { buildFixtureBootstrapRows } from "../lesson-content-bootstrap";
import {
  getCanonicalFixtureAssetsFallback,
  getCanonicalFixtureHomeworkFallback,
  mergeCanonicalMethodologyLessonFallbacks,
  resolveCanonicalMethodologyLessonFallback,
} from "../teacher-methodology-fixture-fallback";

const source = readFileSync("src/lib/server/teacher-methodologies.ts", "utf8");

function materializeDbLesson(
  lesson: MethodologyLesson,
  input: { id: string; methodologyId: string },
): MethodologyLesson {
  return {
    ...lesson,
    id: input.id,
    methodologyId: input.methodologyId,
    methodologySlug: lessonContentFixtureMethodology.slug,
    shell: {
      ...lesson.shell,
      id: input.id,
      methodologyId: input.methodologyId,
    },
  };
}

test("methodology lesson read model keeps canonical homework and source student content", () => {
  assert.equal(source.includes("canonicalHomework"), true);
  assert.equal(source.includes("quizDefinition"), true);
  assert.equal(source.includes('canonicalHomework.kind === "quiz_single_choice"'), true);
  assert.equal(source.includes("getMethodologyLessonStudentContentByLessonIdAdmin"), true);
  assert.equal(source.includes("studentContentUnavailableReason"), true);
  assert.equal(source.includes("getFixtureStudentContentFallback"), true);
  assert.equal(source.includes('"schema_missing"'), true);
  assert.equal(source.includes('"invalid_payload"'), true);
  assert.equal(source.includes('"load_failed"'), true);
});

test("teacher-facing methodology title formatter normalizes bilingual separator to en dash", () => {
  assert.equal(source.includes("function joinBilingualTitle"), true);
  assert.equal(source.includes(" – "), true);
  assert.equal(source.includes("`${titleRu} — ${titleNative}`"), false);
});

test("methodologies index read model exposes normalized cover image metadata", () => {
  assert.equal(source.includes("coverImage: normalizeMethodologyCoverImage(item)"), true);
  assert.equal(source.includes("defaultMethodologyCoverImageBySlug"), true);
  assert.equal(source.includes("Обложка методики"), true);
});


test("methodology detail read model wires structured description content by slug", () => {
  assert.equal(source.includes("getMethodologyDescriptionContent"), true);
  assert.equal(source.includes("descriptionContent: getMethodologyDescriptionContent(methodology.slug)"), true);
});


test("methodology detail read model keeps normalized cover image", () => {
  assert.equal(source.includes("coverImage: normalizeMethodologyCoverImage(methodology)"), true);
});

test("methodology lesson read model does not query uuid columns with fixture ids", () => {
  assert.equal(source.includes("function isUuidLike"), true);
  assert.equal(source.includes("const databaseAssetIds = normalizedIds.filter(isUuidLike);"), true);
  assert.equal(source.includes("listReusableAssetsByIdsAdmin(databaseAssetIds)"), true);
  assert.equal(source.includes("const dbLesson = isUuidLike(input.lessonId)"), true);
});

test("canonical methodology fallback fills missing fixture lessons with stable route ids", () => {
  const methodology = {
    ...lessonContentFixtureMethodology,
    id: "db-methodology-world-around-me",
  };
  const bootstrapRows = buildFixtureBootstrapRows();
  const bootstrapIdByFixtureId = new Map(
    bootstrapRows.methodologyLessonRows.map((lesson) => [
      lesson.fixtureLessonId,
      lesson.id,
    ]),
  );
  const dbLessons = lessonContentFixtureMethodologyLessons
    .slice(0, 3)
    .map((lesson, index) =>
      materializeDbLesson(lesson, {
        id: `db-lesson-${index + 1}`,
        methodologyId: methodology.id,
      }),
    );

  const merged = mergeCanonicalMethodologyLessonFallbacks(
    methodology,
    dbLessons,
    { methodologyTitle: "World Around Me" },
  );
  const lessonFour = lessonContentFixtureMethodologyLessons[3];
  const mergedLessonFour = merged.find(
    (lesson) => lesson.shell.position.lessonIndex === 4,
  );

  assert.equal(merged.length, 4);
  assert.equal(mergedLessonFour?.id, bootstrapIdByFixtureId.get(lessonFour.id));
  assert.equal(mergedLessonFour?.methodologyId, methodology.id);
  assert.equal(mergedLessonFour?.methodologySlug, methodology.slug);
});

test("canonical methodology fallback resolves fixture lesson pages and assets", () => {
  const methodology = {
    ...lessonContentFixtureMethodology,
    id: "db-methodology-world-around-me",
  };
  const bootstrapRows = buildFixtureBootstrapRows();
  const lessonFour = lessonContentFixtureMethodologyLessons[3];
  const lessonFourBootstrapRow = bootstrapRows.methodologyLessonRows.find(
    (lesson) => lesson.fixtureLessonId === lessonFour.id,
  );
  assert.ok(lessonFourBootstrapRow);

  const resolvedLesson = resolveCanonicalMethodologyLessonFallback(
    methodology,
    lessonFourBootstrapRow.id,
    { methodologyTitle: "World Around Me" },
  );
  assert.ok(resolvedLesson);
  assert.equal(resolvedLesson.shell.position.lessonIndex, 4);
  assert.equal(resolvedLesson.shell.title, lessonFour.shell.title);

  const homework = getCanonicalFixtureHomeworkFallback(resolvedLesson);
  const lessonFourHomeworkRow = bootstrapRows.homeworkDefinitionRows.find(
    (item) => item.methodology_lesson_id === lessonFourBootstrapRow.id,
  );
  assert.equal(homework?.id, lessonFourHomeworkRow?.id);
  assert.equal(homework?.methodologyLessonId, resolvedLesson.id);

  const assets = getCanonicalFixtureAssetsFallback([
    "media:lesson-4-abacus",
    "missing-asset",
    "media:lesson-4-abacus",
  ]);
  assert.deepEqual(
    assets.map((asset) => asset.id),
    ["media:lesson-4-abacus"],
  );
});
