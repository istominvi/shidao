"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { LessonCanonicalHomeworkPanel } from "@/components/lessons/lesson-canonical-homework-panel";
import { LessonStudentContentPanel } from "@/components/lessons/lesson-student-content-panel";
import {
  TeacherLessonTabs,
  type TeacherLessonTabKey,
} from "@/components/lessons/teacher-lesson-tabs";
import { TeacherLessonPedagogicalContent } from "@/components/lessons/teacher-lesson-pedagogical-content";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { MethodologyLessonStudentContentSection } from "@/lib/lesson-content";
import type { ReusableAsset } from "@/lib/lesson-content/contracts";
import type { TeacherLessonWorkspaceReadModel } from "@/lib/server/teacher-lesson-workspace";

type MethodologyLessonReadModel = {
  presentation: Pick<
    TeacherLessonWorkspaceReadModel["presentation"],
    "quickSummary" | "lessonFlow" | "methodologyReference"
  >;
  canonicalHomework: {
    title: string;
    kind: "practice_text" | "quiz_single_choice";
    kindLabel: string;
    instructions: string;
    estimatedMinutes: number | null;
    materialLinks: string[];
    answerFormatHint: string | null;
    sourceLayerNote: string;
    quizDefinition: Record<string, unknown> | null;
  } | null;
  studentContent: TeacherLessonWorkspaceReadModel["studentContent"];
};

type WordEntry = {
  id: string;
  hanzi: string;
  pinyin?: string;
  meaning: string;
  audioUrl?: string;
};

type WordGroup = {
  id: string;
  title: string;
  entries: WordEntry[];
};

type PrepItem = {
  id: string;
  title: string;
  href?: string | null;
  actionLabel?: string;
  note?: string;
};

const mainTabs: TeacherLessonTabKey[] = ["plan", "content", "homework"];

function pickSections(
  source: MethodologyLessonReadModel["studentContent"]["source"],
  type: MethodologyLessonStudentContentSection["type"],
) {
  return source?.sections.filter((section) => section.type === type) ?? [];
}

function resolveAssetUrl(asset?: ReusableAsset) {
  return asset?.fileRef ?? asset?.sourceUrl ?? null;
}

