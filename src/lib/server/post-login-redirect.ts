import { ROUTES } from "../auth";

export function resolvePostLoginRedirectForContext(context: {
  actorKind: "adult" | "student";
  hasAnyAdultProfile: boolean;
}) {
  if (context.actorKind === "student") {
    return ROUTES.schedule;
  }

  return context.hasAnyAdultProfile ? ROUTES.dashboard : ROUTES.onboarding;
}
