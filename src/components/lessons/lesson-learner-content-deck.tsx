import Image from "next/image";
import { BookOpen, CirclePlay, ListChecks, Music2, Sparkles } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import type {
  MethodologyLessonStudentContent,
  MethodologyLessonStudentContentSection,
  ReusableAsset,
} from "@/lib/lesson-content";
import { classNames } from "@/lib/ui/classnames";

type Props = {
  source: MethodologyLessonStudentContent | null;
  unavailableReason: "schema_missing" | "invalid_payload" | "load_failed" | null;
  assetsById: Record<string, ReusableAsset>;
  compact?: boolean;
};

type SceneGroup = {
  key: string;
  sections: MethodologyLessonStudentContentSection[];
};

function EmptyState({ reason }: { reason: Props["unavailableReason"] }) {
  return (
    <div className="space-y-2 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
      {reason === "schema_missing" ? <p>Контент урока для ученика временно недоступен. Примените миграцию lesson student content layer.</p> : null}
      {reason === "invalid_payload" ? <p>Контент урока для ученика временно недоступен: source-данные урока заполнены некорректно.</p> : null}
      {reason === "load_failed" ? <p>Не удалось загрузить контент урока для ученика.</p> : null}
      <p>Для этого урока пока нет отдельного learner-facing контента.</p>
    </div>
  );
}

function toneClass(tone?: string) {
  if (tone === "sky") return "border-sky-200 bg-sky-50/70";
  if (tone === "violet") return "border-violet-200 bg-violet-50/70";
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50/70";
  if (tone === "amber") return "border-amber-200 bg-amber-50/70";
  if (tone === "rose") return "border-rose-200 bg-rose-50/70";
  return "border-neutral-200 bg-white";
}

function groupScenes(sections: MethodologyLessonStudentContentSection[]) {
  const groups: SceneGroup[] = [];
  for (const section of sections) {
    const sceneId = section.sceneId?.trim();
    if (sceneId && groups.length && groups[groups.length - 1].key === sceneId) {
      groups[groups.length - 1].sections.push(section);
      continue;
    }
    groups.push({ key: sceneId || `${section.type}-${groups.length}`, sections: [section] });
  }
  return groups;
}

function SceneHeader({ section, compact }: { section: MethodologyLessonStudentContentSection; compact: boolean }) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div>
        <h3 className={classNames("font-semibold text-neutral-900", compact ? "text-base" : "text-lg")}>{section.title}</h3>
        {section.subtitle ? <p className="mt-1 text-sm text-neutral-600">{section.subtitle}</p> : null}
      </div>
      {section.illustrationSrc ? (
        <Image
          src={section.illustrationSrc}
          alt="Иллюстрация"
          width={compact ? 72 : 92}
          height={compact ? 72 : 92}
          className="rounded-xl border border-black/10 bg-white object-contain"
        />
      ) : null}
    </header>
  );
}

