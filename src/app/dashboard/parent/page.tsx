import { DashboardShell } from '@/components/dashboard-shell';

export default function ParentDashboard() {
  return (
    <DashboardShell roleLabel="Родитель" title="Панель родителя" subtitle="Расписание, прогресс и связь с преподавателем в одном месте.">
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl bg-pink-100 p-5">
          <h3 className="text-lg font-bold">Мои дети</h3>
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>Ли Маша — урок 27 марта, 17:00</li>
            <li>Ли Пётр — домашняя работа до 28 марта</li>
          </ul>
        </article>
        <article className="rounded-3xl bg-amber-100 p-5">
          <h3 className="text-lg font-bold">Что доступно</h3>
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>Просмотр уроков и домашней работы</li>
            <li>Чтение обсуждений по занятиям</li>
            <li>Уведомления о сроках</li>
          </ul>
        </article>
      </div>
    </DashboardShell>
  );
}
