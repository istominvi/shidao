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
      <div className="container py-7 md:py-10 space-y-6">
        <AppPageHeader
          eyebrow="Педагогический source layer"
          title="Методики"
          description="Здесь вы изучаете курс как педагогический шаблон: структуру, подход, материалы и формат уроков. Назначение в группу и дату выполняется позже в runtime."
        />

        <AppCard className="p-4 md:p-5" muted>
          <p className="text-sm text-neutral-700">
            <span className="font-semibold text-neutral-900">Как использовать этот раздел:</span>{" "}
            сначала изучите курс и уроки методики, затем откройте нужный урок и назначьте его в реальную группу.
          </p>
        </AppCard>

        <section className="grid gap-4 lg:grid-cols-2">
          {readModel.cards.map((methodology) => (
            <AppCard key={methodology.id} className="p-5 md:p-6" as="article">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-xl font-bold text-neutral-950">{methodology.title}</h2>
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700">
                  {methodology.passport.targetAgeLabel}
                </span>
              </div>
              {methodology.shortDescription ? (
                <p className="mt-2 text-sm text-neutral-700">{methodology.shortDescription}</p>
              ) : null}

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <p className="rounded-xl border border-neutral-200/80 bg-white/80 px-3 py-2 text-xs text-neutral-700">Уровень: <span className="font-medium text-neutral-900">{methodology.passport.level}</span></p>
                <p className="rounded-xl border border-neutral-200/80 bg-white/80 px-3 py-2 text-xs text-neutral-700">Урок: <span className="font-medium text-neutral-900">{methodology.passport.lessonDurationLabel}</span></p>
                <p className="rounded-xl border border-neutral-200/80 bg-white/80 px-3 py-2 text-xs text-neutral-700">Курс: <span className="font-medium text-neutral-900">{methodology.passport.courseDurationLabel}</span></p>
                <p className="rounded-xl border border-neutral-200/80 bg-white/80 px-3 py-2 text-xs text-neutral-700">Группа: <span className="font-medium text-neutral-900">{methodology.passport.idealGroupSizeLabel}</span></p>
                <p className="rounded-xl border border-neutral-200/80 bg-white/80 px-3 py-2 text-xs text-neutral-700">Словарь: <span className="font-medium text-neutral-900">~{methodology.passport.approximateVocabularyCount ?? "—"} слов</span></p>
                <p className="rounded-xl border border-neutral-200/80 bg-white/80 px-3 py-2 text-xs text-neutral-700">Медиа: <span className="font-medium text-neutral-900">{methodology.passport.songCount ?? "—"} песен · {methodology.passport.videoCount ?? "—"} видео</span></p>
              </div>

              <p className="mt-4 text-sm text-neutral-700">{methodology.passport.teachingApproachSummary}</p>
              <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
                {methodology.passport.learningOutcomes.slice(0, 3).map((outcome) => (
                  <li key={outcome} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />{outcome}</li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap gap-2">
                {methodology.passport.thematicModules.slice(0, 3).map((module) => (
                  <span key={module} className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">{module}</span>
                ))}
              </div>

              <p className="mt-4 text-xs text-neutral-600">
                Доступно в ShiDao: <span className="font-medium text-neutral-900">{methodology.lessonCount} урок(ов)</span> · {methodology.passport.lessonAvailabilityNote}
              </p>
              <Link href={toMethodologyRoute(methodology.slug)} className="mt-4 inline-flex items-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">
                Открыть методику
              </Link>
            </AppCard>
          ))}
        </section>
      </div>
    </main>
  );
}
