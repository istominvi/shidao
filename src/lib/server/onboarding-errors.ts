function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.toLowerCase();
  return String(error ?? "").toLowerCase();
}

export function isSchemaDriftError(error: unknown) {
  const message = normalizeErrorMessage(error);
  return (
    message.includes("could not find the function") ||
    message.includes("schema cache") ||
    (message.includes("function") && message.includes("does not exist")) ||
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("column") && message.includes("does not exist"))
  );
}

export function mapOnboardingFailureToUserMessage(error: unknown) {
  if (isSchemaDriftError(error)) {
    return "Не удалось завершить онбординг: проблема схемы БД (миграции не применены или устарели).";
  }

  return "Не удалось завершить онбординг. Попробуйте ещё раз или обратитесь в поддержку.";
}
