import { redirect } from "next/navigation";
import { OnboardingPageClient } from "@/app/(app)/onboarding/page-client";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { resolveOnboardingRedirect } from "@/lib/server/access-guards";

export default async function OnboardingPage() {
  const resolution = await resolveAccessPolicy();
  const redirectPath = resolveOnboardingRedirect(resolution.status);

  if (redirectPath) {
    redirect(redirectPath);
  }

  return <OnboardingPageClient />;
}