function ResourceViewerCard({
  title,
  helper,
  imageRefs,
  itemLabel,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  fullscreenLabel,
}: {
  title: string;
  helper: string;
  imageRefs: string[];
  itemLabel: string;
  primaryHref?: string | null;
  primaryLabel?: string;
  secondaryHref?: string | null;
  secondaryLabel?: string;
  fullscreenLabel?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const activeImage = imageRefs[activeIndex] ?? null;
  const canNavigate = imageRefs.length > 1;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
          <p className="mt-1 text-sm text-neutral-600">{helper}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {fullscreenLabel && activeImage ? (
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-800"
            >
              {fullscreenLabel}
            </button>
          ) : null}
          {primaryHref && primaryLabel ? (
            <a
              href={primaryHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800"
            >
              {primaryLabel}
            </a>
          ) : null}
          {secondaryHref && secondaryLabel ? (
            <a
              href={secondaryHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-800"
            >
              {secondaryLabel}
            </a>
          ) : null}
        </div>
      </div>

      {activeImage ? (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <div className="relative flex min-h-[280px] items-center justify-center rounded-lg bg-white p-2">
            <Image
              src={activeImage}
              alt={`${itemLabel} ${activeIndex + 1}`}
              width={1280}
              height={720}
              className="h-[320px] w-full object-contain"
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs font-medium text-neutral-700">
              {itemLabel} {activeIndex + 1} из {imageRefs.length}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!canNavigate}
                onClick={() => setActiveIndex((prev) => (prev - 1 + imageRefs.length) % imageRefs.length)}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ←
              </button>
              <button
                type="button"
                disabled={!canNavigate}
                onClick={() => setActiveIndex((prev) => (prev + 1) % imageRefs.length)}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                →
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-600">Предпросмотр появится после загрузки материалов.</p>
      )}

      {isFullscreen && activeImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4">
          <div className="w-full max-w-6xl rounded-2xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-900">{title}</p>
              <button
                type="button"
                className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-700"
                onClick={() => setIsFullscreen(false)}
              >
                Закрыть
              </button>
            </div>
            <div className="relative flex h-[70vh] items-center justify-center rounded-xl bg-neutral-100 p-4">
              <Image
                src={activeImage}
                alt={`${itemLabel} ${activeIndex + 1}`}
                width={1920}
                height={1080}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-neutral-600">
                {itemLabel} {activeIndex + 1} из {imageRefs.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!canNavigate}
                  onClick={() => setActiveIndex((prev) => (prev - 1 + imageRefs.length) % imageRefs.length)}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 disabled:opacity-40"
                >
                  ←
                </button>
                <button
                  type="button"
                  disabled={!canNavigate}
                  onClick={() => setActiveIndex((prev) => (prev + 1) % imageRefs.length)}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 disabled:opacity-40"
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function WordAudioButton({ src, label }: { src: string; label: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <button
      type="button"
      className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700"
      onClick={() => {
        const audio = new Audio(src);
        setPlaying(true);
        audio.play().catch(() => setPlaying(false));
        audio.onended = () => setPlaying(false);
      }}
    >
      {playing ? `▶ ${label}...` : label}
    </button>
  );
}

function WordsAndPhrasesPanel({ groups }: { groups: WordGroup[] }) {
  const [density, setDensity] = useState<"large" | "default" | "compact">("default");

  const densityClassName =
    density === "large"
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      : density === "compact"
        ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";

  const hanziClass = density === "compact" ? "text-2xl" : density === "large" ? "text-4xl" : "text-3xl";

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">Новые слова и фразы</h3>
          <p className="mt-1 text-sm text-neutral-600">Компактный словарь для показа на занятии.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-md border px-2 py-1 text-xs font-semibold ${
              density === "large" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-700"
            }`}
            onClick={() => setDensity("large")}
          >
            Крупно
          </button>
          <button
            type="button"
            className={`rounded-md border px-2 py-1 text-xs font-semibold ${
              density === "default" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-700"
            }`}
            onClick={() => setDensity("default")}
          >
            4 в ряд
          </button>
          <button
            type="button"
            className={`rounded-md border px-2 py-1 text-xs font-semibold ${
              density === "compact" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-700"
            }`}
            onClick={() => setDensity("compact")}
          >
            Компактно
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {groups.map((group) => (
          <div key={group.id}>
            <h4 className="mb-2 text-sm font-semibold text-neutral-800">{group.title}</h4>
            <div className={`grid gap-2 ${densityClassName}`}>
              {group.entries.map((entry) => (
                <article key={entry.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <p className={`font-semibold text-neutral-900 ${hanziClass}`}>{entry.hanzi}</p>
                  {entry.pinyin ? <p className="text-xs text-neutral-500">{entry.pinyin}</p> : null}
                  <p className="mt-1 text-sm text-neutral-700">{entry.meaning}</p>
                  {entry.audioUrl ? (
                    <div className="mt-2">
                      <WordAudioButton src={entry.audioUrl} label="Слушать" />
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MaterialsPanel({ digitalItems }: { digitalItems: PrepItem[] }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4">
      <h3 className="text-base font-semibold text-neutral-900">Материалы урока</h3>
      <p className="mt-1 text-sm text-neutral-600">Видео, приложение, песня и тетрадь.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {digitalItems.map((item) => (
          <article key={item.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
            {item.note ? <p className="mt-1 text-xs text-neutral-600">{item.note}</p> : null}
            {item.href ? (
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700"
              >
                {item.actionLabel ?? "Открыть ресурс"}
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function TeacherLessonContentHub({ readModel }: { readModel: MethodologyLessonReadModel }) {
  const resources = useMemo(() => {
    const source = readModel.studentContent.source;
    const assetsById = readModel.studentContent.assetsById;
    const presentationAsset = assetsById["presentation:world-around-me-lesson-1"];
    const flashcardsAsset = assetsById["flashcards:world-around-me-lesson-1"];
    const appendixAsset = assetsById["worksheet:appendix-1"];
    const workbookAsset = assetsById["worksheet:workbook-pages-3-4"];
    const videoAsset = assetsById["video:farm-animals"];
    const songAsset = assetsById["song:farm-animals"];

    const wordListSection = pickSections(source, "word_list")[0] as
      | Extract<MethodologyLessonStudentContentSection, { type: "word_list" }>
      | undefined;

    const groups: WordGroup[] = [];
    if (wordListSection) {
      const lessonGroups = wordListSection.groups ?? [];
      const animals = lessonGroups.find((group) => group.id.includes("animals"));
      const phrase = lessonGroups.find((group) => group.id.includes("phrases"));
      const actions = lessonGroups.find((group) => group.id.includes("actions"));
      groups.push({
        id: "animals-farm",
        title: "Животные и ферма",
        entries: (animals?.entries ?? []).map((entry) => ({
          id: `animals-${entry.hanzi}`,
          hanzi: entry.hanzi,
          pinyin: entry.pinyin,
          meaning: entry.meaning,
          audioUrl: entry.audioAssetId ? resolveAssetUrl(assetsById[entry.audioAssetId]) ?? undefined : undefined,
        })),
      });
      groups.push({
        id: "phrase-actions",
        title: "Фразы и действия",
        entries: [...(phrase?.entries ?? []), ...(actions?.entries ?? [])].map((entry) => ({
          id: `phrase-${entry.hanzi}-${entry.meaning}`,
          hanzi: entry.hanzi,
          pinyin: entry.pinyin,
          meaning: entry.meaning,
          audioUrl: entry.audioAssetId ? resolveAssetUrl(assetsById[entry.audioAssetId]) ?? undefined : undefined,
        })),
      });
    }

    const digitalItems: PrepItem[] = [
      {
        id: "video-farm",
        title: "Видео: farm animals",
        href: resolveAssetUrl(videoAsset),
        actionLabel: "Открыть видео",
      },
      {
        id: "flashcards-pdf",
        title: "Карточки урока 1",
        href: resolveAssetUrl(flashcardsAsset),
        actionLabel: "Скачать карточки PDF",
      },
      {
        id: "appendix-1",
        title: "Приложение 1",
        href: resolveAssetUrl(appendixAsset),
        actionLabel: "Открыть PDF",
      },
      {
        id: "workbook-3-4",
        title: "Рабочая тетрадь, стр. 3–4",
        href: resolveAssetUrl(workbookAsset),
        actionLabel: workbookAsset?.fileRef ? "Открыть PDF" : "Открыть ресурс",
        note: workbookAsset?.fileRef ? undefined : "PDF будет добавлен позже / внешний ресурс",
      },
      {
        id: "song-farm",
        title: "Песня: farm animals",
        href: resolveAssetUrl(songAsset),
        actionLabel: "Слушать",
      },
    ];

    return {
      presentation: {
        pdfUrl: presentationAsset?.fileRef ?? presentationAsset?.sourceUrl,
        pptxUrl:
          typeof presentationAsset?.metadata?.pptxFileRef === "string"
            ? presentationAsset.metadata.pptxFileRef
            : null,
        imageRefs: Array.isArray(presentationAsset?.metadata?.slideImageRefs)
          ? (presentationAsset.metadata.slideImageRefs as string[])
          : [],
      },
      flashcards: {
        pdfUrl: flashcardsAsset?.fileRef ?? flashcardsAsset?.sourceUrl,
        imageRefs: Array.isArray(flashcardsAsset?.metadata?.cardImageRefs)
          ? (flashcardsAsset.metadata.cardImageRefs as string[])
          : [],
      },
      words: groups,
      materials: digitalItems,
    };
  }, [readModel.studentContent.assetsById, readModel.studentContent.source]);

  return (
    <section className="space-y-4" aria-label="Контент урока">
      <ResourceViewerCard
        title="Презентация к уроку"
        helper="Показывайте слайды во время занятия или скачайте файл для подготовки."
        imageRefs={resources.presentation.imageRefs}
        itemLabel="Слайд"
        fullscreenLabel="Открыть на весь экран"
        primaryHref={resources.presentation.pdfUrl}
        primaryLabel="Скачать PDF"
        secondaryHref={resources.presentation.pptxUrl}
        secondaryLabel="Скачать PPTX"
      />

      <ResourceViewerCard
        title="Карточки урока"
        helper="Используйте карточки для показа, повторения и игр."
        imageRefs={resources.flashcards.imageRefs}
        itemLabel="Карточка"
        primaryHref={resources.flashcards.pdfUrl}
        primaryLabel="Скачать PDF"
      />

      <WordsAndPhrasesPanel groups={resources.words} />

      <MaterialsPanel digitalItems={resources.materials} />

      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h3 className="text-base font-semibold text-neutral-900">Предпросмотр для ученика</h3>
        <p className="mt-1 text-sm text-neutral-600">Откройте ученический экран перед занятием и проверьте порядок сцен.</p>
        <div className="mt-4">
          <LessonStudentContentPanel
            title="Предпросмотр для ученика"
            source={readModel.studentContent.source}
            unavailableReason={readModel.studentContent.unavailableReason}
            assetsById={readModel.studentContent.assetsById}
            embedded
          />
        </div>
      </section>
    </section>
  );
}

function buildResourceChipsByStep(readModel: MethodologyLessonReadModel) {
  const assetsById = readModel.studentContent.assetsById;
  const videoUrl = resolveAssetUrl(assetsById["video:farm-animals"]);
  const flashcardsUrl = resolveAssetUrl(assetsById["flashcards:world-around-me-lesson-1"]);
  const appendixUrl = resolveAssetUrl(assetsById["worksheet:appendix-1"]);
  const workbookUrl = resolveAssetUrl(assetsById["worksheet:workbook-pages-3-4"]);
  const songUrl = resolveAssetUrl(assetsById["song:farm-animals"]);
  const audioUrl =
    resolveAssetUrl(assetsById["audio:dog"]) ??
    resolveAssetUrl(assetsById["audio:cat"]) ??
    resolveAssetUrl(assetsById["audio:rabbit"]) ??
    resolveAssetUrl(assetsById["audio:horse"]);

  return Object.fromEntries(
    readModel.presentation.lessonFlow.map((step) => {
      const stepText = `${step.title} ${step.materials.join(" ")}`.toLowerCase();
      const chips: Array<{ label: string; href?: string | null }> = [];

      if (stepText.includes("video")) chips.push({ label: "Видео farm animals", href: videoUrl });
      if (stepText.includes("лексик") || stepText.includes("слова")) {
        chips.push({ label: "Карточки животных", href: flashcardsUrl });
        chips.push({ label: "Аудио слов", href: audioUrl });
      }
      if (stepText.includes("приложение 1") || stepText.includes("сч")) {
        chips.push({ label: "Приложение 1", href: appendixUrl });
      }
      if (stepText.includes("тетрад")) chips.push({ label: "Рабочая тетрадь, стр. 3–4", href: workbookUrl });
      if (stepText.includes("песн")) chips.push({ label: "Песня farm animals", href: songUrl });

      for (const resource of step.resources) {
        const alreadyIncluded = chips.some((chip) => chip.label === resource.title);
        if (!alreadyIncluded) chips.push({ label: resource.title, href: resource.url ?? null });
      }

      return [step.id, chips];
    }),
  );
}

export function TeacherMethodologyLessonWorkspace({ readModel }: { readModel: MethodologyLessonReadModel }) {
  const [tab, setTab] = useState<TeacherLessonTabKey>("plan");
  const resourceChipsByStepId = useMemo(() => buildResourceChipsByStep(readModel), [readModel]);

  return (
    <SurfaceCard as="section" className="p-5 md:p-6" bodyClassName="mt-0">
      <TeacherLessonTabs tabs={mainTabs} activeTab={tab} onTabChange={setTab} tone="embedded" />

      <div className="mt-5">
        {tab === "plan" ? (
          <TeacherLessonPedagogicalContent
            quickSummary={readModel.presentation.quickSummary}
            lessonFlow={readModel.presentation.lessonFlow}
            durationLabel={readModel.presentation.methodologyReference.durationLabel}
            resourceChipsByStepId={resourceChipsByStepId}
          />
        ) : null}

        {tab === "content" ? (
          <TeacherLessonContentHub readModel={readModel} />
        ) : null}

        {tab === "homework" ? (
          <LessonCanonicalHomeworkPanel homework={readModel.canonicalHomework} embedded />
        ) : null}
      </div>
    </SurfaceCard>
  );
}
