import { PublishedCourseWorkspace } from "@/components/course-builder/published-course-workspace";
import { TopNav } from "@/components/top-nav";

export default async function PublishedCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ publicationId: string }>;
  searchParams: Promise<{ audience?: string | string[] }>;
}) {
  const { publicationId } = await params;
  const query = await searchParams;
  const catalogAudience =
    query.audience === "educators" ? "educators" : "children";

  return (
    <main className="course-demo-shell pb-12">
      <TopNav demoStyle />
      <PublishedCourseWorkspace
        publicationId={publicationId}
        catalogAudience={catalogAudience}
      />
    </main>
  );
}
