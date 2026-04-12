import Link from "next/link";
import { AppCard } from "@/components/app/app-card";
import { StudentHomeworkQuizCard } from "@/components/dashboard/student-homework-quiz-card";
import type { MethodologyLessonStudentContentSection } from "@/lib/lesson-content";
import type { LearnerLessonRoomReadModel } from "@/lib/server/lesson-room";

function Section({ section }: { section: MethodologyLessonStudentContentSection }) {
  if (section.type === "lesson_focus") {
    return <AppCard className="p-4"><h3 className="font-bold">{section.title}</h3><p className="mt-2 text-sm">{section.body}</p><div className="mt-2 flex flex-wrap gap-2">{section.chips.map((chip) => <span key={chip} className="rounded-full bg-sky-100 px-2 py-1 text-xs">{chip}</span>)}</div></AppCard>;
  }
  if (section.type === "vocabulary_cards") {
    return <AppCard className="p-4"><h3 className="font-bold">{section.title}</h3><div className="mt-2 grid gap-2 md:grid-cols-2">{section.items.map((item) => <article key={item.term} className="rounded-xl border p-2"><p className="text-lg font-semibold">{item.term}</p><p className="text-xs text-neutral-600">{item.pinyin ?? ""}</p><p className="text-sm">{item.meaning}</p></article>)}</div></AppCard>;
  }
  if (section.type === "phrase_cards") {
    return <AppCard className="p-4"><h3 className="font-bold">{section.title}</h3><div className="mt-2 space-y-2">{section.items.map((item) => <article key={item.phrase} className="rounded-xl border p-2"><p className="font-semibold">{item.phrase}</p><p className="text-xs text-neutral-600">{item.pinyin ?? ""}</p><p className="text-sm">{item.meaning}</p></article>)}</div></AppCard>;
  }
  if (section.type === "media_asset") {
    return <AppCard className="p-4"><h3 className="font-bold">{section.title}</h3><p className="mt-1 text-sm">{section.studentPrompt}</p><p className="mt-2 text-xs text-neutral-500">Asset: {section.assetKind} · {section.assetId}</p></AppCard>;
  }
  if (section.type === "action_cards") {
    return <AppCard className="p-4"><h3 className="font-bold">{section.title}</h3><div className="mt-2 grid gap-2 md:grid-cols-2">{section.items.map((item) => <article key={item.term} className="rounded-xl border p-2"><p className="text-lg font-semibold">{item.term}</p><p className="text-sm">{item.meaning}</p><p className="text-xs text-neutral-600">{item.movementHint}</p></article>)}</div></AppCard>;
  }
  if (section.type === "worksheet") {
    return <AppCard className="p-4"><h3 className="font-bold">{section.title}</h3><p className="mt-1 text-sm">{section.instructions}</p><p className="mt-2 text-xs text-neutral-500">{section.pageLabel ?? section.assetId ?? ""}</p></AppCard>;
  }
  return <AppCard className="p-4"><h3 className="font-bold">{section.title}</h3><ul className="mt-2 text-sm">{section.bullets.map((bullet) => <li key={bullet}>• {bullet}</li>)}</ul></AppCard>;
}

export function LearnerLessonRoom({ model }: { model: LearnerLessonRoomReadModel }) {
  return (
    <div className="container py-6 space-y-4">
      <AppCard className="p-5">
        <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Ученическая версия урока</p>
        <h1 className="text-2xl font-black">{model.learnerContent.title}</h1>
        {model.learnerContent.subtitle ? <p className="text-sm text-neutral-700 mt-1">{model.learnerContent.subtitle}</p> : null}
      </AppCard>

      {model.learnerContent.sections.map((section, idx) => <Section key={`${section.type}-${idx}`} section={section} />)}

      {model.homework ? (
        <AppCard className="p-4 border-sky-200">
          <h2 className="font-bold">Домашнее задание</h2>
          <p className="text-sm mt-1">{model.homework.homeworkTitle}</p>
          <p className="text-xs text-neutral-600">{model.homework.statusLabel} · Срок: {model.homework.dueAt ?? "без срока"}</p>
          {model.homework.issueComment ? <p className="text-sm mt-1">Комментарий: {model.homework.issueComment}</p> : null}
          {model.role === "student" ? (
            model.homework.kind === "quiz_single_choice" ? (
              <StudentHomeworkQuizCard item={model.homework} />
            ) : (
              <form className="mt-2 space-y-2" action={`/api/student/homework/${model.homework.studentHomeworkAssignmentId}/submit`} method="POST">
                <input type="hidden" name="redirectTo" value={`/lesson-room/${model.shell.scheduledLessonId}`} />
                <textarea name="submissionText" defaultValue={model.homework.submissionText ?? ""} rows={3} className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
                <button type="submit" className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white">Отправить</button>
              </form>
            )
          ) : (
            <p className="mt-2 text-sm text-neutral-600">Режим родителя: только просмотр.</p>
          )}
        </AppCard>
      ) : null}

      <div className="pb-6"><Link className="text-sky-700 underline" href="/dashboard">Вернуться в кабинет</Link></div>
    </div>
  );
}
