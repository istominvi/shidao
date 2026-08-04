import type { Metadata } from "next";
import { StudentScreenPreview } from "@/components/course-builder/student-screen-preview";

export const metadata: Metadata = {
  title: "Предпросмотр экрана ученика",
  robots: { index: false, follow: false },
};

export default async function CourseStudentPreviewPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return <StudentScreenPreview courseId={courseId} />;
}
