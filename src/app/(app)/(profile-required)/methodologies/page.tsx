import { redirect } from "next/navigation";
import { TopNav } from "@/components/top-nav";
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
      <div className="container py-7 md:py-10">
        <section className="landing-surface rounded-3xl border border-white/80 p-6 md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">Каталог</p>
          <h1 className="mt-3 text-3xl font-black text-neutral-950">Методики</h1>
          <p className="mt-2 text-sm text-neutral-700">Индекс доступных методик (в текущем стенде обычно одна методика).</p>
          <ul className="mt-4 space-y-2 text-sm text-neutral-700">
            {methodologies.map((item) => (
              <li key={item} className="rounded-xl border border-neutral-200 bg-white px-3 py-2">{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
