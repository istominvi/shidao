'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { getSession, loadParentLearningContexts, type ParentStudentLearningContext } from '@/lib/supabase-client';

export default function ParentDashboard() {
  const [children, setChildren] = useState<ParentStudentLearningContext[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const session = getSession();
        if (!session) {
          setError('Сессия не найдена. Выполните вход заново.');
          return;
        }

        const contexts = await loadParentLearningContexts(session.access_token);
        setChildren(contexts);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить данные детей.');
      }
    }

    load();
  }, []);

  return (
    <DashboardShell roleLabel="Родитель" title="Панель родителя" subtitle="Расписание, прогресс и связь с преподавателем в одном месте.">
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl bg-pink-100 p-5">
          <h3 className="text-lg font-bold">Мои дети</h3>
          {error && <p className="mt-2 rounded-2xl bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}
          {!error && children.length === 0 && <p className="mt-2 text-sm">Пока нет привязанных учеников.</p>}
          {!error && children.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm space-y-2">
              {children.map((child) => (
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
