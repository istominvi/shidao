import type { CourseBuilderActor } from "@/modules/course-builder/domain";
import { createCourseBuilderRepository } from "@/modules/course-builder/repository";
import { getActiveCourseBuilderContext } from "@/modules/course-builder/server-context";
import { createCourseBuilderService } from "@/modules/course-builder/service";
import { createLessonRunsServiceForActor } from "@/modules/lesson-runs/server-context";
import { createLearningActivitiesRepository } from "./repository";
import { createLearningActivitiesService } from "./service";

export function createLearningActivitiesServiceForActor(
  actor: CourseBuilderActor,
) {
  return createLearningActivitiesService({
    repository: createLearningActivitiesRepository(actor.accessToken),
    courseBuilderService: createCourseBuilderService({
      repository: createCourseBuilderRepository(actor.accessToken),
    }),
    lessonRunsService: createLessonRunsServiceForActor(actor),
  });
}

export async function getLearningActivitiesContext() {
  const { actor } = await getActiveCourseBuilderContext();
  return {
    actor,
    service: createLearningActivitiesServiceForActor(actor),
  };
}
