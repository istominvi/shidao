import { AppPageHeader } from "@/components/app/page-header";
import { NewCourseForm } from "@/components/course-builder/new-course-form";
import { TopNav } from "@/components/top-nav";
import { ROUTES } from "@/lib/auth";

export default function NewCoursePage() {
  return (
    <main className="course-demo-shell pb-12">
      <TopNav demoStyle />
      <div className="container app-page-container course-workspace-container pb-16">
        <AppPageHeader
          eyebrow="Конструктор курса"
          title="Новый курс"
          description="Заполните сведения о курсе, добавьте материалы и сохраните его, чтобы перейти к урокам."
          back={{ type: "link", href: ROUTES.courses, label: "К курсам" }}
        />
        <NewCourseForm />
      </div>
    </main>
  );
}
