"use client";

import { useMemo, useState } from "react";
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

function resolveAssetPlaybackUrl(asset?: ReusableAsset) {
  return asset?.fileRef ?? asset?.sourceUrl ?? null;
}

function AudioPlayButton({ asset }: { asset?: ReusableAsset }) {
  const url = resolveAssetPlaybackUrl(asset);
  if (!url) return null;
  return (
    <audio controls preload="none" className="mt-2 w-full">
      <source src={url} />
    </audio>
  );
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

function FlashcardCarousel({ section, assetsById }: { section: Extract<MethodologyLessonStudentContentSection, { type: "vocabulary_cards" }>; assetsById: Record<string, ReusableAsset> }) {
  const [index, setIndex] = useState(0);
  const item = section.items[index];
  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Карточка {index + 1} / {section.items.length}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-black/10 bg-neutral-50 p-4">
          {item.illustrationSrc ? <Image src={item.illustrationSrc} alt={item.meaning} width={320} height={240} className="h-56 w-auto object-contain" /> : <span className="text-sm text-neutral-500">Иллюстрация</span>}
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
          <p className="text-6xl font-bold leading-none text-neutral-950">{item.term}</p>
          {item.pinyin ? <p className="mt-2 text-lg text-neutral-700">{item.pinyin}</p> : null}
          <p className="mt-2 text-base font-semibold text-neutral-900">{item.meaning}</p>
          {item.visualHint ? <p className="mt-1 text-sm text-neutral-700">{item.visualHint}</p> : null}
          {item.audioAssetId ? <AudioPlayButton asset={assetsById[item.audioAssetId]} /> : null}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium" onClick={() => setIndex((prev) => (prev - 1 + section.items.length) % section.items.length)}>Назад</button>
        <button type="button" className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium" onClick={() => setIndex((prev) => (prev + 1) % section.items.length)}>Далее</button>
      </div>
    </div>
  );
}

function ActionSlider({ section, assetsById }: { section: Extract<MethodologyLessonStudentContentSection, { type: "action_cards" }>; assetsById: Record<string, ReusableAsset> }) {
  const [index, setIndex] = useState(0);
  const item = section.items[index];
  return (
    <div className="mt-3 rounded-2xl border border-emerald-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Шаг движения {index + 1} / {section.items.length}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-black/10 bg-neutral-50 p-4">
          {item.illustrationSrc ? <Image src={item.illustrationSrc} alt={item.meaning} width={320} height={240} className="h-56 w-auto object-contain" /> : <span className="text-sm text-neutral-500">Покажи движение</span>}
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <p className="text-5xl font-bold leading-none text-neutral-950">{item.term}</p>
          {item.pinyin ? <p className="mt-2 text-lg text-neutral-700">{item.pinyin}</p> : null}
          <p className="mt-2 text-base font-semibold text-neutral-900">{item.meaning}</p>
          <p className="mt-1 text-sm text-neutral-700">{item.movementHint}</p>
          {item.commandExample ? <p className="mt-1 text-sm font-semibold text-emerald-900">{item.commandExample}</p> : null}
          {item.audioAssetId ? <AudioPlayButton asset={assetsById[item.audioAssetId]} /> : null}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium" onClick={() => setIndex((prev) => (prev - 1 + section.items.length) % section.items.length)}>Назад</button>
        <button type="button" className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium" onClick={() => setIndex((prev) => (prev + 1) % section.items.length)}>Далее</button>
      </div>
    </div>
  );
}

