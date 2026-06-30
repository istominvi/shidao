"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import {
  BookOpen,
  CirclePlay,
  ListChecks,
  Music2,
  Sparkles,
} from "lucide-react";
import { Chip } from "@/components/ui/chip";
import {
  isWorldAroundMeLessonOneCanonicalStep,
  LessonOneStudentActivities,
} from "@/components/lessons/lesson-one-student-activities";
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
  unavailableReason:
    "schema_missing" | "invalid_payload" | "load_failed" | null;
  assetsById: Record<string, ReusableAsset>;
  compact?: boolean;
  fullscreen?: boolean;
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
      {reason === "schema_missing" ? (
        <p>Экран ученика временно недоступен. Данные урока пока не готовы.</p>
      ) : null}
      {reason === "invalid_payload" ? (
        <p>
          Экран ученика временно недоступен. Данные урока заполнены с ошибкой.
        </p>
      ) : null}
      {reason === "load_failed" ? (
        <p>Не удалось загрузить экран ученика.</p>
      ) : null}
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
    groups.push({
      key: sceneId || `${section.type}-${groups.length}`,
      sections: [section],
    });
  }
  return groups;
}

function resolveAssetPlaybackUrl(asset?: ReusableAsset) {
  return asset?.fileRef ?? asset?.sourceUrl ?? null;
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url);
}

