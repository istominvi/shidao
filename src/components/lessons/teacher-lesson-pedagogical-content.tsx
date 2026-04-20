import {
  Activity,
  BookOpenText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  Hash,
  Languages,
  Maximize,
  MonitorUp,
  Music,
  NotebookPen,
  PlayCircle,
  Presentation,
  Package,
  Timer,
  Workflow,
} from "lucide-react";
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { productButtonClassName } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import type { ReusableAsset } from "@/lib/lesson-content";
import type { MethodologyLessonStep } from "@/lib/server/methodology-lesson-unified-read-model";

type Props = {
  quickSummary: {
    prepChecklist: string[];
    keyWords: string[];
    keyPhrases: string[];
  };
  steps: MethodologyLessonStep[];
  durationLabel?: string | null;
  summaryNote?: string | null;
  activeStudentStepId?: string | null;
  assetsById?: Record<string, ReusableAsset>;
  lessonNotesSlot?: ReactNode;
  lessonIdentity?: {
    methodologySlug?: string | null;
    moduleIndex?: number | null;
    lessonIndex?: number | null;
    lessonTitle?: string | null;
  };
  onShowOnStudentScreen?: (stepId: string) => void;
  onOpenStudentScreen?: (stepId: string) => void;
};

type LessonPlanDisplayStep = {
  id: string;
  order: number;
  category: "Видео" | "Лексика" | "Активность" | "Счёт" | "Тетрадь" | "Песня" | "Завершение";
  title: string;
  text: string;
  glossaryTerms: string[];
  durationMinutes?: number;
  resourceIds?: string[];
  resourceButtons?: Array<{ label: string; assetId: string; preferDownload?: boolean }>;
};

const cjkFontFamily =
  '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Arial Unicode MS", system-ui, sans-serif';

const chineseGlossary: Record<string, string> = {
  "狗": "собака",
  "猫": "кошка",
  "兔子": "кролик",
  "马": "лошадь",
  "农场": "ферма",
  "我是…": "я…",
  "你是谁？": "кто ты?",
  "这是…": "это…",
  "这是狗。": "это собака",
  "这是猫。": "это кошка",
  "这是兔子。": "это кролик",
  "这是马。": "это лошадь",
  "这是什么？": "что это?",
  "跑": "бежать",
  "跳": "прыгать",
  "我们跑吧！": "побегаем / давайте побегаем",
  "我们跳吧！": "попрыгаем / давайте попрыгаем",
  "跑到狗！": "беги к собаке",
  "跳到兔子！": "прыгай к кролику",
  "跑到马！": "беги к лошади",
  "跳到猫！": "прыгай к кошке",
  "狗在做什么？": "что собачка делает?",
  "狗在跳": "собачка прыгает",
  "在…里": "в / внутри",
  "猫住在农场里。": "кошка живёт на ферме",
};

