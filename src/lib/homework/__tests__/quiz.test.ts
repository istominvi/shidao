import assert from "node:assert/strict";
import test from "node:test";
import {
  gradeQuizSingleChoice,
  normalizeQuizSingleChoicePayload,
  normalizeQuizSubmissionPayload,
} from "../quiz";

const quiz = normalizeQuizSingleChoicePayload({
  id: "quiz-1",
  version: 1,
  questions: [
    {
      id: "q1",
      prompt: "Q1",
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      correctOptionId: "a",
    },
    {
      id: "q2",
      prompt: "Q2",
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      correctOptionId: "b",
    },
  ],
});

test("quiz grading returns full score for correct answers", () => {
  assert.ok(quiz);
  const submission = normalizeQuizSubmissionPayload({
    answers: [
      { questionId: "q1", selectedOptionId: "a" },
      { questionId: "q2", selectedOptionId: "b" },
    ],
  });
  assert.ok(submission);
  const result = gradeQuizSingleChoice(quiz!, submission!);
  assert.equal(result.score, 2);
  assert.equal(result.maxScore, 2);
});

test("quiz grading returns partial score", () => {
  assert.ok(quiz);
  const submission = normalizeQuizSubmissionPayload({
    answers: [
      { questionId: "q1", selectedOptionId: "a" },
      { questionId: "q2", selectedOptionId: "a" },
    ],
  });
  assert.ok(submission);
  const result = gradeQuizSingleChoice(quiz!, submission!);
  assert.equal(result.score, 1);
  assert.equal(result.answers[1]?.isCorrect, false);
});

test("quiz submission normalization rejects invalid payload", () => {
  const submission = normalizeQuizSubmissionPayload({
    answers: [{ questionId: "", selectedOptionId: "a" }],
  });
  assert.equal(submission, null);
});
