import { DashboardShell } from "@/components/dashboard-shell";

export function StudentDashboard() {
  return (
    <DashboardShell
      roleLabel="Ученик"
      roleTone="student"
      title="Твой фокусный учебный кабинет"
      subtitle="Это стартовая версия ученического кабинета. Учебные карточки будут отображаться автоматически после подключения расписания и домашних заданий."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <article className="dashboard-grid-card bg-[linear-gradient(140deg,rgba(112,183,255,0.22),rgba(255,255,255,0.9))]">
          <h3 className="text-lg font-black">Статус кабинета</h3>
          <p className="mt-2 text-sm text-neutral-700">
            Сейчас здесь доступна безопасная авторизация и вход в отдельный
            ученический профиль.
          </p>
        </article>
        <article className="dashboard-grid-card bg-[linear-gradient(140deg,rgba(255,182,232,0.24),rgba(255,255,255,0.9))]">
          <h3 className="text-lg font-black">Что дальше</h3>
          <p className="mt-2 text-sm text-neutral-700">
            Когда преподаватель начнёт публиковать уроки и задания, карточки
            появятся в этом разделе без ручной настройки.
          </p>
        </article>
      </div>
    </DashboardShell>
  );
}
