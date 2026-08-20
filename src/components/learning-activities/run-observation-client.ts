"use client";

import { courseBuilderRequest } from "@/components/course-builder/course-builder-client";
import type {
  LessonComponentObservation,
  RunObservationWorkspace,
  SaveLessonComponentObservationsInput,
} from "@/modules/learning-activities";

export async function loadRunObservationWorkspace(
  lessonRunId: string,
): Promise<RunObservationWorkspace> {
  const payload = await courseBuilderRequest<{
    workspace: RunObservationWorkspace;
  }>(`/api/v2/lesson-runs/${encodeURIComponent(lessonRunId)}/observations`, {
    cache: "no-store",
  });
  return payload.workspace;
}

export async function saveLessonComponentObservations(
  lessonRunId: string,
  input: SaveLessonComponentObservationsInput,
): Promise<LessonComponentObservation[]> {
  const payload = await courseBuilderRequest<{
    observations: LessonComponentObservation[];
  }>(`/api/v2/lesson-runs/${encodeURIComponent(lessonRunId)}/observations`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return payload.observations;
}
