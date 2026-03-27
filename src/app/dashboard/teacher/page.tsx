import { DashboardShell } from '@/components/dashboard-shell';

export default function TeacherDashboard() {
  return (
    <DashboardShell roleLabel="Преподаватель" title="Панель преподавателя" subtitle="Группы, расписание, уроки и задания под вашим контролем.">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl bg-sky-100 p-5">
          <h3 className="text-lg font-bold">Сегодня</h3>
          <p className="mt-2 text-sm">2 урока · 1 проверка домашней работы · 3 новых сообщения</p>
        </article>
        <article className="rounded-3xl bg-lime-100 p-5">
          <h3 className="text-lg font-bold">Группы</h3>
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>HSK-1 Начинающие (8 учеников)</li>
            <li>HSK-2 Подростки (6 учеников)</li>
          </ul>
        </article>
        <article className="rounded-3xl bg-violet-100 p-5">
          <h3 className="text-lg font-bold">Быстрые действия</h3>
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>Создать урок</li>
            <li>Выдать домашнюю работу</li>
            <li>Открыть обсуждение занятия</li>
          </ul>
        </article>
      </div>
    </DashboardShell>
  );
}
