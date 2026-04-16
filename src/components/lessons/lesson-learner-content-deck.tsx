import Image from "next/image";
import { BookOpen, CirclePlay, Music2 } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import type { MethodologyLessonStudentContent, ReusableAsset } from "@/lib/lesson-content";
import { classNames } from "@/lib/ui/classnames";

type Props = {
  source: MethodologyLessonStudentContent | null;
  unavailableReason: "schema_missing" | "invalid_payload" | "load_failed" | null;
  assetsById: Record<string, ReusableAsset>;
  compact?: boolean;
};

function EmptyState({ reason }: { reason: Props["unavailableReason"] }) {
  return (
    <div className="space-y-2 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
      {reason === "schema_missing" ? (
        <p>Контент урока для ученика временно недоступен. Примените миграцию lesson student content layer.</p>
      ) : reason === "invalid_payload" ? (
        <p>Контент урока для ученика временно недоступен: source-данные урока заполнены некорректно.</p>
      ) : reason === "load_failed" ? (
        <p>Не удалось загрузить контент урока для ученика.</p>
      ) : null}
      <p>Для этого урока пока нет отдельного learner-facing контента.</p>
    </div>
  );
}

function ToneClass(tone?: string) {
  if (tone === "sky") return "border-sky-200 bg-sky-50/70";
  if (tone === "violet") return "border-violet-200 bg-violet-50/70";
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50/70";
  if (tone === "amber") return "border-amber-200 bg-amber-50/70";
  if (tone === "rose") return "border-rose-200 bg-rose-50/70";
  return "border-neutral-200 bg-white";
}

export function LessonLearnerContentDeck({ source, unavailableReason, assetsById, compact = false }: Props) {
  if (!source) return <EmptyState reason={unavailableReason} />;

  return (
    <section className="space-y-3" aria-label="Ученический контент урока">
      {source.sections.map((section, idx) => (
        <article key={`${section.type}-${idx}-${section.title}`} className={classNames("rounded-2xl border p-4", ToneClass(section.tone))}>
          <header className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-neutral-900">{section.title}</h3>
              {section.subtitle ? <p className="text-sm text-neutral-600">{section.subtitle}</p> : null}
            </div>
            {section.illustrationSrc ? (
              <Image src={section.illustrationSrc} alt="Иллюстрация карточки" width={compact ? 56 : 72} height={compact ? 56 : 72} className="rounded-lg border border-black/10 bg-white object-contain" />
            ) : null}
          </header>

          {section.type === "lesson_focus" ? (
            <>
              <p className="mt-2 text-sm text-neutral-700">{section.body}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {section.chips.map((chip) => (
                  <Chip key={chip} tone="sky" size="sm">{chip}</Chip>
                ))}
              </div>
            </>
          ) : null}

          {section.type === "vocabulary_cards" ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item) => (
                <article key={item.term} className="rounded-xl border border-neutral-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-3xl font-bold leading-none text-neutral-950">{item.term}</p>
                      {item.pinyin ? <p className="mt-1 text-xs text-neutral-600">{item.pinyin}</p> : null}
                    </div>
                    {item.illustrationSrc ? <Image src={item.illustrationSrc} alt={item.meaning} width={42} height={42} className="rounded-md border border-black/10 bg-neutral-50" /> : null}
                  </div>
                  <p className="mt-2 text-sm text-neutral-700">{item.meaning}</p>
                  {item.visualHint ? <p className="text-xs text-neutral-500">{item.visualHint}</p> : null}
                </article>
              ))}
            </div>
          ) : null}

          {section.type === "phrase_cards" ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {section.items.map((item) => (
                <article key={item.phrase} className="rounded-xl border border-violet-200 bg-white p-3">
                  <p className="text-2xl font-bold text-neutral-950">{item.phrase}</p>
                  {item.pinyin ? <p className="text-xs text-neutral-600">{item.pinyin}</p> : null}
                  <p className="mt-1 text-sm text-neutral-700">{item.meaning}</p>
                  {item.usageHint ? <p className="mt-1 text-xs text-neutral-600">{item.usageHint}</p> : null}
                  {item.example ? <p className="mt-1 text-xs font-medium text-violet-800">Например: {item.example}</p> : null}
                </article>
              ))}
            </div>
          ) : null}

          {section.type === "media_asset" ? (
            <article className="mt-3 rounded-xl border border-sky-200 bg-white p-3 text-sm text-neutral-700">
              <p className="flex items-center gap-1.5 font-semibold text-neutral-900">
                {section.assetKind === "song" ? <Music2 className="h-4 w-4" /> : <CirclePlay className="h-4 w-4" />} 
                {assetsById[section.assetId]?.title ?? section.title}
              </p>
              <p className="mt-1">{section.studentPrompt}</p>
              {section.teacherShareHint ? <p className="mt-1 text-xs text-neutral-600">{section.teacherShareHint}</p> : null}
              {assetsById[section.assetId]?.sourceUrl ? (
                <a href={assetsById[section.assetId].sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800">
                  {section.ctaLabel ?? "Открыть материал"}
                </a>
              ) : (
                <p className="mt-2 inline-flex rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-medium text-neutral-600">
                  Материал покажет преподаватель на уроке
                </p>
              )}
            </article>
          ) : null}

          {section.type === "action_cards" ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {section.items.map((item) => (
                <article key={item.term} className="rounded-xl border border-emerald-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-3xl font-bold leading-none text-neutral-950">{item.term}</p>
                      {item.pinyin ? <p className="mt-1 text-xs text-neutral-600">{item.pinyin}</p> : null}
                    </div>
                    {item.illustrationSrc ? <Image src={item.illustrationSrc} alt={item.meaning} width={42} height={42} className="rounded-md border border-black/10 bg-neutral-50" /> : null}
                  </div>
                  <p className="mt-1 text-sm text-neutral-700">{item.meaning}</p>
                  <p className="text-xs text-neutral-600">{item.movementHint}</p>
                </article>
              ))}
            </div>
          ) : null}

          {section.type === "worksheet" ? (
            <article className="mt-3 rounded-xl border border-amber-200 bg-white p-3 text-sm text-neutral-700">
              <p className="flex items-center gap-1.5 font-semibold text-neutral-900"><BookOpen className="h-4 w-4" />{section.pageLabel ?? "Задание"}</p>
              <p className="mt-1">{section.instructions}</p>
              {section.teacherHint ? <p className="mt-1 text-xs text-neutral-600">{section.teacherHint}</p> : null}
            </article>
          ) : null}

          {section.type === "recap" ? (
            <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
              {section.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neutral-400" />{bullet}</li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </section>
  );
}
