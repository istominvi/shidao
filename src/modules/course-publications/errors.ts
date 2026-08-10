export class CoursePublicationRepositoryError extends Error {
  readonly name = "CoursePublicationRepositoryError";

  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
    readonly definitelyNotCommitted = false,
  ) {
    super(message);
  }
}

export class CoursePublicationStorageError extends Error {
  readonly name = "CoursePublicationStorageError";

  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class CoursePublicationMutationRateLimitError extends Error {
  readonly name = "CoursePublicationMutationRateLimitError";
  readonly code = "course_publication_mutation_rate_limited";

  constructor(readonly retryAfterSeconds: number) {
    super("Слишком много операций с публикациями. Попробуйте немного позже.");
    this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
  }
}

export class CoursePublicationMutationInFlightError extends Error {
  readonly name = "CoursePublicationMutationInFlightError";
  readonly code = "course_publication_mutation_in_flight";

  constructor() {
    super("Для этого аккаунта уже выполняется операция с публикацией.");
  }
}

export function publicationRepositoryFailure(input: {
  message: string;
  status: number;
  databaseCode: string | null;
  definitelyNotCommitted?: boolean;
}) {
  const token = input.message.toLowerCase();
  if (input.status >= 500) {
    return new CoursePublicationRepositoryError(
      "Не удалось подтвердить результат операции с каталогом курсов.",
      503,
      "course_publication_repository_error",
      false,
    );
  }
  if (token.includes("course_publication_account_quota_exceeded")) {
    return new CoursePublicationRepositoryError(
      "Лимит хранения опубликованных курсов для аккаунта исчерпан.",
      409,
      "course_publication_account_quota_exceeded",
      input.definitelyNotCommitted,
    );
  }
  if (/not_found|access_denied|owner_mismatch/.test(token)) {
    return new CoursePublicationRepositoryError(
      "Публикация курса не найдена или недоступна.",
      404,
      "course_publication_not_found",
      input.definitelyNotCommitted,
    );
  }
  if (
    /source_changed|(?:snapshot|payload|idempotent|live)(?:_[a-z0-9]+)*_mismatch|revision_conflict|stale/.test(
      token,
    )
  ) {
    return new CoursePublicationRepositoryError(
      "Курс изменился во время публикации. Обновите страницу и повторите попытку.",
      409,
      "course_publication_source_changed",
      input.definitelyNotCommitted,
    );
  }
  if (/already_published|duplicate|conflict/.test(token)) {
    return new CoursePublicationRepositoryError(
      "Публикация уже была изменена. Обновите страницу и повторите попытку.",
      409,
      "course_publication_conflict",
      input.definitelyNotCommitted,
    );
  }
  if (
    /manifest|rights|asset_.*invalid|path_invalid|bucket_invalid|snapshot_invalid|id_map|content_sha256/.test(
      token,
    )
  ) {
    return new CoursePublicationRepositoryError(
      "Не удалось подтвердить данные публикации.",
      400,
      "course_publication_validation_error",
      input.definitelyNotCommitted,
    );
  }
  return new CoursePublicationRepositoryError(
    "Не удалось подтвердить данные операции с каталогом курсов.",
    input.status >= 400 && input.status < 500 ? 400 : 503,
    "course_publication_repository_error",
    input.definitelyNotCommitted,
  );
}

export function isTrustedPostgrestRollback(
  status: number,
  payload: unknown,
  contentType: string | null,
) {
  if (
    status < 400 ||
    status >= 500 ||
    !contentType?.toLowerCase().startsWith("application/json") ||
    !payload ||
    typeof payload !== "object"
  ) {
    return false;
  }
  const details = payload as Record<string, unknown>;
  return (
    typeof details.code === "string" &&
    /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(details.code) &&
    typeof details.message === "string" &&
    details.message.length > 0
  );
}
