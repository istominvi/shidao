import { AppCard } from "@/components/app/app-card";
import { StudentHomeworkQuizCard } from "@/components/dashboard/student-homework-quiz-card";
import type { LearnerLessonRoomReadModel } from "@/lib/server/learner-lesson-room";

function statusLabel(status: LearnerLessonRoomReadModel["runtimeStatus"]) {
  if (status === "in_progress") return "Идёт урок";
  if (status === "completed") return "Урок завершён";
  if (status === "cancelled") return "Урок отменён";
  return "Урок запланирован";
}

function whenLabel(startsAt: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(startsAt));
}

export function LearnerLessonRoom({
  model,
  role,
  header,
}: {
  model: LearnerLessonRoomReadModel;
  role: "student" | "parent";
  header: { title: string; subtitle: string };
}) {
  return (
    <div className="space-y-5">
      <AppCard className="p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">{header.title}</p>
        <h1 className="mt-2 text-2xl font-black text-neutral-950">{model.lessonTitle}</h1>
        <p className="mt-1 text-sm text-neutral-700">{model.lessonSubtitle ?? header.subtitle}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-700">
          <span className="rounded-full bg-neutral-100 px-3 py-1">{statusLabel(model.runtimeStatus)}</span>
          <span className="rounded-full bg-neutral-100 px-3 py-1">{whenLabel(model.startsAt)}</span>
        </div>
      </AppCard>

      {!model.studentContent ? (
        <AppCard className="p-5">
          {model.studentContentUnavailableDueToSchema ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Контент урока для ученика временно недоступен. Примените миграцию lesson student content layer.
            </p>
          ) : (
            <p className="text-sm text-neutral-700">
              Контент урока для ученика пока не опубликован.
            </p>
          )}
        </AppCard>
      ) : null}

      {(model.studentContent?.sections ?? []).map((section, index) => (
        <AppCard key={`${section.type}-${index}`} className="p-5">
          <h2 className="text-xl font-bold text-neutral-900">{section.title}</h2>
          {section.type === "lesson_focus" ? (
            <>
              <p className="mt-2 text-sm text-neutral-700">{section.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {section.chips.map((chip) => (
                  <span key={chip} className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900">{chip}</span>
                ))}
              </div>
            </>
          ) : null}

          {section.type === "vocabulary_cards" ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {section.items.map((item) => (
                <article key={item.term} className="rounded-2xl border border-neutral-200 bg-white p-3">
                  <p className="text-lg font-bold text-neutral-950">{item.term}</p>
                  <p className="text-sm text-neutral-600">{item.pinyin ?? ""}</p>
                  <p className="text-sm text-neutral-700">{item.meaning}</p>
                </article>
              ))}
            </div>
          ) : null}

          {section.type === "phrase_cards" ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {section.items.map((item) => (
                <article key={item.phrase} className="rounded-2xl border border-violet-200 bg-violet-50/50 p-3">
                  <p className="text-lg font-bold text-neutral-950">{item.phrase}</p>
                  <p className="text-sm text-neutral-600">{item.pinyin ?? ""}</p>
                  <p className="text-sm text-neutral-700">{item.meaning}</p>
                  {item.usageHint ? <p className="mt-1 text-xs text-neutral-600">{item.usageHint}</p> : null}
                </article>
              ))}
            </div>
          ) : null}

          {section.type === "media_asset" ? (
            <article className="mt-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-3 text-sm">
              <p className="font-semibold text-neutral-900">{model.assetsById[section.assetId]?.title ?? section.title}</p>
              <p className="text-neutral-700">{section.studentPrompt}</p>
              <p className="mt-1 text-xs text-neutral-500">Тип: {section.assetKind === "video" ? "Видео" : "Песня"}</p>
              {model.assetsById[section.assetId]?.sourceUrl ? (
                <a href={model.assetsById[section.assetId]?.sourceUrl} className="mt-2 inline-block text-xs text-sky-700 underline underline-offset-2" target="_blank" rel="noreferrer">Открыть материал</a>
              ) : (
                <p className="mt-2 text-xs text-neutral-500">Ссылка будет добавлена преподавателем в материалы курса.</p>
              )}
            </article>
          ) : null}

          {section.type === "action_cards" ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {section.items.map((item) => (
                <article key={item.term} className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <p className="text-lg font-bold text-neutral-950">{item.term}</p>
                  <p className="text-sm text-neutral-600">{item.pinyin ?? ""} · {item.meaning}</p>
                  <p className="text-sm text-neutral-700">{item.movementHint}</p>
                </article>
              ))}
            </div>
          ) : null}

          {section.type === "worksheet" ? (
            <article className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-neutral-700">
              <p className="font-semibold text-neutral-900">{section.pageLabel ?? "Задание"}</p>
              <p>{section.instructions}</p>
              {section.assetId ? (
                <p className="mt-1 text-xs text-neutral-500">Материал: {model.assetsById[section.assetId]?.title ?? section.assetId}</p>
              ) : null}
            </article>
          ) : null}

          {section.type === "recap" ? (
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              {section.bullets.map((bullet) => (
                <li key={bullet}>• {bullet}</li>
              ))}
            </ul>
          ) : null}
        </AppCard>
      ))}

      {model.homework ? (
        <AppCard className="border-fuchsia-200/80 p-5">
          <h2 className="text-xl font-bold text-neutral-900">Домашнее задание</h2>
          {model.homework.role === "student" ? (
            <article className="mt-3 rounded-2xl border border-neutral-200 bg-white p-3">
              <p className="font-semibold text-neutral-900">{model.homework.card.homeworkTitle}</p>
              <p className="text-xs text-neutral-500">{model.homework.card.statusLabel} · Срок: {model.homework.card.dueAt ?? "без срока"}</p>
              <p className="mt-2 text-sm text-neutral-700">{model.homework.card.instructions}</p>
              {model.homework.card.kind === "practice_text" ? (
                role === "student" ? (
                  <form className="mt-2 space-y-2" action={`/api/student/homework/${model.homework.card.studentHomeworkAssignmentId}/submit`} method="POST">
                    <textarea
                      name="submissionText"
                      defaultValue={model.homework.card.submissionText ?? ""}
                      rows={3}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                      placeholder="Напиши короткий ответ"
                    />
                    <button type="submit" className="rounded-xl bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white">Отправить</button>
                  </form>
                ) : null
              ) : (
                <StudentHomeworkQuizCard item={model.homework.card} />
              )}
            </article>
          ) : (
            <article className="mt-3 rounded-2xl border border-neutral-200 bg-white p-3 text-sm text-neutral-700">
              <p className="font-semibold text-neutral-900">{model.homework.card.homeworkTitle}</p>
              <p className="text-xs text-neutral-500">{model.homework.card.statusLabel} · Срок: {model.homework.card.dueAt ?? "без срока"}</p>
              {model.homework.card.score !== null && model.homework.card.maxScore !== null ? (
                <p className="mt-1 text-xs text-sky-800">Результат: {model.homework.card.score} / {model.homework.card.maxScore}</p>
              ) : null}
              {model.homework.card.assignmentComment ? <p className="mt-1">Комментарий к выдаче: {model.homework.card.assignmentComment}</p> : null}
              {model.homework.card.reviewNote ? <p className="mt-1">Комментарий после проверки: {model.homework.card.reviewNote}</p> : null}
            </article>
          )}
        </AppCard>
      ) : null}
    </div>
  );
}
