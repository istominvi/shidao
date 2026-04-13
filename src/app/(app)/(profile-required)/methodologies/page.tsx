import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  CalendarRange,
  Clock3,
  GraduationCap,
  Shapes,
  Users,
} from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { AppPageHeader } from "@/components/app/page-header";
import { SemanticChip } from "@/components/app/semantic-chip";
import {
  MethodologyEntityCard,
  methodologyEntityActionClass,
} from "@/components/methodologies/methodology-entity-card";
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
      <div className="container space-y-6 py-7 md:py-10">
        <AppPageHeader
          title="Методики"
          description="Педагогический source layer: изучите курс и уроки методики, затем назначайте их группам в runtime-расписание."
        />

        <section className="space-y-3">
          {readModel.cards.map((methodology) => (
            <MethodologyEntityCard
              key={methodology.id}
              title={methodology.title}
              description={methodology.shortDescription}
              badges={
                <>
                  <SemanticChip icon={BookOpen} tone="violet" size="md">
                    Уроков: {methodology.lessonCount}
                  </SemanticChip>
                  {methodology.passport.courseDurationLabel ? (
                    <SemanticChip icon={CalendarRange} tone="emerald" size="md">
                      Курс:{" "}
                      {methodology.passport.courseDurationLabel ===
                      "1 учебный год"
                        ? "1 год"
                        : methodology.passport.courseDurationLabel}
                    </SemanticChip>
                  ) : null}
                  {methodology.passport.lessonDurationLabel ? (
                    <SemanticChip icon={Clock3} tone="amber" size="md">
                      Урок: {methodology.passport.lessonDurationLabel}
                    </SemanticChip>
                  ) : null}
                  {methodology.passport.targetAgeLabel ? (
                    <SemanticChip icon={GraduationCap} tone="sky" size="md">
                      Возраст: {methodology.passport.targetAgeLabel}
                    </SemanticChip>
                  ) : null}
                  {methodology.passport.groupSizeLabel ? (
                    <SemanticChip icon={Users} tone="indigo" size="md">
                      Группа: {methodology.passport.groupSizeLabel}
                    </SemanticChip>
                  ) : null}
                  {methodology.passport.activitiesPerLessonLabel ? (
                    <SemanticChip icon={Shapes} tone="rose" size="md">
                      Активностей:{" "}
                      {methodology.passport.activitiesPerLessonLabel
                        .replace(/^Обычно:\s*/i, "")
                        .replace(/^Обычно\s+/i, "")
                        .replace(/\s*активност(?:ей|и)\s*$/i, "")
                        .trim()}
                    </SemanticChip>
                  ) : null}
                </>
              }
              actions={
                <Link
                  href={toMethodologyRoute(methodology.slug)}
                  className={methodologyEntityActionClass}
                >
                  Открыть методику
                </Link>
              }
            />
          ))}
        </section>
      </div>
    </main>
  );
}