function extractMetadataStringArray(
  asset: ReusableAsset | undefined,
  key: string,
) {
  const value = asset?.metadata?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
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

function SceneHeader({
  section,
  compact,
  hideTitle = false,
}: {
  section: MethodologyLessonStudentContentSection;
  compact: boolean;
  hideTitle?: boolean;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div>
        {!hideTitle ? (
          <h3
            className={classNames(
              "font-semibold text-neutral-900",
              compact ? "text-base" : "text-lg",
            )}
          >
            {section.title}
          </h3>
        ) : null}
        {section.subtitle ? (
          <p className="mt-1 text-sm text-neutral-600">{section.subtitle}</p>
        ) : null}
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

function collectAssetIdsFromSection(
  section: MethodologyLessonStudentContentSection,
): string[] {
  if (section.type === "media_asset") return [section.assetId];
  if (section.type === "presentation") return [section.assetId];
  if (section.type === "worksheet" && section.assetId) return [section.assetId];
  if (section.type === "count_board" && section.assetId)
    return [section.assetId];
  if (section.type === "resource_links") {
    return section.resources
      .map((resource) => resource.assetId)
      .filter((id): id is string => Boolean(id));
  }
  if (section.type === "vocabulary_cards") {
    return section.items
      .map((item) => item.audioAssetId)
      .filter((id): id is string => Boolean(id));
  }
  if (section.type === "phrase_cards") {
    return section.items
      .map((item) => item.audioAssetId)
      .filter((id): id is string => Boolean(id));
  }
  if (section.type === "action_cards") {
    return section.items
      .map((item) => item.audioAssetId)
      .filter((id): id is string => Boolean(id));
  }
  if (section.type === "word_list") {
    return section.groups.flatMap((group) =>
      group.entries
        .map((entry) => entry.audioAssetId)
        .filter((id): id is string => Boolean(id)),
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
  const alreadyRenderedAssetIds = new Set(
    sections.flatMap(collectAssetIdsFromSection),
  );
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
      const slideImageRefs = extractMetadataStringArray(
        asset,
        "slideImageRefs",
      );
      const previewSlide = slideImageRefs[0];

      if (
        (asset.kind === "video" ||
          asset.kind === "lesson_video" ||
          asset.kind === "media_file") &&
        url &&
        isVideoUrl(url)
      ) {
        return (
          <article
            key={asset.id}
            className="rounded-xl border border-sky-200 bg-sky-50/40 p-3"
          >
            <p className="text-sm font-semibold text-neutral-900">
              {asset.title}
            </p>
            <video
              controls
              preload="metadata"
              className="mt-2 w-full rounded-lg border border-sky-200 bg-black/80"
            >
              <source src={url} />
            </video>
          </article>
        );
      }

      if (
        (asset.kind === "song_audio" || asset.kind === "pronunciation_audio") &&
        url
      ) {
        return (
          <article
            key={asset.id}
            className="rounded-xl border border-rose-200 bg-rose-50/40 p-3"
          >
            <p className="text-sm font-semibold text-neutral-900">
              {asset.title}
            </p>
            <audio controls preload="none" className="mt-2 w-full">
              <source src={url} />
            </audio>
          </article>
        );
      }

      if (asset.kind === "presentation") {
        if (!url && !previewSlide) return null;
        return (
          <article
            key={asset.id}
            className="rounded-xl border border-sky-200 bg-sky-50/40 p-3"
          >
            <p className="text-sm font-semibold text-neutral-900">
              {asset.title}
            </p>
            {previewSlide ? (
              <Image
                src={previewSlide}
                alt={`${asset.title} · превью`}
                width={960}
                height={540}
                className="mt-2 h-auto w-full rounded-lg border border-sky-200 bg-white object-contain"
              />
            ) : null}
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex rounded-lg border border-sky-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-800"
              >
                Открыть презентацию
              </a>
            ) : null}
          </article>
        );
      }

      if (
        asset.kind === "flashcards_pdf" ||
        asset.kind === "worksheet_pdf" ||
        asset.kind === "worksheet"
      ) {
        if (!url) return null;
        return (
          <article
            key={asset.id}
            className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
          >
            <p className="text-sm font-semibold text-neutral-900">
              {asset.title}
            </p>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800"
            >
              {asset.kind === "flashcards_pdf" || asset.kind === "worksheet_pdf"
                ? "Открыть PDF"
                : "Открыть ресурс"}
            </a>
          </article>
        );
      }

      if (!url) return null;
      return (
        <article
          key={asset.id}
          className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
        >
          <p className="text-sm font-semibold text-neutral-900">
            {asset.title}
          </p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800"
          >
            Открыть ресурс
          </a>
        </article>
      );
    })
    .filter((assetCard) => assetCard !== null);

  if (!renderedAssets.length) return null;

  return (
    <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-3">
      <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">
        Посмотри и послушай
      </h4>
      <div className="mt-3 grid gap-3">{renderedAssets}</div>
    </section>
  );
}

function FlashcardCarousel({
  section,
  assetsById,
}: {
  section: Extract<
    MethodologyLessonStudentContentSection,
    { type: "vocabulary_cards" }
  >;
  assetsById: Record<string, ReusableAsset>;
}) {
  const [index, setIndex] = useState(0);
  const item = section.items[index];
  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
        Карточка {index + 1} / {section.items.length}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-black/10 bg-neutral-50 p-4">
          {item.illustrationSrc ? (
            <Image
              src={item.illustrationSrc}
              alt={item.meaning}
              width={320}
              height={240}
              className="h-56 w-auto object-contain"
            />
          ) : (
            <span className="text-sm text-neutral-500">Иллюстрация</span>
          )}
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
          <p className="text-6xl font-bold leading-none text-neutral-950">
            {item.term}
          </p>
          {item.pinyin ? (
            <p className="mt-2 text-lg text-neutral-700">{item.pinyin}</p>
          ) : null}
          <p className="mt-2 text-base font-semibold text-neutral-900">
            {item.meaning}
          </p>
          {item.visualHint ? (
            <p className="mt-1 text-sm text-neutral-700">{item.visualHint}</p>
          ) : null}
          {item.audioAssetId ? (
            <AudioPlayButton asset={assetsById[item.audioAssetId]} />
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium"
          onClick={() =>
            setIndex(
              (prev) =>
                (prev - 1 + section.items.length) % section.items.length,
            )
          }
        >
          Назад
        </button>
        <button
          type="button"
          className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium"
          onClick={() => setIndex((prev) => (prev + 1) % section.items.length)}
        >
          Далее
        </button>
      </div>
    </div>
  );
}

function ActionSlider({
  section,
  assetsById,
}: {
  section: Extract<
    MethodologyLessonStudentContentSection,
    { type: "action_cards" }
  >;
  assetsById: Record<string, ReusableAsset>;
}) {
  const [index, setIndex] = useState(0);
  const item = section.items[index];
  return (
    <div className="mt-3 rounded-2xl border border-emerald-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
        Шаг движения {index + 1} / {section.items.length}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-black/10 bg-neutral-50 p-4">
          {item.illustrationSrc ? (
            <Image
              src={item.illustrationSrc}
              alt={item.meaning}
              width={320}
              height={240}
              className="h-56 w-auto object-contain"
            />
          ) : (
            <span className="text-sm text-neutral-500">Покажи движение</span>
          )}
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <p className="text-5xl font-bold leading-none text-neutral-950">
            {item.term}
          </p>
          {item.pinyin ? (
            <p className="mt-2 text-lg text-neutral-700">{item.pinyin}</p>
          ) : null}
          <p className="mt-2 text-base font-semibold text-neutral-900">
            {item.meaning}
          </p>
          <p className="mt-1 text-sm text-neutral-700">{item.movementHint}</p>
          {item.commandExample ? (
            <p className="mt-1 text-sm font-semibold text-emerald-900">
              {item.commandExample}
            </p>
          ) : null}
          {item.audioAssetId ? (
            <AudioPlayButton asset={assetsById[item.audioAssetId]} />
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium"
          onClick={() =>
            setIndex(
              (prev) =>
                (prev - 1 + section.items.length) % section.items.length,
            )
          }
        >
          Назад
        </button>
        <button
          type="button"
          className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium"
          onClick={() => setIndex((prev) => (prev + 1) % section.items.length)}
        >
          Далее
        </button>
      </div>
    </div>
  );
}

function CountBoard({
  section,
  assetsById,
}: {
  section: Extract<
    MethodologyLessonStudentContentSection,
    { type: "count_board" }
  >;
  assetsById: Record<string, ReusableAsset>;
}) {
  const [selected, setSelected] = useState(section.groups[0]?.id);
  const active =
    section.groups.find((group) => group.id === selected) ?? section.groups[0];
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
          <button
            key={group.id}
            type="button"
            onClick={() => setSelected(group.id)}
            className={classNames(
              "rounded-full border px-3 py-1 text-sm",
              selected === group.id
                ? "border-sky-500 bg-sky-100 text-sky-900"
                : "border-neutral-300 bg-white text-neutral-700",
            )}
          >
            {group.label}
          </button>
        ))}
      </div>
      {active ? (
        <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {active.cue ?? `Считаем: ${active.count}`}
        </p>
      ) : null}
    </div>
  );
}

