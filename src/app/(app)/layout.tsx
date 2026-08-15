import { redirect } from "next/navigation";
import { SystemAssistant } from "@/components/assistant/system-assistant";
import { SystemAssistantProvider } from "@/components/assistant/system-assistant-provider";
import { PageTransitionProvider } from "@/components/navigation/page-transition-provider";
import { PrimaryHeaderSummaryProvider } from "@/components/navigation/primary-header-summary-provider";
import { primaryHeaderSummaryOwnerKey } from "@/lib/navigation/primary-header-summary-owner";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { resolveAppLayoutRedirect } from "@/lib/server/access-guards";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const resolution = await resolveAccessPolicy();
  const redirectPath = resolveAppLayoutRedirect(resolution.status);

  if (redirectPath) {
    redirect(redirectPath);
  }

  const accountKey =
    resolution.status === "account"
      ? primaryHeaderSummaryOwnerKey(resolution.context.userId)
      : "unavailable";

  return (
    <PageTransitionProvider>
      <PrimaryHeaderSummaryProvider key={accountKey} accountKey={accountKey}>
        <SystemAssistantProvider>
          {children}
          <SystemAssistant />
        </SystemAssistantProvider>
      </PrimaryHeaderSummaryProvider>
    </PageTransitionProvider>
  );
}
