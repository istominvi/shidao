import type { Metadata } from "next";
import { RunObservationPageClient } from "@/components/learning-activities/run-observation-page-client";

export const metadata: Metadata = {
  title: "Проведение урока",
  robots: { index: false, follow: false },
};

export default async function LessonRunObservationPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonRunId: string }>;
}) {
  const { courseId, lessonRunId } = await params;

  return (
    <main className="app-page-shell pb-12">
      <RunObservationPageClient
        key={lessonRunId}
        courseId={courseId}
        lessonRunId={lessonRunId}
      />
    </main>
  );
}
