import type {
  LearnerLiveSource,
  LearnerLiveState,
  PresentationCursor,
  SetLiveAccessInput,
  SetPresentationCursorInput,
  TeacherLiveDelivery,
} from "./contracts";

/** Trusted server context. Neither value is accepted from learner HTTP input. */
export type LearnerLiveActor = {
  authUserId: string;
  supabaseSessionId: string;
};

export type {
  LearnerLiveSource,
  LearnerLiveState,
  PresentationCursor,
  SetLiveAccessInput,
  SetPresentationCursorInput,
  TeacherLiveDelivery,
};
