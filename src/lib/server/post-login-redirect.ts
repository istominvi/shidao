import { ROUTES } from "../auth";
import type { ProfileKind } from "../auth";

export function resolvePostLoginRedirectForContext(context: {
  actorKind: "adult" | "student";
  hasAnyAdultProfile: boolean;
  activeAdultProfile?: ProfileKind | null;
}) {
  if (context.actorKind === "student") {
    return ROUTES.lessons;
  }

  if (!context.hasAnyAdultProfile) {
    return ROUTES.onboarding;
  }

  return context.activeAdultProfile === "teacher"
    ? ROUTES.lessons
    : ROUTES.dashboard;
}
