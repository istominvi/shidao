import type { ActivityRole } from "@/modules/course-builder/registry/contracts";
import type {
  ChoiceQuizLearnerExecution,
  ChoiceQuizTeacherHistory,
  CorrectChoiceQuizEvaluationInput,
  CorrectChoiceQuizEvaluationResult,
  IssuedChoiceQuizProjection,
  SubmitChoiceQuizAttemptInput,
  SubmitChoiceQuizAttemptResult,
} from "./contracts";

/** Trusted server context. These values are decoded from the encrypted app
 * session and are never accepted from learner request input. */
export type ChoiceQuizLearnerActor = {
  authUserId: string;
  supabaseSessionId: string;
};

/** Trusted teacher identity/session claims decoded from the server-held
 * Supabase access token. Browser correction input cannot supply either. */
export type ChoiceQuizTeacherActor = ChoiceQuizLearnerActor;

export type ChoiceQuizLiveComponentSource = {
  id: string;
  schemaVersion: number;
  position: number;
  updatedAt: string;
  activityRole: ActivityRole | null;
  primaryLearningObjectiveId: string | null;
  payload: unknown;
};

export type IssueChoiceQuizDefinitionInput = {
  actor: ChoiceQuizLearnerActor;
  lessonRunId: string;
  cursorRevision: number;
  component: ChoiceQuizLiveComponentSource;
};

export type {
  ChoiceQuizLearnerExecution,
  ChoiceQuizTeacherHistory,
  CorrectChoiceQuizEvaluationInput,
  CorrectChoiceQuizEvaluationResult,
  IssuedChoiceQuizProjection,
  SubmitChoiceQuizAttemptInput,
  SubmitChoiceQuizAttemptResult,
};