function FarmPlacementCard({
  section,
}: {
  section: Extract<
    MethodologyLessonStudentContentSection,
    { type: "farm_placement" }
  >;
}) {
  const [animalId, setAnimalId] = useState(section.animals[0]?.id);
  const selectedAnimal =
    section.animals.find((item) => item.id === animalId) ?? section.animals[0];
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-xl border border-amber-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-800">
          Выбери животное
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {section.animals.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAnimalId(item.id)}
              className={classNames(
                "rounded-full border px-3 py-1 text-sm",
                animalId === item.id
                  ? "border-amber-500 bg-amber-100 text-amber-900"
                  : "border-neutral-300 bg-white text-neutral-700",
              )}
            >
              {item.hanzi}
            </button>
          ))}
        </div>
        {selectedAnimal ? (
          <p className="mt-3 text-sm text-neutral-700">
            {section.targetPhraseTemplate
              .replace("{animal}", selectedAnimal.hanzi)
              .replace("{zone}", section.defaultZoneLabel)}
          </p>
        ) : null}
      </div>
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-amber-200 bg-white p-3">
        {section.illustrationSrc ? (
          <Image
            src={section.illustrationSrc}
            alt="Ферма"
            width={400}
            height={260}
            className="h-56 w-auto object-contain"
          />
        ) : (
          <span className="text-sm text-neutral-600">Игрушечная ферма</span>
        )}
      </div>
    </div>
  );
}

type LessonFourColorCard = {
  id: string;
  hanzi: string;
  pinyin?: string;
  meaning: string;
  swatch: string;
  border?: string;
};

type LessonFourSortItem = {
  id: string;
  label: string;
  colorId: string;
};

type LessonFivePlantItem = {
  id: string;
  term: string;
  pinyin?: string;
  meaning: string;
  illustrationSrc: string;
};

type LessonFiveMeadowElement = LessonFivePlantItem & {
  targetCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readColorCards(value: unknown): LessonFourColorCard[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): LessonFourColorCard[] => {
    if (!isRecord(item)) return [];
    const id = readString(item.id);
    const hanzi = readString(item.hanzi);
    const meaning = readString(item.meaning);
    const swatch = readString(item.swatch);
    if (!id || !hanzi || !meaning || !swatch) return [];
    return [
      {
        id,
        hanzi,
        meaning,
        swatch,
        pinyin: readString(item.pinyin) ?? undefined,
        border: readString(item.border) ?? undefined,
      },
    ];
  });
}

function readSortItems(value: unknown): LessonFourSortItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): LessonFourSortItem[] => {
    if (!isRecord(item)) return [];
    const id = readString(item.id);
    const label = readString(item.label);
    const colorId = readString(item.colorId);
    if (!id || !label || !colorId) return [];
    return [{ id, label, colorId }];
  });
}

function readPlantItems(value: unknown): LessonFivePlantItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): LessonFivePlantItem[] => {
    if (!isRecord(item)) return [];
    const id = readString(item.id);
    const term = readString(item.term);
    const meaning = readString(item.meaning);
    const illustrationSrc = readString(item.illustrationSrc);
    if (!id || !term || !meaning || !illustrationSrc) return [];
    return [
      {
        id,
        term,
        meaning,
        illustrationSrc,
        pinyin: readString(item.pinyin) ?? undefined,
      },
    ];
  });
}

function readMeadowElements(value: unknown): LessonFiveMeadowElement[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): LessonFiveMeadowElement[] => {
    if (!isRecord(item)) return [];
    const [plant] = readPlantItems([item]);
    const targetCount =
      typeof item.targetCount === "number" && Number.isFinite(item.targetCount)
        ? Math.max(0, Math.floor(item.targetCount))
        : 0;
    if (!plant || targetCount <= 0) return [];
    return [{ ...plant, targetCount }];
  });
}

const lessonFourFallbackColors: LessonFourColorCard[] = [
  {
    id: "orange",
    hanzi: "橘色",
    pinyin: "júsè",
    meaning: "оранжевый",
    swatch: "#f47c24",
  },
  {
    id: "black",
    hanzi: "黑色",
    pinyin: "hēisè",
    meaning: "чёрный",
    swatch: "#111111",
  },
  {
    id: "white",
    hanzi: "白色",
    pinyin: "báisè",
    meaning: "белый",
    swatch: "#ffffff",
    border: "#4f7fd9",
  },
  {
    id: "brown",
    hanzi: "棕色",
    pinyin: "zōngsè",
    meaning: "коричневый",
    swatch: "#8a6500",
  },
];

function getLessonFourColorData(currentStep: MethodologyLessonStep) {
  const data = currentStep.student.payload?.data;
  return isRecord(data) ? data : {};
}

const lessonFiveFallbackPlants: LessonFivePlantItem[] = [
  {
    id: "flower",
    term: "花",
    pinyin: "huā",
    meaning: "цветок",
    illustrationSrc:
      "/methodologies/world-around-me/lesson-5/assets/flower-purple.png",
  },
  {
    id: "tree",
    term: "树",
    pinyin: "shù",
    meaning: "дерево",
    illustrationSrc: "/methodologies/world-around-me/lesson-5/assets/tree.png",
  },
  {
    id: "grass",
    term: "草",
    pinyin: "cǎo",
    meaning: "трава",
    illustrationSrc: "/methodologies/world-around-me/lesson-5/assets/grass.png",
  },
  {
    id: "grassland",
    term: "草地",
    pinyin: "cǎodì",
    meaning: "луг / поле",
    illustrationSrc:
      "/methodologies/world-around-me/lesson-5/assets/meadow-bg.jpeg",
  },
];

const lessonFiveFallbackMeadowElements: LessonFiveMeadowElement[] =
  lessonFiveFallbackPlants
    .filter((item) => item.id !== "grassland")
    .map((item) => ({
      ...item,
      targetCount: item.id === "flower" ? 3 : item.id === "tree" ? 2 : 4,
    }));

function getLessonFiveData(currentStep: MethodologyLessonStep) {
  const data = currentStep.student.payload?.data;
  return isRecord(data) ? data : {};
}

