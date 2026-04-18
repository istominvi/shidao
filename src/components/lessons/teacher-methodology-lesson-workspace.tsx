"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { LessonCanonicalHomeworkPanel } from "@/components/lessons/lesson-canonical-homework-panel";
import { LessonStudentContentPanel } from "@/components/lessons/lesson-student-content-panel";
import { TeacherLessonPedagogicalContent } from "@/components/lessons/teacher-lesson-pedagogical-content";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { TeacherLessonWorkspaceReadModel } from "@/lib/server/teacher-lesson-workspace";
import type {
  MethodologyLessonStudentContentSection,
  ResourceLinksStudentSection,
  WordListStudentSection,
  CountBoardStudentSection,
  PresentationStudentSection,
} from "@/lib/lesson-content";

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

type LessonTabKey =
  | "presentation"
  | "cards"
  | "words"
  | "materials"
  | "plan"
  | "student"
  | "homework";

const tabItems: Array<{ key: LessonTabKey; label: string }> = [
  { key: "presentation", label: "Презентация" },
  { key: "cards", label: "Карточки" },
  { key: "words", label: "Новые слова и фразы" },
  { key: "materials", label: "Реквизит к уроку" },
  { key: "plan", label: "План урока" },
  { key: "student", label: "Контент для ученика" },
  { key: "homework", label: "Домашнее задание" },
];

