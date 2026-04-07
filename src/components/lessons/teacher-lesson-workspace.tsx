import type { TeacherLessonWorkspaceReadModel } from "@/lib/server/teacher-lesson-workspace";

type TeacherLessonWorkspaceProps = {
  workspace: TeacherLessonWorkspaceReadModel;
  runtimeFormFeedback?: {
    success?: string;
    error?: string;
  };
};

function statusBadgeTone(statusLabel: string) {
  if (statusLabel.includes("Идёт"))
    return "bg-sky-100 text-sky-800 border-sky-200";
  if (statusLabel.includes("Заверш"))
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (statusLabel.includes("Отмен"))
    return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
}

export function TeacherLessonWorkspace({
  workspace,
  runtimeFormFeedback,
}: TeacherLessonWorkspaceProps) {
  const runtime = workspace.projection.runtimeShell;
  const { hero, quickSummary, methodologyReference, lessonFlow, notes } =
    workspace.presentation;

  return (
    <div className="space-y-6">
      <header className="landing-surface rounded-3xl border border-white/70 p-6 shadow-[0_16px_48px_rgba(20,20,20,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
          Рабочее пространство преподавателя
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.02em] text-neutral-900">
          {hero.lessonTitle}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-neutral-700">
          <span className="rounded-full bg-neutral-100 px-3 py-1 font-medium">
            Группа: {hero.groupLabel}
          </span>
          <span>{hero.dateTimeLabel}</span>
          <span>·</span>
          <span>{hero.formatLabel}</span>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeTone(hero.statusLabel)}`}
          >
            {hero.statusLabel}
          </span>
        </div>
        <p className="mt-3 text-sm text-neutral-600">{hero.methodologyLine}</p>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="landing-surface rounded-2xl border border-white/70 p-4">
          <h2 className="text-sm font-semibold text-neutral-900">
            Подготовить
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
            {quickSummary.prepChecklist.slice(0, 5).map((item) => (
              <li key={item}>• {item}</li>
            ))}
            {quickSummary.prepChecklist.length === 0 ? (
              <li>• Все материалы уже в уроке.</li>
            ) : null}
          </ul>
        </article>

        <article className="landing-surface rounded-2xl border border-white/70 p-4">
          <h2 className="text-sm font-semibold text-neutral-900">
            Ключевые слова
          </h2>
          <p className="mt-2 text-sm text-neutral-700">
            {quickSummary.keyWords.length
              ? quickSummary.keyWords.join(", ")
              : "Слова не указаны."}
          </p>
        </article>

        <article className="landing-surface rounded-2xl border border-white/70 p-4">
          <h2 className="text-sm font-semibold text-neutral-900">
            Ключевые фразы
          </h2>
          <p className="mt-2 text-sm text-neutral-700">
            {quickSummary.keyPhrases.length
              ? quickSummary.keyPhrases.join(" · ")
              : "Фразы не указаны."}
          </p>
        </article>

        <article className="landing-surface rounded-2xl border border-white/70 p-4">
          <h2 className="text-sm font-semibold text-neutral-900">
            Видео и материалы
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
            {quickSummary.resources.slice(0, 4).map((resource) => (
              <li key={`${resource.kindLabel}-${resource.title}`}>
                <span className="font-medium">{resource.kindLabel}:</span>{" "}
                {resource.url ? (
                  <a
                    href={resource.url}
                    className="text-sky-700 underline underline-offset-2"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {resource.title}
                  </a>
                ) : (
                  resource.title
                )}
              </li>
            ))}
            {quickSummary.resources.length === 0 ? (
              <li>Материалы не указаны.</li>
            ) : null}
          </ul>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <article className="landing-surface rounded-3xl border border-white/70 p-5">
          <h2 className="text-xl font-bold text-neutral-900">Ход урока</h2>
          <div className="mt-4 space-y-4">
            {lessonFlow.map((step) => (
              <article
                key={step.id}
                className="rounded-2xl border border-neutral-200/90 bg-white/80 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  {step.stepLabel}
                </p>
                <h3 className="mt-1 text-base font-semibold text-neutral-900">
                  {step.title}
                </h3>
                {step.description ? (
                  <p className="mt-2 text-sm text-neutral-700">
                    {step.description}
                  </p>
                ) : null}

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">
                      Что делает преподаватель
                    </p>
                    <ul className="mt-1 space-y-1 text-sm text-neutral-700">
                      {step.teacherActions.length
                        ? step.teacherActions.map((item) => (
                            <li key={item}>• {item}</li>
                          ))
                        : [<li key="none">• По плану урока.</li>]}
                    </ul>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">
                      Что делают дети
                    </p>
                    <ul className="mt-1 space-y-1 text-sm text-neutral-700">
                      {step.studentActions.length
                        ? step.studentActions.map((item) => (
                            <li key={item}>• {item}</li>
                          ))
                        : [<li key="none">• Вовлекаются в этап занятия.</li>]}
                    </ul>
                  </div>
                </div>

                {step.materials.length ? (
                  <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">
                      Что подготовить
                    </p>
                    <ul className="mt-1 space-y-1 text-sm text-neutral-700">
                      {step.materials.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {step.resources.length ? (
                  <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">
                      Материалы этапа
                    </p>
                    <ul className="mt-1 space-y-1 text-sm text-neutral-700">
                      {step.resources.map((resource) => (
                        <li key={`${resource.kindLabel}:${resource.title}`}>
                          <span className="font-medium">
                            {resource.kindLabel}:
                          </span>{" "}
                          {resource.url ? (
                            <a
                              href={resource.url}
                              className="text-sky-700 underline underline-offset-2"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {resource.title}
                            </a>
                          ) : (
                            resource.title
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </article>

        <aside className="space-y-4">
          <section className="landing-surface rounded-3xl border border-emerald-200/70 p-5">
            <h2 className="text-lg font-bold text-neutral-900">
              Проведение занятия
            </h2>
            <p className="mt-2 text-sm text-neutral-700">
              Обновляйте только статус и заметки по текущему проведению.
            </p>

            {runtimeFormFeedback?.success ? (
              <p className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {runtimeFormFeedback.success}
              </p>
            ) : null}
            {runtimeFormFeedback?.error ? (
              <p className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {runtimeFormFeedback.error}
              </p>
            ) : null}

            <form
              className="mt-4 space-y-3"
              action={`/api/teacher/lessons/${workspace.scheduledLessonId}/runtime`}
              method="POST"
            >
              <label className="block">
                <span className="text-sm font-semibold text-neutral-900">
                  Статус
                </span>
                <select
                  name="runtimeStatus"
                  defaultValue={runtime.runtimeStatus}
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                >
                  <option value="planned">Запланировано</option>
                  <option value="in_progress">Идёт занятие</option>
                  <option value="completed">Завершено</option>
                  <option value="cancelled">Отменено</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-900">
                  Короткая заметка перед/во время урока
                </span>
                <textarea
                  name="runtimeNotesSummary"
                  rows={2}
                  defaultValue={runtime.runtimeNotesSummary ?? ""}
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-900">
                  Заметки по проведению
                </span>
                <textarea
                  name="runtimeNotes"
                  rows={4}
                  defaultValue={workspace.projection.runtimeNotes ?? ""}
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-900">
                  Итоги после занятия
                </span>
                <textarea
                  name="outcomeNotes"
                  rows={4}
                  defaultValue={workspace.projection.outcomeNotes ?? ""}
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                />
              </label>

              <button
                type="submit"
                className="inline-flex items-center rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                Сохранить изменения
              </button>
            </form>
          </section>

          <section className="landing-surface rounded-3xl border border-white/70 p-5">
            <h2 className="text-lg font-bold text-neutral-900">
              Заметки преподавателя
            </h2>
            <article className="mt-3 rounded-2xl border border-neutral-200 p-4">
              <h3 className="font-semibold text-neutral-900">
                Заметки по проведению
              </h3>
              <p className="mt-2 text-sm text-neutral-700">
                {notes.runtimeNotes ||
                  "Пока нет заметок по проведению занятия."}
              </p>
            </article>
            <article className="mt-3 rounded-2xl border border-neutral-200 p-4">
              <h3 className="font-semibold text-neutral-900">
                Итоги после занятия
              </h3>
              <p className="mt-2 text-sm text-neutral-700">
                {notes.outcomeNotes ||
                  "После урока добавьте короткий итог по группе."}
              </p>
            </article>
          </section>

          <section className="landing-surface rounded-3xl border border-violet-200/70 p-5">
            <h2 className="text-lg font-bold text-neutral-900">
              Ориентиры урока
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              <li>
                <span className="font-semibold text-neutral-900">Позиция:</span>{" "}
                {methodologyReference.positionLabel}
              </li>
              <li>
                <span className="font-semibold text-neutral-900">
                  Длительность:
                </span>{" "}
                {methodologyReference.durationLabel}
              </li>
              <li>
                <span className="font-semibold text-neutral-900">
                  Состояние методики:
                </span>{" "}
                {methodologyReference.readinessLabel}
              </li>
            </ul>
          </section>
        </aside>
      </section>
    </div>
  );
}
