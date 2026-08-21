"use client";

import { courseBuilderRequest } from "@/components/course-builder/course-builder-client";
import type {
  CourseAudience,
  LearningRecord,
  LearnerGroup,
  LearnerProfile,
  LessonRun,
} from "@/modules/lesson-runs/domain";
import type {
  LearningEvidence,
  LessonObservationCorrection,
  LessonComponentObservation,
} from "@/modules/learning-activities";

function encoded(value: string) {
  return encodeURIComponent(value);
}

export async function loadLearnerProfiles() {
  const payload = await courseBuilderRequest<{
    learnerProfiles: LearnerProfile[];
  }>("/api/v2/learner-profiles", { cache: "no-store" });
  return payload.learnerProfiles;
}

export async function createLearnerProfile(
  displayName: string,
  learnerGroupIds: string[] = [],
) {
  const payload = await courseBuilderRequest<{
    learnerProfile: LearnerProfile;
  }>("/api/v2/learner-profiles", {
    method: "POST",
    body: JSON.stringify({ displayName, learnerGroupIds }),
  });
  return payload.learnerProfile;
}

export async function updateLearnerProfile(
  learnerProfileId: string,
  input: { displayName: string; learnerGroupIds: string[] },
) {
  const payload = await courseBuilderRequest<{
    learnerProfile: LearnerProfile;
  }>(`/api/v2/learner-profiles/${encoded(learnerProfileId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return payload.learnerProfile;
}

export async function deleteLearnerProfile(learnerProfileId: string) {
  await courseBuilderRequest<{ deleted: boolean }>(
    `/api/v2/learner-profiles/${encoded(learnerProfileId)}`,
    { method: "DELETE" },
  );
}

export async function loadLearnerGroups() {
  const payload = await courseBuilderRequest<{
    learnerGroups: LearnerGroup[];
  }>("/api/v2/learner-groups", { cache: "no-store" });
  return payload.learnerGroups;
}

export async function createLearnerGroup(input: {
  name: string;
  learnerProfileIds: string[];
}) {
  const payload = await courseBuilderRequest<{ learnerGroup: LearnerGroup }>(
    "/api/v2/learner-groups",
    { method: "POST", body: JSON.stringify(input) },
  );
  return payload.learnerGroup;
}

export async function updateLearnerGroup(
  learnerGroupId: string,
  input: { name: string; learnerProfileIds: string[] },
) {
  const payload = await courseBuilderRequest<{ learnerGroup: LearnerGroup }>(
    `/api/v2/learner-groups/${encoded(learnerGroupId)}`,
    { method: "PUT", body: JSON.stringify(input) },
  );
  return payload.learnerGroup;
}

export async function deleteLearnerGroup(learnerGroupId: string) {
  await courseBuilderRequest<{ deleted: boolean }>(
    `/api/v2/learner-groups/${encoded(learnerGroupId)}`,
    { method: "DELETE" },
  );
}

export async function loadCourseAudience(courseId: string) {
  const payload = await courseBuilderRequest<{
    audience?: CourseAudience;
    learnerProfiles: LearnerProfile[];
  }>(`/api/v2/courses/${encoded(courseId)}/audience`, {
    cache: "no-store",
  });
  return (
    payload.audience ?? {
      directLearners: payload.learnerProfiles,
      groups: [],
      effectiveLearners: payload.learnerProfiles,
    }
  );
}

export async function replaceCourseAudience(
  courseId: string,
  input: {
    directLearnerProfileIds: string[];
    learnerGroupIds: string[];
  },
) {
  const payload = await courseBuilderRequest<{
    audience?: CourseAudience;
    learnerProfiles: LearnerProfile[];
  }>(`/api/v2/courses/${encoded(courseId)}/audience`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return (
    payload.audience ?? {
      directLearners: payload.learnerProfiles,
      groups: [],
      effectiveLearners: payload.learnerProfiles,
    }
  );
}

export async function scheduleLessonRun(
  lessonId: string,
  input: {
    scheduledAt: string;
    plannedDurationMinutes?: number;
    learnerProfileIds?: string[];
  },
) {
  const payload = await courseBuilderRequest<{ run: LessonRun }>(
    `/api/v2/lessons/${encoded(lessonId)}/runs`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return payload.run;
}

export async function updateLessonRun(
  runId: string,
  input: {
    scheduledAt: string;
    plannedDurationMinutes?: number;
    learnerProfileIds?: string[];
  },
) {
  const payload = await courseBuilderRequest<{ run: LessonRun }>(
    `/api/v2/lesson-runs/${encoded(runId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return payload.run;
}

export async function startLessonRun(runId: string) {
  const payload = await courseBuilderRequest<{ run: LessonRun }>(
    `/api/v2/lesson-runs/${encoded(runId)}/start`,
    { method: "POST" },
  );
  return payload.run;
}

export async function cancelLessonRun(runId: string) {
  const payload = await courseBuilderRequest<{ run: LessonRun }>(
    `/api/v2/lesson-runs/${encoded(runId)}/cancel`,
    { method: "POST" },
  );
  return payload.run;
}

export async function completeLessonRun(
  runId: string,
  input: {
    teacherReport: string;
    actualDurationMinutes?: number | null;
    records: Array<{
      learnerProfileId: string;
      wasPresent: boolean;
      needsRepeat: boolean;
      teacherComment: string;
      shareWithLearner: boolean;
    }>;
  },
) {
  const payload = await courseBuilderRequest<{ run: LessonRun }>(
    `/api/v2/lesson-runs/${encoded(runId)}/complete`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return payload.run;
}

async function loadRunHistory(path: string) {
  return courseBuilderRequest<{
    runs: LessonRun[];
    observations: LessonComponentObservation[];
    corrections: LessonObservationCorrection[];
    correctionsTruncated: boolean;
    correctionsUnavailable: boolean;
    evidence: LearningEvidence[];
    evidenceUnavailable: boolean;
  }>(path, {
    cache: "no-store",
  });
}

export function loadLessonHistory(lessonId: string) {
  return loadRunHistory(`/api/v2/lessons/${encoded(lessonId)}/history`);
}

export function loadCourseHistory(courseId: string) {
  return loadRunHistory(`/api/v2/courses/${encoded(courseId)}/history`);
}

export async function loadLearnerHistory(learnerProfileId: string) {
  return courseBuilderRequest<{
    records: LearningRecord[];
    observations: LessonComponentObservation[];
    corrections: LessonObservationCorrection[];
    correctionsTruncated: boolean;
    correctionsUnavailable: boolean;
    evidence: LearningEvidence[];
    evidenceUnavailable: boolean;
  }>(`/api/v2/learner-profiles/${encoded(learnerProfileId)}/history`, {
    cache: "no-store",
  });
}

export function loadSchedule(from: string, to: string) {
  const query = new URLSearchParams({ from, to });
  return courseBuilderRequest<{ runs: LessonRun[] }>(
    `/api/v2/lesson-runs?${query.toString()}`,
    { cache: "no-store" },
  ).then((payload) => payload.runs);
}