function CountBoard({ section }: { section: Extract<MethodologyLessonStudentContentSection, { type: "count_board" }> }) {
  const [selected, setSelected] = useState(section.groups[0]?.id);
  const active = section.groups.find((group) => group.id === selected) ?? section.groups[0];
  return (
    <div className="mt-3 rounded-xl border border-sky-200 bg-white p-3">
      <p className="text-sm text-neutral-700">{section.prompt}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {section.groups.map((group) => (
          <button key={group.id} type="button" onClick={() => setSelected(group.id)} className={classNames("rounded-full border px-3 py-1 text-sm", selected === group.id ? "border-sky-500 bg-sky-100 text-sky-900" : "border-neutral-300 bg-white text-neutral-700")}>{group.label}</button>
        ))}
      </div>
      {active ? <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">{active.cue ?? `Считаем: ${active.count}`}</p> : null}
    </div>
  );
}

function FarmPlacementCard({ section }: { section: Extract<MethodologyLessonStudentContentSection, { type: "farm_placement" }> }) {
  const [animalId, setAnimalId] = useState(section.animals[0]?.id);
  const selectedAnimal = section.animals.find((item) => item.id === animalId) ?? section.animals[0];
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-xl border border-amber-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-800">Выбери животное</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {section.animals.map((item) => (
            <button key={item.id} type="button" onClick={() => setAnimalId(item.id)} className={classNames("rounded-full border px-3 py-1 text-sm", animalId === item.id ? "border-amber-500 bg-amber-100 text-amber-900" : "border-neutral-300 bg-white text-neutral-700")}>{item.hanzi}</button>
          ))}
        </div>
        {selectedAnimal ? <p className="mt-3 text-sm text-neutral-700">{section.targetPhraseTemplate.replace("{animal}", selectedAnimal.hanzi).replace("{zone}", section.defaultZoneLabel)}</p> : null}
      </div>
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-amber-200 bg-white p-3">
        {section.illustrationSrc ? <Image src={section.illustrationSrc} alt="Ферма" width={400} height={260} className="h-56 w-auto object-contain" /> : <span className="text-sm text-neutral-600">Игрушечная ферма</span>}
      </div>
    </div>
  );
}

