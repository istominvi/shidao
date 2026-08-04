import { AppPageHeader } from "@/components/app/page-header";
import { NewCourseForm } from "@/components/course-builder/new-course-form";
import { TopNav } from "@/components/top-nav";
import { ROUTES } from "@/lib/auth";

export default function NewCoursePage() {
  return (
    <main className="course-demo-shell pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav demoStyle />
      <div className="container app-page-container space-y-6">
        <AppPageHeader
          eyebrow="Конструктор курса"
          title="Новый курс"
          description="Сохраните пустой курс или сразу соберите первый осмысленный урок с упорядоченными компонентами."
          backHref={ROUTES.courses}
          backLabel="К курсам"
        />
        <NewCourseForm />
      </div>
    </main>
  );
}
