import { DashboardShell } from "@/components/dashboard-shell";

export function TeacherDashboard() {
  return (
    <DashboardShell
      roleLabel="Преподаватель"
      roleTone="teacher"
      title="Рабочая зона преподавателя"
      subtitle="Базовый кабинет преподавателя уже доступен. Детальные блоки уроков, групп и заданий подключаются по мере запуска предметных модулей."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <article className="dashboard-grid-card bg-[linear-gradient(140deg,rgba(112,183,255,0.26),rgba(255,255,255,0.9))]">
          <h3 className="text-lg font-black">Текущий статус</h3>
          <p className="mt-2 text-sm text-neutral-700">
            В MVP уже доступна авторизация, переключение профилей и базовая
            структура кабинета. Карточки с уроками и задачами появятся, когда
            будет подключён учебный контент.
          </p>
        </article>
        <article className="dashboard-grid-card bg-[linear-gradient(140deg,rgba(201,180,255,0.28),rgba(255,255,255,0.9))]">
          <h3 className="text-lg font-black">Что уже можно сделать</h3>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
            <li>• Настроить профиль и безопасность входа</li>
            <li>• Добавить взрослый профиль через онбординг</li>
            <li>• Отправить приглашение в разделе «Команда»</li>
          </ul>
        </article>
      </div>
    </DashboardShell>
  );
}