const lessonOneDisplaySteps: LessonPlanDisplayStep[] = [
  {
    id: "lesson-1-step-1",
    order: 1,
    category: "Видео",
    title: "Смотрим видео «farm animals»",
    text: "",
    glossaryTerms: [],
    durationMinutes: 3,
    resourceIds: ["video:farm-animals"],
  },
  {
    id: "lesson-1-step-2",
    order: 2,
    category: "Лексика",
    title: "Учим фразу 我是…",
    text: "Учим фразу 我是… (я…). Садимся в круг, по очереди представляемся, указывая на себя и героев: 我是… (имя преподавателя/героя). По очереди спрашиваем детей: 你是谁？ (Кто ты?) и помогаем с ответом: 我是…",
    glossaryTerms: ["我是…", "你是谁？"],
    durationMinutes: 3,
  },
  {
    id: "lesson-1-step-3",
    order: 3,
    category: "Лексика",
    title: "Учим слова 狗，猫，兔子，马",
    text: "Учим слова 狗 (собака)，猫 (кошка)，兔子 (кролик)，马 (лошадь) с помощью карточек. Показываем их детям поочередно два раза. Первый раз называем только слово, соответствующее картинке: 狗，猫，兔子，马. Второй раз проговариваем предложением: 这是狗。 这是猫。 这是兔子。 这是马。",
    glossaryTerms: ["狗", "猫", "兔子", "马", "这是…", "这是狗。", "这是猫。", "这是兔子。", "这是马。"],
    durationMinutes: 4,
    resourceIds: ["flashcards:world-around-me-lesson-1"],
    resourceButtons: [
      { label: "Предпросмотр карточек", assetId: "flashcards:world-around-me-lesson-1" },
      { label: "Скачать PDF", assetId: "flashcards:world-around-me-lesson-1", preferDownload: true },
    ],
  },
  {
    id: "lesson-1-step-4",
    order: 4,
    category: "Активность",
    title: "Изображаем животных",
    text: "Встаем. Поочередно указываем на карточки с животными и изображаем их вместе с детьми: лаем, как собаки, приглаживаем усики, как коты и т.д. Комментируем действия: 我是狗.",
    glossaryTerms: ["我是狗。"],
    durationMinutes: 3,
  },
  {
    id: "lesson-1-step-5",
    order: 5,
    category: "Активность",
    title: "Игра с мячом у стены",
    text: "С помощью малярного скотча расклеиваем карточки с животными на стене и берем мяч. Задача ребенка: попасть мячом по той карточке, которую называет преподаватель, и сказать, что на ней изображено.",
    glossaryTerms: [],
    durationMinutes: 4,
  },
  {
    id: "lesson-1-step-6",
    order: 6,
    category: "Счёт",
    title: "Счётные палочки",
    text: "Садимся. Берем палочки для счета, показательно считаем до 5. Раздаем палочки каждому ребенку и считаем все вместе.",
    glossaryTerms: [],
    durationMinutes: 3,
  },
  {
    id: "lesson-1-step-7",
    order: 7,
    category: "Счёт",
    title: "Приложение 1: указываем, считаем и называем животных",
    text: "Приложение 1: раздаем каждому ребенку картинки из приложения 1 и указку. Вместе указываем, считаем и называем животных.",
    glossaryTerms: ["狗", "猫", "兔子", "马"],
    durationMinutes: 4,
    resourceIds: ["worksheet:appendix-1"],
    resourceButtons: [
      { label: "Предпросмотр Приложения 1", assetId: "worksheet:appendix-1" },
      { label: "Скачать PDF", assetId: "worksheet:appendix-1", preferDownload: true },
    ],
  },
  {
    id: "lesson-1-step-8",
    order: 8,
    category: "Активность",
    title: "Учим глаголы 跑，跳",
    text: "Встаем. Учим глаголы 跑 (бежать)，跳 (прыгать). Даем команду: 我们跑吧！ (Побегаем!) 我们跳吧！ (Попрыгаем!) и выполняем вместе с детьми.",
    glossaryTerms: ["跑", "跳", "我们跑吧！", "我们跳吧！"],
    durationMinutes: 3,
  },
  {
    id: "lesson-1-step-9",
    order: 9,
    category: "Активность",
    title: "Команды с мягкими игрушками",
    text: "Берем мягкие игрушки собаки, кота, кролика и лошади и расставляем по комнате. Даем команды: 跑到狗！ 跳到兔子！ 跑到马！ 跳到猫！",
    glossaryTerms: ["跑到狗！", "跳到兔子！", "跑到马！", "跳到猫！"],
    durationMinutes: 4,
  },
  {
    id: "lesson-1-step-10",
    order: 10,
    category: "Активность",
    title: "Отрабатываем 跑，跳 на мягких игрушках",
    text: "Берем мягкие игрушки и отрабатываем на них глаголы 跑 (бежать)，跳 (прыгать). Попутно задаем вопросы: 狗在做什么？ (Что собачка делает?) 狗在跳 (Собачка прыгает) и т.д.",
    glossaryTerms: ["跑", "跳", "狗在做什么？", "狗在跳"],
    durationMinutes: 3,
  },
  {
    id: "lesson-1-step-11",
    order: 11,
    category: "Тетрадь",
    title: "Рабочая тетрадь, страницы 3–4",
    text: "Выполняем страницы 3–4 в рабочей тетради. Раскрашиваем животных, задавая вопрос 这是什么？ (Что это?)",
    glossaryTerms: ["这是什么？"],
    durationMinutes: 4,
    resourceIds: ["worksheet:workbook-pages-3-4"],
    resourceButtons: [
      { label: "Предпросмотр тетради", assetId: "worksheet:workbook-pages-3-4" },
      { label: "Скачать PDF", assetId: "worksheet:workbook-pages-3-4", preferDownload: true },
    ],
  },
  {
    id: "lesson-1-step-12",
    order: 12,
    category: "Лексика",
    title: "Учим слово 农场",
    text: "Учим слово 农场 (ферма) с помощью карточки.",
    glossaryTerms: ["农场"],
    durationMinutes: 2,
  },
  {
    id: "lesson-1-step-13",
    order: 13,
    category: "Активность",
    title: "Игрушечная ферма и конструкция 在…里",
    text: "Отрабатываем слова 农场，狗，猫，兔子，马 и грамматическую конструкцию 在…里 при помощи игрушечной фермы. Ставим игрушки на ферму и комментируем: 猫住在农场里。 (Кошка живёт на ферме)",
    glossaryTerms: ["农场", "狗", "猫", "兔子", "马", "在…里", "猫住在农场里。"],
    durationMinutes: 4,
  },
  {
    id: "lesson-1-step-14",
    order: 14,
    category: "Песня",
    title: "Поём песню «Животные на ферме»",
    text: "Поем песню «Животные на ферме».",
    glossaryTerms: [],
    durationMinutes: 3,
    resourceIds: ["song:farm-animals", "song-video:farm-animals-movement"],
    resourceButtons: [
      { label: "Воспроизвести аудио", assetId: "song:farm-animals" },
      { label: "Скачать аудио", assetId: "song:farm-animals", preferDownload: true },
      { label: "Видео с движениями", assetId: "song-video:farm-animals-movement" },
    ],
  },
  {
    id: "lesson-1-step-15",
    order: 15,
    category: "Завершение",
    title: "Прощаемся с детьми и героями курса",
    text: "Прощаемся с детьми и героями курса.",
    glossaryTerms: [],
    durationMinutes: 2,
  },
];

