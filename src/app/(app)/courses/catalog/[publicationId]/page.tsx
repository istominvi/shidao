import { PublishedCourseWorkspace } from "@/components/course-builder/published-course-workspace";

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
    <main className="app-page-shell pb-12">
      <PublishedCourseWorkspace
        publicationId={publicationId}
        catalogAudience={catalogAudience}
      />
    </main>
  );
}
