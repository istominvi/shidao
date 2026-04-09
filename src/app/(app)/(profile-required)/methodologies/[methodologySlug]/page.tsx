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

function PassportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-900">{value}</p>
    </div>
  );
}

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
          eyebrow="Методика · источник уроков"
          title={readModel.methodology.title}
          description={readModel.methodology.shortDescription}
          meta={
            <>
              <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">
                Доступно уроков в ShiDao: {readModel.lessons.length}
              </span>
              <LessonContextChip context="methodology" />
            </>
          }
        />

        <AppCard className="space-y-4 p-5 md:p-6">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <PassportMetric label="Возраст" value={readModel.passport.targetAgeLabel || "—"} />
            <PassportMetric label="Уровень" value={readModel.passport.level || "—"} />
            <PassportMetric label="Урок" value={readModel.passport.lessonDurationLabel || "—"} />
            <PassportMetric label="Курс" value={readModel.passport.courseDurationLabel || "—"} />
            <PassportMetric
              label="Лексика"
              value={readModel.passport.approximateVocabularyCount ? `~${readModel.passport.approximateVocabularyCount} слов` : "—"}
            />
            <PassportMetric
              label="Медиа"
              value={
                readModel.passport.songsCount && readModel.passport.videosCount
                  ? `${readModel.passport.songsCount} песен · ${readModel.passport.videosCount} видео`
                  : "—"
              }
            />
            <PassportMetric label="Рекомендуемая группа" value={readModel.passport.idealGroupSizeLabel || "—"} />
            <PassportMetric label="Максимум" value={readModel.passport.maxGroupSize ? `${readModel.passport.maxGroupSize} детей` : "—"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article>
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">Как преподаётся курс</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-700">{readModel.passport.teachingApproachSummary || "Описание подхода скоро появится."}</p>
              {readModel.passport.lessonFormatSummary ? (
                <p className="mt-3 text-sm leading-6 text-neutral-700">
                  <span className="font-semibold text-neutral-900">Формат урока:</span> {readModel.passport.lessonFormatSummary}
                </p>
              ) : null}
              {readModel.passport.materialsEcosystemSummary ? (
                <p className="mt-3 text-sm leading-6 text-neutral-700">
                  <span className="font-semibold text-neutral-900">Материалы:</span> {readModel.passport.materialsEcosystemSummary}
                </p>
              ) : null}
            </article>

            <article className="space-y-3">
              {readModel.passport.thematicModules.length ? (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">Тематическая структура</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {readModel.passport.thematicModules.map((theme) => (
                      <span key={theme} className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {readModel.passport.learningOutcomes.length ? (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">Результаты обучения</h3>
                  <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
                    {readModel.passport.learningOutcomes.map((outcome) => (
                      <li key={outcome} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-neutral-400" />
                        <span>{outcome}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-800">
            Эта страница — педагогический source layer. Привязка к группе, дате и формату выполняется позже через «Назначить урок».
          </div>
          {readModel.passport.courseScopeLabel || readModel.passport.availableLessonsLabel ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-3 text-sm text-neutral-700">
              {readModel.passport.courseScopeLabel ? <p>{readModel.passport.courseScopeLabel}</p> : null}
              {readModel.passport.availableLessonsLabel ? <p className="mt-1">{readModel.passport.availableLessonsLabel}</p> : null}
            </div>
          ) : null}
        </AppCard>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900">Уроки методики</h2>
          {readModel.lessons.map((lesson) => (
            <AppCard key={lesson.id} className="p-5" as="article">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-neutral-950">{lesson.title}</h3>
                  <p className="text-sm text-neutral-600">
                    {lesson.positionLabel} · {lesson.durationLabel} · {lesson.readinessLabel}
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-700">
                      Медиа: {lesson.mediaSummary.videos} видео · {lesson.mediaSummary.songs} песен · {lesson.mediaSummary.worksheets} worksheets
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-700">
                      Подготовка: {lesson.hasMaterialsPrep ? "есть чек-лист" : "не указано"}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-700">
                      Домашняя/worksheet часть: {lesson.hasHomeworkSignal ? "есть" : "нет"}
                    </span>
                  </div>
                  {lesson.vocabularyPreview.length ? (
                    <p className="text-sm text-neutral-700">Лексика: {lesson.vocabularyPreview.join(" · ")}</p>
                  ) : null}
                  {lesson.phrasePreview.length ? (
                    <p className="text-sm text-neutral-700">Фразы: {lesson.phrasePreview.join(" · ")}</p>
                  ) : null}
                </div>
                <LessonContextChip context="methodology" />
              </div>
              <div className="mt-4 flex gap-2">
                <Link href={toMethodologyLessonRoute(readModel.methodology.slug, lesson.id)} className="landing-btn landing-btn-primary text-xs">
                  Открыть урок
                </Link>
                <Link href={`${toMethodologyLessonRoute(readModel.methodology.slug, lesson.id)}?assign=1`} className="landing-btn landing-btn-muted text-xs">
                  Назначить
                </Link>
              </div>
            </AppCard>
          ))}
        </section>
      </div>
    </main>
  );
}
