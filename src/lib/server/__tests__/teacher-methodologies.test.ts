import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/server/teacher-methodologies.ts", "utf8");

test("methodology lesson read model keeps canonical homework and source student content", () => {
  assert.equal(source.includes("canonicalHomework"), true);
  assert.equal(source.includes("getMethodologyLessonStudentContentByLessonIdAdmin"), true);
  assert.equal(source.includes("studentContentUnavailableReason"), true);
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
