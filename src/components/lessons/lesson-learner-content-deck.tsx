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
import type { MethodologyLessonStep } from "@/lib/server/methodology-lesson-unified-read-model";
import { classNames } from "@/lib/ui/classnames";

type Props = {
  steps?: MethodologyLessonStep[];
  source: MethodologyLessonStudentContent | null;
  unavailableReason: "schema_missing" | "invalid_payload" | "load_failed" | null;
  assetsById: Record<string, ReusableAsset>;
  compact?: boolean;
  mode?: "teacher_preview" | "student_live_locked" | "student_review";
  controlledStepId?: string;
  onStepChange?: (stepId: string) => void;
};

type StepGroup = {
  key: string;
  sections: MethodologyLessonStudentContentSection[];
};

function EmptyState({ reason }: { reason: Props["unavailableReason"] }) {
  return (
    <div className="space-y-2 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
      {reason === "schema_missing" ? <p>Экран ученика временно недоступен. Данные урока пока не готовы.</p> : null}
      {reason === "invalid_payload" ? <p>Экран ученика временно недоступен. Данные урока заполнены с ошибкой.</p> : null}
      {reason === "load_failed" ? <p>Не удалось загрузить экран ученика.</p> : null}
      <p>Для этого урока пока нет отдельного экрана ученика.</p>
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

function groupSteps(sections: MethodologyLessonStudentContentSection[]) {
  const groups: StepGroup[] = [];
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

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url);
}

function extractMetadataStringArray(asset: ReusableAsset | undefined, key: string) {
  const value = asset?.metadata?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function extractMetadataString(asset: ReusableAsset | undefined, key: string) {
  const value = asset?.metadata?.[key];
  return typeof value === "string" ? value : null;
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

function SceneHeader({ section, compact, hideTitle = false }: { section: MethodologyLessonStudentContentSection; compact: boolean; hideTitle?: boolean }) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div>
        {!hideTitle ? <h3 className={classNames("font-semibold text-neutral-900", compact ? "text-base" : "text-lg")}>{section.title}</h3> : null}
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

function collectAssetIdsFromSection(section: MethodologyLessonStudentContentSection): string[] {
  if (section.type === "media_asset") return [section.assetId];
  if (section.type === "presentation") return [section.assetId];
  if (section.type === "worksheet" && section.assetId) return [section.assetId];
  if (section.type === "count_board" && section.assetId) return [section.assetId];
  if (section.type === "resource_links") {
    return section.resources.map((resource) => resource.assetId).filter((id): id is string => Boolean(id));
  }
  if (section.type === "vocabulary_cards") {
    return section.items.map((item) => item.audioAssetId).filter((id): id is string => Boolean(id));
  }
  if (section.type === "phrase_cards") {
    return section.items.map((item) => item.audioAssetId).filter((id): id is string => Boolean(id));
  }
  if (section.type === "action_cards") {
    return section.items.map((item) => item.audioAssetId).filter((id): id is string => Boolean(id));
  }
  if (section.type === "word_list") {
    return section.groups.flatMap((group) =>
      group.entries.map((entry) => entry.audioAssetId).filter((id): id is string => Boolean(id)),
    );
  }
  return [];
}

function StepResources({
  step,
  sections,
  assetsById,
}: {
  step: MethodologyLessonStep;
  sections: MethodologyLessonStudentContentSection[];
  assetsById: Record<string, ReusableAsset>;
}) {
  const alreadyRenderedAssetIds = new Set(sections.flatMap(collectAssetIdsFromSection));
  const candidateAssetIds = Array.from(
    new Set([...(step.student.assetIds ?? []), ...(step.resourceIds ?? [])]),
  ).filter((assetId) => !alreadyRenderedAssetIds.has(assetId));

  const assets = candidateAssetIds
    .map((assetId) => assetsById[assetId])
    .filter((asset): asset is ReusableAsset => Boolean(asset));

  if (!assets.length) return null;
  const renderedAssets = assets
    .map((asset) => {
      const url = resolveAssetPlaybackUrl(asset);
      const slideImageRefs = extractMetadataStringArray(asset, "slideImageRefs");
      const previewSlide = slideImageRefs[0];

      if ((asset.kind === "video" || asset.kind === "lesson_video" || asset.kind === "media_file") && url && isVideoUrl(url)) {
        return (
          <article key={asset.id} className="rounded-xl border border-sky-200 bg-sky-50/40 p-3">
            <p className="text-sm font-semibold text-neutral-900">{asset.title}</p>
            <video controls preload="metadata" className="mt-2 w-full rounded-lg border border-sky-200 bg-black/80">
              <source src={url} />
            </video>
          </article>
        );
      }

      if ((asset.kind === "song_audio" || asset.kind === "pronunciation_audio") && url) {
        return (
          <article key={asset.id} className="rounded-xl border border-rose-200 bg-rose-50/40 p-3">
            <p className="text-sm font-semibold text-neutral-900">{asset.title}</p>
            <audio controls preload="none" className="mt-2 w-full">
              <source src={url} />
            </audio>
          </article>
        );
      }

      if (asset.kind === "presentation") {
        if (!url && !previewSlide) return null;
        return (
          <article key={asset.id} className="rounded-xl border border-sky-200 bg-sky-50/40 p-3">
            <p className="text-sm font-semibold text-neutral-900">{asset.title}</p>
            {previewSlide ? (
              <Image
                src={previewSlide}
                alt={`${asset.title} · превью`}
                width={960}
                height={540}
                className="mt-2 h-auto w-full rounded-lg border border-sky-200 bg-white object-contain"
              />
            ) : null}
            {url ? <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-lg border border-sky-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-800">Открыть презентацию</a> : null}
          </article>
        );
      }

      if (asset.kind === "flashcards_pdf" || asset.kind === "worksheet_pdf" || asset.kind === "worksheet") {
        if (!url) return null;
        return (
          <article key={asset.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-sm font-semibold text-neutral-900">{asset.title}</p>
            <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800">
              {asset.kind === "flashcards_pdf" || asset.kind === "worksheet_pdf" ? "Открыть PDF" : "Открыть ресурс"}
            </a>
          </article>
        );
      }

      if (!url) return null;
      return (
        <article key={asset.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-sm font-semibold text-neutral-900">{asset.title}</p>
          <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800">Открыть ресурс</a>
        </article>
      );
    })
    .filter((assetCard) => assetCard !== null);

  if (!renderedAssets.length) return null;

  return (
    <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-3">
      <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">Посмотри и послушай</h4>
      <div className="mt-3 grid gap-3">{renderedAssets}</div>
    </section>
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

function CountBoard({
  section,
  assetsById,
}: {
  section: Extract<MethodologyLessonStudentContentSection, { type: "count_board" }>;
  assetsById: Record<string, ReusableAsset>;
}) {
  const [selected, setSelected] = useState(section.groups[0]?.id);
  const active = section.groups.find((group) => group.id === selected) ?? section.groups[0];
  const asset = section.assetId ? assetsById[section.assetId] : undefined;
  const previewImageRef = extractMetadataString(asset, "previewImageRef");
  return (
    <div className="mt-3 rounded-xl border border-sky-200 bg-white p-3">
      <p className="text-sm text-neutral-700">{section.prompt}</p>
      {previewImageRef ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-sky-200 bg-sky-50 p-2">
          <Image
            src={previewImageRef}
            alt="Приложение 1"
            width={800}
            height={520}
            className="h-auto w-full rounded-lg object-contain"
          />
        </div>
      ) : null}
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

function PresentationCard({
  section,
  asset,
}: {
  section: Extract<MethodologyLessonStudentContentSection, { type: "presentation" }>;
  asset?: ReusableAsset;
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const url = resolveAssetPlaybackUrl(asset);
  const slideImageRefs = extractMetadataStringArray(asset, "slideImageRefs");
  const activeSlide = slideImageRefs[slideIndex] ?? null;

  return (
    <article className="mt-3 rounded-xl border border-sky-200 bg-white p-3 text-sm text-neutral-700">
      <p className="font-semibold text-neutral-900">{asset?.title ?? "Презентация урока"}</p>
      {section.note ? <p className="mt-1">{section.note}</p> : null}
      {activeSlide ? (
        <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/60 p-3">
          <Image
            src={activeSlide}
            alt={`Слайд ${slideIndex + 1}`}
            width={1200}
            height={675}
            className="h-auto w-full rounded-lg object-contain"
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-sky-900">Слайд {slideIndex + 1} / {slideImageRefs.length}</p>
            <div className="flex gap-2">
              <button type="button" className="rounded-lg border border-sky-300 bg-white px-2 py-1 text-xs font-semibold text-sky-800" onClick={() => setSlideIndex((prev) => (prev - 1 + slideImageRefs.length) % slideImageRefs.length)}>Назад</button>
              <button type="button" className="rounded-lg border border-sky-300 bg-white px-2 py-1 text-xs font-semibold text-sky-800" onClick={() => setSlideIndex((prev) => (prev + 1) % slideImageRefs.length)}>Далее</button>
            </div>
          </div>
        </div>
      ) : null}
      {url ? <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800">{section.studentCtaLabel ?? "Открыть презентацию"}</a> : <p className="mt-2 text-xs">Презентацию открывает преподаватель.</p>}
    </article>
  );
}

function renderSection(
  section: MethodologyLessonStudentContentSection,
  assetsById: Record<string, ReusableAsset>,
) {
  if (section.type === "presentation") {
    const asset = assetsById[section.assetId];
    return <PresentationCard section={section} asset={asset} />;
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
    return <CountBoard section={section} assetsById={assetsById} />;
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
          <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-900"><ListChecks className="h-4 w-4" />Что сегодня делаем</p>
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
    const asset = section.assetId ? assetsById[section.assetId] : undefined;
    const url = resolveAssetPlaybackUrl(asset);
    return (
      <article className="mt-3 rounded-xl border border-amber-200 bg-white p-3 text-sm text-neutral-700">
        <p className="flex items-center gap-1.5 font-semibold text-neutral-900"><BookOpen className="h-4 w-4" />{section.pageLabel ?? "Задание"}</p>
        <p className="mt-1">{section.instructions}</p>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800">
            Открыть внешний ресурс
          </a>
        ) : (
          <p className="mt-2 text-xs text-neutral-600">PDF будет добавлен позже.</p>
        )}
      </article>
    );
  }

  if (section.type === "media_asset") {
    const asset = assetsById[section.assetId];
    const url = resolveAssetPlaybackUrl(asset);
    const isSong = section.assetKind === "song";
    const renderAsVideo = !isSong && Boolean(url && isVideoUrl(url));
    return (
      <article className={classNames("mt-3 rounded-2xl border bg-white p-4 text-sm text-neutral-700", isSong ? "border-rose-200" : "border-sky-200")}>
        <p className={classNames("flex items-center gap-1.5 text-base font-semibold", isSong ? "text-rose-900" : "text-sky-900")}>{isSong ? <Music2 className="h-5 w-5" /> : <CirclePlay className="h-5 w-5" />}{asset?.title ?? section.title}</p>
        <p className="mt-1">{section.studentPrompt}</p>
        {renderAsVideo && url ? (
          <video controls preload="metadata" className="mt-3 w-full rounded-xl border border-sky-200 bg-black/90">
            <source src={url} />
          </video>
        ) : null}
        {isSong && url ? (
          <audio controls preload="none" className="mt-3 w-full">
            <source src={url} />
          </audio>
        ) : null}
        {!renderAsVideo && !isSong && url ? (
          <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800">
            {section.ctaLabel ?? "Открыть видео"}
          </a>
        ) : null}
        {!url ? <p className="mt-2 inline-flex rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-medium text-neutral-600">Материал откроет преподаватель на уроке.</p> : null}
      </article>
    );
  }

  return (
    <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
      {section.bullets.map((bullet) => <li key={bullet} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neutral-400" />{bullet}</li>)}
    </ul>
  );
}

function buildLegacyStepDeckFromStudentContent(source: MethodologyLessonStudentContent | null): MethodologyLessonStep[] {
  if (!source) return [];
  const grouped = groupSteps(source.sections);
  return grouped.map((group, index) => ({
    id: `legacy-step-${index + 1}`,
    order: index + 1,
    title: group.sections[0]?.title ?? `Шаг ${index + 1}`,
    teacher: {
      teacherActions: [],
      studentActions: [],
      materials: [],
    },
    student: {
      screenType: "placeholder",
      title: group.sections[0]?.title ?? `Шаг ${index + 1}`,
      instruction: group.sections[0]?.subtitle ?? "Следуйте инструкции преподавателя.",
      payload: { sections: group.sections },
    },
  }));
}

export function LessonLearnerContentDeck({
  steps,
  source,
  unavailableReason,
  assetsById,
  compact = false,
  mode = "teacher_preview",
  controlledStepId,
  onStepChange,
}: Props) {
  // Canonical path: methodology workspace passes unified steps directly.
  // Legacy path is retained for runtime/older screens that still provide source sections.
  const hasUnifiedSteps = Boolean(steps?.length);
  const resolvedSteps = useMemo(
    () => (hasUnifiedSteps ? (steps ?? []) : buildLegacyStepDeckFromStudentContent(source)),
    [hasUnifiedSteps, source, steps],
  );
  const [localStepId, setLocalStepId] = useState<string | null>(resolvedSteps[0]?.id ?? null);
  const activeStepId = controlledStepId ?? localStepId ?? resolvedSteps[0]?.id ?? null;
  const currentStepIndex = Math.max(0, resolvedSteps.findIndex((step) => step.id === activeStepId));
  const currentStep = resolvedSteps[currentStepIndex];

  if (!currentStep) return <EmptyState reason={unavailableReason} />;
  const sections = currentStep.student.payload?.sections ?? [];
  const main = sections[0];

  const moveToStep = (nextIndex: number) => {
    const next = resolvedSteps[nextIndex];
    if (!next) return;
    if (!controlledStepId) setLocalStepId(next.id);
    onStepChange?.(next.id);
  };

  const canNavigate = mode !== "student_live_locked";
  const showLiveLockedBanner = mode === "student_live_locked";
  const showReviewBanner = mode === "student_review";

  return (
    <section className="space-y-4" aria-label="Экран ученика">
      {showLiveLockedBanner ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">Урок ведёт преподаватель</p>
          <p className="mt-1 text-sm text-amber-900/90">Слушай, повторяй и выполняй задания на этом экране.</p>
        </div>
      ) : null}
      {showReviewBanner ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-sm font-semibold text-sky-900">Повторение урока</p>
          <p className="mt-1 text-sm text-sky-900/90">Можно пройти шаги ещё раз перед домашним заданием.</p>
        </div>
      ) : null}
      <article className={classNames("rounded-3xl border p-5 md:p-6", toneClass(main?.tone), main?.layout === "hero" ? "shadow-[0_14px_30px_rgba(15,23,42,0.08)]" : "")}>
        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">
          <span>Шаг {currentStepIndex + 1} из {resolvedSteps.length}</span>
          {canNavigate ? (
            <div className="flex gap-2 normal-case tracking-normal">
              <button type="button" className="min-h-10 cursor-pointer rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={currentStepIndex === 0} onClick={() => moveToStep(currentStepIndex - 1)}>Назад</button>
              <button type="button" className="min-h-10 cursor-pointer rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={currentStepIndex >= resolvedSteps.length - 1} onClick={() => moveToStep(currentStepIndex + 1)}>Далее</button>
            </div>
          ) : null}
        </div>

        {canNavigate ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {resolvedSteps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => moveToStep(index)}
                className={classNames(
                  "h-2.5 w-2.5 cursor-pointer rounded-full transition",
                  index === currentStepIndex ? "bg-sky-600" : "bg-neutral-300 hover:bg-neutral-400",
                )}
                aria-label={`Перейти к шагу ${index + 1}`}
              />
            ))}
          </div>
        ) : null}

        <h3 className={classNames("font-semibold text-neutral-900", compact ? "text-2xl" : "text-3xl")}>{currentStep.student.title}</h3>
        {currentStep.student.instruction ? <p className="mt-2 text-base text-neutral-700">{currentStep.student.instruction}</p> : null}

        {main && (main.subtitle || main.illustrationSrc) ? <SceneHeader section={main} compact={compact} hideTitle /> : null}
        {sections.length ? sections.map((section, index) => (
          <div key={`${currentStep.id}-${section.type}-${section.title}-${index}`}>{renderSection(section, assetsById)}</div>
        )) : (
          <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-700">
            <p className="text-base font-semibold text-neutral-900">Слушай преподавателя</p>
            {currentStep.student.instruction ? <p className="mt-2">{currentStep.student.instruction}</p> : null}
            <p className="mt-2">Сейчас выполняем задание вместе.</p>
          </div>
        )}
        <StepResources step={currentStep} sections={sections} assetsById={assetsById} />
      </article>
    </section>
  );
}