function renderSection(section: MethodologyLessonStudentContentSection, assetsById: Record<string, ReusableAsset>) {
  if (section.type === "presentation") {
    const asset = assetsById[section.assetId];
    const url = resolveAssetPlaybackUrl(asset);
    return (
      <article className="mt-3 rounded-xl border border-sky-200 bg-white p-3 text-sm text-neutral-700">
        <p className="font-semibold text-neutral-900">{asset?.title ?? "Презентация урока"}</p>
        {section.note ? <p className="mt-1">{section.note}</p> : null}
        {url ? <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800">{section.studentCtaLabel ?? "Открыть презентацию"}</a> : <p className="mt-2 text-xs">Презентацию открывает преподаватель.</p>}
      </article>
    );
  }

  if (section.type === "resource_links") {
    return (
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {section.resources.map((resource) => {
          const asset = resource.assetId ? assetsById[resource.assetId] : undefined;
          const url = resolveAssetPlaybackUrl(asset) ?? resource.sourceUrl ?? null;
          return (
            <article key={resource.id} className="rounded-xl border border-neutral-200 bg-white p-3 text-sm">
              <p className="font-semibold text-neutral-900">{resource.title}</p>
              {resource.subtitle ? <p className="mt-1 text-neutral-700">{resource.subtitle}</p> : null}
              {url ? <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-lg border border-neutral-300 bg-neutral-50 px-2.5 py-1.5 text-xs font-semibold text-neutral-800">Открыть ресурс</a> : <p className="mt-2 text-xs text-neutral-600">Ресурс покажет преподаватель на уроке.</p>}
            </article>
          );
        })}
      </div>
    );
  }

  if (section.type === "count_board") {
    return <CountBoard section={section} />;
  }

  if (section.type === "word_list") {
    return (
      <div className="mt-3 space-y-3">
        {section.groups.map((group) => (
          <article key={group.id} className="rounded-xl border border-neutral-200 bg-white p-3">
            <p className="text-sm font-semibold text-neutral-900">{group.title}</p>
            <div className="mt-2 grid gap-2">
              {group.entries.map((entry) => (
                <div key={`${group.id}-${entry.hanzi}`} className="rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                  <p className="text-2xl font-bold text-neutral-950">{entry.hanzi}</p>
                  <p className="text-xs text-neutral-700">{entry.pinyin ?? ""} · {entry.meaning}</p>
                  {entry.audioAssetId ? <AudioPlayButton asset={assetsById[entry.audioAssetId]} /> : null}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (section.type === "matching_practice") {
    return (
      <div className="mt-3 rounded-xl border border-violet-200 bg-white p-3">
        <p className="text-sm text-neutral-700">{section.prompt}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {section.pairs.map((pair) => (
            <div key={pair.id} className="rounded-lg border border-violet-200 bg-violet-50/60 p-2 text-sm">
              {pair.illustrationSrc ? <Image src={pair.illustrationSrc} alt={pair.label} width={120} height={88} className="mb-2 h-20 w-full rounded-md object-contain" /> : null}
              <p className="font-semibold">{pair.label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section.type === "farm_placement") {
    return <FarmPlacementCard section={section} />;
  }

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
              {section.chips.slice(0, 6).map((chip) => <Chip key={chip} tone="sky" size="sm">{chip}</Chip>)}
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
          <div className="mt-3 flex flex-wrap gap-1.5">{section.chips.map((chip) => <Chip key={chip} tone="violet" size="sm">{chip}</Chip>)}</div>
        </div>
      );
    }

    return <p className="mt-2 text-sm text-neutral-700">{section.body}</p>;
  }

  if (section.type === "vocabulary_cards") {
    if (section.displayMode === "carousel") {
      return <FlashcardCarousel section={section} assetsById={assetsById} />;
    }
    return (
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {section.items.map((item) => (
          <article key={item.term} className="rounded-xl border border-neutral-200 bg-white p-3">
            <p className="text-3xl font-bold leading-none text-neutral-950">{item.term}</p>
            <p className="mt-1 text-xs text-neutral-600">{item.pinyin}</p>
            <p className="mt-1 text-sm text-neutral-800">{item.meaning}</p>
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
            {item.speaker ? <p className="text-xs uppercase tracking-[0.1em] text-violet-700">{item.speaker}</p> : null}
            <p className="text-3xl font-bold leading-none text-neutral-950">{item.phrase}</p>
            {item.pinyin ? <p className="mt-1 text-xs text-neutral-600">{item.pinyin}</p> : null}
            <p className="mt-1 text-sm text-neutral-800">{item.meaning}</p>
            {item.example ? <p className="mt-1 text-xs font-semibold text-violet-900">Пример: {item.example}</p> : null}
            {item.audioAssetId ? <AudioPlayButton asset={assetsById[item.audioAssetId]} /> : null}
          </article>
        ))}
      </div>
    );
  }

  if (section.type === "action_cards") {
    if (section.displayMode === "slider") {
      return <ActionSlider section={section} assetsById={assetsById} />;
    }
    return (
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {section.items.map((item) => (
          <article key={item.term} className="rounded-xl border border-emerald-200 bg-white p-3">
            <p className="text-4xl font-bold leading-none text-neutral-950">{item.term}</p>
            <p className="mt-1 text-sm text-neutral-800">{item.meaning}</p>
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
      </article>
    );
  }

  if (section.type === "media_asset") {
    return (
      <article className="mt-3 rounded-xl border border-rose-200 bg-white p-3 text-sm text-neutral-700">
        <p className="flex items-center gap-1.5 font-semibold text-neutral-900">{section.assetKind === "song" ? <Music2 className="h-4 w-4" /> : <CirclePlay className="h-4 w-4" />}{assetsById[section.assetId]?.title ?? section.title}</p>
        <p className="mt-1">{section.studentPrompt}</p>
        {resolveAssetPlaybackUrl(assetsById[section.assetId]) ? <a href={resolveAssetPlaybackUrl(assetsById[section.assetId])!} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-800">{section.ctaLabel ?? "Открыть материал"}</a> : <p className="mt-2 inline-flex rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-medium text-neutral-600">Материал покажет преподаватель на уроке</p>}
      </article>
    );
  }

  return (
    <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
      {section.bullets.map((bullet) => <li key={bullet} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neutral-400" />{bullet}</li>)}
    </ul>
  );
}

export function LessonLearnerContentDeck({ source, unavailableReason, assetsById, compact = false }: Props) {
  const scenes = useMemo(() => groupScenes(source?.sections ?? []), [source?.sections]);
  if (!source) return <EmptyState reason={unavailableReason} />;

  return (
    <section className="space-y-4" aria-label="Ученический контент урока">
      {scenes.map((scene, sceneIndex) => {
        const main = scene.sections[0];
        const isHero = main.layout === "hero";
        return (
          <article key={scene.key} className={classNames("rounded-2xl border p-4", toneClass(main.tone), isHero ? "p-5 md:p-6 shadow-[0_14px_30px_rgba(15,23,42,0.08)]" : "")}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">Сцена {sceneIndex + 1}</div>
            <SceneHeader section={main} compact={compact} />
            {scene.sections.map((section, index) => (
              <div key={`${scene.key}-${section.type}-${section.title}-${index}`}>{renderSection(section, assetsById)}</div>
            ))}
          </article>
        );
      })}
    </section>
  );
}
