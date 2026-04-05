import { DashboardShell } from "@/components/dashboard-shell";

export function StudentDashboard() {
  return (
    <DashboardShell
      roleLabel="Ученик"
      roleTone="student"
      title="Твой фокусный учебный кабинет"
      subtitle="Открой ближайший урок, выполни домашнюю работу и держи контакт с преподавателем в понятном ритме."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <article className="dashboard-grid-card bg-[linear-gradient(140deg,rgba(112,183,255,0.22),rgba(255,255,255,0.9))]">
          <h3 className="text-lg font-black">Ближайший урок</h3>
          <p className="mt-2 text-sm text-neutral-700">
            27 марта · 17:00 · Zoom-ссылка от преподавателя
          </p>
        </article>
        <article className="dashboard-grid-card bg-[linear-gradient(140deg,rgba(255,182,232,0.24),rgba(255,255,255,0.9))]">
          <h3 className="text-lg font-black">Домашняя работа</h3>
          <p className="mt-2 text-sm text-neutral-700">
            Урок 5: аудио + карточки иероглифов. Срок: 28 марта, 20:00.
          </p>
        </article>
      </div>
    </DashboardShell>
  );
}
