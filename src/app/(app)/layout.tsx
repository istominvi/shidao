import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { AssistantPageContextProvider } from "@/components/communication/assistant-page-context";
import { CommunicationCenter } from "@/components/communication/communication-center";
import { CommunicationCenterProvider } from "@/components/communication/communication-center-provider";
import { PageTransitionProvider } from "@/components/navigation/page-transition-provider";
import { PrimaryHeaderSummaryProvider } from "@/components/navigation/primary-header-summary-provider";
import { PersistentTopNav } from "@/components/top-nav";
import { primaryHeaderSummaryOwnerKey } from "@/lib/navigation/primary-header-summary-owner";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { resolveAppLayoutRedirect } from "@/lib/server/access-guards";
import "../styles/communication-center.css";
import "../styles/page-motion.css";

export const viewport: Viewport = {
  themeColor: "#f5f1e8",
  viewportFit: "cover",
};

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
      ? primaryHeaderSummaryOwnerKey(resolution.context.authUserId)
      : "unavailable";

  return (
    <PageTransitionProvider>
      <PrimaryHeaderSummaryProvider key={accountKey} accountKey={accountKey}>
        <AssistantPageContextProvider>
          <CommunicationCenterProvider>
            <div className="app-product-chrome">
              <PersistentTopNav />
              {children}
            </div>
            <CommunicationCenter />
          </CommunicationCenterProvider>
        </AssistantPageContextProvider>
      </PrimaryHeaderSummaryProvider>
    </PageTransitionProvider>
  );
}
