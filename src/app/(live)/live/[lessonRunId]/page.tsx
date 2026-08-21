import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LearnerLiveDelivery } from "@/components/learning-activities/learner-live-delivery";
import { ROUTES, toLearnerLiveRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";

export const metadata: Metadata = {
  title: "Live-урок",
  robots: { index: false, follow: false },
};

export default async function LearnerLiveDeliveryPage({
  params,
}: {
  params: Promise<{ lessonRunId: string }>;
}) {
  const { lessonRunId } = await params;
  const resolution = await resolveAccessPolicy();
  if (resolution.status !== "account") {
    const next = toLearnerLiveRoute(lessonRunId);
    redirect(`${ROUTES.login}?next=${encodeURIComponent(next)}`);
  }
  return <LearnerLiveDelivery lessonRunId={lessonRunId} />;
}
