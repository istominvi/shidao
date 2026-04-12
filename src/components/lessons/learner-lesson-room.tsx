import Link from "next/link";
import { AppCard } from "@/components/app/app-card";
import type { LearnerLessonRoomReadModel } from "@/lib/server/learner-lesson-room";

export function LearnerLessonRoom({
  readModel,
  role,
}: {
  readModel: LearnerLessonRoomReadModel;
  role: "student" | "parent";
}) {
  return (
    <div className="space-y-4">
      <AppCard className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">{role === "student" ? "Ученическая версия" : "Версия для семьи"}</p>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">{readModel.title}</h1>
        {readModel.subtitle ? <p className="mt-1 text-sm text-neutral-700">{readModel.subtitle}</p> : null}
      </AppCard>

      {readModel.lessonContent.sections.map((section, index) => (
        <AppCard key={`${section.type}-${index}`} className="p-5">
          <h2 className="text-lg font-semibold text-neutral-900">{section.title}</h2>
          {section.type === "lesson_focus" ? (
            <>
              <p className="mt-2 text-sm text-neutral-700">{section.body}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {section.chips.map((chip) => (
                  <span key={chip} className="rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">{chip}</span>
                ))}
              </div>
            </>
          ) : null}
          {section.type === "vocabulary_cards" || section.type === "action_cards" ? (
            <ul className="mt-2 space-y-2 text-sm">
              {section.items.map((item) => (
                <li key={item.term} className="rounded-xl border border-neutral-200 p-2">
                  <p className="font-semibold">{item.term} {item.pinyin ? `(${item.pinyin})` : ""} — {item.meaning}</p>
                  {"movementHint" in item && item.movementHint ? <p className="text-xs text-neutral-600">{item.movementHint}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {section.type === "phrase_cards" ? (
            <ul className="mt-2 space-y-2 text-sm">
              {section.items.map((item) => (
                <li key={item.phrase} className="rounded-xl border border-neutral-200 p-2">
                  <p className="font-semibold">{item.phrase} {item.pinyin ? `(${item.pinyin})` : ""}</p>
                  <p>{item.meaning}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {section.type === "media_asset" || section.type === "worksheet" ? (
            <div className="mt-2 rounded-xl border border-dashed border-neutral-300 p-3 text-sm text-neutral-700">
              <p>{section.type === "media_asset" ? section.studentPrompt : section.instructions}</p>
              {section.assetId ? <p className="text-xs text-neutral-500">Материал: {readModel.assetsById[section.assetId]?.title ?? section.assetId}</p> : null}
            </div>
          ) : null}
          {section.type === "recap" ? (
            <ul className="mt-2 space-y-1 text-sm text-neutral-700">
              {section.bullets.map((bullet) => <li key={bullet}>• {bullet}</li>)}
            </ul>
          ) : null}
        </AppCard>
      ))}

      {readModel.homework ? (
        <AppCard className="p-5">
          <h2 className="text-lg font-semibold text-neutral-900">Домашнее задание</h2>
          <p className="mt-1 text-sm">{readModel.homework.title}</p>
          <p className="text-sm text-neutral-600">{readModel.homework.instructions}</p>
          <p className="text-xs text-neutral-500">{readModel.homework.statusLabel} · Срок: {readModel.homework.dueAt ?? "без срока"}</p>
          {readModel.homework.readOnly ? (
            <p className="mt-2 text-xs text-neutral-600">Режим просмотра для родителя.</p>
          ) : (
            <Link href="/dashboard" className="mt-2 inline-flex rounded-xl bg-sky-700 px-3 py-2 text-sm font-semibold text-white">Открыть и выполнить</Link>
          )}
        </AppCard>
      ) : null}
    </div>
  );
}
