import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  getDevTeacherScheduledLessonId,
} from "@/lib/server/teacher-lesson-workspace";
import { toLessonWorkspaceRoute } from "@/lib/auth";

export function TeacherDashboard() {
  const scheduledLessonId = getDevTeacherScheduledLessonId();

  return (
    <DashboardShell
      roleLabel="Преподаватель"
      roleTone="teacher"
      title="Рабочая зона преподавателя"
      subtitle="Кабинет преподавателя уже показывает методологический урок из lesson-content хранилища. Runtime-заметки урока редактируются отдельно от канонического содержания."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <article className="dashboard-grid-card bg-[linear-gradient(140deg,rgba(112,183,255,0.26),rgba(255,255,255,0.9))]">
          <h3 className="text-lg font-black">Текущий статус</h3>
          <p className="mt-2 text-sm text-neutral-700">
            Для dev-потока доступен реальный базовый урок методологии «我周围的世界».
            Можно открыть workspace и проверить разделение methodology shell и
            runtime shell без редактирования канонических блоков.
          </p>
          {scheduledLessonId ? (
            <p className="mt-3 text-sm text-neutral-700">
              <Link
                href={toLessonWorkspaceRoute(scheduledLessonId)}
                className="font-semibold text-sky-700 underline underline-offset-2"
              >
                Открыть workspace урока
              </Link>
            </p>
          ) : (
            <p className="mt-3 text-xs text-neutral-500">
              Для dev-навигации задайте
              {" "}
              <code>DEV_TEACHER_WORKSPACE_SCHEDULED_LESSON_ID</code>
              {" "}
              в окружении приложения.
            </p>
          )}
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
