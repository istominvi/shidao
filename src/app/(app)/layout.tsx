import { redirect } from "next/navigation";
import { SystemAssistant } from "@/components/assistant/system-assistant";
import { SystemAssistantProvider } from "@/components/assistant/system-assistant-provider";
import { PageTransitionProvider } from "@/components/navigation/page-transition-provider";
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

  return (
    <PageTransitionProvider>
      <SystemAssistantProvider>
        {children}
        <SystemAssistant />
      </SystemAssistantProvider>
    </PageTransitionProvider>
  );
}
