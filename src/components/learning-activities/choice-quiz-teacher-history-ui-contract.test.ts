import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const page = source(
  "src/components/learning-activities/run-observation-page-client.tsx",
);
const panel = source(
  "src/components/learning-activities/run-choice-quiz-history-panel.tsx",
);
const client = source(
  "src/components/learning-activities/choice-quiz-history-client.ts",
);
const styles = source(
  "src/components/learning-activities/run-choice-quiz-history-panel.module.css",
);

test("existing Run hierarchy visibly loads the strict teacher choice quiz history", () => {
  assert.match(page, /<RunChoiceQuizHistoryPanel lessonRunId=\{lessonRunId\}/);
  assert.match(
    client,
    /\/api\/v2\/lesson-runs\/\$\{encodeURIComponent\(lessonRunId\)\}\/choice-quiz-history/,
  );
  assert.match(client, /choiceQuizTeacherHistorySchema\.safeParse/);
  assert.match(client, /credentials: "same-origin"/);
  assert.match(client, /cache: "no-store"/);
  assert.match(
    client,
    /\/api\/v2\/choice-quiz-evaluations\/\$\{encodeURIComponent\(evaluationId\)\}\/corrections/,
  );
  assert.match(client, /correctChoiceQuizEvaluationInputSchema\.safeParse/);
  assert.match(client, /correctChoiceQuizEvaluationResultSchema\.safeParse/);
});

test("teacher history exposes learner, question, attempt, feedback policy and correction chain", () => {
  for (const token of [
    "attempt.learnerDisplayName",
    "attempt.question",
    "attempt.attemptNumber",
    "choiceQuizSupportLabel(attempt.supportContext)",
    "evaluation.isCorrect",
    "evaluation.score",
    "evaluation.revealAvailable",
    "evaluation.supersedesEvaluationId",
    "evaluation.supersededByEvaluationId",
    "evaluation.correctionReason",
  ]) {
    assert.ok(panel.includes(token), token);
  }
  assert.match(panel, /Цепочка оценок/);
  assert.match(panel, /Причина исправления/);
  assert.match(panel, /Выбранный ответ/);
  assert.match(panel, /Исправить текущую оценку/);
  assert.match(panel, /Сохранить исправление/);
  assert.match(panel, /type="radio"/);
  assert.match(panel, /crypto\.randomUUID\(\)/);
  assert.match(panel, /pendingRequest \?\?/);
  assert.doesNotMatch(
    panel,
    /evaluatorFingerprint|evaluatorVersion|correctOptionIds|learnerProfileId/,
  );
});

test("history includes accessible loading, empty, error, reload and responsive states", () => {
  assert.match(panel, /aria-labelledby="choice-quiz-history-title"/);
  assert.match(panel, /aria-busy/);
  assert.match(panel, /role="status"/);
  assert.match(panel, /role="alert"/);
  assert.match(panel, /Ответов пока нет/);
  assert.match(panel, /Повторить/);
  assert.match(panel, /Обновить историю ответов на тесты/);
  assert.match(panel, /Показаны последние 5 000 оценок и исправлений/);
  assert.doesNotMatch(panel, /Ответ был раскрыт ученику/);
  assert.match(panel, /<dl/);
  assert.match(panel, /<ol aria-label="Исходная оценка и исправления"/);
  assert.match(panel, /aria-live="polite"/);
  assert.match(panel, /maxLength=\{500\}/);
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /min-height: 2\.75rem/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /\.correctionEditor summary:focus-visible/);
});
