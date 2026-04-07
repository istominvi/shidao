import { DashboardShell } from "@/components/dashboard-shell";
import type { StudentHomeworkCard } from "@/lib/server/student-homework";

export function StudentDashboard({
  homework,
}: {
  homework: StudentHomeworkCard[];
}) {
  return (
    <DashboardShell
      roleLabel="Ученик"
      roleTone="student"
      title="Твой фокусный учебный кабинет"
      subtitle="Это стартовая версия ученического кабинета. Учебные карточки будут отображаться автоматически после подключения расписания и домашних заданий."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <article className="dashboard-grid-card bg-[linear-gradient(140deg,rgba(112,183,255,0.22),rgba(255,255,255,0.9))]">
          <h3 className="text-lg font-black">Статус кабинета</h3>
          <p className="mt-2 text-sm text-neutral-700">
            Сейчас здесь доступна безопасная авторизация и вход в отдельный
            ученический профиль.
          </p>
        </article>
        <article className="dashboard-grid-card bg-[linear-gradient(140deg,rgba(255,182,232,0.24),rgba(255,255,255,0.9))]">
          <h3 className="text-lg font-black">Что дальше</h3>
          <p className="mt-2 text-sm text-neutral-700">
            Когда преподаватель начнёт публиковать уроки и задания, карточки
            появятся в этом разделе без ручной настройки.
          </p>
        </article>
      </div>

      <section className="mt-4 rounded-3xl border border-white/80 bg-white/90 p-4">
        <h3 className="text-lg font-black">Мои домашние задания</h3>
        {homework.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">
            Пока преподаватель не выдал домашнее задание.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {homework.map((item) => (
              <article key={item.studentHomeworkAssignmentId} className="rounded-2xl border border-neutral-200 p-3">
                <p className="font-semibold">{item.homeworkTitle}</p>
                <p className="mt-1 text-sm text-neutral-700">{item.instructions}</p>
                <p className="mt-1 text-xs text-neutral-500">Срок: {item.dueAt ?? "без срока"} · {item.statusLabel}</p>
                <form
                  className="mt-2 space-y-2"
                  action={`/api/student/homework/${item.studentHomeworkAssignmentId}/submit`}
                  method="POST"
                >
                  <textarea
                    name="submissionText"
                    defaultValue={item.submissionText ?? ""}
                    rows={3}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                    placeholder="Введите ответ"
                  />
                  <button type="submit" className="rounded-xl bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white">
                    Отправить
                  </button>
                </form>
                {item.reviewNote ? (
                  <p className="mt-2 text-sm text-sky-800">Комментарий: {item.reviewNote}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
