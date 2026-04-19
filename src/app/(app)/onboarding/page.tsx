import { redirect } from "next/navigation";
import { OnboardingPageClient } from "@/app/(app)/onboarding/page-client";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { resolveOnboardingRedirect } from "@/lib/server/access-guards";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const params = await searchParams;
  const resolution = await resolveAccessPolicy();
  const redirectPath = resolveOnboardingRedirect(resolution.status, {
    mode: params.mode,
  });

  if (redirectPath) {
    redirect(redirectPath);
  }

  return <OnboardingPageClient manageMode={params.mode === "add-profile"} />;
}
