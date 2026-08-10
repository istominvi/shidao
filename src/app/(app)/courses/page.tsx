import Link from "next/link";
import { Plus } from "lucide-react";
import { AppPageHeader } from "@/components/app/page-header";
import { CoursesIndex } from "@/components/course-builder/courses-index";
import { TopNav } from "@/components/top-nav";
import { productButtonClassName } from "@/components/ui/button";
import { ROUTES } from "@/lib/auth";

type CoursesPageProps = {
  searchParams: Promise<{
    tab?: string | string[];
    course?: string | string[];
  }>;
};

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const query = await searchParams;
  const initialTab = query.tab === "catalog" ? "catalog" : "mine";
  const initialCatalogCourseId =
    initialTab === "catalog" && typeof query.course === "string"
      ? query.course
      : null;

  return (
    <main className="course-demo-shell pb-12">
      <TopNav demoStyle />
      <div className="container app-page-container space-y-6">
        <AppPageHeader
          title="Курсы"
          description="Создавайте свои курсы с нуля или добавляйте готовые из каталога."
          actions={
            <Link
              href={ROUTES.coursesNew}
              className={productButtonClassName("primary")}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Создать курс
            </Link>
          }
        />
        <CoursesIndex
          initialTab={initialTab}
          initialCatalogCourseId={initialCatalogCourseId}
        />
      </div>
    </main>
  );
}
