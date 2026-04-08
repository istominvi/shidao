import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { LessonContextChip } from "@/components/lessons/lesson-context-chip";
import { TopNav } from "@/components/top-nav";
import { ROUTES, toMethodologyLessonRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  assertTeacherMethodologiesAccess,
  canAccessTeacherMethodologies,
  getTeacherMethodologyDetailReadModel,
} from "@/lib/server/teacher-methodologies";

export default async function MethodologyDetailPage({ params }: { params: Promise<{ methodologySlug: string }> }) {
  const resolution = await resolveAccessPolicy();
  if (!canAccessTeacherMethodologies(resolution)) redirect(ROUTES.dashboard);
  assertTeacherMethodologiesAccess(resolution);

  const { methodologySlug } = await params;
  const readModel = await getTeacherMethodologyDetailReadModel(methodologySlug);
  if (!readModel) notFound();

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10 space-y-6">
        <AppPageHeader backHref={ROUTES.methodologies} backLabel="Методики" title={readModel.methodology.title} description={readModel.methodology.shortDescription} meta={<span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">Уроков: {readModel.lessons.length}</span>} />
        <section className="space-y-3">
          {readModel.lessons.map((lesson) => (
            <AppCard key={lesson.id} className="p-5" as="article">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-950">{lesson.title}</h2>
                  <p className="mt-1 text-sm text-neutral-600">{lesson.positionLabel} · {lesson.durationLabel} · {lesson.readinessLabel}</p>
                  <p className="mt-2 text-xs text-neutral-500">Без группы и расписания</p>
                </div>
                <LessonContextChip context="methodology" />
              </div>
              <div className="mt-4 flex gap-2">
                <Link href={toMethodologyLessonRoute(readModel.methodology.slug, lesson.id)} className="landing-btn landing-btn-primary text-xs">Открыть урок</Link>
                <Link href={`${toMethodologyLessonRoute(readModel.methodology.slug, lesson.id)}?assign=1`} className="landing-btn landing-btn-muted text-xs">Назначить</Link>
              </div>
            </AppCard>
          ))}
        </section>
      </div>
    </main>
  );
}
