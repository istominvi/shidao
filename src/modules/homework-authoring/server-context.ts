import { getActiveCourseBuilderContext } from "@/modules/course-builder/server-context";
import { createHomeworkAuthoringRepository } from "./repository";
import { createHomeworkAuthoringService } from "./service";

export async function getHomeworkAuthoringContext() {
  const { actor, service: courseService } =
    await getActiveCourseBuilderContext();
  return {
    actor,
    service: createHomeworkAuthoringService({
      repository: createHomeworkAuthoringRepository(actor.accessToken),
      courseService,
    }),
  };
}
