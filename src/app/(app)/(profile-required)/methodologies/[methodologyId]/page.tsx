import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { MethodologyLessonCard } from "@/components/methodologies/methodology-lesson-card";
import { TopNav } from "@/components/top-nav";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { assertTeacherGroupsAccess, canAccessTeacherGroups } from "@/lib/server/teacher-groups";
import { getTeacherMethodologyDetail } from "@/lib/server/teacher-methodologies";

export default async function MethodologyDetailPage({
  params,
}: {
  params: Promise<{ methodologyId: string }>;
}) {
  const resolution = await resolveAccessPolicy();
  if (!canAccessTeacherGroups(resolution)) {
    redirect(ROUTES.dashboard);
  }

  assertTeacherGroupsAccess(resolution);
  const { methodologyId } = await params;
  const detail = await getTeacherMethodologyDetail(methodologyId);

  if (!detail) {
    notFound();
  }

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10 space-y-6">
        <AppPageHeader
          backHref={ROUTES.methodologies}
          backLabel="Методики"
          eyebrow={(
            <span>
              <Link href={ROUTES.methodologies} className="text-neutral-500 underline underline-offset-2">Методики</Link>
              {" / "}
              <span className="text-neutral-700">{detail.title}</span>
            </span>
          )}
          title={detail.title}
          description={detail.shortDescription ?? "Описание методики пока не заполнено."}
          meta={(
            <>
              <span className="rounded-full border border-neutral-200 bg-white/90 px-3 py-1 text-sm text-neutral-700">
                Уроков методики: {detail.lessonCount}
              </span>
              <span className="rounded-full border border-neutral-200 bg-white/90 px-3 py-1 text-sm text-neutral-700">
                Модулей: {detail.moduleCount}
              </span>
            </>
          )}
        />

        <AppCard className="border-sky-200/70 bg-sky-50/40 p-4 text-sm text-sky-900">
          Урок методики — это содержательная единица программы. Занятие — это конкретная встреча в расписании.
        </AppCard>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold tracking-[-0.02em] text-neutral-950">Уроки методики</h2>
          {detail.lessonCount === 0 ? (
            <AppCard className="border-dashed border-neutral-300 p-5 text-sm text-neutral-600">
              В этой методике пока нет уроков.
            </AppCard>
          ) : (
            <div className="space-y-6">
              {detail.modules.map((module) => (
                <section key={module.moduleIndex} className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">
                    Модуль {module.moduleIndex}
                  </h3>
                  <div className="space-y-3">
                    {module.lessons.map((lesson) => (
                      <MethodologyLessonCard key={lesson.id} lesson={lesson} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
