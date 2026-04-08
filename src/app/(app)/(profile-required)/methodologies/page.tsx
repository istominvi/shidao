import { redirect } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { listMethodologyLessonsCatalogAdmin } from "@/lib/server/lesson-content-repository";
import { assertTeacherGroupsAccess, canAccessTeacherGroups } from "@/lib/server/teacher-groups";

export default async function MethodologiesPage() {
  const resolution = await resolveAccessPolicy();
  if (!canAccessTeacherGroups(resolution)) {
    redirect(ROUTES.dashboard);
  }

  assertTeacherGroupsAccess(resolution);
  const lessons = await listMethodologyLessonsCatalogAdmin();
  const methodologies = Array.from(
    new Set(lessons.map((lesson) => lesson.methodologyTitle?.trim() || "Без названия")),
  );

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10 space-y-6">
        <AppPageHeader
          eyebrow="Каталог"
          title="Методики"
          description="Индекс доступных методик (в текущем стенде обычно одна методика)."
        />
        <AppCard className="p-6 md:p-8">
          <ul className="mt-4 space-y-2 text-sm text-neutral-700">
            {methodologies.map((item) => (
              <li key={item} className="rounded-xl border border-neutral-200 bg-white px-3 py-2">{item}</li>
            ))}
          </ul>
        </AppCard>
      </div>
    </main>
  );
}
