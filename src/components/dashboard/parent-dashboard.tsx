import { DashboardShell } from '@/components/dashboard-shell';

type ParentContext = {
  studentId: string;
  studentName: string;
  login: string;
  classes: Array<{ classId: string; className: string; schoolId: string; schoolName: string }>;
};

export function ParentDashboard({ childrenContexts }: { childrenContexts: ParentContext[] }) {
  return (
    <DashboardShell
      roleLabel="Родитель"
      roleTone="parent"
      title="Ваше семейное учебное пространство"
      subtitle="Здесь собраны дети, занятия и комментарии преподавателя — чтобы видеть прогресс спокойно и без разрозненных чатов."
    >
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="dashboard-grid-card bg-[linear-gradient(140deg,rgba(201,255,79,0.24),rgba(255,255,255,0.92))]">
          <h3 className="text-lg font-black">Мои дети</h3>
          {childrenContexts.length === 0 && <p className="mt-2 text-sm text-neutral-700">Пока нет привязанных учеников.</p>}
          {childrenContexts.length > 0 && (
            <ul className="mt-3 space-y-3 text-sm">
              {childrenContexts.map((child) => (
                <li key={child.studentId} className="rounded-2xl border border-black/10 bg-white/80 p-3">
                  <p className="font-semibold">{child.studentName}</p>
                  <p className="mt-1 text-neutral-700">Логин ученика: {child.login}</p>
                  {child.classes.length === 0 ? (
                    <p className="mt-1 text-neutral-600">Классы пока не назначены.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-neutral-700">
                      {child.classes.map((context) => (
                        <li key={`${child.studentId}-${context.classId}`}>• {context.className} · {context.schoolName}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="dashboard-grid-card bg-[linear-gradient(160deg,rgba(255,182,232,0.24),rgba(255,255,255,0.9))]">
          <h3 className="text-lg font-black">Что доступно</h3>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            <li>• Просмотр уроков и домашней работы по каждому ребёнку</li>
            <li>• Комментарии и обратная связь в контексте занятия</li>
            <li>• Контроль сроков и статусов без отдельного трекинга</li>
          </ul>
        </article>
      </div>
    </DashboardShell>
  );
}
