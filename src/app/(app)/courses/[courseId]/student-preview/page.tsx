import type { Metadata } from "next";
import { StudentScreenPreview } from "@/components/course-builder/student-screen-preview";

export const metadata: Metadata = {
  title: "Предпросмотр экрана ученика",
  robots: { index: false, follow: false },
};

export default async function CourseStudentPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ lesson?: string | string[] }>;
}) {
  const { courseId } = await params;
  const query = await searchParams;
  const initialLessonId = Array.isArray(query.lesson)
    ? query.lesson[0]
    : query.lesson;
  return (
    <StudentScreenPreview
      courseId={courseId}
      initialLessonId={initialLessonId}
    />
  );
}
