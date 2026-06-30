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
  MonitorPlay,
  MonitorUp,
  Music,
  NotebookPen,
  PlayCircle,
  Presentation,
  Package,
  Timer,
  Workflow,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  "我是狗。": "я собачка / я собака",
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
  "橘色": "оранжевый",
  "黑色": "чёрный",
  "白色": "белый",
  "棕色": "коричневый",
  "草地": "луг / поле",
  "我喜欢…": "мне нравится…",
  "我喜欢蓝色。": "мне нравится синий цвет",
  "我喜欢黑色。": "мне нравится чёрный цвет",
  "我喜欢橘色。": "мне нравится оранжевый цвет",
  "有": "иметь / есть",
  "飞": "летать",
  "草地上有什么动物？": "какие животные на лугу?",
  "草地上有一头蓝色的牛。": "на лугу одна синяя корова",
  "草地上有黄色的猫。": "на лугу жёлтая кошка",
  "这是黑色。": "это чёрный цвет",
  "花": "цветок",
  "树": "дерево",
  "草": "трава",
  "我很好": "у меня всё хорошо",
  "我不好": "мне нехорошо / не очень",
  "我喜欢蓝色的花。": "мне нравится синий цветок",
  "我喜欢红色的花。": "мне нравится красный цветок",
  "我喜欢黄色的花。": "мне нравится жёлтый цветок",
  "我喜欢绿色的花。": "мне нравится зелёный цветок",
  "草地上有什么？": "что есть на лугу?",
  "草地上有花。": "на лугу есть цветы",
  "草地上有树。": "на лугу есть деревья",
  "草地上有草。": "на лугу есть трава",
};

