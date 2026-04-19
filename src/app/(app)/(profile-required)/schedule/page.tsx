import Link from "next/link";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/app/page-header";
import { TopNav } from "@/components/top-nav";
import { SurfaceCard } from "@/components/ui/surface-card";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { getStudentScheduleReadModel } from "@/lib/server/student-schedule";

function formatStartsAt(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function StudentSchedulePage() {
  const resolution = await resolveAccessPolicy();

  if (resolution.status === "guest" || resolution.status === "degraded") {
    redirect(ROUTES.login);
  }

  if (resolution.status === "adult-without-profile") {
    redirect(ROUTES.onboarding);
  }

  if (resolution.context.actorKind !== "student") {
    redirect(ROUTES.dashboard);
  }

  const studentId = resolution.context.student?.id;
  if (!studentId) {
    redirect(ROUTES.login);
  }

  const items = await getStudentScheduleReadModel({ studentId });

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container app-page-container space-y-6">
        <AppPageHeader
          eyebrow="Кабинет ученика"
          title="Расписание"
          description="Все запланированные и прошедшие занятия по твоим группам."
        />

        <SurfaceCard
          title="Все занятия"
          description={`Всего уроков: ${items.length}`}
        >
          {items.length === 0 ? (
            <p className="text-sm text-neutral-600">Пока нет занятий в расписании.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.scheduledLessonId} className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <p className="text-sm font-semibold text-neutral-900">{item.lessonTitle}</p>
                  <p className="mt-1 text-xs text-neutral-600">
                    {formatStartsAt(item.startsAt)} · {item.statusLabel} · {item.formatLabel}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Группа: {item.groupLabel} · Преподаватель: {item.teacherLabel}
                  </p>
                  <Link
                    href={item.href}
                    className="mt-3 inline-flex rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800"
                  >
                    Открыть урок
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>
    </main>
  );
}
