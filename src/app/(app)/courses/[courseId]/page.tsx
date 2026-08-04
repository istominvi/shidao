import { CourseWorkspaceClient } from "@/components/course-builder/course-workspace";
import { TopNav } from "@/components/top-nav";

export default async function CourseWorkspacePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  return (
    <main className="course-demo-shell pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav demoStyle />
      <CourseWorkspaceClient key={courseId} courseId={courseId} />
    </main>
  );
}