function renderSection(
  section: MethodologyLessonStudentContentSection,
  assetsById: Record<string, ReusableAsset>,
) {
  if (section.type === "lesson_focus") {
    if (section.layout === "hero") {
      return (
        <div className="mt-3 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3">
            <p className="text-sm leading-6 text-neutral-700">{section.body}</p>
            <p className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-sky-900">
              <Sparkles className="h-4 w-4" />
              Сегодня мы отправляемся на ферму вместе с Сяо Лоном и Сяо Мей.
            </p>
            <p className="text-sm text-neutral-700">Сначала: поздороваемся, посмотрим видео и выучим первые слова.</p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-sky-800">Главные слова урока</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {section.chips.slice(0, 5).map((chip) => (
                <Chip key={chip} tone="sky" size="sm">{chip}</Chip>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (section.layout === "roadmap") {
      return (
        <div className="mt-3 rounded-xl border border-violet-200 bg-white p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-900"><ListChecks className="h-4 w-4" />План урока</p>
          <p className="mt-2 text-sm text-neutral-700">{section.body}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {section.chips.map((chip) => <Chip key={chip} tone="violet" size="sm">{chip}</Chip>)}
          </div>
        </div>
      );
    }

    if (section.layout === "counting") {
      return (
        <div className="mt-3 grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-xl border border-sky-200 bg-white p-3">
            <p className="text-sm text-neutral-700">{section.body}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-sky-800">Считаем вслух</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {section.chips.map((chip) => <Chip key={chip} tone="sky" size="sm">{chip}</Chip>)}
            </div>
          </div>
        </div>
      );
    }

    return <p className="mt-2 text-sm text-neutral-700">{section.body}</p>;
  }

  if (section.type === "vocabulary_cards") {
    return (
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {section.items.map((item) => (
          <article key={item.term} className="rounded-xl border border-neutral-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-4xl font-bold leading-none text-neutral-950">{item.term}</p>
                {item.pinyin ? <p className="mt-1 text-xs text-neutral-600">{item.pinyin}</p> : null}
              </div>
              {item.illustrationSrc ? (
                <Image src={item.illustrationSrc} alt={item.meaning} width={48} height={48} className="rounded-lg border border-black/10 bg-neutral-50" />
              ) : null}
            </div>
            <p className="mt-2 text-sm font-medium text-neutral-800">{item.meaning}</p>
            {item.visualHint ? <p className="text-xs text-neutral-600">{item.visualHint}</p> : null}
          </article>
        ))}
      </div>
    );
  }

  if (section.type === "phrase_cards") {
    return (
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {section.items.map((item) => (
          <article key={item.phrase} className="rounded-xl border border-violet-200 bg-white p-3">
            <p className="text-3xl font-bold leading-none text-neutral-950">{item.phrase}</p>
            {item.pinyin ? <p className="mt-1 text-xs text-neutral-600">{item.pinyin}</p> : null}
            <p className="mt-1 text-sm text-neutral-800">{item.meaning}</p>
            {item.usageHint ? <p className="mt-1 text-xs text-neutral-600">{item.usageHint}</p> : null}
            {item.example ? <p className="mt-1 text-xs font-semibold text-violet-900">Пример: {item.example}</p> : null}
          </article>
        ))}
      </div>
    );
  }

  if (section.type === "action_cards") {
    return (
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {section.items.map((item) => (
          <article key={item.term} className="rounded-xl border border-emerald-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-4xl font-bold leading-none text-neutral-950">{item.term}</p>
                {item.pinyin ? <p className="mt-1 text-xs text-neutral-600">{item.pinyin}</p> : null}
              </div>
              {item.illustrationSrc ? <Image src={item.illustrationSrc} alt={item.meaning} width={48} height={48} className="rounded-lg border border-black/10 bg-neutral-50" /> : null}
            </div>
            <p className="mt-2 text-sm font-medium text-neutral-800">{item.meaning}</p>
            <p className="text-xs text-neutral-700">{item.movementHint}</p>
          </article>
        ))}
      </div>
    );
  }

  if (section.type === "worksheet") {
    return (
      <article className="mt-3 rounded-xl border border-amber-200 bg-white p-3 text-sm text-neutral-700">
        <p className="flex items-center gap-1.5 font-semibold text-neutral-900"><BookOpen className="h-4 w-4" />{section.pageLabel ?? "Задание"}</p>
        <p className="mt-1">{section.instructions}</p>
        {section.teacherHint ? <p className="mt-1 text-xs text-neutral-600">{section.teacherHint}</p> : null}
      </article>
    );
  }

  if (section.type === "media_asset") {
    return (
      <article className="mt-3 rounded-xl border border-rose-200 bg-white p-3 text-sm text-neutral-700">
        <p className="flex items-center gap-1.5 font-semibold text-neutral-900">
          {section.assetKind === "song" ? <Music2 className="h-4 w-4" /> : <CirclePlay className="h-4 w-4" />}
          {assetsById[section.assetId]?.title ?? section.title}
        </p>
        <p className="mt-1">{section.studentPrompt}</p>
        {section.teacherShareHint ? <p className="mt-1 text-xs text-neutral-600">{section.teacherShareHint}</p> : null}
        {assetsById[section.assetId]?.sourceUrl ? (
          <a href={assetsById[section.assetId].sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-800">
            {section.ctaLabel ?? "Открыть материал"}
          </a>
        ) : (
          <p className="mt-2 inline-flex rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-medium text-neutral-600">Материал покажет преподаватель на уроке</p>
        )}
      </article>
    );
  }

  return (
    <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
      {section.bullets.map((bullet) => (
        <li key={bullet} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neutral-400" />{bullet}</li>
      ))}
    </ul>
  );
}

export function LessonLearnerContentDeck({ source, unavailableReason, assetsById, compact = false }: Props) {
  if (!source) return <EmptyState reason={unavailableReason} />;

  const scenes = groupScenes(source.sections);

  return (
    <section className="space-y-4" aria-label="Ученический контент урока">
      {scenes.map((scene, sceneIndex) => {
        const main = scene.sections[0];
        const isHero = main.layout === "hero";
        return (
          <article
            key={scene.key}
            className={classNames(
              "rounded-2xl border p-4",
              toneClass(main.tone),
              isHero ? "p-5 md:p-6 shadow-[0_14px_30px_rgba(15,23,42,0.08)]" : "",
            )}
          >
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">Сцена {sceneIndex + 1}</div>
            <SceneHeader section={main} compact={compact} />
            {scene.sections.map((section) => (
              <div key={`${scene.key}-${section.type}-${section.title}`}>{renderSection(section, assetsById)}</div>
            ))}
          </article>
        );
      })}
    </section>
  );
}