function isLessonOnePlan(identity?: Props["lessonIdentity"]) {
  return (
    identity?.methodologySlug === "world-around-me" &&
    identity?.moduleIndex === 1 &&
    identity?.lessonIndex === 1
  );
}

function ResourceButtons({
  actions,
  assetsById,
}: {
  actions: NonNullable<LessonPlanDisplayStep["resourceButtons"]>;
  assetsById: Record<string, ReusableAsset>;
}) {
  const resolved = actions
    .map((action) => ({ action, asset: assetsById[action.assetId] }))
    .filter((item) => Boolean(item.asset));
  if (!resolved.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {resolved.map(({ action, asset }) => {
        if (!asset) return null;
        const href = action.preferDownload
          ? asset.fileRef ?? asset.sourceUrl
          : asset.fileRef ?? asset.sourceUrl;
        if (!href) return null;
        return (
          <a
            key={`${action.assetId}-${action.label}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800"
          >
            {action.label}
          </a>
        );
      })}
    </div>
  );
}

function mapAssetUrls(asset: ReusableAsset) {
  const metadata = asset.metadata ?? {};
  const localUrl = typeof asset.fileRef === "string" && asset.fileRef.startsWith("/methodologies/")
    ? asset.fileRef
    : undefined;
  const previewImageRefs = [
    ...(Array.isArray(metadata.previewImageRefs) ? metadata.previewImageRefs : []),
    ...(typeof metadata.previewImageRef === "string" ? [metadata.previewImageRef] : []),
  ].filter((value): value is string => typeof value === "string");
  const slideImageRefs = Array.isArray(metadata.slideImageRefs)
    ? metadata.slideImageRefs.filter((value): value is string => typeof value === "string")
    : [];
  const cardImageRefs = Array.isArray(metadata.cardImageRefs)
    ? metadata.cardImageRefs.filter((value): value is string => typeof value === "string")
    : [];
  const pptxFileRef = typeof metadata.pptxFileRef === "string" ? metadata.pptxFileRef : undefined;
  const fallbackUrl = !localUrl ? asset.sourceUrl : undefined;
  return { localUrl, fallbackUrl, previewImageRefs, slideImageRefs, cardImageRefs, pptxFileRef };
}

function toGoogleDrivePreviewUrl(url: string) {
  const match = url.match(/\/file\/d\/([^/]+)\//);
  if (!match) return null;
  return `https://drive.usercontent.google.com/download?id=${match[1]}&export=download&confirm=t`;
}

function StepOneVideoEmbed({ asset }: { asset: ReusableAsset }) {
  const { localUrl } = mapAssetUrls(asset);
  const fallbackSourceUrl = asset.sourceUrl ? toGoogleDrivePreviewUrl(asset.sourceUrl) : null;
  const sourceUrl = localUrl ?? fallbackSourceUrl;
  if (!sourceUrl) return null;
  return (
    <video
      controls
      playsInline
      preload="metadata"
      src={sourceUrl}
      className="mt-3 aspect-video w-full rounded-xl border border-neutral-200 bg-black object-contain"
    />
  );
}

function downloadLabel(asset: ReusableAsset) {
  if (asset.kind === "song_audio" || asset.kind === "song" || asset.kind === "pronunciation_audio") return "Скачать аудио";
  if (asset.kind === "song_video" || asset.kind === "video" || asset.kind === "lesson_video") return "Скачать MP4";
  if (asset.kind === "presentation" || asset.kind === "flashcards_pdf" || asset.kind === "worksheet" || asset.kind === "worksheet_pdf") return "Скачать PDF";
  return "Скачать файл";
}

function openLabel(asset: ReusableAsset) {
  if (asset.kind === "song_audio" || asset.kind === "song" || asset.kind === "pronunciation_audio") return "Открыть аудио";
  if (asset.kind === "song_video" || asset.kind === "video" || asset.kind === "lesson_video") return "Открыть видео";
  if (asset.kind === "presentation" || asset.kind === "flashcards_pdf" || asset.kind === "worksheet" || asset.kind === "worksheet_pdf") return "Открыть PDF";
  return "Открыть файл";
}

function LessonPlanResourcePreview({
  asset,
  mode = "default",
}: {
  asset: ReusableAsset;
  mode?: "default" | "single-slide";
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeCard, setActiveCard] = useState(0);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const { localUrl, fallbackUrl, previewImageRefs, slideImageRefs, cardImageRefs, pptxFileRef } = mapAssetUrls(asset);
  const primaryUrl = localUrl ?? fallbackUrl;
  if (!primaryUrl && !previewImageRefs.length && !slideImageRefs.length && !cardImageRefs.length) return null;

  const actionButtonClassName =
    "inline-flex rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800";

  if (asset.kind === "video" || asset.kind === "lesson_video" || asset.kind === "song_video") {
    return (
      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        {primaryUrl ? (
          <video controls playsInline preload="metadata" src={primaryUrl} className="w-full rounded-lg border border-neutral-200 bg-black" />
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {primaryUrl ? <a href={primaryUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>{openLabel(asset)}</a> : null}
          {localUrl ? <a href={localUrl} download className={actionButtonClassName}>{downloadLabel(asset)}</a> : null}
          {!localUrl && fallbackUrl ? <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>Открыть источник</a> : null}
        </div>
      </div>
    );
  }

  if (asset.kind === "song_audio" || asset.kind === "song" || asset.kind === "pronunciation_audio") {
    return (
      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        {primaryUrl ? <audio controls preload="metadata" src={primaryUrl} className="w-full" /> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {!localUrl && fallbackUrl ? <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>Открыть аудио</a> : null}
          {localUrl ? <a href={localUrl} download className={actionButtonClassName}>Скачать аудио</a> : null}
        </div>
      </div>
    );
  }

  if (asset.kind === "presentation") {
    const previewSlides = slideImageRefs.length ? slideImageRefs : (localUrl ? [localUrl] : []);
    const currentSlide = previewSlides[activeSlide] ?? previewSlides[0];

    return (
      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        {mode === "single-slide" && currentSlide ? (
          <div ref={frameRef} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            {slideImageRefs.length ? (
              <img src={currentSlide} alt={`Слайд ${activeSlide + 1}: ${asset.title}`} className="h-64 w-full object-contain" />
            ) : (
              <iframe src={currentSlide} title={asset.title} className="h-64 w-full bg-white" />
            )}
          </div>
        ) : slideImageRefs.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {slideImageRefs.slice(0, 6).map((imageRef, index) => (
              <img key={imageRef} src={imageRef} alt={`Слайд ${index + 1}: ${asset.title}`} className="h-20 w-full rounded-md border border-neutral-200 object-cover" />
            ))}
          </div>
        ) : localUrl ? (
          <iframe src={localUrl} title={asset.title} className="h-56 w-full rounded-lg border border-neutral-200 bg-white" />
        ) : null}
        {mode === "single-slide" && previewSlides.length > 1 ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setActiveSlide((prev) => (prev === 0 ? previewSlides.length - 1 : prev - 1))}
              className={actionButtonClassName}
            >
              <ChevronLeft className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              Назад
            </button>
            <span className="text-xs text-neutral-600">Слайд {activeSlide + 1} из {previewSlides.length}</span>
            <button
              type="button"
              onClick={() => setActiveSlide((prev) => (prev + 1) % previewSlides.length)}
              className={actionButtonClassName}
            >
              Вперёд
              <ChevronRight className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {mode === "single-slide" ? (
            <button
              type="button"
              onClick={() => frameRef.current?.requestFullscreen?.()}
              className={actionButtonClassName}
            >
              <Maximize className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              На весь экран
            </button>
          ) : null}
          {localUrl ? <a href={localUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>Открыть PDF</a> : null}
          {pptxFileRef ? <a href={pptxFileRef} target="_blank" rel="noreferrer" className={actionButtonClassName}>Скачать PPTX</a> : null}
          {!localUrl && fallbackUrl ? <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>Открыть источник</a> : null}
        </div>
      </div>
    );
  }

  if (asset.kind === "flashcards_pdf") {
    const currentCard = cardImageRefs[activeCard] ?? cardImageRefs[0];
    return (
      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        {mode === "single-slide" && currentCard ? (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <img src={currentCard} alt={`Карточка ${activeCard + 1}: ${asset.title}`} className="h-64 w-full object-contain" />
          </div>
        ) : cardImageRefs.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {cardImageRefs.slice(0, 10).map((imageRef, index) => (
              <img key={imageRef} src={imageRef} alt={`Карточка ${index + 1}: ${asset.title}`} className="h-20 w-full rounded-md border border-neutral-200 object-cover" />
            ))}
          </div>
        ) : null}
        {mode === "single-slide" && cardImageRefs.length > 1 ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setActiveCard((prev) => (prev === 0 ? cardImageRefs.length - 1 : prev - 1))}
              className={actionButtonClassName}
            >
              <ChevronLeft className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              Назад
            </button>
            <span className="text-xs text-neutral-600">Карточка {activeCard + 1} из {cardImageRefs.length}</span>
            <button
              type="button"
              onClick={() => setActiveCard((prev) => (prev + 1) % cardImageRefs.length)}
              className={actionButtonClassName}
            >
              Вперёд
              <ChevronRight className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {localUrl ? <a href={localUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>Открыть PDF</a> : null}
          {localUrl ? <a href={localUrl} download className={actionButtonClassName}>Скачать PDF</a> : null}
          {!localUrl && fallbackUrl ? <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>Открыть источник</a> : null}
        </div>
      </div>
    );
  }

  if (asset.kind === "worksheet" || asset.kind === "worksheet_pdf") {
    return (
      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        {previewImageRefs.length ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {previewImageRefs.slice(0, 2).map((imageRef, index) => (
              <img key={imageRef} src={imageRef} alt={`Превью листа ${index + 1}: ${asset.title}`} className="h-40 w-full rounded-md border border-neutral-200 object-cover" />
            ))}
          </div>
        ) : localUrl ? (
          <iframe src={localUrl} title={asset.title} className="h-56 w-full rounded-lg border border-neutral-200 bg-white" />
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {localUrl ? <a href={localUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>Открыть PDF</a> : null}
          {localUrl ? <a href={localUrl} download className={actionButtonClassName}>Скачать PDF</a> : null}
          {!localUrl && fallbackUrl ? <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>Открыть источник</a> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="mt-2 flex flex-wrap gap-2">
        {primaryUrl ? <a href={primaryUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>{openLabel(asset)}</a> : null}
        {localUrl ? <a href={localUrl} download className={actionButtonClassName}>{downloadLabel(asset)}</a> : null}
      </div>
    </div>
  );
}

function GlossaryTerm({ term }: { term: string }) {
  const meaning = chineseGlossary[term];
  if (!meaning) {
    return (
      <span
        className="inline-flex rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs text-violet-900"
        style={{ fontFamily: cjkFontFamily }}
      >
        {term}
      </span>
    );
  }
  return (
    <button
      type="button"
      className="group relative inline-flex rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-left text-xs text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
      style={{ fontFamily: cjkFontFamily }}
      aria-label={`${term}: ${meaning}`}
    >
      {term}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-max -translate-x-1/2 rounded-md bg-neutral-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block group-focus-visible:block"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        {meaning}
      </span>
    </button>
  );
}

function GlossaryChips({ terms, compactTop = false }: { terms: string[]; compactTop?: boolean }) {
  if (!terms.length) return null;
  return (
    <div className={`${compactTop ? "mt-1" : "mt-3"} flex flex-wrap gap-1.5`}>
      {terms.map((term) => (
        <GlossaryTerm key={term} term={term} />
      ))}
    </div>
  );
}

function CollapsibleCard({
  title,
  defaultOpen = true,
  icon: Icon,
  contentClassName,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  contentClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <article className="rounded-2xl border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left"
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <Icon className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          {title}
        </h3>
        <ChevronDown
          className={`h-4 w-4 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className={`border-t border-neutral-100 px-4 py-3 ${contentClassName ?? ""}`}>
          {children}
        </div>
      ) : null}
    </article>
  );
}

const categoryChipByLabel: Record<
  LessonPlanDisplayStep["category"],
  { tone: "sky" | "amber" | "emerald" | "indigo" | "rose" | "violet" | "slate"; icon: typeof PlayCircle }
> = {
  Видео: { tone: "sky", icon: PlayCircle },
  Лексика: { tone: "amber", icon: Languages },
  Активность: { tone: "emerald", icon: Activity },
  "Счёт": { tone: "indigo", icon: Hash },
  Тетрадь: { tone: "rose", icon: NotebookPen },
  Песня: { tone: "violet", icon: Music },
  Завершение: { tone: "slate", icon: CheckCircle2 },
};

function resolveCanonicalStepSource(steps: MethodologyLessonStep[], displayStepOrder: number) {
  const direct = steps.find((source) => source.order === displayStepOrder);
  const hasIntroOffset =
    steps.length === 16 &&
    /привет|вход|знаком/i.test(steps[0]?.title ?? "") &&
    /видео/i.test(steps[1]?.title ?? "");
  if (hasIntroOffset) {
    return steps.find((source) => source.order === displayStepOrder + 1) ?? direct;
  }
  return direct;
}

function LessonOnePlan({
  assetsById,
  lessonNotesSlot,
  steps,
  onShowOnStudentScreen,
}: {
  assetsById: Record<string, ReusableAsset>;
  lessonNotesSlot?: ReactNode;
  steps: MethodologyLessonStep[];
  onShowOnStudentScreen?: (stepId: string) => void;
}) {

  return (
    <section className="space-y-6" aria-label="План урока">
      <section className="space-y-3">
        <CollapsibleCard title="Об уроке" icon={BookOpenText} defaultOpen>
          <p className="text-sm text-neutral-700" style={{ fontFamily: cjkFontFamily }}>
            Первый урок знакомит детей с животными фермы через видео, карточки, движение, счёт, игрушечную ферму и песню. План следует методике: учитель ведёт детей от первых слов к коротким моделям 我是… / 这是… / 在…里.
          </p>
        </CollapsibleCard>

        {lessonNotesSlot ? (
          <CollapsibleCard
            title="Заметки к уроку"
            icon={NotebookPen}
            defaultOpen={false}
            contentClassName="pt-1"
          >
            {lessonNotesSlot}
          </CollapsibleCard>
        ) : null}

        <CollapsibleCard
          title="Презентация"
          icon={Presentation}
          defaultOpen={false}
        >
          {assetsById["presentation:world-around-me-lesson-1"] ? (
            <LessonPlanResourcePreview asset={assetsById["presentation:world-around-me-lesson-1"]} mode="single-slide" />
          ) : (
            <p className="text-sm text-neutral-700">Презентация не найдена.</p>
          )}
        </CollapsibleCard>

        <CollapsibleCard
          title="Карточки"
          icon={FileText}
          defaultOpen={false}
        >
          {assetsById["flashcards:world-around-me-lesson-1"] ? (
            <LessonPlanResourcePreview asset={assetsById["flashcards:world-around-me-lesson-1"]} mode="single-slide" />
          ) : (
            <p className="text-sm text-neutral-700">Карточки не найдены.</p>
          )}
        </CollapsibleCard>

        <CollapsibleCard
          title="Новые слова и фразы"
          icon={Languages}
          defaultOpen={false}
          contentClassName="pt-1"
        >
          <GlossaryChips compactTop terms={["狗", "猫", "兔子", "马", "农场", "我是…", "这是…", "跑", "跳", "我们…吧！", "在"]} />
        </CollapsibleCard>

        <CollapsibleCard title="Реквизит" icon={Package} defaultOpen={false}>
          <ul className="space-y-1 text-sm text-neutral-700">
            <li>Активность 1: герои курса</li>
            <li>Активность 3: герои курса</li>
            <li>Активность 4: карточки 狗，猫，兔子，马</li>
            <li>Активность 6: малярный скотч, карточки 狗，猫，兔子，马, мяч</li>
            <li>Активность 7: палочки для счета</li>
            <li>Активность 8: приложение 1, указка</li>
            <li>Активность 10: мягкие игрушки (собака, кот, кролик, лошадь)</li>
            <li>Активность 11: мягкие игрушки (собака, кот, кролик, лошадь)</li>
            <li>Активность 12: рабочая тетрадь</li>
            <li>Активность 13: карточка 农场</li>
            <li>Активность 14: игрушечная ферма</li>
            <li>Активность 16: герои курса</li>
          </ul>
        </CollapsibleCard>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold text-neutral-950">Структура урока</h2>
          <Chip tone="sky" icon={Timer} className="whitespace-nowrap">45 минут</Chip>
          <Chip tone="neutral" icon={Workflow} className="whitespace-nowrap">15 шагов</Chip>
        </div>

        <div className="space-y-3">
          {lessonOneDisplaySteps.map((step) => (
            <article key={step.id} className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-[0_8px_28px_rgba(20,20,20,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip size="sm" tone="inverse">Шаг {step.order}</Chip>
                  <Chip size="sm" tone={categoryChipByLabel[step.category].tone} icon={categoryChipByLabel[step.category].icon}>
                    {step.category}
                  </Chip>
                  <Chip
                    size="sm"
                    tone="sky"
                    icon={Timer}
                    className="whitespace-nowrap"
                  >
                    {step.durationMinutes ?? resolveCanonicalStepSource(steps, step.order)?.durationMinutes ?? 3} мин
                  </Chip>
                </div>
                {onShowOnStudentScreen ? (
                  <button
                    type="button"
                    onClick={() => {
                      const sourceStep = resolveCanonicalStepSource(steps, step.order);
                      if (sourceStep) onShowOnStudentScreen(sourceStep.id);
                    }}
                    className={productButtonClassName("secondary", "text-sm whitespace-nowrap")}
                  >
                    <MonitorUp className="h-4 w-4" aria-hidden="true" />
                    На экран
                  </button>
                ) : null}
              </div>
              <h3 className="mt-2 text-lg font-semibold text-neutral-950" style={{ fontFamily: cjkFontFamily }}>{step.title}</h3>
              {step.text ? (
                <p className="mt-2 text-sm leading-6 text-neutral-700" style={{ fontFamily: cjkFontFamily }}>{step.text}</p>
              ) : null}
              <GlossaryChips terms={step.glossaryTerms} />
              {step.order === 3 ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Два прохода</p>
                  <p className="mt-2 text-sm text-neutral-800">
                    <strong>Проход 1 — слово:</strong>{" "}
                    <span style={{ fontFamily: cjkFontFamily }}>狗, 猫, 兔子, 马</span>
                  </p>
                  <p className="mt-1 text-sm text-neutral-800">
                    <strong>Проход 2 — предложение:</strong>{" "}
                    <span style={{ fontFamily: cjkFontFamily }}>这是狗。 / 这是猫。 / 这是兔子。 / 这是马。</span>
                  </p>
                </div>
              ) : null}
              {step.resourceIds?.map((resourceId) => {
                const asset = assetsById[resourceId];
                if (!asset) return null;
                if (step.order === 1 && resourceId === "video:farm-animals") {
                  return <StepOneVideoEmbed key={`${step.id}-${resourceId}`} asset={asset} />;
                }
                return <LessonPlanResourcePreview key={`${step.id}-${resourceId}`} asset={asset} />;
              })}
              {!step.resourceIds?.length && step.resourceButtons?.length ? (
                <ResourceButtons actions={step.resourceButtons} assetsById={assetsById} />
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function GenericPlan({ quickSummary, steps, durationLabel }: Pick<Props, "quickSummary" | "steps" | "durationLabel">) {
  return (
    <section className="space-y-6" aria-label="План урока">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="text-base font-semibold text-neutral-950">Кратко об уроке</h2>
        <p className="mt-2 text-sm text-neutral-700">{durationLabel ?? "45 минут"} · {steps.length} шагов</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {quickSummary.keyWords.map((word) => <Chip key={word} tone="sky">{word}</Chip>)}
          {quickSummary.keyPhrases.map((phrase) => <Chip key={phrase} tone="violet">{phrase}</Chip>)}
        </div>
      </section>
      <section className="space-y-3">
        {steps.map((step) => (
          <article key={step.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h3 className="text-base font-semibold text-neutral-950">Шаг {step.order}. {step.title}</h3>
            {step.teacher.description ? <p className="mt-2 text-sm text-neutral-700">{step.teacher.description}</p> : null}
          </article>
        ))}
      </section>
    </section>
  );
}

export function TeacherLessonPedagogicalContent({
  quickSummary,
  steps,
  durationLabel,
  assetsById = {},
  lessonNotesSlot,
  lessonIdentity,
  onShowOnStudentScreen,
}: Props) {
  if (isLessonOnePlan(lessonIdentity)) {
    return (
      <LessonOnePlan
        assetsById={assetsById}
        lessonNotesSlot={lessonNotesSlot}
        steps={steps}
        onShowOnStudentScreen={onShowOnStudentScreen}
      />
    );
  }

  return <GenericPlan quickSummary={quickSummary} steps={steps} durationLabel={durationLabel} />;
}
