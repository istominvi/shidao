import { DashboardShell } from '@/components/dashboard-shell';

export default function StudentDashboard() {
  return (
    <DashboardShell
      role="student"
      title="Кабинет ученика"
      subtitle="Мои уроки, задания и чат с преподавателем в контексте урока"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl bg-emerald-100 p-5">
          <h3 className="text-lg font-bold">Ближайший урок</h3>
          <p className="mt-2 text-sm">27 марта · 17:00 · Zoom ссылка от преподавателя</p>
        </article>
        <article className="rounded-3xl bg-indigo-100 p-5">
          <h3 className="text-lg font-bold">Домашнее задание</h3>
          <p className="mt-2 text-sm">Урок 5: аудио + карточки иероглифов. Дедлайн: 28 марта, 20:00.</p>
        </article>
      </div>
    </DashboardShell>
  );
}
