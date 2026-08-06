import {
  clearAppSession,
  isSessionRevoked,
  readAppSession,
} from "@/lib/server/app-session";
import {
  requireSupabaseUserAccessToken,
  SupabaseUserReauthenticationRequiredError,
} from "@/lib/server/supabase-user-session";
import type { CourseBuilderActor } from "@/modules/course-builder/domain";
import { createLessonRunsRepository } from "./repository";
import { createLessonRunsService } from "./service";

export function createLessonRunsServiceForActor(actor: CourseBuilderActor) {
  return createLessonRunsService({
    repository: createLessonRunsRepository(actor.accessToken),
  });
}

export async function getLessonRunsContext() {
  const session = await readAppSession();
  if (!session) throw new SupabaseUserReauthenticationRequiredError();
  const accessToken = await requireSupabaseUserAccessToken();
  const repository = createLessonRunsRepository(accessToken);
  const sessionsInvalidBefore = await repository.getSessionInvalidBefore();
  if (isSessionRevoked(session.iat, sessionsInvalidBefore)) {
    await clearAppSession();
    throw new SupabaseUserReauthenticationRequiredError();
  }
  const actor: CourseBuilderActor = {
    authUserId: session.uid,
    accessToken,
  };
  return {
    actor,
    service: createLessonRunsService({ repository }),
  };
}
