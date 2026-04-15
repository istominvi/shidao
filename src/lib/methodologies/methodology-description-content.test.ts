import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/lib/methodologies/methodology-description-content.ts",
  "utf8",
);

test("world-around-me structured description content includes canonical tabs payload and curriculum sections", () => {
  assert.equal(source.includes('methodologySlug: "world-around-me"'), true);
  assert.equal(source.includes('title: "Учебно-тематический план"'), true);
  assert.equal(source.includes('columns: ["Раздел", "Период", "Часы", "Грамматика"]'), true);
  assert.equal(source.includes('section: "10. Шоу талантов."'), true);
  assert.equal(source.includes('title: "Планируемые результаты"'), true);
  assert.equal(source.includes('title: "Содержание и компетенции"'), true);
  assert.equal(source.includes('title: "Методическое обеспечение"'), true);
  assert.equal(source.includes('title: "Литература"'), true);
});