function MissingColorGameRenderer({
  currentStep,
  sections,
  assetsById,
  fullscreen,
}: StudentStepRendererProps) {
  const data = getLessonFourColorData(currentStep);
  const colors = readColorCards(data.colors);
  const resolvedColors = colors.length ? colors : lessonFourFallbackColors;
  const [hiddenId, setHiddenId] = useState<string | null>(null);
  const hiddenColor =
    resolvedColors.find((color) => color.id === hiddenId) ?? null;

  return (
    <>
      <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {resolvedColors.map((color) => {
            const isHidden = color.id === hiddenId;
            return (
              <button
                key={color.id}
                type="button"
                onClick={() => setHiddenId(isHidden ? null : color.id)}
                className={classNames(
                  "min-h-36 rounded-2xl border-2 bg-white p-3 text-left transition",
                  isHidden
                    ? "border-dashed border-amber-400 bg-amber-50"
                    : "border-neutral-200 hover:border-amber-400",
                )}
              >
                <div
                  className="flex h-20 items-center justify-center rounded-[2rem] border text-2xl font-bold"
                  style={{
                    backgroundColor: isHidden ? "#f8fafc" : color.swatch,
                    borderColor: color.border ?? color.swatch,
                    color:
                      color.id === "black" && !isHidden ? "#ffffff" : "#111827",
                  }}
                >
                  {isHidden ? "?" : color.hanzi}
                </div>
                <p className="mt-3 text-sm font-semibold text-neutral-900">
                  {isHidden ? "Что пропало?" : color.hanzi}
                </p>
                {!isHidden ? (
                  <p className="text-xs text-neutral-600">
                    {color.pinyin ? `${color.pinyin} · ` : ""}
                    {color.meaning}
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const currentIndex = Math.max(
                0,
                resolvedColors.findIndex((color) => color.id === hiddenId),
              );
              const next =
                resolvedColors[(currentIndex + 1) % resolvedColors.length];
              setHiddenId(next?.id ?? null);
            }}
            className="rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Спрятать следующий цвет
          </button>
          <button
            type="button"
            onClick={() => setHiddenId(null)}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800"
          >
            Показать все
          </button>
          {hiddenColor ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
              Ответ: {hiddenColor.hanzi} · {hiddenColor.meaning}
            </p>
          ) : null}
        </div>
      </div>
      <SectionRenderer
        currentStep={currentStep}
        sections={sections}
        assetsById={assetsById}
        fullscreen={fullscreen}
      />
    </>
  );
}

function ColorSortingGameRenderer({
  currentStep,
  sections,
  assetsById,
  fullscreen,
}: StudentStepRendererProps) {
  const data = getLessonFourColorData(currentStep);
  const baskets = readColorCards(data.baskets);
  const resolvedBaskets = baskets.length ? baskets : lessonFourFallbackColors;
  const items = readSortItems(data.items);
  const resolvedItems = items.length
    ? items
    : [
        { id: "jacket", label: "кофта", colorId: "brown" },
        { id: "carrot", label: "морковь", colorId: "orange" },
        { id: "cat", label: "кот", colorId: "black" },
        { id: "plane", label: "самолёт", colorId: "white" },
      ];
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [message, setMessage] = useState(
    "Выбери предмет, затем корзину такого же цвета.",
  );
  const selectedItem =
    resolvedItems.find((item) => item.id === selectedItemId) ?? null;
  const placedCount = Object.keys(placements).length;

  const placeSelectedItem = (basketId: string) => {
    if (!selectedItem) {
      setMessage("Сначала выбери предмет.");
      return;
    }
    if (selectedItem.colorId !== basketId) {
      setMessage("Попробуй другую корзину: цвет предмета не совпадает.");
      return;
    }
    setPlacements((prev) => ({ ...prev, [selectedItem.id]: basketId }));
    setSelectedItemId(null);
    setMessage(
      `Верно: ${selectedItem.label} отправляется в корзину ${resolvedBaskets.find((basket) => basket.id === basketId)?.hanzi ?? ""}.`,
    );
  };

  return (
    <>
      <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-emerald-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-neutral-900">Предметы</p>
            <p className="text-xs font-semibold text-emerald-800">
              {placedCount} / {resolvedItems.length}
            </p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {resolvedItems.map((item) => {
              const isPlaced = Boolean(placements[item.id]);
              const color = resolvedBaskets.find(
                (basket) => basket.id === item.colorId,
              );
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isPlaced}
                  onClick={() => {
                    setSelectedItemId(item.id);
                    setMessage(
                      `Выбран предмет: ${item.label}. Теперь выбери корзину.`,
                    );
                  }}
                  className={classNames(
                    "min-h-20 rounded-xl border p-3 text-left text-sm transition",
                    selectedItemId === item.id
                      ? "border-emerald-500 bg-emerald-100"
                      : "border-neutral-200 bg-neutral-50 hover:border-emerald-300",
                    isPlaced ? "opacity-40" : "",
                  )}
                >
                  <span
                    className="mb-2 block h-4 w-12 rounded-full border"
                    style={{
                      backgroundColor: color?.swatch ?? "#e5e7eb",
                      borderColor: color?.border ?? color?.swatch ?? "#d1d5db",
                    }}
                  />
                  <span className="font-semibold text-neutral-900">
                    {item.label}
                  </span>
                  {isPlaced ? (
                    <span className="mt-1 block text-xs text-neutral-500">
                      уже в корзине
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-sm font-semibold text-neutral-900">Корзины</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {resolvedBaskets.map((basket) => {
              const basketItems = resolvedItems.filter(
                (item) => placements[item.id] === basket.id,
              );
              return (
                <button
                  key={basket.id}
                  type="button"
                  onClick={() => placeSelectedItem(basket.id)}
                  className="min-h-36 rounded-2xl border border-emerald-200 bg-white p-3 text-left transition hover:border-emerald-500"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-8 w-8 rounded-full border"
                      style={{
                        backgroundColor: basket.swatch,
                        borderColor: basket.border ?? basket.swatch,
                      }}
                    />
                    <span className="font-semibold text-neutral-950">
                      {basket.hanzi}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-600">
                    {basket.meaning}
                  </p>
                  <div className="mt-3 flex min-h-10 flex-wrap gap-1.5">
                    {basketItems.length ? (
                      basketItems.map((item) => (
                        <span
                          key={item.id}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900"
                        >
                          {item.label}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-neutral-500">
                        пока пусто
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-900">
              {message}
            </p>
            <button
              type="button"
              onClick={() => {
                setPlacements({});
                setSelectedItemId(null);
                setMessage("Выбери предмет, затем корзину такого же цвета.");
              }}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800"
            >
              Сбросить
            </button>
          </div>
        </section>
      </div>
      <SectionRenderer
        currentStep={currentStep}
        sections={sections}
        assetsById={assetsById}
        fullscreen={fullscreen}
      />
    </>
  );
}

function PlantWheelGameRenderer({
  currentStep,
  sections,
  assetsById,
  fullscreen,
}: StudentStepRendererProps) {
  const data = getLessonFiveData(currentStep);
  const items = readPlantItems(data.items);
  const resolvedItems = items.length ? items : lessonFiveFallbackPlants;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedItem = resolvedItems[selectedIndex] ?? resolvedItems[0];

  if (!selectedItem) {
    return (
      <SectionRenderer
        currentStep={currentStep}
        sections={sections}
        assetsById={assetsById}
        fullscreen={fullscreen}
      />
    );
  }

  return (
    <>
      <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-violet-200 bg-white p-4">
          <p className="text-sm font-semibold text-violet-900">
            Колесо слов
          </p>
          <div className="mt-3 flex min-h-64 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
            <div
              className="relative h-56 w-56 rounded-full border-[10px] border-white shadow-[0_12px_32px_rgba(88,28,135,0.18)]"
              style={{
                background:
                  "conic-gradient(#a78bfa 0 25%, #facc15 25% 50%, #34d399 50% 75%, #60a5fa 75% 100%)",
                transform: `rotate(${selectedIndex * 55}deg)`,
                transition: "transform 420ms ease",
              }}
            >
              <div className="absolute inset-8 rounded-full border border-white/70 bg-white/80" />
              <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-violet-200 bg-white text-3xl font-black text-violet-900">
                {selectedItem.term}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setSelectedIndex((previous) => (previous + 1) % resolvedItems.length)
            }
            className="mt-3 w-full rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Stop / следующее слово
          </button>
        </section>

        <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
          <p className="text-sm font-semibold text-neutral-900">
            Выпало слово
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
            <div className="flex min-h-44 items-center justify-center rounded-2xl border border-violet-100 bg-white p-3">
              <Image
                src={selectedItem.illustrationSrc}
                alt={selectedItem.meaning}
                width={280}
                height={220}
                className="max-h-48 w-auto object-contain"
              />
            </div>
            <div className="rounded-2xl border border-violet-100 bg-white p-4">
              <p className="text-6xl font-black leading-none text-neutral-950">
                {selectedItem.term}
              </p>
              {selectedItem.pinyin ? (
                <p className="mt-2 text-lg text-neutral-700">
                  {selectedItem.pinyin}
                </p>
              ) : null}
              <p className="mt-2 text-base font-semibold text-neutral-900">
                {selectedItem.meaning}
              </p>
              <p className="mt-3 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-sm text-violet-900">
                Назови слово вслух и покажи картинку.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {resolvedItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={classNames(
                  "rounded-full border px-3 py-1 text-sm font-semibold",
                  selectedIndex === index
                    ? "border-violet-500 bg-violet-100 text-violet-900"
                    : "border-neutral-300 bg-white text-neutral-700",
                )}
              >
                {item.term}
              </button>
            ))}
          </div>
        </section>
      </div>
      <SectionRenderer
        currentStep={currentStep}
        sections={sections}
        assetsById={assetsById}
        fullscreen={fullscreen}
      />
    </>
  );
}

function MeadowBuilderRenderer({
  currentStep,
  sections,
  assetsById,
  fullscreen,
}: StudentStepRendererProps) {
  const data = getLessonFiveData(currentStep);
  const elements = readMeadowElements(data.elements);
  const resolvedElements = elements.length
    ? elements
    : lessonFiveFallbackMeadowElements;
  const [counts, setCounts] = useState<Record<string, number>>(
    Object.fromEntries(resolvedElements.map((item) => [item.id, 0])),
  );
  const totalCount = Object.values(counts).reduce(
    (sum, value) => sum + value,
    0,
  );

  const updateCount = (id: string, nextCount: number) => {
    const max =
      resolvedElements.find((item) => item.id === id)?.targetCount ?? 0;
    setCounts((previous) => ({
      ...previous,
      [id]: Math.min(max, Math.max(0, nextCount)),
    }));
  };

  return (
    <>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-emerald-200 bg-white p-4">
          <div
            className="relative min-h-72 overflow-hidden rounded-2xl border border-emerald-200 bg-cover bg-center p-4"
            style={{
              backgroundImage:
                "url('/methodologies/world-around-me/lesson-5/assets/meadow-bg.jpeg')",
            }}
          >
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-lime-500/50 to-transparent" />
            <div className="relative flex min-h-60 flex-wrap content-end items-end justify-center gap-3 pt-16">
              {resolvedElements.flatMap((item) =>
                Array.from({ length: counts[item.id] ?? 0 }, (_, index) => (
                  <div
                    key={`${item.id}-${index}`}
                    className="flex h-20 w-20 items-end justify-center rounded-2xl bg-white/70 p-1 shadow-sm"
                  >
                    <Image
                      src={item.illustrationSrc}
                      alt={item.meaning}
                      width={80}
                      height={80}
                      className="max-h-16 w-auto object-contain"
                    />
                  </div>
                )),
              )}
              {!totalCount ? (
                <p className="mb-8 rounded-2xl border border-emerald-200 bg-white/90 px-4 py-3 text-sm font-semibold text-emerald-900">
                  Добавь элементы на луг.
                </p>
              ) : null}
            </div>
          </div>
          <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            草地上有 {totalCount} 个东西. Назови каждый элемент: 花、树、草.
          </p>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <p className="text-sm font-semibold text-neutral-900">
            Собери свой 草地
          </p>
          <div className="mt-3 grid gap-3">
            {resolvedElements.map((item) => {
              const count = counts[item.id] ?? 0;
              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-emerald-100 bg-white p-3"
                >
                  <div className="flex items-center gap-3">
                    <Image
                      src={item.illustrationSrc}
                      alt={item.meaning}
                      width={72}
                      height={72}
                      className="h-14 w-14 rounded-xl border border-neutral-100 object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-2xl font-black text-neutral-950">
                        {item.term}
                      </p>
                      <p className="text-xs text-neutral-600">
                        {item.meaning} · {count} / {item.targetCount}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateCount(item.id, count - 1)}
                      className="min-h-10 flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800"
                    >
                      Убрать
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCount(item.id, count + 1)}
                      className="min-h-10 flex-1 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
                    >
                      Добавить
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() =>
              setCounts(Object.fromEntries(resolvedElements.map((item) => [item.id, 0])))
            }
            className="mt-3 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800"
          >
            Очистить луг
          </button>
        </section>
      </div>
      <SectionRenderer
        currentStep={currentStep}
        sections={sections}
        assetsById={assetsById}
        fullscreen={fullscreen}
      />
    </>
  );
}

function PresentationCard({
  section,
  asset,
}: {
  section: Extract<
    MethodologyLessonStudentContentSection,
    { type: "presentation" }
  >;
  asset?: ReusableAsset;
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const url = resolveAssetPlaybackUrl(asset);
  const slideImageRefs = extractMetadataStringArray(asset, "slideImageRefs");
  const activeSlide = slideImageRefs[slideIndex] ?? null;

  return (
    <article className="mt-3 rounded-xl border border-sky-200 bg-white p-3 text-sm text-neutral-700">
      <p className="font-semibold text-neutral-900">
        {asset?.title ?? "Презентация урока"}
      </p>
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
            <p className="text-xs font-semibold text-sky-900">
              Слайд {slideIndex + 1} / {slideImageRefs.length}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg border border-sky-300 bg-white px-2 py-1 text-xs font-semibold text-sky-800"
                onClick={() =>
                  setSlideIndex(
                    (prev) =>
                      (prev - 1 + slideImageRefs.length) %
                      slideImageRefs.length,
                  )
                }
              >
                Назад
              </button>
              <button
                type="button"
                className="rounded-lg border border-sky-300 bg-white px-2 py-1 text-xs font-semibold text-sky-800"
                onClick={() =>
                  setSlideIndex((prev) => (prev + 1) % slideImageRefs.length)
                }
              >
                Далее
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800"
        >
          {section.studentCtaLabel ?? "Открыть презентацию"}
        </a>
      ) : (
        <p className="mt-2 text-xs">Презентацию открывает преподаватель.</p>
      )}
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
          const asset = resource.assetId
            ? assetsById[resource.assetId]
            : undefined;
          const url =
            resolveAssetPlaybackUrl(asset) ?? resource.sourceUrl ?? null;
          return (
            <article
              key={resource.id}
              className="rounded-xl border border-neutral-200 bg-white p-3 text-sm"
            >
              <p className="font-semibold text-neutral-900">{resource.title}</p>
              {resource.subtitle ? (
                <p className="mt-1 text-neutral-700">{resource.subtitle}</p>
              ) : null}
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex rounded-lg border border-neutral-300 bg-neutral-50 px-2.5 py-1.5 text-xs font-semibold text-neutral-800"
                >
                  Открыть ресурс
                </a>
              ) : (
                <p className="mt-2 text-xs text-neutral-600">
                  Ресурс покажет преподаватель на уроке.
                </p>
              )}
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
          <article
            key={group.id}
            className="rounded-xl border border-neutral-200 bg-white p-3"
          >
            <p className="text-sm font-semibold text-neutral-900">
              {group.title}
            </p>
            <div className="mt-2 grid gap-2">
              {group.entries.map((entry) => (
                <div
                  key={`${group.id}-${entry.hanzi}`}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 p-2"
                >
                  <p className="text-2xl font-bold text-neutral-950">
                    {entry.hanzi}
                  </p>
                  <p className="text-xs text-neutral-700">
                    {entry.pinyin ?? ""} · {entry.meaning}
                  </p>
                  {entry.audioAssetId ? (
                    <AudioPlayButton asset={assetsById[entry.audioAssetId]} />
                  ) : null}
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
            <div
              key={pair.id}
              className="rounded-lg border border-violet-200 bg-violet-50/60 p-2 text-sm"
            >
              {pair.illustrationSrc ? (
                <Image
                  src={pair.illustrationSrc}
                  alt={pair.label}
                  width={120}
                  height={88}
                  className="mb-2 h-20 w-full rounded-md object-contain"
                />
              ) : null}
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
            <p className="text-sm text-neutral-700">
              Сначала: поздороваемся, посмотрим видео и выучим первые слова.
            </p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-sky-800">
              Главные слова урока
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {section.chips.slice(0, 6).map((chip) => (
                <Chip key={chip} tone="sky" size="sm">
                  {chip}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (section.layout === "roadmap") {
      return (
        <div className="mt-3 rounded-xl border border-violet-200 bg-white p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-900">
            <ListChecks className="h-4 w-4" />
            Что сегодня делаем
          </p>
          <p className="mt-2 text-sm text-neutral-700">{section.body}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {section.chips.map((chip) => (
              <Chip key={chip} tone="violet" size="sm">
                {chip}
              </Chip>
            ))}
          </div>
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
          <article
            key={item.term}
            className="rounded-xl border border-neutral-200 bg-white p-3"
          >
            <p className="text-3xl font-bold leading-none text-neutral-950">
              {item.term}
            </p>
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
          <article
            key={item.phrase}
            className="rounded-xl border border-violet-200 bg-white p-3"
          >
            {item.speaker ? (
              <p className="text-xs uppercase tracking-[0.1em] text-violet-700">
                {item.speaker}
              </p>
            ) : null}
            <p className="text-3xl font-bold leading-none text-neutral-950">
              {item.phrase}
            </p>
            {item.pinyin ? (
              <p className="mt-1 text-xs text-neutral-600">{item.pinyin}</p>
            ) : null}
            <p className="mt-1 text-sm text-neutral-800">{item.meaning}</p>
            {item.example ? (
              <p className="mt-1 text-xs font-semibold text-violet-900">
                Пример: {item.example}
              </p>
            ) : null}
            {item.audioAssetId ? (
              <AudioPlayButton asset={assetsById[item.audioAssetId]} />
            ) : null}
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
          <article
            key={item.term}
            className="rounded-xl border border-emerald-200 bg-white p-3"
          >
            <p className="text-4xl font-bold leading-none text-neutral-950">
              {item.term}
            </p>
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
        <p className="flex items-center gap-1.5 font-semibold text-neutral-900">
          <BookOpen className="h-4 w-4" />
          {section.pageLabel ?? "Задание"}
        </p>
        <p className="mt-1">{section.instructions}</p>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800"
          >
            Открыть внешний ресурс
          </a>
        ) : (
          <p className="mt-2 text-xs text-neutral-600">
            PDF будет добавлен позже.
          </p>
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
      <article
        className={classNames(
          "mt-3 rounded-2xl border bg-white p-4 text-sm text-neutral-700",
          isSong ? "border-rose-200" : "border-sky-200",
        )}
      >
        <p
          className={classNames(
            "flex items-center gap-1.5 text-base font-semibold",
            isSong ? "text-rose-900" : "text-sky-900",
          )}
        >
          {isSong ? (
            <Music2 className="h-5 w-5" />
          ) : (
            <CirclePlay className="h-5 w-5" />
          )}
          {asset?.title ?? section.title}
        </p>
        <p className="mt-1">{section.studentPrompt}</p>
        {renderAsVideo && url ? (
          <video
            controls
            preload="metadata"
            className="mt-3 w-full rounded-xl border border-sky-200 bg-black/90"
          >
            <source src={url} />
          </video>
        ) : null}
        {isSong && url ? (
          <audio controls preload="none" className="mt-3 w-full">
            <source src={url} />
          </audio>
        ) : null}
        {!renderAsVideo && !isSong && url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800"
          >
            {section.ctaLabel ?? "Открыть видео"}
          </a>
        ) : null}
        {!url ? (
          <p className="mt-2 inline-flex rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-medium text-neutral-600">
            Материал откроет преподаватель на уроке.
          </p>
        ) : null}
      </article>
    );
  }

  return (
    <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
      {section.bullets.map((bullet) => (
        <li key={bullet} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neutral-400" />
          {bullet}
        </li>
      ))}
    </ul>
  );
}

function buildLegacyStepDeckFromStudentContent(
  source: MethodologyLessonStudentContent | null,
): MethodologyLessonStep[] {
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
      componentKey: group.sections.length
        ? "section_renderer_v1"
        : "placeholder_v1",
      title: group.sections[0]?.title ?? `Шаг ${index + 1}`,
      instruction:
        group.sections[0]?.subtitle ?? "Следуйте инструкции преподавателя.",
      payload: { sections: group.sections },
    },
  }));
}

type StudentStepRendererProps = {
  currentStep: MethodologyLessonStep;
  sections: MethodologyLessonStudentContentSection[];
  assetsById: Record<string, ReusableAsset>;
  fullscreen: boolean;
};

type StudentStepRenderer = (props: StudentStepRendererProps) => ReactNode;

function PlaceholderStepRenderer({ currentStep }: StudentStepRendererProps) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-700">
      <p className="text-base font-semibold text-neutral-900">
        Слушай преподавателя
      </p>
      {currentStep.student.instruction ? (
        <p className="mt-2">{currentStep.student.instruction}</p>
      ) : null}
      <p className="mt-2">Сейчас выполняем задание вместе.</p>
    </div>
  );
}

function SectionRenderer({
  currentStep,
  sections,
  assetsById,
}: StudentStepRendererProps) {
  if (!sections.length) {
    return (
      <PlaceholderStepRenderer
        currentStep={currentStep}
        sections={sections}
        assetsById={assetsById}
        fullscreen={false}
      />
    );
  }

  return (
    <>
      {sections.map((section, index) => (
        <div
          key={`${currentStep.id}-${section.type}-${section.title}-${index}`}
        >
          {renderSection(section, assetsById)}
        </div>
      ))}
      <StepResources
        step={currentStep}
        sections={sections}
        assetsById={assetsById}
      />
    </>
  );
}

function LessonOneCustomRenderer({
  currentStep,
  sections,
  assetsById,
  fullscreen,
}: StudentStepRendererProps) {
  return (
    <LessonOneStudentActivities
      step={currentStep}
      assetsById={assetsById}
      sections={sections}
      fullscreen={fullscreen}
    />
  );
}

const studentComponentRegistry: Record<string, StudentStepRenderer> = {
  lesson_one_custom_v1: LessonOneCustomRenderer,
  missing_color_game_v1: MissingColorGameRenderer,
  color_sorting_game_v1: ColorSortingGameRenderer,
  plant_wheel_game_v1: PlantWheelGameRenderer,
  meadow_builder_v1: MeadowBuilderRenderer,
  section_renderer_v1: SectionRenderer,
  placeholder_v1: PlaceholderStepRenderer,
  lesson_focus_v1: SectionRenderer,
  presentation_deck_v1: SectionRenderer,
  media_asset_v1: SectionRenderer,
  flashcards_v1: SectionRenderer,
  phrase_cards_v1: SectionRenderer,
  count_board_v1: SectionRenderer,
  movement_cards_v1: SectionRenderer,
  matching_practice_v1: SectionRenderer,
  worksheet_v1: SectionRenderer,
  farm_placement_v1: SectionRenderer,
  song_player_v1: SectionRenderer,
};

function resolveStudentComponentKey(step: MethodologyLessonStep) {
  if (step.student.componentKey) return step.student.componentKey;
  if (isWorldAroundMeLessonOneCanonicalStep(step.id))
    return "lesson_one_custom_v1";
  if (step.student.payload?.sections?.length) return "section_renderer_v1";
  return "placeholder_v1";
}

export function LessonLearnerContentDeck({
  steps,
  source,
  unavailableReason,
  assetsById,
  compact = false,
  fullscreen = false,
  mode = "teacher_preview",
  controlledStepId,
  onStepChange,
}: Props) {
  // Canonical path: methodology workspace passes unified steps directly.
  // Legacy path is retained for runtime/older screens that still provide source sections.
  const hasUnifiedSteps = Boolean(steps?.length);
  const resolvedSteps = useMemo(
    () =>
      hasUnifiedSteps
        ? (steps ?? [])
        : buildLegacyStepDeckFromStudentContent(source),
    [hasUnifiedSteps, source, steps],
  );
  const [localStepId, setLocalStepId] = useState<string | null>(
    resolvedSteps[0]?.id ?? null,
  );
  const activeStepId =
    controlledStepId ?? localStepId ?? resolvedSteps[0]?.id ?? null;
  const currentStepIndex = Math.max(
    0,
    resolvedSteps.findIndex((step) => step.id === activeStepId),
  );
  const currentStep = resolvedSteps[currentStepIndex];

  if (!currentStep) return <EmptyState reason={unavailableReason} />;
  const sections = currentStep.student.payload?.sections ?? [];
  const main = sections[0];
  const componentKey = resolveStudentComponentKey(currentStep);
  const StepRenderer =
    studentComponentRegistry[componentKey] ??
    studentComponentRegistry.section_renderer_v1;

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
    <section
      className={classNames(
        "space-y-4",
        fullscreen ? "flex h-full min-h-0 flex-col" : "",
      )}
      aria-label="Экран ученика"
    >
      {showLiveLockedBanner ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">
            Урок ведёт преподаватель
          </p>
          <p className="mt-1 text-sm text-amber-900/90">
            Слушай, повторяй и выполняй задания на этом экране.
          </p>
        </div>
      ) : null}
      {showReviewBanner ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-sm font-semibold text-sky-900">Повторение урока</p>
          <p className="mt-1 text-sm text-sky-900/90">
            Можно пройти шаги ещё раз перед домашним заданием.
          </p>
        </div>
      ) : null}
      <article
        className={classNames(
          "rounded-3xl border p-5 md:p-6",
          toneClass(main?.tone),
          main?.layout === "hero"
            ? "shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
            : "",
          fullscreen
            ? "flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-5"
            : "",
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">
          <span>
            Шаг {currentStepIndex + 1} из {resolvedSteps.length}
          </span>
          {canNavigate ? (
            <div className="flex gap-2 normal-case tracking-normal">
              <button
                type="button"
                className="min-h-10 cursor-pointer rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={currentStepIndex === 0}
                onClick={() => moveToStep(currentStepIndex - 1)}
              >
                Назад
              </button>
              <button
                type="button"
                className="min-h-10 cursor-pointer rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={currentStepIndex >= resolvedSteps.length - 1}
                onClick={() => moveToStep(currentStepIndex + 1)}
              >
                Далее
              </button>
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
                  index === currentStepIndex
                    ? "bg-sky-600"
                    : "bg-neutral-300 hover:bg-neutral-400",
                )}
                aria-label={`Перейти к шагу ${index + 1}`}
              />
            ))}
          </div>
        ) : null}

        <h3
          className={classNames(
            "font-semibold text-neutral-900",
            compact ? "text-2xl" : "text-3xl",
          )}
        >
          {currentStep.student.title}
        </h3>
        {currentStep.student.instruction ? (
          <p className="mt-2 text-base text-neutral-700">
            {currentStep.student.instruction}
          </p>
        ) : null}

        <div className={classNames(fullscreen ? "min-h-0 flex-1" : "")}>
          {main && (main.subtitle || main.illustrationSrc) ? (
            <SceneHeader section={main} compact={compact} hideTitle />
          ) : null}
          <StepRenderer
            currentStep={currentStep}
            sections={sections}
            assetsById={assetsById}
            fullscreen={fullscreen}
          />
        </div>
      </article>
    </section>
  );
}
