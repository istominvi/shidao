import { DashboardShell } from '@/components/dashboard-shell';

export function TeacherDashboard() {
  return (
    <DashboardShell
      roleLabel="Преподаватель"
      roleTone="teacher"
      title="Рабочая зона преподавателя"
      subtitle="Уроки, группы и задания в структуре, которая поддерживает методику Shidao и помогает держать ритм обучения."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <article className="dashboard-grid-card bg-[linear-gradient(140deg,rgba(112,183,255,0.26),rgba(255,255,255,0.9))]">
          <h3 className="text-lg font-black">Сегодня</h3>
          <p className="mt-2 text-sm text-neutral-700">2 урока · 1 проверка домашней работы · 3 новых сообщения</p>
        </article>
        <article className="dashboard-grid-card bg-[linear-gradient(140deg,rgba(201,255,79,0.24),rgba(255,255,255,0.9))]">
          <h3 className="text-lg font-black">Группы</h3>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
            <li>• HSK-1 Начинающие (8 учеников)</li>
            <li>• HSK-2 Подростки (6 учеников)</li>
          </ul>
        </article>
        <article className="dashboard-grid-card bg-[linear-gradient(140deg,rgba(201,180,255,0.28),rgba(255,255,255,0.9))]">
          <h3 className="text-lg font-black">Быстрые действия</h3>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
            <li>• Создать урок</li>
            <li>• Выдать домашнюю работу</li>
            <li>• Открыть обсуждение занятия</li>
          </ul>
        </article>
      </div>
    </DashboardShell>
  );
}