const lessonOneDisplaySteps: LessonPlanDisplayStep[] = [
  {
    id: "lesson-1-step-1",
    order: 1,
    category: "Видео",
    title: "Смотрим видео «Животные на ферме»",
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
    title: "Карточки животных: два прохода",
    text: "Учим слова 狗 (собака)，猫 (кошка)，兔子 (кролик)，马 (лошадь) с помощью карточек. Показываем их детям поочередно два раза. Первый раз называем только слово, соответствующее картинке: 狗，猫，兔子，马. Второй раз проговариваем предложением: 这是狗。 这是猫。 这是兔子。 这是马。",
    glossaryTerms: ["狗", "猫", "兔子", "马", "这是…", "这是狗。", "这是猫。", "这是兔子。", "这是马。"],
    durationMinutes: 4,
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
    title: "Игра с мячом и карточками",
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

function isLessonFourPlan(identity?: Props["lessonIdentity"]) {
  return (
    identity?.methodologySlug === "world-around-me" &&
    identity?.moduleIndex === 1 &&
    identity?.lessonIndex === 4
  );
}

function isLessonFivePlan(identity?: Props["lessonIdentity"]) {
  return (
    identity?.methodologySlug === "world-around-me" &&
    identity?.moduleIndex === 1 &&
    identity?.lessonIndex === 5
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
  const driveFileId = fallbackUrl ? extractGoogleDriveFileId(fallbackUrl) : null;
  const drivePreviewUrl = driveFileId
    ? `https://drive.google.com/file/d/${driveFileId}/preview`
    : undefined;
  const driveDownloadUrl = driveFileId
    ? `https://drive.google.com/uc?export=download&id=${driveFileId}`
    : undefined;
  return {
    localUrl,
    fallbackUrl,
    previewImageRefs,
    slideImageRefs,
    cardImageRefs,
    pptxFileRef,
    drivePreviewUrl,
    driveDownloadUrl,
  };
}

function extractGoogleDriveFileId(url: string) {
  const fileMatch = url.match(/\/file\/d\/([^/]+)/);
  if (fileMatch?.[1]) return fileMatch[1];

  const queryMatch = url.match(/[?&]id=([^&]+)/);
  return queryMatch?.[1] ?? null;
}

const lessonOneStepOneVideoPlaylist = [
  { fileName: "zhu.mp4", labelRu: "Свинья", labelZh: "猪" },
  { fileName: "yang.mp4", labelRu: "Овца", labelZh: "羊" },
  { fileName: "ya.mp4", labelRu: "Утка", labelZh: "鸭" },
  { fileName: "tu.mp4", labelRu: "Кролик", labelZh: "兔子" },
  { fileName: "nainiu.mp4", labelRu: "Корова", labelZh: "奶牛" },
  { fileName: "mao.mp4", labelRu: "Кошка", labelZh: "猫" },
  { fileName: "ma.mp4", labelRu: "Лошадь", labelZh: "马" },
  { fileName: "ji.mp4", labelRu: "Курица", labelZh: "鸡" },
  { fileName: "gou.mp4", labelRu: "Собака", labelZh: "狗" },
  { fileName: "e.mp4", labelRu: "Гуси", labelZh: "鹅" },
] as const;

function StepOneVideoEmbed() {
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playlist = lessonOneStepOneVideoPlaylist.map((item, index) => ({
    id: `step-1-video-${index + 1}`,
    fileName: item.fileName,
    src: `/methodologies/world-around-me/lesson-1/media/${item.fileName}`,
    labelRu: item.labelRu,
    labelZh: item.labelZh,
  }));

  const activeItem = playlist[activeIndex] ?? playlist[0];
  if (!activeItem) return null;

  return (
    <div className="mt-3 space-y-3">
      <video
        key={activeItem.src}
        ref={videoRef}
        controls
        playsInline
        muted
        autoPlay
        preload="metadata"
        src={activeItem.src}
        onEnded={() => setActiveIndex((prev) => (prev + 1) % playlist.length)}
        className="aspect-video w-full rounded-xl border border-neutral-200 bg-black object-contain"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {playlist.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setActiveIndex(index);
              void videoRef.current?.play().catch(() => {});
            }}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold ${
              index === activeIndex
                ? "border-sky-300 bg-sky-50 text-sky-900"
                : "border-neutral-200 bg-white text-neutral-700"
            }`}
          >
            <MonitorPlay className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="truncate">
              {item.labelRu} · <span style={{ fontFamily: cjkFontFamily }}>{item.labelZh}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
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
  const {
    localUrl,
    fallbackUrl,
    previewImageRefs,
    slideImageRefs,
    cardImageRefs,
    pptxFileRef,
    drivePreviewUrl,
    driveDownloadUrl,
  } = mapAssetUrls(asset);
  const primaryUrl = localUrl ?? fallbackUrl;
  if (
    !primaryUrl &&
    !drivePreviewUrl &&
    !previewImageRefs.length &&
    !slideImageRefs.length &&
    !cardImageRefs.length
  ) return null;

  const actionButtonClassName =
    "inline-flex rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800";

  if (asset.kind === "video" || asset.kind === "lesson_video" || asset.kind === "song_video") {
    return (
      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        {localUrl ? (
          <video controls playsInline preload="metadata" src={primaryUrl} className="w-full rounded-lg border border-neutral-200 bg-black" />
        ) : drivePreviewUrl ? (
          <iframe
            src={drivePreviewUrl}
            title={asset.title}
            className="aspect-video w-full rounded-lg border border-neutral-200 bg-black"
            allow="autoplay"
          />
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {primaryUrl ? <a href={primaryUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>{openLabel(asset)}</a> : null}
          {localUrl ? <a href={localUrl} download className={actionButtonClassName}>{downloadLabel(asset)}</a> : null}
          {!localUrl && driveDownloadUrl ? <a href={driveDownloadUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>{downloadLabel(asset)}</a> : null}
          {!localUrl && fallbackUrl ? <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>Открыть источник</a> : null}
        </div>
      </div>
    );
  }

  if (asset.kind === "song_audio" || asset.kind === "song" || asset.kind === "pronunciation_audio") {
    return (
      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        {localUrl ? (
          <audio controls preload="metadata" src={localUrl} className="w-full" />
        ) : drivePreviewUrl ? (
          <iframe
            src={drivePreviewUrl}
            title={asset.title}
            className="h-24 w-full rounded-lg border border-neutral-200 bg-white"
            allow="autoplay"
          />
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {!localUrl && fallbackUrl ? <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>Открыть аудио</a> : null}
          {localUrl ? <a href={localUrl} download className={actionButtonClassName}>Скачать аудио</a> : null}
          {!localUrl && driveDownloadUrl ? <a href={driveDownloadUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>Скачать аудио</a> : null}
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
        ) : drivePreviewUrl ? (
          <iframe src={drivePreviewUrl} title={asset.title} className="h-56 w-full rounded-lg border border-neutral-200 bg-white" />
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
        ) : drivePreviewUrl ? (
          <iframe src={drivePreviewUrl} title={asset.title} className="h-56 w-full rounded-lg border border-neutral-200 bg-white" />
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {localUrl ? <a href={localUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>Открыть PDF</a> : null}
          {localUrl ? <a href={localUrl} download className={actionButtonClassName}>Скачать PDF</a> : null}
          {!localUrl && driveDownloadUrl ? <a href={driveDownloadUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>Скачать PDF</a> : null}
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
  const lessonOneAnimalCards = [
    { src: "/methodologies/world-around-me/lesson-1/visuals/dog-card.png", label: "狗", alt: "Карточка собаки" },
    { src: "/methodologies/world-around-me/lesson-1/visuals/cat-card.png", label: "猫", alt: "Карточка кошки" },
    { src: "/methodologies/world-around-me/lesson-1/visuals/rabbit-card.png", label: "兔子", alt: "Карточка кролика" },
    { src: "/methodologies/world-around-me/lesson-1/visuals/horse-card.png", label: "马", alt: "Карточка лошади" },
  ] as const;

  function AnimalCardReferenceGrid() {
    return (
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {lessonOneAnimalCards.map((card) => (
          <figure key={card.src} className="rounded-xl border border-neutral-200 bg-white p-2">
            <img src={card.src} alt={card.alt} className="h-20 w-full rounded-lg object-contain" />
            <figcaption className="mt-1.5 text-center text-sm font-semibold text-neutral-800">
              <GlossaryTerm term={card.label} />
            </figcaption>
          </figure>
        ))}
      </div>
    );
  }

  function StepThreeCardPassesBlock() {
    return (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Два прохода с карточками</p>
        <div className="mt-2 space-y-2">
          <p className="text-sm text-neutral-800">
            <strong>Проход 1 — слово:</strong>{" "}
            <span style={{ fontFamily: cjkFontFamily }}>狗 / 猫 / 兔子 / 马</span>
          </p>
          <p className="text-sm text-neutral-800">
            <strong>Проход 2 — предложение:</strong>{" "}
            <span style={{ fontFamily: cjkFontFamily }}>这是狗。 / 这是猫。 / 这是兔子。 / 这是马。</span>
          </p>
        </div>
        <AnimalCardReferenceGrid />
      </div>
    );
  }

  function StepFourActionBlock() {
    const [activeIndex, setActiveIndex] = useState(0);
    const activeCard = lessonOneAnimalCards[activeIndex] ?? lessonOneAnimalCards[0];

    useEffect(() => {
      const intervalId = window.setInterval(() => {
        setActiveIndex((previous) => (previous + 1) % lessonOneAnimalCards.length);
      }, 2600);
      return () => window.clearInterval(intervalId);
    }, []);

    return (
      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Действие</p>
        <ul className="mt-2 space-y-1 text-sm text-neutral-800">
          <li>• Показать карточку</li>
          <li>• Изобразить животное</li>
          <li>
            • Сказать: <GlossaryTerm term="我是狗。" />
          </li>
        </ul>
        {activeCard ? (
          <div className="mt-3 rounded-xl border border-emerald-200/80 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Карусель карточек</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setActiveIndex((previous) =>
                    previous === 0 ? lessonOneAnimalCards.length - 1 : previous - 1,
                  )
                }
                className="inline-flex rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <div className="relative h-28 flex-1 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                <img
                  key={activeCard.src}
                  src={activeCard.src}
                  alt={activeCard.alt}
                  className="h-full w-full object-contain transition duration-500 ease-out motion-safe:animate-[pulse_1.8s_ease-in-out_infinite]"
                />
              </div>
              <button
                type="button"
                onClick={() => setActiveIndex((previous) => (previous + 1) % lessonOneAnimalCards.length)}
                className="inline-flex rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-center text-sm font-semibold text-neutral-800">
              <GlossaryTerm term={activeCard.label} />
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  function StepFiveGameMechanicsBlock() {
    const onlinePreviewCards = [
      ...lessonOneAnimalCards,
      ...lessonOneAnimalCards,
      lessonOneAnimalCards[0],
    ].filter((card): card is (typeof lessonOneAnimalCards)[number] => Boolean(card));
    const [activeCardSrc, setActiveCardSrc] = useState<string | null>(null);

    return (
      <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-900">Механика игры</p>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-neutral-800">
          <li>Расклеить карточки на стене</li>
          <li>Назвать животное</li>
          <li>Ребёнок бросает мяч</li>
          <li>Ребёнок называет карточку</li>
        </ol>
        <div className="mt-3 rounded-xl border border-sky-200/80 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Онлайн-превью (сетка 3×3)</p>
          <p className="mt-1 text-xs text-neutral-600">
            На экране ученика ребёнок тапает по названной карточке и озвучивает животное.
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {onlinePreviewCards.map((card, index) => {
              const isActive = activeCardSrc === `${card.src}-${index}`;
              return (
                <button
                  key={`${card.src}-${index}`}
                  type="button"
                  onClick={() => {
                    setActiveCardSrc(`${card.src}-${index}`);
                    window.setTimeout(() => setActiveCardSrc((previous) => (previous === `${card.src}-${index}` ? null : previous)), 360);
                  }}
                  className={`rounded-lg border bg-neutral-50 p-1.5 transition ${
                    isActive ? "scale-95 border-sky-400 ring-2 ring-sky-200" : "border-neutral-200 hover:border-sky-300"
                  }`}
                >
                  <img src={card.src} alt={card.alt} className="h-16 w-full object-contain" />
                  <span className="mt-1 block text-center text-xs font-semibold text-neutral-700" style={{ fontFamily: cjkFontFamily }}>
                    {card.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const stepSevenGalleryImages = [
    "/methodologies/world-around-me/lesson-1/step7/step7_1.png",
    "/methodologies/world-around-me/lesson-1/step7/step7_2.png",
    "/methodologies/world-around-me/lesson-1/step7/step7_3.png",
    "/methodologies/world-around-me/lesson-1/step7/step7_4.png",
    "/methodologies/world-around-me/lesson-1/step7/step7_5.png",
    "/methodologies/world-around-me/lesson-1/step7/step7_6.png",
    "/methodologies/world-around-me/lesson-1/step7/step7_7.png",
    "/methodologies/world-around-me/lesson-1/step7/step7_8.png",
    "/methodologies/world-around-me/lesson-1/step7/step7_9.png",
    "/methodologies/world-around-me/lesson-1/step7/step7_10.png",
  ] as const;

  function StepSevenGalleryBlock() {
    return (
      <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {stepSevenGalleryImages.map((imageRef, index) => (
            <img
              key={imageRef}
              src={imageRef}
              alt={`Шаг 7, изображение ${index + 1}`}
              className="aspect-square w-full rounded-lg border border-neutral-200 bg-white object-cover"
            />
          ))}
        </div>
      </div>
    );
  }

  function StepElevenWorkbookColoringBlock() {
    return (
      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/50 p-3">
        <div className="mt-2 w-fit overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <img
            src="/methodologies/world-around-me/lesson-1/step11/step11.png"
            alt="Раскраска для шага 11"
            className="h-auto w-48 object-contain"
          />
        </div>
      </div>
    );
  }

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
              {step.order === 3 ? <StepThreeCardPassesBlock /> : null}
              {step.order === 4 ? <StepFourActionBlock /> : null}
              {step.order === 5 ? <StepFiveGameMechanicsBlock /> : null}
              {step.order === 7 ? <StepSevenGalleryBlock /> : null}
              {step.order === 11 ? <StepElevenWorkbookColoringBlock /> : null}
              {step.resourceIds?.map((resourceId) => {
                const asset = assetsById[resourceId];
                if (!asset) return null;
                if (step.order === 1 && resourceId === "video:farm-animals") {
                  return <StepOneVideoEmbed key={`${step.id}-${resourceId}`} />;
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

const lessonFourDisplaySteps: LessonPlanDisplayStep[] = [
  {
    id: "lesson-4-step-1",
    order: 1,
    category: "Активность",
    title: "Приветствуем учеников и героев курса",
    text: "Начинаем урок с приветствия, возвращаем детей к теме цветов и показываем, что сегодня будем говорить о любимых цветах.",
    glossaryTerms: [],
    durationMinutes: 2,
  },
  {
    id: "lesson-4-step-2",
    order: 2,
    category: "Видео",
    title: "Смотрим видео «colors»",
    text: "Смотрим видео colors, вспоминаем знакомые цвета и слушаем новые. После просмотра просим детей показать или назвать цвет, который они услышали.",
    glossaryTerms: ["红色", "绿色", "蓝色", "黄色", "橘色", "黑色", "白色", "棕色"],
    durationMinutes: 3,
    resourceIds: ["video:colors"],
  },
  {
    id: "lesson-4-step-3",
    order: 3,
    category: "Лексика",
    title: "Отрабатываем фразы 我是… / 你是… / 我是谁？",
    text: "По очереди представляемся: сначала 我是… от лица преподавателя или героя. Затем, указывая на ребёнка, говорим 你是… и спрашиваем 我是谁？, помогая ответить 你是…",
    glossaryTerms: ["我是…", "你是…", "我是谁？"],
    durationMinutes: 3,
  },
  {
    id: "lesson-4-step-4",
    order: 4,
    category: "Песня",
    title: "Поём песню «farm animals»",
    text: "Поём знакомую песню, возвращаем животных из прошлых уроков и добавляем движение: дети показывают животных и включаются в ритм занятия.",
    glossaryTerms: [],
    durationMinutes: 3,
    resourceIds: ["song:farm-animals", "song-video:farm-animals-movement"],
  },
  {
    id: "lesson-4-step-5",
    order: 5,
    category: "Лексика",
    title: "Новые цвета: 橘色 / 黑色 / 白色 / 棕色",
    text: "Учим цвета с помощью карточек. Первый проход: называем только слово. Второй проход: говорим предложением, например 这是黑色。",
    glossaryTerms: ["橘色", "黑色", "白色", "棕色", "这是黑色。"],
    durationMinutes: 4,
    resourceIds: ["flashcards:world-around-me-lesson-4"],
  },
  {
    id: "lesson-4-step-6",
    order: 6,
    category: "Активность",
    title: "Игра «Что пропало?»",
    text: "Выкладываем карточки в ряд, дети закрывают глаза, преподаватель убирает одну карточку. Дети называют цвет, который пропал. Это игра 4.6 из исходного плана.",
    glossaryTerms: ["橘色", "黑色", "白色", "棕色"],
    durationMinutes: 4,
    resourceIds: ["activity:lesson-4-missing-color"],
  },
  {
    id: "lesson-4-step-7",
    order: 7,
    category: "Активность",
    title: "Сортируем предметы по цветам",
    text: "Рассыпаем по комнате разноцветные мячи или предметы. Ребёнок выбирает предмет, называет цвет и кладёт его в правильную коробку. Это игра 4.7.",
    glossaryTerms: ["绿色", "蓝色", "红色", "橘色", "黑色", "白色", "棕色"],
    durationMinutes: 4,
    resourceIds: ["activity:lesson-4-color-sorting"],
  },
  {
    id: "lesson-4-step-8",
    order: 8,
    category: "Лексика",
    title: "Грамматическая конструкция 我喜欢…",
    text: "Берём сердце из картона с клейкой лентой. Выбираем цвет и прикрепляем его на сердце, комментируя 我喜欢蓝色。 Дети по очереди выбирают цвет и говорят свою фразу.",
    glossaryTerms: ["我喜欢…", "我喜欢蓝色。", "我喜欢黑色。", "我喜欢橘色。"],
    durationMinutes: 4,
    resourceIds: ["media:lesson-4-heart"],
  },
  {
    id: "lesson-4-step-9",
    order: 9,
    category: "Активность",
    title: "Глагол 飞 и повтор действий",
    text: "Вводим 飞 и повторяем знакомые действия: 跑, 跳, 拍手, 数. Учитель показывает карточку, дети выполняют действие.",
    glossaryTerms: ["飞", "跑", "跳", "我们跳吧！"],
    durationMinutes: 3,
    resourceIds: ["media:lesson-4-action-cards"],
  },
  {
    id: "lesson-4-step-10",
    order: 10,
    category: "Лексика",
    title: "Учим слово 草地",
    text: "Показываем карточку 草地, проговариваем слово несколько раз и готовим детей к сцене с лугом и животными.",
    glossaryTerms: ["草地"],
    durationMinutes: 3,
    resourceIds: ["media:lesson-4-grassland"],
  },
  {
    id: "lesson-4-step-11",
    order: 11,
    category: "Активность",
    title: "Луг и животные: 草地上有什么动物？",
    text: "Выкладываем луг из синей, зелёной и жёлтой ткани, добавляем цветных животных из Приложения 3 и говорим: 草地上有一头蓝色的牛。",
    glossaryTerms: ["草地上有什么动物？", "草地上有一头蓝色的牛。", "草地上有黄色的猫。"],
    durationMinutes: 5,
    resourceIds: ["worksheet:appendix-3-color-animals", "media:lesson-4-grassland"],
  },
  {
    id: "lesson-4-step-12",
    order: 12,
    category: "Активность",
    title: "Приложение 4: домино цветов",
    text: "На экране иероглифы цветов и цветовые карточки. Ребёнок соединяет цвет с правильным иероглифом. Если пара неправильная, соединение не засчитывается.",
    glossaryTerms: ["橘色", "黑色", "白色", "棕色"],
    durationMinutes: 4,
    resourceIds: ["worksheet:appendix-4-color-domino"],
  },
  {
    id: "lesson-4-step-13",
    order: 13,
    category: "Счёт",
    title: "Разноцветные счёты: считаем до 5",
    text: "Показываем разноцветные счёты. Дети называют цвет ряда и считают бусины: оранжевые — 5, чёрные — 4, белые — 3, коричневые — 2.",
    glossaryTerms: ["橘色", "黑色", "白色", "棕色"],
    durationMinutes: 3,
    resourceIds: ["media:lesson-4-abacus"],
  },
  {
    id: "lesson-4-step-14",
    order: 14,
    category: "Тетрадь",
    title: "Рабочая тетрадь: страницы 7–8",
    text: "Слушаем преподавателя и раскрашиваем животных нужным цветом. После выполнения ребёнок показывает животное и называет цвет.",
    glossaryTerms: ["这是黑色。", "橘色", "黑色", "白色", "棕色"],
    durationMinutes: 4,
    resourceIds: ["worksheet:workbook-pages-7-8"],
  },
  {
    id: "lesson-4-step-15",
    order: 15,
    category: "Песня",
    title: "Поём «my favorite color is blue»",
    text: "Финальный музыкальный повтор фразы про любимый цвет. Дети слушают, поют и показывают карточку любимого цвета.",
    glossaryTerms: ["我喜欢…", "我喜欢蓝色。"],
    durationMinutes: 3,
    resourceIds: [
      "song:my-favorite-color-is-blue",
      "song-video:my-favorite-color-is-blue",
    ],
  },
  {
    id: "lesson-4-step-16",
    order: 16,
    category: "Завершение",
    title: "Прощаемся с детьми и героями курса",
    text: "Перед прощанием каждый ребёнок называет один новый цвет и одну фразу 我喜欢… Затем прощаемся с героями курса.",
    glossaryTerms: ["橘色", "黑色", "白色", "棕色", "我喜欢…"],
    durationMinutes: 2,
  },
];

const lessonFourColors = [
  { id: "orange", hanzi: "橘色", pinyin: "juse", meaning: "оранжевый", swatch: "#f97316", border: "#f97316" },
  { id: "black", hanzi: "黑色", pinyin: "heise", meaning: "чёрный", swatch: "#111111", border: "#111111" },
  { id: "white", hanzi: "白色", pinyin: "baise", meaning: "белый", swatch: "#ffffff", border: "#60a5fa" },
  { id: "brown", hanzi: "棕色", pinyin: "zongse", meaning: "коричневый", swatch: "#8b5e34", border: "#8b5e34" },
] as const;

function LessonFourColorCardsBlock() {
  return (
    <div className="mt-3 border-t border-amber-100 pt-3">
      <p className="text-xs font-bold uppercase text-amber-800">Карточки в два прохода</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        {lessonFourColors.map((color) => (
          <div key={color.id} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-center">
            <span
              className="mx-auto block h-12 w-12 rounded-full border"
              style={{
                backgroundColor: color.swatch,
                borderColor: color.border,
              }}
            />
            <p className="mt-2 text-2xl font-bold text-neutral-950" style={{ fontFamily: cjkFontFamily }}>{color.hanzi}</p>
            <p className="text-xs text-neutral-600">{color.pinyin} · {color.meaning}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-neutral-700" style={{ fontFamily: cjkFontFamily }}>
        Проход 1: 橘色 / 黑色 / 白色 / 棕色. Проход 2: 这是黑色。
      </p>
    </div>
  );
}

function LessonFourMissingColorBlock() {
  const [hiddenColorId, setHiddenColorId] = useState<string | null>("black");

  return (
    <div className="mt-3 border-t border-amber-100 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase text-amber-800">Игра 4.6 · что пропало?</p>
        <button
          type="button"
          onClick={() => {
            const currentIndex = lessonFourColors.findIndex((color) => color.id === hiddenColorId);
            const next = lessonFourColors[(currentIndex + 1) % lessonFourColors.length];
            setHiddenColorId(next?.id ?? null);
          }}
          className={productButtonClassName("secondary", "text-xs")}
        >
          Спрятать следующий цвет
        </button>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        {lessonFourColors.map((color) => {
          const hidden = color.id === hiddenColorId;
          return (
            <div
              key={color.id}
              className={`flex min-h-28 flex-col items-center justify-center rounded-xl border px-3 py-3 text-center ${
                hidden ? "border-dashed border-neutral-300 bg-neutral-100" : "border-neutral-200 bg-white"
              }`}
            >
              {hidden ? (
                <>
                  <span className="text-3xl font-black text-neutral-400">?</span>
                  <span className="mt-1 text-xs text-neutral-500">Что пропало?</span>
                </>
              ) : (
                <>
                  <span
                    className="block h-12 w-12 rounded-full border"
                  style={{ backgroundColor: color.swatch, borderColor: color.border }}
                  />
                  <span className="mt-2 text-xl font-bold text-neutral-950" style={{ fontFamily: cjkFontFamily }}>{color.hanzi}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LessonFourSortingBlock() {
  const items = [
    { label: "морковь", color: "orange" },
    { label: "ворона", color: "black" },
    { label: "снег", color: "white" },
    { label: "хлеб", color: "brown" },
  ];
  return (
    <div className="mt-3 border-t border-emerald-100 pt-3">
      <p className="text-xs font-bold uppercase text-emerald-800">Игра 4.7 · сортировка по корзинам</p>
      <div className="mt-2 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid grid-cols-2 gap-2">
          {lessonFourColors.map((color) => (
            <div key={color.id} className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
              <span
                className="mx-auto block h-10 w-10 rounded-lg border"
                style={{ backgroundColor: color.swatch, borderColor: color.border }}
              />
              <p className="mt-2 text-lg font-bold" style={{ fontFamily: cjkFontFamily }}>{color.hanzi}</p>
              <p className="text-xs text-neutral-600">корзина</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {items.map((item) => {
            const color = lessonFourColors.find((candidate) => candidate.id === item.color);
            return (
              <div key={item.label} className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3">
                <span
                  className="h-8 w-8 rounded-full border"
                  style={{ backgroundColor: color?.swatch, borderColor: color?.border }}
                />
                <span className="text-sm font-semibold text-neutral-800">{item.label} → {color?.hanzi}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LessonFourHeartBlock() {
  return (
    <div className="mt-3 grid gap-3 border-t border-rose-100 pt-3 md:grid-cols-[220px_1fr]">
      <img
        src="/methodologies/world-around-me/lesson-4/heart-color.svg"
        alt="Сердце для фразы 我喜欢"
        className="h-44 w-full object-contain"
      />
      <div className="flex flex-col justify-center">
        <p className="text-sm leading-6 text-neutral-700" style={{ fontFamily: cjkFontFamily }}>
          Учитель выбирает цвет, прикрепляет его на сердце и говорит: 我喜欢蓝色。
          Затем каждый ребёнок выбирает свой цвет и повторяет фразу.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lessonFourColors.map((color) => (
            <Chip key={color.id} tone="rose" size="sm">{color.hanzi}</Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

function LessonFourGrasslandBlock() {
  return (
    <div className="mt-3 grid gap-3 border-t border-sky-100 pt-3 md:grid-cols-[1fr_0.8fr]">
      <img
        src="/methodologies/world-around-me/lesson-4/color-animals-grassland.svg"
        alt="Цветные животные на лугу"
        className="h-56 w-full rounded-xl border border-neutral-200 bg-white object-contain"
      />
      <div className="space-y-2 text-sm leading-6 text-neutral-700" style={{ fontFamily: cjkFontFamily }}>
        <p className="font-semibold text-neutral-900">Речевой сценарий</p>
        <p>草地上有什么动物？</p>
        <p>草地上有一头蓝色的牛。</p>
        <p>草地上有黄色的猫。</p>
      </div>
    </div>
  );
}

function LessonFourDominoBlock() {
  return (
    <div className="mt-3 border-t border-violet-100 pt-3">
      <img
        src="/methodologies/world-around-me/lesson-4/color-domino.svg"
        alt="Домино цветов"
        className="h-56 w-full rounded-xl border border-neutral-200 bg-white object-contain"
      />
      <p className="mt-2 text-sm text-neutral-700">
        Интерактивная логика: сначала кликаем иероглиф, затем соответствующий цвет. Неверная пара не соединяется.
      </p>
    </div>
  );
}

function LessonFourAbacusBlock() {
  return (
    <div className="mt-3 grid gap-3 border-t border-sky-100 pt-3 md:grid-cols-[220px_1fr]">
      <img
        src="/methodologies/world-around-me/lesson-4/abacus.svg"
        alt="Разноцветные счёты"
        className="h-44 w-full object-contain"
      />
      <div className="grid grid-cols-2 gap-2">
        {[
          ["橘色", "5"],
          ["黑色", "4"],
          ["白色", "3"],
          ["棕色", "2"],
        ].map(([label, count]) => (
          <div key={label} className="border-l-2 border-sky-200 pl-3">
            <p className="text-xl font-bold" style={{ fontFamily: cjkFontFamily }}>{label}</p>
            <p className="text-sm text-neutral-600">считаем до {count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LessonFourWorkbookBlock() {
  return (
    <div className="mt-3 border-t border-rose-100 pt-3">
      <img
        src="/methodologies/world-around-me/lesson-4/workbook-pages-7-8.svg"
        alt="Рабочая тетрадь страницы 7-8"
        className="h-56 w-full rounded-xl border border-neutral-200 bg-white object-contain"
      />
      <p className="mt-2 text-sm text-neutral-700">
        Учитель называет цвет, ребёнок раскрашивает животное и произносит цвет или короткую фразу.
      </p>
    </div>
  );
}

function LessonFourCustomBlock({ order }: { order: number }) {
  if (order === 5) return <LessonFourColorCardsBlock />;
  if (order === 6) return <LessonFourMissingColorBlock />;
  if (order === 7) return <LessonFourSortingBlock />;
  if (order === 8) return <LessonFourHeartBlock />;
  if (order === 11) return <LessonFourGrasslandBlock />;
  if (order === 12) return <LessonFourDominoBlock />;
  if (order === 13) return <LessonFourAbacusBlock />;
  if (order === 14) return <LessonFourWorkbookBlock />;
  return null;
}

function LessonFourPlan({
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
          <p className="text-sm leading-6 text-neutral-700" style={{ fontFamily: cjkFontFamily }}>
            Урок знакомит детей с новыми цветами через видео, карточки, игры и песню.
            Дети повторяют животных, добавляют глагол 飞, строят фразы 我喜欢… и 草地上有…
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

        <CollapsibleCard title="Карточки" icon={FileText} defaultOpen={false}>
          <GlossaryChips compactTop terms={["橘色", "黑色", "白色", "棕色", "草地", "我喜欢…", "有", "飞"]} />
          {assetsById["flashcards:world-around-me-lesson-4"] ? (
            <LessonPlanResourcePreview
              asset={assetsById["flashcards:world-around-me-lesson-4"]}
              mode="single-slide"
            />
          ) : null}
        </CollapsibleCard>

        <CollapsibleCard
          title="Новые слова и фразы"
          icon={Languages}
          defaultOpen={false}
          contentClassName="pt-1"
        >
          <GlossaryChips compactTop terms={["橘色", "黑色", "白色", "棕色", "草地", "我喜欢…", "有", "飞", "草地上有什么动物？"]} />
        </CollapsibleCard>

        <CollapsibleCard title="Реквизит" icon={Package} defaultOpen={false}>
          <ul className="space-y-1 text-sm leading-6 text-neutral-700">
            <li>Активность 1: герои курса</li>
            <li>Активность 3: герои курса</li>
            <li>Активность 5: карточки 橘色，黑色，白色，棕色</li>
            <li>Активность 6: карточки 橘色，黑色，白色，棕色 / игра 4.6</li>
            <li>Активность 7: разноцветные мячи, коробки для сортировки / игра 4.7</li>
            <li>Активность 8: сердце из картона, клейкая лента, карточки цветов</li>
            <li>Активность 10: карточка 草地</li>
            <li>Активность 11: синяя, зелёная и жёлтая ткани, Приложение 3</li>
            <li>Активность 12: Приложение 4, домино цветов</li>
            <li>Активность 13: разноцветные счёты</li>
            <li>Активность 14: рабочая тетрадь, страницы 7–8</li>
            <li>Активность 16: герои курса</li>
          </ul>
        </CollapsibleCard>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold text-neutral-950">Структура урока</h2>
          <Chip tone="sky" icon={Timer} className="whitespace-nowrap">45 минут</Chip>
          <Chip tone="neutral" icon={Workflow} className="whitespace-nowrap">16 шагов</Chip>
        </div>

        <div className="space-y-3">
          {lessonFourDisplaySteps.map((step) => (
            <article key={step.id} className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-[0_8px_28px_rgba(20,20,20,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip size="sm" tone="inverse">Шаг {step.order}</Chip>
                  <Chip size="sm" tone={categoryChipByLabel[step.category].tone} icon={categoryChipByLabel[step.category].icon}>
                    {step.category}
                  </Chip>
                  <Chip size="sm" tone="sky" icon={Timer} className="whitespace-nowrap">
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
              <p className="mt-2 text-sm leading-6 text-neutral-700" style={{ fontFamily: cjkFontFamily }}>{step.text}</p>
              <GlossaryChips terms={step.glossaryTerms} />
              <LessonFourCustomBlock order={step.order} />
              {step.resourceIds?.map((resourceId) => {
                const asset = assetsById[resourceId];
                if (!asset) return null;
                return (
                  <LessonPlanResourcePreview
                    key={`${step.id}-${resourceId}`}
                    asset={asset}
                    mode={asset.kind === "flashcards_pdf" ? "single-slide" : "default"}
                  />
                );
              })}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

const lessonFiveDisplaySteps: LessonPlanDisplayStep[] = [
  {
    id: "lesson-5-step-1",
    order: 1,
    category: "Активность",
    title: "Приветствие детей и героев курса",
    text: "Начинаем урок с Сяо Лоном и Сяо Мей, объявляем тему природы и показываем, что сегодня будем собирать луг из цветов, деревьев и травы.",
    glossaryTerms: ["你好", "花", "树", "草地"],
    durationMinutes: 2,
    resourceIds: ["presentation:world-around-me-lesson-5", "media:lesson-5-heroes"],
  },
  {
    id: "lesson-5-step-2",
    order: 2,
    category: "Видео",
    title: "Смотрим видео и входим в тему природы",
    text: "Короткий видеовход помогает вспомнить цвета перед фразами про цветы. После просмотра спрашиваем, какого цвета может быть 花.",
    glossaryTerms: ["颜色", "花"],
    durationMinutes: 3,
    resourceIds: ["video:colors"],
  },
  {
    id: "lesson-5-step-3",
    order: 3,
    category: "Лексика",
    title: "Проверяем настроение: 我很好 / 我不好",
    text: "Показываем два состояния через смайлы и жесты, затем каждый ребёнок выбирает короткую фразу про себя.",
    glossaryTerms: ["我很好", "我不好"],
    durationMinutes: 3,
  },
  {
    id: "lesson-5-step-4",
    order: 4,
    category: "Песня",
    title: "Песня-ритуал перед новыми словами",
    text: "Поём короткий знакомый фрагмент или открываем песню по ссылке из презентации, чтобы собрать внимание перед карточками.",
    glossaryTerms: [],
    durationMinutes: 3,
    resourceIds: ["song:hello"],
  },
  {
    id: "lesson-5-step-5",
    order: 5,
    category: "Лексика",
    title: "Слово 花",
    text: "Вводим 花 через крупную карточку и озвучку. Дети показывают цветок на слайде и повторяют слово.",
    glossaryTerms: ["花"],
    durationMinutes: 3,
    resourceIds: ["flashcards:world-around-me-lesson-5", "pronunciation:lesson-5-flower"],
  },
  {
    id: "lesson-5-step-6",
    order: 6,
    category: "Лексика",
    title: "Слово 树",
    text: "Показываем дерево, произносим 树 и добавляем жест высокого дерева.",
    glossaryTerms: ["树"],
    durationMinutes: 3,
    resourceIds: ["flashcards:world-around-me-lesson-5", "media:lesson-5-tree"],
  },
  {
    id: "lesson-5-step-7",
    order: 7,
    category: "Лексика",
    title: "Слово 草",
    text: "Показываем траву, произносим 草 и телесно противопоставляем низкую траву высокому дереву.",
    glossaryTerms: ["草"],
    durationMinutes: 3,
    resourceIds: ["flashcards:world-around-me-lesson-5", "media:lesson-5-grass"],
  },
  {
    id: "lesson-5-step-8",
    order: 8,
    category: "Лексика",
    title: "Слово 草地",
    text: "Показываем весь луг и собираем значение из 草 + 地: место с травой.",
    glossaryTerms: ["草地"],
    durationMinutes: 3,
    resourceIds: ["flashcards:world-around-me-lesson-5", "media:lesson-5-grassland"],
  },
  {
    id: "lesson-5-step-9",
    order: 9,
    category: "Активность",
    title: "Игра «Колесо слов»",
    text: "Крутим колесо, останавливаем его и просим ребёнка назвать выпавшее слово: 花, 树, 草 или 草地.",
    glossaryTerms: ["花", "树", "草", "草地"],
    durationMinutes: 4,
    resourceIds: ["activity:lesson-5-wheel"],
  },
  {
    id: "lesson-5-step-10",
    order: 10,
    category: "Активность",
    title: "Приложение 3: карточки растений",
    text: "Закрепляем карточки растений: выбираем картинку, называем слово и сопоставляем картинку с иероглифом.",
    glossaryTerms: ["花", "树", "草", "草地"],
    durationMinutes: 4,
    resourceIds: ["activity:lesson-5-plant-cards"],
  },
  {
    id: "lesson-5-step-11",
    order: 11,
    category: "Лексика",
    title: "Конструкция 我喜欢…的花",
    text: "Выбираем цветок и расширяем фразу о любимом цвете: 我喜欢蓝色的花。",
    glossaryTerms: ["我喜欢蓝色的花。", "我喜欢红色的花。", "我喜欢黄色的花。", "我喜欢绿色的花。"],
    durationMinutes: 4,
    resourceIds: ["worksheet:lesson-5-favorite-flowers"],
  },
  {
    id: "lesson-5-step-12",
    order: 12,
    category: "Активность",
    title: "Действия: 飞 / 跑 / 跳 / 拍手 / 数",
    text: "Повторяем действия на карточках и выполняем их всей группой. Завершаем словом 数 как мостиком к счёту.",
    glossaryTerms: ["飞", "跑", "跳", "拍手", "数"],
    durationMinutes: 4,
    resourceIds: ["worksheet:lesson-5-actions"],
  },
  {
    id: "lesson-5-step-13",
    order: 13,
    category: "Активность",
    title: "Сцена 草地: что есть на лугу?",
    text: "Показываем луг, добавляем цветы, деревья и траву. Задаём вопрос 草地上有什么？ и принимаем ответ одним словом или короткой фразой.",
    glossaryTerms: ["草地上有什么？", "草地上有花。", "草地上有树。", "草地上有草。"],
    durationMinutes: 4,
    resourceIds: ["media:lesson-5-grassland", "media:lesson-5-flower", "media:lesson-5-tree", "media:lesson-5-grass"],
  },
  {
    id: "lesson-5-step-14",
    order: 14,
    category: "Счёт",
    title: "Считаем цветы, деревья и траву",
    text: "Открываем Приложение 6 и считаем группы объектов на лугу: цветы, деревья и траву.",
    glossaryTerms: ["花", "树", "草", "数"],
    durationMinutes: 4,
    resourceIds: ["worksheet:lesson-5-meadow-count", "media:lesson-5-count-hands"],
  },
  {
    id: "lesson-5-step-15",
    order: 15,
    category: "Тетрадь",
    title: "Создаём и раскрашиваем луг",
    text: "Переходим к творческому заданию: ребёнок выбирает элементы, раскрашивает и называет 花, 树, 草, 草地.",
    glossaryTerms: ["花", "树", "草", "草地"],
    durationMinutes: 5,
    resourceIds: ["worksheet:lesson-5-flower-coloring", "worksheet:lesson-5-homework-meadow"],
  },
  {
    id: "lesson-5-step-16",
    order: 16,
    category: "Завершение",
    title: "Песня, прощание и домашняя миссия",
    text: "Финальная песня, быстрый recap слов урока и показ домашней миссии: создать свой луг.",
    glossaryTerms: ["花", "树", "草", "草地", "再见！"],
    durationMinutes: 3,
    resourceIds: ["song:my-favorite-color-is-blue", "song-video:my-favorite-color-is-blue", "worksheet:lesson-5-homework"],
  },
];

const lessonFivePlants = [
  { id: "flower", hanzi: "花", pinyin: "huā", meaning: "цветок", src: "/methodologies/world-around-me/lesson-5/assets/flower-purple.png" },
  { id: "tree", hanzi: "树", pinyin: "shù", meaning: "дерево", src: "/methodologies/world-around-me/lesson-5/assets/tree.png" },
  { id: "grass", hanzi: "草", pinyin: "cǎo", meaning: "трава", src: "/methodologies/world-around-me/lesson-5/assets/grass.png" },
  { id: "grassland", hanzi: "草地", pinyin: "cǎodì", meaning: "луг / поле", src: "/methodologies/world-around-me/lesson-5/assets/meadow-bg.jpeg" },
] as const;

function LessonFivePlantCardsBlock() {
  return (
    <div className="mt-3 border-t border-emerald-100 pt-3">
      <p className="text-xs font-bold uppercase text-emerald-800">Карточки растений</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        {lessonFivePlants.map((plant) => (
          <div key={plant.id} className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
            <img src={plant.src} alt={plant.meaning} className="mx-auto h-24 w-full object-contain" />
            <p className="mt-2 text-3xl font-bold text-neutral-950" style={{ fontFamily: cjkFontFamily }}>{plant.hanzi}</p>
            <p className="text-xs text-neutral-600">{plant.pinyin} · {plant.meaning}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LessonFiveWheelBlock() {
  return (
    <div className="mt-3 grid gap-3 border-t border-violet-100 pt-3 md:grid-cols-[220px_1fr]">
      <img
        src="/methodologies/world-around-me/lesson-5/appendices/appendix-2-page-01.png"
        alt="Колесо слов урока 5"
        className="h-44 w-full rounded-xl border border-neutral-200 bg-white object-contain"
      />
      <div className="flex flex-col justify-center text-sm leading-6 text-neutral-700">
        <p className="font-semibold text-neutral-900">Механика</p>
        <p>Крутим колесо, останавливаем и называем выпавшее слово без русской подсказки.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lessonFivePlants.map((plant) => (
            <Chip key={plant.id} tone="violet" size="sm">{plant.hanzi}</Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

function LessonFiveFavoriteFlowerBlock() {
  return (
    <div className="mt-3 grid gap-3 border-t border-rose-100 pt-3 md:grid-cols-[220px_1fr]">
      <img
        src="/methodologies/world-around-me/lesson-5/assets/colored-flowers.png"
        alt="Цветные цветы"
        className="h-44 w-full object-contain"
      />
      <div className="space-y-2 text-sm leading-6 text-neutral-700" style={{ fontFamily: cjkFontFamily }}>
        <p className="font-semibold text-neutral-900">Фраза</p>
        <p>我喜欢蓝色的花。</p>
        <p>我喜欢红色的花。</p>
        <p>Меняем цвет, но сохраняем модель 我喜欢…的花。</p>
      </div>
    </div>
  );
}

function LessonFiveActionsBlock() {
  return (
    <div className="mt-3 border-t border-emerald-100 pt-3">
      <p className="text-xs font-bold uppercase text-emerald-800">Действия урока</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-5">
        {["飞", "跑", "跳", "拍手", "数"].map((action, index) => (
          <div key={action} className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
            <img
              src={`/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-${String(index + 13).padStart(2, "0")}.png`}
              alt={action}
              className="h-24 w-full object-contain"
            />
            <p className="mt-2 text-2xl font-bold" style={{ fontFamily: cjkFontFamily }}>{action}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LessonFiveMeadowBlock() {
  return (
    <div className="mt-3 grid gap-3 border-t border-sky-100 pt-3 md:grid-cols-[1fr_0.8fr]">
      <img
        src="/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-19.png"
        alt="Цветы на лугу"
        className="h-56 w-full rounded-xl border border-neutral-200 bg-white object-contain"
      />
      <div className="space-y-2 text-sm leading-6 text-neutral-700" style={{ fontFamily: cjkFontFamily }}>
        <p className="font-semibold text-neutral-900">Речевой сценарий</p>
        <p>草地上有什么？</p>
        <p>草地上有花。</p>
        <p>草地上有树。</p>
      </div>
    </div>
  );
}

function LessonFiveCountingBlock() {
  return (
    <div className="mt-3 border-t border-sky-100 pt-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          ["花", "10", "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-22.png"],
          ["树", "10", "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-23.png"],
          ["草", "10", "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-24.png"],
        ].map(([label, count, src]) => (
          <div key={label} className="rounded-xl border border-neutral-200 bg-white p-3">
            <img src={src} alt={`${label} count`} className="h-28 w-full object-contain" />
            <p className="mt-2 text-xl font-bold" style={{ fontFamily: cjkFontFamily }}>{label} · {count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LessonFiveCreativeBlock() {
  return (
    <div className="mt-3 grid gap-3 border-t border-emerald-100 pt-3 md:grid-cols-2">
      <img
        src="/methodologies/world-around-me/lesson-5/appendices/appendix-7-page-01.png"
        alt="Раскраска цветка"
        className="h-56 w-full rounded-xl border border-neutral-200 bg-white object-contain"
      />
      <img
        src="/methodologies/world-around-me/lesson-5/appendices/appendix-8-page-01.png"
        alt="Домашний луг"
        className="h-56 w-full rounded-xl border border-neutral-200 bg-white object-contain"
      />
    </div>
  );
}

function LessonFiveCustomBlock({ order }: { order: number }) {
  if ([5, 6, 7, 8, 10].includes(order)) return <LessonFivePlantCardsBlock />;
  if (order === 9) return <LessonFiveWheelBlock />;
  if (order === 11) return <LessonFiveFavoriteFlowerBlock />;
  if (order === 12) return <LessonFiveActionsBlock />;
  if (order === 13) return <LessonFiveMeadowBlock />;
  if (order === 14) return <LessonFiveCountingBlock />;
  if (order === 15) return <LessonFiveCreativeBlock />;
  return null;
}

function LessonFivePlan({
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
          <p className="text-sm leading-6 text-neutral-700" style={{ fontFamily: cjkFontFamily }}>
            Урок знакомит детей с 花, 树, 草 и 草地. Дети повторяют настроение,
            любимый цветок, действия и счёт, а в конце собирают собственный луг.
          </p>
        </CollapsibleCard>

        {lessonNotesSlot ? (
          <CollapsibleCard title="Заметки к уроку" icon={NotebookPen} defaultOpen={false} contentClassName="pt-1">
            {lessonNotesSlot}
          </CollapsibleCard>
        ) : null}

        <CollapsibleCard title="Материалы" icon={FileText} defaultOpen={false}>
          <GlossaryChips compactTop terms={["花", "树", "草", "草地", "我很好", "我不好", "我喜欢蓝色的花。"]} />
          {assetsById["presentation:world-around-me-lesson-5"] ? (
            <LessonPlanResourcePreview
              asset={assetsById["presentation:world-around-me-lesson-5"]}
              mode="single-slide"
            />
          ) : null}
        </CollapsibleCard>

        <CollapsibleCard title="Реквизит" icon={Package} defaultOpen={false}>
          <ul className="space-y-1 text-sm leading-6 text-neutral-700">
            <li>Презентация урока 5 и экран для демонстрации.</li>
            <li>Приложение 1: карточки 花、树、草、草地.</li>
            <li>Приложение 2: колесо слов.</li>
            <li>Приложение 3: карточки растений.</li>
            <li>Приложения 4-6: цветы, действия и счёт на лугу.</li>
            <li>Приложения 7-8: раскраска, вырезание, клей и карандаши.</li>
          </ul>
        </CollapsibleCard>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold text-neutral-950">Структура урока</h2>
          <Chip tone="sky" icon={Timer} className="whitespace-nowrap">45 минут</Chip>
          <Chip tone="neutral" icon={Workflow} className="whitespace-nowrap">16 шагов</Chip>
        </div>

        <div className="space-y-3">
          {lessonFiveDisplaySteps.map((step) => (
            <article key={step.id} className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-[0_8px_28px_rgba(20,20,20,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip size="sm" tone="inverse">Шаг {step.order}</Chip>
                  <Chip size="sm" tone={categoryChipByLabel[step.category].tone} icon={categoryChipByLabel[step.category].icon}>
                    {step.category}
                  </Chip>
                  <Chip size="sm" tone="sky" icon={Timer} className="whitespace-nowrap">
                    {step.durationMinutes ?? steps.find((source) => source.order === step.order)?.durationMinutes ?? 3} мин
                  </Chip>
                </div>
                {onShowOnStudentScreen ? (
                  <button
                    type="button"
                    onClick={() => {
                      const sourceStep = steps.find((source) => source.order === step.order);
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
              <p className="mt-2 text-sm leading-6 text-neutral-700" style={{ fontFamily: cjkFontFamily }}>{step.text}</p>
              <GlossaryChips terms={step.glossaryTerms} />
              <LessonFiveCustomBlock order={step.order} />
              {step.resourceIds?.map((resourceId) => {
                const asset = assetsById[resourceId];
                if (!asset) return null;
                return (
                  <LessonPlanResourcePreview
                    key={`${step.id}-${resourceId}`}
                    asset={asset}
                    mode={asset.kind === "flashcards_pdf" || asset.kind === "presentation" ? "single-slide" : "default"}
                  />
                );
              })}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function normalizePlanItems(items: Array<string | null | undefined> | undefined) {
  return Array.from(
    new Set(
      (items ?? [])
        .map((item) => item?.trim() ?? "")
        .filter(Boolean),
    ),
  );
}

function PlanDetailList({
  title,
  items,
}: {
  title: string;
  items: Array<string | null | undefined> | undefined;
}) {
  const normalized = normalizePlanItems(items);
  if (!normalized.length) return null;

  return (
    <div className="border-l-2 border-neutral-200 pl-3">
      <p className="text-xs font-bold uppercase text-neutral-500">{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm leading-6 text-neutral-700">
        {normalized.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" aria-hidden="true" />
            <span className="whitespace-pre-line" style={{ fontFamily: cjkFontFamily }}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GenericStepResources({
  resourceIds,
  assetsById,
}: {
  resourceIds: string[] | undefined;
  assetsById: Record<string, ReusableAsset>;
}) {
  const assets = normalizePlanItems(resourceIds)
    .map((assetId) => assetsById[assetId])
    .filter((asset): asset is ReusableAsset => Boolean(asset));
  if (!assets.length) return null;

  return (
    <div className="mt-3 border-t border-sky-100 pt-3">
      <p className="text-xs font-bold uppercase text-sky-800">Материалы шага</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {assets.map((asset) => {
          const href = asset.fileRef ?? asset.sourceUrl;
          if (!href) return null;
          return (
            <a
              key={asset.id}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-900"
            >
              {openLabel(asset)}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function GenericPlan({
  quickSummary,
  steps,
  durationLabel,
  summaryNote,
  lessonNotesSlot,
  assetsById = {},
  onShowOnStudentScreen,
}: Pick<
  Props,
  | "quickSummary"
  | "steps"
  | "durationLabel"
  | "summaryNote"
  | "lessonNotesSlot"
  | "assetsById"
  | "onShowOnStudentScreen"
>) {
  return (
    <section className="space-y-6" aria-label="План урока">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="text-base font-semibold text-neutral-950">Кратко об уроке</h2>
        <p className="mt-2 text-sm text-neutral-700">{durationLabel ?? "45 минут"} · {steps.length} шагов</p>
        {summaryNote ? (
          <p className="mt-2 text-sm leading-6 text-neutral-700">{summaryNote}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {quickSummary.keyWords.map((word) => <Chip key={word} tone="sky">{word}</Chip>)}
          {quickSummary.keyPhrases.map((phrase) => <Chip key={phrase} tone="violet">{phrase}</Chip>)}
        </div>
      </section>
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
      {quickSummary.prepChecklist.length ? (
        <CollapsibleCard title="Реквизит" icon={Package} defaultOpen={false}>
          <ul className="space-y-1 text-sm leading-6 text-neutral-700">
            {quickSummary.prepChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CollapsibleCard>
      ) : null}
      <section className="space-y-3">
        {steps.map((step) => {
          const showGoal =
            step.teacher.goal &&
            step.teacher.goal !== step.teacher.description
              ? [step.teacher.goal]
              : [];

          return (
            <article
              key={step.id}
              className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-[0_8px_28px_rgba(20,20,20,0.04)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip size="sm" tone="inverse">Шаг {step.order}</Chip>
                  {step.durationMinutes ? (
                    <Chip size="sm" tone="sky" icon={Timer} className="whitespace-nowrap">
                      {step.durationMinutes} мин
                    </Chip>
                  ) : null}
                </div>
                {onShowOnStudentScreen ? (
                  <button
                    type="button"
                    onClick={() => onShowOnStudentScreen(step.id)}
                    className={productButtonClassName("secondary", "text-sm whitespace-nowrap")}
                  >
                    <MonitorUp className="h-4 w-4" aria-hidden="true" />
                    На экран
                  </button>
                ) : null}
              </div>
              <h3 className="mt-2 text-lg font-semibold text-neutral-950" style={{ fontFamily: cjkFontFamily }}>
                {step.title}
              </h3>
              {step.teacher.description ? (
                <p className="mt-2 text-sm leading-6 text-neutral-700" style={{ fontFamily: cjkFontFamily }}>
                  {step.teacher.description}
                </p>
              ) : null}
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <PlanDetailList title="Цель" items={showGoal} />
                <PlanDetailList title="Действия преподавателя" items={step.teacher.teacherActions} />
                <PlanDetailList title="Действия детей" items={step.teacher.studentActions} />
                <PlanDetailList title="Речевые модели" items={step.teacher.teacherScript} />
                <PlanDetailList title="Ожидаемые ответы" items={step.teacher.expectedResponses} />
                <PlanDetailList title="Критерии успеха" items={step.teacher.successCriteria} />
                <PlanDetailList title="Материалы" items={step.teacher.materials} />
                <PlanDetailList title="Методические заметки" items={step.teacher.notes} />
              </div>
              <GenericStepResources
                resourceIds={step.resourceIds}
                assetsById={assetsById}
              />
            </article>
          );
        })}
      </section>
    </section>
  );
}

export function TeacherLessonPedagogicalContent({
  quickSummary,
  steps,
  durationLabel,
  summaryNote,
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

  if (isLessonFourPlan(lessonIdentity)) {
    return (
      <LessonFourPlan
        assetsById={assetsById}
        lessonNotesSlot={lessonNotesSlot}
        steps={steps}
        onShowOnStudentScreen={onShowOnStudentScreen}
      />
    );
  }

  if (isLessonFivePlan(lessonIdentity)) {
    return (
      <LessonFivePlan
        assetsById={assetsById}
        lessonNotesSlot={lessonNotesSlot}
        steps={steps}
        onShowOnStudentScreen={onShowOnStudentScreen}
      />
    );
  }

  return (
    <GenericPlan
      quickSummary={quickSummary}
      steps={steps}
      durationLabel={durationLabel}
      summaryNote={summaryNote}
      lessonNotesSlot={lessonNotesSlot}
      assetsById={assetsById}
      onShowOnStudentScreen={onShowOnStudentScreen}
    />
  );
}
