import { DashboardShell } from '@/components/dashboard-shell';

type ParentContext = {
  studentId: string;
  studentName: string;
  login: string;
  classes: Array<{ classId: string; className: string; schoolId: string; schoolName: string }>;
};

export function ParentDashboard({ childrenContexts }: { childrenContexts: ParentContext[] }) {
  return (
    <DashboardShell roleLabel="Родитель" title="Панель родителя" subtitle="Расписание, прогресс и связь с преподавателем в одном месте.">
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl bg-pink-100 p-5">
          <h3 className="text-lg font-bold">Мои дети</h3>
          {childrenContexts.length === 0 && <p className="mt-2 text-sm">Пока нет привязанных учеников.</p>}
          {childrenContexts.length > 0 && (
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
              {childrenContexts.map((child) => (
                <li key={child.studentId}>
                  <p className="font-semibold">{child.studentName}</p>
                  <p className="text-neutral-700">Логин: {child.login}</p>
                  {child.classes.length === 0 ? (
                    <p className="text-neutral-600">Классы пока не назначены.</p>
                  ) : (
                    <ul className="mt-1 list-disc pl-5 text-neutral-700">
                      {child.classes.map((context) => (
                        <li key={`${child.studentId}-${context.classId}`}>
                          {context.className} · {context.schoolName}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
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
