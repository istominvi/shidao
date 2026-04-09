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

  const passport = readModel.overview.passport;

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container space-y-6 py-7 md:py-10">
        <AppPageHeader
          backHref={ROUTES.methodologies}
          backLabel="Методики"
          title={readModel.methodology.title}
          description={readModel.methodology.shortDescription}
          meta={
            <>
              <LessonContextChip context="methodology" />
              <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">Уроков в ShiDao: {readModel.overview.availableLessonsCount}</span>
              {readModel.overview.programLessonCount ? (
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">Программа: ~{readModel.overview.programLessonCount} уроков</span>
              ) : null}
            </>
          }
        />

        <AppCard className="p-5 md:p-6">
          <p className="text-sm font-medium text-neutral-700">{readModel.overview.sourceRuntimeNote}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-neutral-700">
            {passport.targetAgeLabel ? <span className="rounded-full bg-neutral-100 px-2.5 py-1">Возраст: {passport.targetAgeLabel}</span> : null}
            {passport.level ? <span className="rounded-full bg-neutral-100 px-2.5 py-1">Уровень: {passport.level}</span> : null}
            {passport.lessonDurationLabel ? <span className="rounded-full bg-neutral-100 px-2.5 py-1">Урок: {passport.lessonDurationLabel}</span> : null}
            {passport.courseDurationLabel ? <span className="rounded-full bg-neutral-100 px-2.5 py-1">Курс: {passport.courseDurationLabel}</span> : null}
            {passport.approximateVocabularyCount ? <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-800">≈ {passport.approximateVocabularyCount} слов</span> : null}
            {passport.songCount || passport.videoCount ? (
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-800">{passport.songCount ?? 0} песен · {passport.videoCount ?? 0} видео</span>
            ) : null}
            {passport.idealGroupSizeLabel ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">
                Группа: {passport.idealGroupSizeLabel}{passport.maxGroupSize ? ` (макс. ${passport.maxGroupSize})` : ""}
              </span>
            ) : null}
            {passport.activitiesPerLessonLabel ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">{passport.activitiesPerLessonLabel}</span> : null}
          </div>
          {passport.courseScopeLabel ? <p className="mt-4 text-sm text-neutral-700">Объём курса: {passport.courseScopeLabel}</p> : null}
          {readModel.overview.programLessonCount && readModel.overview.programLessonCount > readModel.overview.availableLessonsCount ? (
            <p className="mt-2 text-xs text-neutral-600">В платформу импортирована только часть программы: доступно {readModel.overview.availableLessonsCount} урок(ов) из ~{readModel.overview.programLessonCount}.</p>
          ) : null}
        </AppCard>

        <section className="grid gap-4 lg:grid-cols-2">
          <AppCard className="p-5" as="article">
            <h2 className="text-lg font-semibold text-neutral-900">Для кого курс</h2>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              {passport.audienceLabel ? <li>• {passport.audienceLabel}</li> : null}
              {passport.lessonFormatSummary ? <li>• {passport.lessonFormatSummary}</li> : null}
              {readModel.overview.teachingApproachSummary ? <li>• {readModel.overview.teachingApproachSummary}</li> : null}
            </ul>
          </AppCard>

          <AppCard className="p-5" as="article">
            <h2 className="text-lg font-semibold text-neutral-900">Что дети осваивают</h2>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              {readModel.overview.learningOutcomes.map((outcome) => (
                <li key={outcome}>• {outcome}</li>
              ))}
            </ul>
          </AppCard>

          <AppCard className="p-5" as="article">
            <h2 className="text-lg font-semibold text-neutral-900">Тематическая структура</h2>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              {readModel.overview.thematicModules.map((module) => (
                <li key={module}>• {module}</li>
              ))}
            </ul>
          </AppCard>

          <AppCard className="p-5" as="article">
            <h2 className="text-lg font-semibold text-neutral-900">Материалы и методические заметки</h2>
            {readModel.overview.materialsEcosystemSummary ? <p className="mt-3 text-sm text-neutral-700">{readModel.overview.materialsEcosystemSummary}</p> : null}
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              {readModel.overview.methodologyNotes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
          </AppCard>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold tracking-[-0.02em] text-neutral-950">Уроки в ShiDao</h2>
          {readModel.lessons.map((lesson) => (
            <AppCard key={lesson.id} className="p-5" as="article">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-950">{lesson.title}</h3>
                  <p className="mt-1 text-sm text-neutral-600">{lesson.positionLabel} · {lesson.durationLabel} · {lesson.readinessLabel}</p>
                  {lesson.vocabularyPreview.length ? <p className="mt-2 text-sm text-neutral-700">Лексика: {lesson.vocabularyPreview.join(", ")}</p> : null}
                  {lesson.phrasePreview.length ? <p className="mt-1 text-sm text-neutral-700">Фразы: {lesson.phrasePreview.join(" · ")}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-700">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1">Видео: {lesson.mediaSummary.videos}</span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1">Песни: {lesson.mediaSummary.songs}</span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1">Worksheet: {lesson.mediaSummary.worksheets}</span>
                    {lesson.materialsSignal ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">Нужна подготовка материалов</span> : null}
                    {lesson.homeworkSignal ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-800">Есть домашнее задание</span> : null}
                  </div>
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
