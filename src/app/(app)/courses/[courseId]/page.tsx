import { CourseWorkspaceClient } from "@/components/course-builder/course-workspace";

export default async function CourseWorkspacePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  return (
    <main className="app-page-shell pb-12">
      <CourseWorkspaceClient key={courseId} courseId={courseId} />
    </main>
  );
}
