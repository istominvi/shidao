"use client";

import { courseBuilderRequest } from "@/components/course-builder/course-builder-client";
import type {
  FinalizedObservationCorrectionResult,
  LearnerSafeActivityProfile,
  LearningRecommendationType,
  RecommendationOverrideResult,
  TeacherLearnerActivityProfile,
} from "@/modules/learning-activities";

function encoded(value: string) {
  return encodeURIComponent(value);
}

export async function loadTeacherActivityProfile(learnerProfileId: string) {
  const payload = await courseBuilderRequest<{
    profile: TeacherLearnerActivityProfile;
  }>(`/api/v2/learner-profiles/${encoded(learnerProfileId)}/activity-profile`, {
    cache: "no-store",
  });
  return payload.profile;
}

export async function loadSelfActivityProfile() {
  const payload = await courseBuilderRequest<{
    profile: LearnerSafeActivityProfile;
  }>("/api/v2/me/learning-profile/activity-profile", { cache: "no-store" });
  return payload.profile;
}

export async function loadObservedActivityProfile(learnerProfileId: string) {
  const payload = await courseBuilderRequest<{
    profile: LearnerSafeActivityProfile;
  }>(`/api/v2/observations/${encoded(learnerProfileId)}/activity-profile`, {
    cache: "no-store",
  });
  return payload.profile;
}

export async function correctTeacherObservation(
  learnerProfileId: string,
  input: {
    observationId: string;
    expectedLearningRecordId: string;
    rating: "independent" | "with_support" | "not_yet";
    privateNote: string | null;
    correctionReason: string;
    idempotencyKey: string;
  },
) {
  const payload = await courseBuilderRequest<{
    result: FinalizedObservationCorrectionResult;
  }>(
    `/api/v2/learner-profiles/${encoded(learnerProfileId)}/activity-profile/corrections`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return payload.result;
}

export async function setTeacherRecommendationOverride(
  learnerProfileId: string,
  input: {
    sourceLearningObjectiveIdAtTime: string;
    action: "replace" | "dismiss" | "clear";
    recommendationType: LearningRecommendationType | null;
    privateReason: string | null;
    expectedStateUpdatedAt: string;
  },
) {
  const payload = await courseBuilderRequest<{
    result: RecommendationOverrideResult;
  }>(
    `/api/v2/learner-profiles/${encoded(learnerProfileId)}/activity-profile/recommendation-overrides`,
    { method: "PUT", body: JSON.stringify(input) },
  );
  return payload.result;
}
