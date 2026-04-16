import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/lib/methodologies/methodology-description-content.ts",
  "utf8",
);

test("world-around-me description content is rendered as a structured methodology passport", () => {
  assert.equal(source.includes('methodologySlug: "world-around-me"'), true);
  assert.equal(source.includes('passportFacts'), true);
  assert.equal(source.includes('type: "fact_cards"'), true);
  assert.equal(source.includes('title: "DNA курса"'), true);
  assert.equal(source.includes('type: "anatomy_flow"'), true);
  assert.equal(source.includes('title: "Анатомия урока (инфографика цикла)"'), true);
  assert.equal(source.includes('title: "Педагогические принципы"'), true);
  assert.equal(source.includes('title: "Экосистема материалов"'), true);
  assert.equal(source.includes('title: "Важная заметка по безопасности"'), true);
});
