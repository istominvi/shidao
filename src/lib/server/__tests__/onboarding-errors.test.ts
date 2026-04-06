import test from "node:test";
import assert from "node:assert/strict";
import {
  isSchemaDriftError,
  mapOnboardingFailureToUserMessage,
} from "../onboarding-errors";

test("isSchemaDriftError detects missing RPC function errors", () => {
  assert.equal(
    isSchemaDriftError(
      new Error('Could not find the function public.onboard_teacher(p_user_id)'),
    ),
    true,
  );
});

test("isSchemaDriftError detects missing relation/column errors", () => {
  assert.equal(
    isSchemaDriftError(new Error('relation "public.class_teacher" does not exist')),
    true,
  );
  assert.equal(
    isSchemaDriftError(new Error('column "teacher_id" does not exist')),
    true,
  );
});

test("mapOnboardingFailureToUserMessage returns safe schema message", () => {
  assert.equal(
    mapOnboardingFailureToUserMessage(
      new Error('function public.onboard_teacher(uuid, text) does not exist'),
    ),
    "Не удалось завершить онбординг: проблема схемы БД (миграции не применены или устарели).",
  );
});

test("mapOnboardingFailureToUserMessage keeps generic fallback for runtime errors", () => {
  assert.equal(
    mapOnboardingFailureToUserMessage(new Error("fetch failed")),
    "Не удалось завершить онбординг. Попробуйте ещё раз или обратитесь в поддержку.",
  );
});
