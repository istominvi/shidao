import Link from "next/link";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { ROUTES, toMethodologyRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  assertTeacherMethodologiesAccess,
  canAccessTeacherMethodologies,
  getTeacherMethodologiesIndexReadModel,
} from "@/lib/server/teacher-methodologies";

function statPill(label: string, value: string) {
  return (
    <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700">
      <span className="font-semibold text-neutral-900">{value}</span> · {label}
    </span>
  );
}

export default async function MethodologiesPage() {
  const resolution = await resolveAccessPolicy();
  if (!canAccessTeacherMethodologies(resolution)) {
    redirect(ROUTES.dashboard);
  }

  assertTeacherMethodologiesAccess(resolution);
  const readModel = await getTeacherMethodologiesIndexReadModel();

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container space-y-6 py-7 md:py-10">
        <AppPageHeader
          eyebrow="Педагогический source layer"
          title="Методики"
          description="Изучайте структуру и формат курса здесь, а затем назначайте уроки в реальные группы и расписание."
          meta={<span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">{readModel.cards.length} методик</span>}
        />

        <section className="grid gap-4 lg:grid-cols-2">
          {readModel.cards.map((methodology) => (
            <AppCard key={methodology.id} className="p-5 md:p-6" as="article">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold tracking-[-0.02em] text-neutral-950">{methodology.title}</h2>
                  {methodology.shortDescription ? (
                    <p className="mt-2 text-sm leading-6 text-neutral-700">{methodology.shortDescription}</p>
                  ) : null}
                </div>
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700">
                  {methodology.availableLessonsLabel}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {statPill("возраст", methodology.course.targetAgeLabel)}
                {statPill("уровень", methodology.course.level)}
                {statPill("урок", methodology.course.lessonDurationLabel)}
                {statPill("курс", methodology.course.courseDurationLabel)}
                {statPill("группа", methodology.course.idealGroupSizeLabel)}
                {typeof methodology.course.approximateVocabularyCount === "number"
                  ? statPill("лексика", `~${methodology.course.approximateVocabularyCount}`)
                  : null}
                {typeof methodology.course.songCount === "number" && typeof methodology.course.videoCount === "number"
                  ? statPill("медиа", `${methodology.course.songCount} песен / ${methodology.course.videoCount} видео`)
                  : null}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Тематические кластеры</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
                    {methodology.course.thematicModules.slice(0, 3).map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-neutral-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Фокус обучения</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
                    {methodology.course.learningOutcomes.slice(0, 3).map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500/70" />
                        <span>{item}</span>
                      </li>
                    ))}
                    {methodology.course.formatHighlights.slice(0, 1).map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-500/70" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                {methodology.lessonScopeNote}
              </p>

              <Link
                href={toMethodologyRoute(methodology.slug)}
                className="mt-4 inline-flex items-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Открыть методику
              </Link>
            </AppCard>
          ))}
        </section>
      </div>
    </main>
  );
}