function TeacherResourceSection({
  title,
  subtitle,
  links,
}: {
  title: string;
  subtitle?: string;
  links: Array<{
    id: string;
    title: string;
    url?: string | null;
    secondaryUrl?: string | null;
    imageRefs?: string[];
    downloadable?: boolean;
  }>;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-neutral-700">{subtitle}</p> : null}
      <div className="mt-3 grid gap-2">
        {links.length ? (
          links.map((item) => (
            <article key={item.id} className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
              <p className="text-sm font-medium text-neutral-900">{item.title}</p>
              {item.url ? (
                <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
                  {item.downloadable === false ? "Открыть PDF" : "Открыть / скачать PDF"}
                </a>
              ) : (
                <p className="mt-1 text-xs text-neutral-600">Ресурс сохранён в source-слое, ссылка появится после загрузки.</p>
              )}
              {item.secondaryUrl ? (
                <a href={item.secondaryUrl} target="_blank" rel="noreferrer" className="ml-2 mt-1 inline-flex rounded-lg border border-neutral-300 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-800">
                  Скачать PPTX
                </a>
              ) : null}
              {item.imageRefs?.length ? (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {item.imageRefs.slice(0, 8).map((imageRef) => (
                    <Image key={imageRef} src={imageRef} alt={item.title} width={240} height={140} className="h-20 w-full rounded-md border border-neutral-200 object-cover" />
                  ))}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="text-sm text-neutral-600">Ресурсы не добавлены.</p>
        )}
      </div>
    </section>
  );
}

function pickSections(
  source: MethodologyLessonReadModel["studentContent"]["source"],
  type: MethodologyLessonStudentContentSection["type"],
) {
  return source?.sections.filter((section) => section.type === type) ?? [];
}

export function TeacherMethodologyLessonWorkspace({ readModel }: { readModel: MethodologyLessonReadModel }) {
  const [tab, setTab] = useState<LessonTabKey>("presentation");

  const resources = useMemo(() => {
    const source = readModel.studentContent.source;
    const assetsById = readModel.studentContent.assetsById;
    const presentation = pickSections(source, "presentation")[0] as
      | PresentationStudentSection
      | undefined;
    const resourceSections = pickSections(source, "resource_links") as ResourceLinksStudentSection[];
    const wordListSection = pickSections(source, "word_list")[0] as
      | WordListStudentSection
      | undefined;
    const countSection = pickSections(source, "count_board")[0] as
      | CountBoardStudentSection
      | undefined;

    const materialLinks = resourceSections.flatMap((section) =>
      section.resources.map((resource) => {
        const asset = resource.assetId ? assetsById[resource.assetId] : undefined;
        return {
          id: resource.id,
          title: resource.title,
          url: asset?.fileRef ?? asset?.sourceUrl ?? resource.sourceUrl ?? null,
          imageRefs: Array.isArray(asset?.metadata?.cardImageRefs)
            ? (asset?.metadata?.cardImageRefs as string[])
            : undefined,
        };
      }),
    );

    const presentationAsset = presentation?.assetId
      ? assetsById[presentation.assetId]
      : undefined;

    const flashcardsAsset = assetsById["flashcards:world-around-me-lesson-1"];

    const cards = flashcardsAsset
      ? [
          {
            id: flashcardsAsset.id,
            title: flashcardsAsset.title,
            url: flashcardsAsset.fileRef ?? flashcardsAsset.sourceUrl ?? null,
            imageRefs: Array.isArray(flashcardsAsset.metadata?.cardImageRefs)
              ? (flashcardsAsset.metadata.cardImageRefs as string[])
              : undefined,
            downloadable: false,
          },
        ]
      : [];

    const words = wordListSection
        ? wordListSection.groups.flatMap((group) =>
            group.entries.map((entry) => ({
              id: `${group.id}-${entry.hanzi}`,
              title: `${entry.hanzi} · ${entry.pinyin ?? ""} · ${entry.meaning}`,
              url: entry.audioAssetId
                ? (assetsById[entry.audioAssetId]?.fileRef ?? assetsById[entry.audioAssetId]?.sourceUrl)
                : null,
            })),
          )
        : [];

    return {
      presentation: presentationAsset
        ? [
            {
              id: presentationAsset.id,
              title: presentationAsset.title,
              url: presentationAsset.fileRef ?? presentationAsset.sourceUrl,
              secondaryUrl:
                typeof presentationAsset.metadata?.pptxFileRef === "string"
                  ? presentationAsset.metadata.pptxFileRef
                  : null,
              imageRefs: Array.isArray(presentationAsset.metadata?.slideImageRefs)
                ? (presentationAsset.metadata.slideImageRefs as string[])
                : undefined,
            },
          ]
        : [],
      cards,
      words,
      materials: [
        ...materialLinks,
        ...(countSection && "assetId" in countSection && countSection.assetId
          ? [
              {
                id: "appendix",
                title: "Приложение 1 (интерактивный счёт)",
                url:
                  assetsById[countSection.assetId]?.fileRef ??
                  assetsById[countSection.assetId]?.sourceUrl ??
                  null,
              },
            ]
          : []),
      ],
    };
  }, [readModel.studentContent.assetsById, readModel.studentContent.source]);

  return (
    <SurfaceCard as="section" className="p-5 md:p-6" bodyClassName="mt-0">
      <div className="flex flex-wrap gap-2">
        {tabItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-xl border px-3 py-1.5 text-sm font-medium ${
              tab === item.key
                ? "border-sky-400 bg-sky-50 text-sky-900"
                : "border-neutral-300 bg-white text-neutral-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "presentation" ? (
          <TeacherResourceSection
            title="Презентация урока"
            subtitle="Предпросмотр и доступ к каноническому файлу презентации."
            links={resources.presentation}
          />
        ) : null}

        {tab === "cards" ? (
          <TeacherResourceSection
            title="Карточки урока 1 (PDF)"
            subtitle="Откройте PDF и используйте превью карточек; ученикам доступен просмотр без скачивания."
            links={resources.cards}
          />
        ) : null}

        {tab === "words" ? (
          <TeacherResourceSection
            title="Новые слова и фразы"
            subtitle="Список слов с pinyin/переводом и аудио-произношением."
            links={resources.words}
          />
        ) : null}

        {tab === "materials" ? (
          <TeacherResourceSection
            title="Реквизит к уроку"
            subtitle="Видео, карточки PDF, приложение 1, рабочая тетрадь и песня."
            links={resources.materials}
          />
        ) : null}

        {tab === "plan" ? (
          <TeacherLessonPedagogicalContent
            quickSummary={readModel.presentation.quickSummary}
            lessonFlow={readModel.presentation.lessonFlow}
            durationLabel={readModel.presentation.methodologyReference.durationLabel}
          />
        ) : null}

        {tab === "student" ? (
          <LessonStudentContentPanel
            source={readModel.studentContent.source}
            unavailableReason={readModel.studentContent.unavailableReason}
            assetsById={readModel.studentContent.assetsById}
            embedded
          />
        ) : null}

        {tab === "homework" ? (
          <LessonCanonicalHomeworkPanel homework={readModel.canonicalHomework} embedded />
        ) : null}
      </div>
    </SurfaceCard>
  );
}
