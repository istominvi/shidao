import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/lib/methodologies/methodology-description-content.ts",
  "utf8",
);

test("world-around-me structured description content includes revised goals section and curriculum lessons map", () => {
  assert.equal(source.includes('methodologySlug: "world-around-me"'), true);
  assert.equal(source.includes('lead:\n    "我周围的世界 / Мир вокруг меня — рабочая программа раннего обучения китайскому языку для дошкольников 5–6 лет.'), true);
  assert.equal(source.includes('type: "goal_map"'), true);
  assert.equal(source.includes('title: "Цели и задачи курса"'), true);
  assert.equal(source.includes("valueOrientations"), true);
  assert.equal(source.includes('title: "Учебно-тематический план"'), true);
  assert.equal(source.includes('columns: ["Раздел", "Период", "Часы", "Грамматика"]'), true);
  assert.equal(source.includes('section: "10. Шоу талантов."'), true);
  assert.equal(source.includes('lessons: ["Урок 37", "Урок 38", "Урок 39", "Урок 40"]'), false);
  assert.equal(source.includes('title: "Планируемые результаты"'), true);
  assert.equal(source.includes('title: "Содержание и компетенции"'), true);
  assert.equal(source.includes('title: "Методическое обеспечение"'), true);
  assert.equal(source.includes('title: "Литература"'), false);
});
