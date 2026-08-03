import { AppPageHeader } from "@/components/app/page-header";
import { NewCourseForm } from "@/components/course-builder/new-course-form";
import { TopNav } from "@/components/top-nav";
import { ROUTES } from "@/lib/auth";

export default function NewCoursePage() {
  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container app-page-container space-y-6">
        <AppPageHeader
          eyebrow="Course builder"
          title="Новый курс"
          description="Сохраните пустой Course или сразу соберите первый осмысленный Lesson с упорядоченными Lesson Steps и компонентами."
          backHref={ROUTES.courses}
          backLabel="К курсам"
        />
        <NewCourseForm />
      </div>
    </main>
  );
}
