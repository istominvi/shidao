import Link from "next/link";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { ROUTES, toMethodologyRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { getTeacherMethodologiesCatalog } from "@/lib/server/teacher-methodologies";
import { assertTeacherGroupsAccess, canAccessTeacherGroups } from "@/lib/server/teacher-groups";

export default async function MethodologiesPage() {
  const resolution = await resolveAccessPolicy();
  if (!canAccessTeacherGroups(resolution)) {
    redirect(ROUTES.dashboard);
  }

  assertTeacherGroupsAccess(resolution);
  const methodologies = await getTeacherMethodologiesCatalog();

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10 space-y-6">
        <AppPageHeader
          eyebrow="Библиотека преподавателя"
          title="Методики"
          description="Здесь вы изучаете структуру методики и уроки методики. Конкретные занятия создаются отдельно — в контексте группы и расписания."
        />

        {methodologies.length === 0 ? (
          <AppCard className="border-dashed border-neutral-300 p-6 text-sm text-neutral-600">
            В библиотеке пока нет методик. Когда они появятся, здесь будет доступен обзор структуры и уроков методики.
          </AppCard>
        ) : (
          <section className="grid gap-4 md:grid-cols-2">
            {methodologies.map((methodology) => (
              <AppCard key={methodology.id} as="article" className="p-6 space-y-4">
                <div className="space-y-2">
                  <h2 className="text-xl font-bold tracking-[-0.02em] text-neutral-950">{methodology.title}</h2>
                  {methodology.shortDescription ? (
                    <p className="text-sm text-neutral-700">{methodology.shortDescription}</p>
                  ) : (
                    <p className="text-sm text-neutral-500">Краткое описание пока не добавлено.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-neutral-700">
                  <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">Уроков методики: {methodology.lessonCount}</span>
                  <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">Модулей: {methodology.moduleCount}</span>
                </div>

                <div>
                  <Link
                    href={toMethodologyRoute(methodology.id)}
                    className="inline-flex items-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
                  >
                    Открыть методику
                  </Link>
                </div>
              </AppCard>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
