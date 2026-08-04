import Link from "next/link";
import { Plus } from "lucide-react";
import { AppPageHeader } from "@/components/app/page-header";
import { CoursesIndex } from "@/components/course-builder/courses-index";
import { TopNav } from "@/components/top-nav";
import { productButtonClassName } from "@/components/ui/button";
import { ROUTES } from "@/lib/auth";

export default function CoursesPage() {
  return (
    <main className="course-demo-shell pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav demoStyle />
      <div className="container app-page-container space-y-6">
        <AppPageHeader
          title="Курсы"
          description="Создавайте собственные курсы, собирайте уроки из компонентов и проверяйте видимые ученику материалы на экране ученика."
          actions={
            <Link
              href={ROUTES.coursesNew}
              className={productButtonClassName("primary")}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Новый курс
            </Link>
          }
        />
        <CoursesIndex />
      </div>
    </main>
  );
}
