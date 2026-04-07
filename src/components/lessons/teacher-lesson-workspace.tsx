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

function flowAccentClass(tone: "sky" | "violet" | "emerald" | "amber") {
  switch (tone) {
    case "sky":
      return "from-sky-500/20 via-sky-500/10 to-transparent";
    case "violet":
      return "from-violet-500/20 via-violet-500/10 to-transparent";
    case "emerald":
      return "from-emerald-500/20 via-emerald-500/10 to-transparent";
    default:
      return "from-amber-500/20 via-amber-500/10 to-transparent";
  }
}

export function TeacherLessonWorkspace({
  workspace,
  runtimeFormFeedback,
}: TeacherLessonWorkspaceProps) {
  const runtime = workspace.projection.runtimeShell;
  const { hero, quickSummary, methodologyReference, lessonFlow, notes } =
    workspace.presentation;

  return (
    <div className="space-y-8 lg:space-y-10">
      <header className="landing-surface relative overflow-hidden rounded-[2rem] border border-white/80 p-6 shadow-[0_24px_72px_rgba(15,23,42,0.12)] md:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_48%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.16),transparent_44%)]"
        />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
            Рабочее пространство преподавателя
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.03em] text-neutral-950 md:text-4xl">
            {hero.lessonTitle}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700 md:text-base">
            {hero.lessonEssence}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-neutral-700">
            <span className="rounded-full border border-neutral-200 bg-white/90 px-3 py-1.5 font-medium text-neutral-900">
              {hero.groupLabel}
            </span>
            <span className="rounded-full border border-neutral-200 bg-white/80 px-3 py-1.5">
              {hero.dateTimeLabel}
            </span>
            <span className="rounded-full border border-neutral-200 bg-white/80 px-3 py-1.5">
              {hero.formatLabel}
            </span>
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusBadgeTone(hero.statusLabel)}`}
            >
              {hero.statusLabel}
            </span>
          </div>
          <p className="mt-4 text-sm text-neutral-600">{hero.methodologyLine}</p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="landing-surface rounded-3xl border border-white/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Подготовить
          </p>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            {quickSummary.prepChecklist.slice(0, 5).map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-neutral-400" />
                <span>{item}</span>
              </li>
            ))}
            {quickSummary.prepChecklist.length === 0 ? (
              <li className="text-neutral-600">Все материалы уже в уроке.</li>
            ) : null}
          </ul>
        </article>

        <article className="landing-surface rounded-3xl border border-white/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Ключевые слова
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {quickSummary.keyWords.length ? (
              quickSummary.keyWords.slice(0, 8).map((word) => (
                <span
                  key={word}
                  className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900"
                >
                  {word}
                </span>
              ))
            ) : (
              <p className="text-sm text-neutral-600">Слова не указаны.</p>
            )}
          </div>
        </article>

        <article className="landing-surface rounded-3xl border border-white/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Ключевые фразы
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {quickSummary.keyPhrases.length ? (
              quickSummary.keyPhrases.slice(0, 6).map((phrase) => (
                <span
                  key={phrase}
                  className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-900"
                >
                  {phrase}
                </span>
              ))
            ) : (
              <p className="text-sm text-neutral-600">Фразы не указаны.</p>
            )}
          </div>
        </article>

        <article className="landing-surface rounded-3xl border border-white/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Видео и материалы
          </p>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            {quickSummary.resources.slice(0, 4).map((resource) => (
              <li key={`${resource.kindLabel}-${resource.title}`}>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                  {resource.kindLabel}
                </span>{" "}
                {resource.url ? (
                  <a
                    href={resource.url}
                    className="font-medium text-sky-700 underline underline-offset-2"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {resource.title}
                  </a>
                ) : (
                  <span className="font-medium text-neutral-900">
                    {resource.title}
                  </span>
                )}
              </li>
            ))}
            {quickSummary.resources.length === 0 ? (
              <li className="text-neutral-600">Материалы не указаны.</li>
            ) : null}
          </ul>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        <article className="landing-surface rounded-[2rem] border border-white/80 p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Сценарий занятия
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-neutral-900">
                Ход урока
              </h2>
            </div>
            <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600">
              {lessonFlow.length} этапов
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {lessonFlow.map((step) => (
              <article
                key={step.id}
                className="relative overflow-hidden rounded-3xl border border-neutral-200/90 bg-white/90 p-4 md:p-5"
              >
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r ${flowAccentClass(step.accentTone)}`}
                />
                <div className="relative">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-white">
                      {step.stepLabel}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                      {step.blockLabel}
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-semibold text-neutral-950">
                    {step.title}
                  </h3>
                  {step.description ? (
                    <p className="mt-2 text-sm leading-6 text-neutral-700">
                      {step.description}
                    </p>
                  ) : null}

                  {(step.teacherActions.length > 0 ||
                    step.studentActions.length > 0) && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {step.teacherActions.length ? (
                        <div className="rounded-2xl bg-neutral-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                            Действия преподавателя
                          </p>
                          <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
                            {step.teacherActions.map((item) => (
                              <li key={item}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {step.studentActions.length ? (
                        <div className="rounded-2xl bg-neutral-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                            Действия детей
                          </p>
                          <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
                            {step.studentActions.map((item) => (
                              <li key={item}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {(step.materials.length > 0 || step.resources.length > 0) && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {step.materials.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900"
                        >
                          {item}
                        </span>
                      ))}
                      {step.resources.map((resource) => (
                        <span
                          key={`${resource.kindLabel}:${resource.title}`}
                          className="rounded-full bg-sky-50 px-2.5 py-1 text-xs text-sky-900"
                        >
                          {resource.kindLabel}: {" "}
                          {resource.url ? (
                            <a
                              href={resource.url}
                              className="font-semibold underline underline-offset-2"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {resource.title}
                            </a>
                          ) : (
                            <span className="font-semibold">{resource.title}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </article>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <section className="landing-surface rounded-[2rem] border border-emerald-200/70 p-5 md:p-6">
            <h2 className="text-xl font-bold tracking-[-0.02em] text-neutral-900">
              Проведение занятия
            </h2>
            <p className="mt-2 text-sm text-neutral-700">
              Обновляйте рабочий статус и заметки по этому занятию.
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
              className="mt-4 space-y-4"
              action={`/api/teacher/lessons/${workspace.scheduledLessonId}/runtime`}
              method="POST"
            >
              <label className="block">
                <span className="text-sm font-semibold text-neutral-900">
                  Статус занятия
                </span>
                <select
                  name="runtimeStatus"
                  defaultValue={runtime.runtimeStatus}
                  className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900"
                >
                  <option value="planned">Запланировано</option>
                  <option value="in_progress">Идёт занятие</option>
                  <option value="completed">Завершено</option>
                  <option value="cancelled">Отменено</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-900">
                  Короткая заметка перед уроком
                </span>
                <textarea
                  name="runtimeNotesSummary"
                  rows={2}
                  defaultValue={runtime.runtimeNotesSummary ?? ""}
                  className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900"
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
                  className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900"
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
                  className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900"
                />
              </label>

              <button
                type="submit"
                className="inline-flex items-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Сохранить изменения
              </button>
            </form>
          </section>

          <section className="landing-surface rounded-3xl border border-white/80 p-5">
            <h2 className="text-lg font-bold text-neutral-900">Фокус преподавателя</h2>
            <article className="mt-3 rounded-2xl border border-neutral-200 bg-white/80 p-4">
              <h3 className="text-sm font-semibold text-neutral-900">
                Короткая заметка
              </h3>
              <p className="mt-2 text-sm text-neutral-700">
                {runtime.runtimeNotesSummary?.trim() ||
                  "Добавьте короткую заметку перед началом урока."}
              </p>
            </article>
            <article className="mt-3 rounded-2xl border border-neutral-200 bg-white/80 p-4">
              <h3 className="text-sm font-semibold text-neutral-900">
                Заметки по проведению
              </h3>
              <p className="mt-2 text-sm text-neutral-700">
                {notes.runtimeNotes ||
                  "Пока нет заметок по проведению занятия."}
              </p>
            </article>
            <article className="mt-3 rounded-2xl border border-neutral-200 bg-white/80 p-4">
              <h3 className="text-sm font-semibold text-neutral-900">
                Итоги после занятия
              </h3>
              <p className="mt-2 text-sm text-neutral-700">
                {notes.outcomeNotes ||
                  "После урока добавьте короткий итог по группе."}
              </p>
            </article>
          </section>

          <section className="landing-surface rounded-3xl border border-violet-200/70 p-5">
            <h2 className="text-lg font-bold text-neutral-900">Ориентиры методики</h2>
            <p className="mt-2 text-sm text-neutral-700">{hero.methodologyTitle}</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              <li>
                <span className="font-semibold text-neutral-900">Позиция:</span>{" "}
                {methodologyReference.positionLabel}
              </li>
              <li>
                <span className="font-semibold text-neutral-900">Длительность:</span>{" "}
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

          <section className="landing-surface rounded-3xl border border-sky-200/70 p-5">
            <h2 className="text-lg font-bold text-neutral-900">Домашнее задание</h2>
            {!workspace.homework.schemaReady ? (
              <p className="mt-3 text-sm text-amber-700">
                Домашние задания временно недоступны: схема БД не обновлена. Примените миграцию homework runtime layer.
              </p>
            ) : workspace.homework.definition ? (
              <div className="mt-3 space-y-3 text-sm text-neutral-700">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
                  Из методики (только чтение)
                </p>
                <p className="font-semibold text-neutral-900">
                  {workspace.homework.definition.title}
                </p>
                <p>{workspace.homework.definition.instructions}</p>
                {workspace.homework.definition.materialLinks.length ? (
                  <ul className="space-y-1 text-neutral-700">
                    {workspace.homework.definition.materialLinks.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-neutral-600">
                Для этого урока методики домашнее задание пока не определено.
              </p>
            )}

            {workspace.homework.definition && !workspace.homework.assignment ? (
              <form
                className="mt-4 space-y-3 rounded-2xl border border-neutral-200 bg-white/80 p-3"
                action={`/api/teacher/lessons/${workspace.scheduledLessonId}/homework/issue`}
                method="POST"
              >
                <label className="block text-sm">
                  <span className="font-semibold text-neutral-900">Кому выдать</span>
                  <select
                    name="recipientMode"
                    defaultValue="all"
                    className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2"
                  >
                    <option value="all">Вся группа</option>
                    <option value="selected">Выбранные ученики</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-neutral-900">Срок сдачи</span>
                  <input name="dueAt" type="datetime-local" className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" />
                </label>
                <fieldset className="space-y-1">
                  <legend className="text-sm font-semibold text-neutral-900">
                    Выбрать учеников (для режима “выбранные”)
                  </legend>
                  {workspace.homework.roster.map((row) => (
                    <label key={row.studentId} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="studentIds" value={row.studentId} />
                      <span>{row.studentName}</span>
                    </label>
                  ))}
                </fieldset>
                <button
                  type="submit"
                  className="inline-flex items-center rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white"
                >
                  Выдать домашнее задание
                </button>
              </form>
            ) : null}

            {workspace.homework.assignment ? (
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-white/80 p-3 text-sm text-neutral-700">
                <p>
                  Выдано: {workspace.homework.assignment.recipientMode === "all" ? "всей группе" : "выбранным ученикам"}
                </p>
                <p>Срок: {workspace.homework.assignment.dueAt ?? "без срока"}</p>
                <div className="mt-2 space-y-2">
                  {workspace.homework.roster.map((row) => (
                    <div key={row.studentId} className="rounded-xl border border-neutral-200 p-2">
                      <p className="font-medium text-neutral-900">{row.studentName}: {row.statusLabel}</p>
                      {row.assigned && row.studentHomeworkAssignmentId ? (
                        <form
                          className="mt-2 space-y-2"
                          action={`/api/teacher/lessons/${workspace.scheduledLessonId}/homework/review`}
                          method="POST"
                        >
                          <input type="hidden" name="studentHomeworkAssignmentId" value={row.studentHomeworkAssignmentId} />
                          <select name="reviewStatus" defaultValue="reviewed" className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm">
                            <option value="reviewed">Проверено</option>
                            <option value="needs_revision">Нужна доработка</option>
                          </select>
                          <textarea name="reviewNote" defaultValue={row.reviewNote ?? ""} rows={2} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" placeholder="Комментарий преподавателя" />
                          <button type="submit" className="rounded-xl border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800">Сохранить проверку</button>
                        </form>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </aside>
      </section>
    </div>
  );
}
