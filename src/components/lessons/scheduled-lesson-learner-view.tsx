import { SurfaceCard } from "@/components/ui/surface-card";
import { StudentHomeworkQuizCard } from "@/components/dashboard/student-homework-quiz-card";
import type {
  ParentScheduledLessonView,
  ScheduledLessonPreviewView,
  StudentScheduledLessonView,
} from "@/lib/server/scheduled-lesson-view";

export function ScheduledLessonLearnerView({
  model,
}: {
  model:
    | StudentScheduledLessonView
    | ParentScheduledLessonView
    | ScheduledLessonPreviewView;
}) {
  return (
    <div className="space-y-5">
      {!model.studentContent ? (
        <SurfaceCard>
          {model.studentContentUnavailableReason === "schema_missing" ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Контент урока для ученика временно недоступен. Примените миграцию
              lesson student content layer.
            </p>
          ) : model.studentContentUnavailableReason === "invalid_payload" ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Контент урока для ученика временно недоступен: source-данные урока
              заполнены некорректно.
            </p>
          ) : model.studentContentUnavailableReason === "load_failed" ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Не удалось загрузить контент урока для ученика.
            </p>
          ) : (
            <p className="text-sm text-neutral-700">
              Контент урока для ученика пока не опубликован.
            </p>
          )}
        </SurfaceCard>
      ) : null}

      {(model.studentContent?.sections ?? []).map((section, index) => (
        <SurfaceCard key={`${section.type}-${index}`} title={section.title}>
          {section.type === "lesson_focus" ? (
            <>
              <p className="mt-2 text-sm text-neutral-700">{section.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {section.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </>
          ) : null}

          {section.type === "vocabulary_cards" ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {section.items.map((item) => (
                <article
                  key={item.term}
                  className="rounded-2xl border border-neutral-200 bg-white p-3"
                >
                  <p className="text-lg font-bold text-neutral-950">
                    {item.term}
                  </p>
                  <p className="text-sm text-neutral-600">
                    {item.pinyin ?? ""}
                  </p>
                  <p className="text-sm text-neutral-700">{item.meaning}</p>
                </article>
              ))}
            </div>
          ) : null}

          {section.type === "phrase_cards" ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {section.items.map((item) => (
                <article
                  key={item.phrase}
                  className="rounded-2xl border border-violet-200 bg-violet-50/50 p-3"
                >
                  <p className="text-lg font-bold text-neutral-950">
                    {item.phrase}
                  </p>
                  <p className="text-sm text-neutral-600">
                    {item.pinyin ?? ""}
                  </p>
                  <p className="text-sm text-neutral-700">{item.meaning}</p>
                  {item.usageHint ? (
                    <p className="mt-1 text-xs text-neutral-600">
                      {item.usageHint}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}

          {section.type === "media_asset" ? (
            <article className="mt-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-3 text-sm">
              <p className="font-semibold text-neutral-900">
                {model.assetsById[section.assetId]?.title ?? section.title}
              </p>
              <p className="text-neutral-700">{section.studentPrompt}</p>
              {model.assetsById[section.assetId]?.sourceUrl ? (
                <a
                  href={model.assetsById[section.assetId]?.sourceUrl}
                  className="mt-2 inline-block text-xs text-sky-700 underline underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть материал
                </a>
              ) : null}
            </article>
          ) : null}

          {section.type === "action_cards" ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {section.items.map((item) => (
                <article
                  key={item.term}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3"
                >
                  <p className="text-lg font-bold text-neutral-950">
                    {item.term}
                  </p>
                  <p className="text-sm text-neutral-600">
                    {item.pinyin ?? ""} · {item.meaning}
                  </p>
                  <p className="text-sm text-neutral-700">
                    {item.movementHint}
                  </p>
                </article>
              ))}
            </div>
          ) : null}

          {section.type === "worksheet" ? (
            <article className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-neutral-700">
              <p className="font-semibold text-neutral-900">
                {section.pageLabel ?? "Задание"}
              </p>
              <p>{section.instructions}</p>
            </article>
          ) : null}

          {section.type === "recap" ? (
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              {section.bullets.map((bullet) => (
                <li key={bullet}>• {bullet}</li>
              ))}
            </ul>
          ) : null}
        </SurfaceCard>
      ))}

      {model.role === "student" && model.homework ? (
        <SurfaceCard title="Домашнее задание">
          <article className="mt-3 rounded-2xl border border-neutral-200 bg-white p-3">
            <p className="font-semibold text-neutral-900">
              {model.homework.homeworkTitle}
            </p>
            <p className="text-xs text-neutral-500">
              {model.homework.statusLabel} · Срок:{" "}
              {model.homework.dueAt ?? "без срока"}
            </p>
            <p className="mt-2 text-sm text-neutral-700">
              {model.homework.instructions}
            </p>
            {model.homework.kind === "practice_text" ? (
              <form
                className="mt-2 space-y-2"
                action={`/api/student/homework/${model.homework.studentHomeworkAssignmentId}/submit`}
                method="POST"
              >
                <textarea
                  name="submissionText"
                  defaultValue={model.homework.submissionText ?? ""}
                  rows={3}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="Напиши короткий ответ"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white"
                >
                  Отправить
                </button>
              </form>
            ) : (
              <StudentHomeworkQuizCard item={model.homework} />
            )}
          </article>
        </SurfaceCard>
      ) : null}

      {model.role === "student" && model.communication.length > 0 ? (
        <SurfaceCard title="Обсуждение по уроку">
          <div className="space-y-1 text-sm text-neutral-700">
            {model.communication.map((message) => (
              <p key={message.id}>
                <span className="font-medium">{message.authorRole}:</span>{" "}
                {message.body}
              </p>
            ))}
          </div>
        </SurfaceCard>
      ) : null}

      {model.role === "parent" ? (
        <SurfaceCard title="Дети на этом уроке">
          <div className="space-y-3">
            {model.childrenRuntime.map((child) => (
              <article
                key={child.studentId}
                className="rounded-2xl border border-neutral-200 bg-white p-3 text-sm"
              >
                <p className="font-semibold text-neutral-900">
                  {child.studentName}
                </p>
                <p className="text-xs text-neutral-500">
                  {child.lessonStatusLabel}
                </p>
                {child.homework ? (
                  <>
                    <p className="mt-1 text-neutral-700">
                      {child.homework.homeworkTitle} ·{" "}
                      {child.homework.statusLabel}
                    </p>
                    {child.homework.score !== null &&
                    child.homework.maxScore !== null ? (
                      <p className="text-xs text-sky-800">
                        Результат: {child.homework.score} /{" "}
                        {child.homework.maxScore}
                      </p>
                    ) : null}
                    {child.homework.assignmentComment ? (
                      <p className="text-xs text-neutral-700">
                        Комментарий к выдаче: {child.homework.assignmentComment}
                      </p>
                    ) : null}
                    {child.homework.reviewNote ? (
                      <p className="text-xs text-neutral-700">
                        Комментарий после проверки: {child.homework.reviewNote}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-1 text-neutral-600">
                    Домашнее задание пока не выдано.
                  </p>
                )}
                {child.communicationPreview.length > 0 ? (
                  <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2">
                    {child.communicationPreview.map((message) => (
                      <p key={message.id} className="text-xs text-neutral-700">
                        <span className="font-medium">
                          {message.authorRole}:
                        </span>{" "}
                        {message.body}
                      </p>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
