import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { AppPageHeader } from "@/components/app/page-header";
import { CoursesIndex } from "@/components/course-builder/courses-index";
import { PageTransitionLink } from "@/components/navigation/page-transition-link";
import { TopNav } from "@/components/top-nav";
import { productButtonClassName } from "@/components/ui/button";
import { ROUTES } from "@/lib/auth";

type CoursesPageProps = {
  searchParams: Promise<{
    tab?: string | string[];
    course?: string | string[];
    audience?: string | string[];
  }>;
};

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const query = await searchParams;
  const initialTab = query.tab === "catalog" ? "catalog" : "mine";
  const initialLearningAudience =
    query.audience === "educators" ? "educators" : "children";

  if (initialTab === "catalog" && typeof query.course === "string") {
    const audienceQuery =
      initialLearningAudience === "educators" ? "?audience=educators" : "";
    redirect(
      `/courses/catalog/${encodeURIComponent(query.course)}${audienceQuery}`,
    );
  }

  return (
    <main className="course-demo-shell pb-12">
      <TopNav demoStyle />
      <div className="container app-page-container space-y-6">
        <AppPageHeader
          title="Курсы"
          actions={
            <PageTransitionLink
              href={ROUTES.coursesNew}
              direction="forward"
              className={productButtonClassName("primary")}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Создать курс
            </PageTransitionLink>
          }
        />
        <CoursesIndex
          initialTab={initialTab}
          initialLearningAudience={initialLearningAudience}
        />
      </div>
    </main>
  );
}
