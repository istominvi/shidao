"use client";

import { courseBuilderRequest } from "@/components/course-builder/course-builder-client";

export type TeacherLiveDelivery = {
  run: { started: boolean; ended: boolean };
  cursor: { slideId: string | null; revision: number };
  slides: Array<{ id: string; position: number; componentCount: number }>;
  learners: Array<{
    learnerProfileId: string;
    displayName: string;
    identityState: "claimed" | "offline";
    courseAccessEnabled: boolean;
    runCapabilityEnabled: boolean;
  }>;
};

function teacherLivePath(lessonRunId: string) {
  return `/api/v2/lesson-runs/${encodeURIComponent(lessonRunId)}/live-delivery`;
}

export async function loadTeacherLiveDelivery(lessonRunId: string) {
  const payload = await courseBuilderRequest<{ delivery: TeacherLiveDelivery }>(
    teacherLivePath(lessonRunId),
    { cache: "no-store" },
  );
  return payload.delivery;
}

export async function updateTeacherLiveAccess(
  lessonRunId: string,
  input: {
    learnerProfileId: string;
    courseAccessEnabled: boolean;
    runCapabilityEnabled: boolean;
  },
) {
  const payload = await courseBuilderRequest<{ delivery: TeacherLiveDelivery }>(
    `${teacherLivePath(lessonRunId)}/access`,
    { method: "PUT", body: JSON.stringify(input) },
  );
  return payload.delivery;
}

export async function updateTeacherLiveCursor(
  lessonRunId: string,
  input: { slideId: string | null; expectedRevision: number },
) {
  const payload = await courseBuilderRequest<{
    cursor: TeacherLiveDelivery["cursor"];
  }>(`${teacherLivePath(lessonRunId)}/cursor`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return payload.cursor;
}
