export type ChoiceQuizRepositoryErrorCode =
  | "choice_quiz_repository_error"
  | "choice_quiz_network_error"
  | "choice_quiz_response_invalid"
  | "choice_quiz_session_revoked"
  | "choice_quiz_not_found"
  | "choice_quiz_state_conflict"
  | "choice_quiz_idempotency_conflict"
  | "choice_quiz_validation_error";

export class ChoiceQuizRepositoryError extends Error {
  readonly name = "ChoiceQuizRepositoryError";

  constructor(
    message: string,
    readonly status: 400 | 401 | 404 | 409 | 502 | 503,
    readonly code: ChoiceQuizRepositoryErrorCode,
  ) {
    super(message);
  }
}

export class ChoiceQuizProjectionError extends Error {
  readonly name = "ChoiceQuizProjectionError";
  readonly code = "choice_quiz_projection_error";
}
