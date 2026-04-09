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
      <div className="container space-y-6 py-7 md:py-10">
        <AppPageHeader
          backHref={ROUTES.methodologies}
          backLabel="Методики"
          eyebrow="Паспорт курса"
          title={readModel.methodology.title}
          description={readModel.methodology.shortDescription}
          meta={
            <>
              <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">{readModel.lessons.length} уроков доступно в ShiDao</span>
              <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">{readModel.course.targetAgeLabel}</span>
              <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">{readModel.course.lessonDurationLabel}</span>
            </>
          }
        />

        <AppCard className="p-4 md:p-5" muted>
          <p className="text-sm text-neutral-700">{readModel.sourceRuntimeNote}</p>
        </AppCard>

        <section className="grid gap-4 lg:grid-cols-3">
          <AppCard className="p-5 lg:col-span-2">
            <h2 className="text-lg font-semibold text-neutral-950">Как устроен курс</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-700">{readModel.course.courseScopeSummary}</p>
            <p className="mt-3 text-sm leading-6 text-neutral-700">{readModel.course.teachingApproachSummary}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700">Уровень: {readModel.course.level}</span>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700">Язык: {readModel.course.locale}</span>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700">Курс: {readModel.course.courseDurationLabel}</span>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700">Группа: {readModel.course.idealGroupSizeLabel}{readModel.course.maxGroupSize ? ` (макс. ${readModel.course.maxGroupSize})` : ""}</span>
              {typeof readModel.course.approximateVocabularyCount === "number" ? <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700">~{readModel.course.approximateVocabularyCount} слов за курс</span> : null}
              {typeof readModel.course.songCount === "number" ? <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700">{readModel.course.songCount} песен</span> : null}
              {typeof readModel.course.videoCount === "number" ? <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700">{readModel.course.videoCount} видео</span> : null}
            </div>
          </AppCard>

          <AppCard className="p-5">
            <h2 className="text-lg font-semibold text-neutral-950">Для кого курс</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-700">{readModel.course.audienceSummary}</p>
            <p className="mt-3 text-sm leading-6 text-neutral-700">Материалы: {readModel.course.materialsEcosystemSummary}</p>
          </AppCard>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <AppCard className="p-5">
            <h2 className="text-base font-semibold text-neutral-950">Темы и модули</h2>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              {readModel.course.thematicModules.map((item) => (
                <li key={item} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neutral-400" />{item}</li>
              ))}
            </ul>
          </AppCard>
          <AppCard className="p-5">
            <h2 className="text-base font-semibold text-neutral-950">Результаты обучения</h2>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              {readModel.course.learningOutcomes.map((item) => (
                <li key={item} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-500/70" />{item}</li>
              ))}
            </ul>
          </AppCard>
          <AppCard className="p-5">
            <h2 className="text-base font-semibold text-neutral-950">Что важно преподавателю</h2>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              {readModel.course.formatHighlights.map((item) => (
                <li key={item} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet-500/70" />{item}</li>
              ))}
              {readModel.course.methodologyNotes.map((item) => (
                <li key={item} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500/70" />{item}</li>
              ))}
            </ul>
          </AppCard>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-neutral-950">Уроки методики</h2>
            <LessonContextChip context="methodology" />
          </div>
          {readModel.lessons.map((lesson) => (
            <AppCard key={lesson.id} className="p-5" as="article">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-neutral-950">{lesson.title}</h3>
                  <p className="mt-1 text-sm text-neutral-600">{lesson.positionLabel} · {lesson.durationLabel} · {lesson.readinessLabel}</p>

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <p className="text-xs text-neutral-700"><span className="font-semibold">Лексика:</span> {lesson.vocabularyPreview.join(", ") || "—"}</p>
                    <p className="text-xs text-neutral-700"><span className="font-semibold">Фразы:</span> {lesson.phrasePreview.join(", ") || "—"}</p>
                    <p className="text-xs text-neutral-700"><span className="font-semibold">Медиа:</span> {lesson.mediaSummary.videos} видео · {lesson.mediaSummary.songs} песен · {lesson.mediaSummary.worksheets} worksheet</p>
                    <p className="text-xs text-neutral-700"><span className="font-semibold">Prep:</span> {lesson.materialsSignal}</p>
                    <p className="text-xs text-neutral-700 md:col-span-2"><span className="font-semibold">Домашняя практика:</span> {lesson.homeworkSignal}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={toMethodologyLessonRoute(readModel.methodology.slug, lesson.id)} className="landing-btn landing-btn-primary text-xs">Открыть урок</Link>
                  <Link href={`${toMethodologyLessonRoute(readModel.methodology.slug, lesson.id)}?assign=1`} className="landing-btn landing-btn-muted text-xs">Назначить</Link>
                </div>
              </div>
            </AppCard>
          ))}
        </section>
      </div>
    </main>
  );
}
