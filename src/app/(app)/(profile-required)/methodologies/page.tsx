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

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white/90 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-900">{value}</p>
    </div>
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
          description="Изучайте структуру курса, подход и материалы методики. Назначение в конкретные группы и даты выполняется позже в runtime-слое занятий."
          meta={
            <>
              <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">
                Методик: {readModel.cards.length}
              </span>
            </>
          }
        />

        <section className="grid gap-4 xl:grid-cols-2">
          {readModel.cards.map((methodology) => (
            <AppCard key={methodology.id} className="p-5 md:p-6" as="article">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-neutral-950">{methodology.title}</h2>
                  {methodology.shortDescription ? (
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-700">{methodology.shortDescription}</p>
                  ) : null}
                </div>
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700">
                  Доступно уроков в ShiDao: {methodology.lessonCount}
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <StatChip label="Возраст" value={methodology.passport.targetAgeLabel || "—"} />
                <StatChip label="Уровень" value={methodology.passport.level || "—"} />
                <StatChip label="Длительность урока" value={methodology.passport.lessonDurationLabel || "—"} />
                <StatChip label="Курс" value={methodology.passport.courseDurationLabel || "—"} />
                <StatChip
                  label="Лексика"
                  value={methodology.passport.approximateVocabularyCount ? `~${methodology.passport.approximateVocabularyCount} слов` : "—"}
                />
                <StatChip
                  label="Медиа"
                  value={
                    methodology.passport.songsCount && methodology.passport.videosCount
                      ? `${methodology.passport.songsCount} песен · ${methodology.passport.videosCount} видео`
                      : "—"
                  }
                />
                <StatChip label="Группа" value={methodology.passport.idealGroupSizeLabel || "—"} />
                <StatChip
                  label="Максимум"
                  value={methodology.passport.maxGroupSize ? `${methodology.passport.maxGroupSize} детей` : "—"}
                />
              </div>

              {methodology.passport.teachingApproachSummary ? (
                <p className="mt-4 text-sm leading-6 text-neutral-700">
                  <span className="font-semibold text-neutral-900">Подход:</span> {methodology.passport.teachingApproachSummary}
                </p>
              ) : null}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {methodology.passport.thematicModules.length ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.13em] text-neutral-500">Темы курса</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {methodology.passport.thematicModules.slice(0, 3).map((theme) => (
                        <span key={theme} className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {methodology.passport.learningOutcomes.length ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.13em] text-neutral-500">Что получит ребёнок</p>
                    <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
                      {methodology.passport.learningOutcomes.slice(0, 3).map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-neutral-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={toMethodologyRoute(methodology.slug)}
                  className="inline-flex items-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Открыть методику
                </Link>
              </div>
            </AppCard>
          ))}
        </section>
      </div>
    </main>
  );
}
