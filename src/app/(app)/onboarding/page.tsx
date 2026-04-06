import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import OnboardingClientPage from "./onboarding-client";

export default async function OnboardingPage() {
  const resolution = await resolveAccessPolicy();

  if (resolution.status === "guest" || resolution.status === "degraded") {
    redirect(ROUTES.login);
  }

  if (resolution.status === "student") {
    redirect(ROUTES.dashboard);
  }

  return <OnboardingClientPage />;
}
