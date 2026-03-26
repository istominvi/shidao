import { DashboardShell } from '@/components/dashboard-shell';

export default function ParentDashboard() {
  return (
    <DashboardShell
      role="parent"
      title="Кабинет родителя"
      subtitle="Прозрачный контроль расписания, прогресса и коммуникации ребёнка"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl bg-pink-100 p-5">
          <h3 className="text-lg font-bold">Мои дети</h3>
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>Ли Маша — урок 27 марта, 17:00</li>
            <li>Ли Пётр — ДЗ до 28 марта</li>
          </ul>
        </article>
        <article className="rounded-3xl bg-amber-100 p-5">
          <h3 className="text-lg font-bold">Что доступно</h3>
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>Просмотр уроков и ДЗ</li>
            <li>Чтение треда по занятию</li>
            <li>Уведомления о сроках</li>
          </ul>
        </article>
      </div>
    </DashboardShell>
  );
}
