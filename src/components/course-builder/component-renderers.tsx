"use client";

import Image from "next/image";
import {
  Fragment,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import type { LessonComponent } from "@/modules/course-builder/domain";
import {
  componentRegistry,
  componentTypeKeys,
  findComponentDefinition,
  type ComponentPlacement,
  type ComponentTypeKey,
} from "@/modules/course-builder/registry/contracts";

export type CourseComponentRenderMode = "teacher" | "student";

export type SignedCourseComponentAsset = {
  id: string;
  originalFilename: string;
  mimeType: string;
  signedUrl: string | null;
};

export type SignedCourseComponentAssetMap = Readonly<
  Record<string, SignedCourseComponentAsset>
>;

export type CourseComponentRendererComponent = Pick<
  LessonComponent,
  "id" | "typeKey" | "payload" | "placement"
>;

export type CourseComponentRendererProps = {
  component: CourseComponentRendererComponent;
  assets: SignedCourseComponentAssetMap;
  mode: CourseComponentRenderMode;
};

type RegisteredRendererProps = CourseComponentRendererProps;

function widthClass(
  width: "content" | "wide" | "full",
  mode: CourseComponentRenderMode,
) {
  const alignment = mode === "teacher" ? "" : "mx-auto ";
  if (width === "content") return `${alignment}w-full max-w-3xl`;
  if (width === "wide") return `${alignment}w-full max-w-5xl`;
  return "w-full";
}

function textAlignClass(align: "start" | "center" | "end") {
  if (align === "center") return "text-center";
  if (align === "end") return "text-right";
  return "text-left";
}

function blockAlignClass(align: "start" | "center" | "end" | "stretch") {
  if (align === "center") return "mx-auto";
  if (align === "end") return "ml-auto";
  if (align === "stretch") return "w-full";
  return "mr-auto";
}

function safeSignedUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function safeHttpsUrl(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeAnswer(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU");
}

function deterministicOrder<T>(items: readonly T[], shuffle: boolean) {
  return shuffle ? [...items].reverse() : [...items];
}

function resolveAsset(
  assets: SignedCourseComponentAssetMap,
  storedFileId: string | null,
) {
  if (!storedFileId) return null;
  const asset = assets[storedFileId];
  const signedUrl = safeSignedUrl(asset?.signedUrl);
  return asset && signedUrl ? { ...asset, signedUrl } : null;
}

function UnavailableAsset({ kind }: { kind: "image" | "file" }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-8 text-center text-sm text-neutral-600">
      {kind === "image"
        ? "Изображение пока не прикреплено или недоступно."
        : "Файл пока не прикреплён или недоступен."}
    </div>
  );
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const chunks = text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g);

  return chunks.map((chunk, index) => {
    const key = `${keyPrefix}-${index}`;
    if (chunk.startsWith("**") && chunk.endsWith("**")) {
      return <strong key={key}>{chunk.slice(2, -2)}</strong>;
    }
    if (chunk.startsWith("`") && chunk.endsWith("`")) {
      return (
        <code
          key={key}
          className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[0.92em]"
        >
          {chunk.slice(1, -1)}
        </code>
      );
    }
    if (chunk.startsWith("*") && chunk.endsWith("*")) {
      return <em key={key}>{chunk.slice(1, -1)}</em>;
    }
    return <Fragment key={key}>{chunk}</Fragment>;
  });
}

function SafeRichText({ content }: { content: string }) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3 text-base leading-7 text-neutral-800">
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p key={`paragraph-${paragraphIndex}`}>
          {paragraph.split("\n").map((line, lineIndex) => (
            <Fragment key={`line-${paragraphIndex}-${lineIndex}`}>
              {lineIndex > 0 ? <br /> : null}
              {renderInlineMarkdown(
                line,
                `inline-${paragraphIndex}-${lineIndex}`,
              )}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}

function HeadingRenderer({ component, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.heading.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.heading.placementSchema.parse(
    component.placement,
  );
  const Tag = payload.level;

  return (
    <Tag
      className={`${widthClass(placement.width, mode)} ${textAlignClass(placement.textAlign)} text-2xl font-black tracking-tight text-neutral-950 md:text-3xl`}
    >
      {payload.text}
    </Tag>
  );
}

function RichTextRenderer({ component, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.rich_text.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.rich_text.placementSchema.parse(
    component.placement,
  );

  return (
    <div
      className={`${widthClass(placement.width, mode)} ${textAlignClass(placement.textAlign)} grid gap-3`}
    >
      {payload.title ? (
        <p className="text-xl font-semibold leading-tight tracking-tight text-neutral-950">
          {payload.title}
        </p>
      ) : null}
      <SafeRichText content={payload.content} />
    </div>
  );
}

const calloutToneClass = {
  neutral: "border-neutral-200 bg-neutral-50 text-neutral-800",
  info: "border-sky-200 bg-sky-50 text-sky-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
} as const;

function CalloutRenderer({ component, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.callout.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.callout.placementSchema.parse(
    component.placement,
  );

  return (
    <aside
      className={`${widthClass(placement.width, mode)} ${calloutToneClass[payload.tone]} rounded-2xl border px-5 py-4 ${placement.emphasis === "strong" ? "shadow-sm" : ""}`}
    >
      {payload.title ? (
        <p className="font-bold text-current">{payload.title}</p>
      ) : null}
      <p className={payload.title ? "mt-1.5 leading-6" : "leading-6"}>
        {payload.text}
      </p>
    </aside>
  );
}

function QuoteRenderer({ component, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.quote.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.quote.placementSchema.parse(
    component.placement,
  );

  return (
    <blockquote
      className={`${widthClass(placement.width, mode)} ${textAlignClass(placement.textAlign)} border-l-4 border-violet-300 bg-violet-50/60 px-5 py-4 text-lg italic leading-7 text-neutral-800`}
    >
      <p>«{payload.text}»</p>
      {payload.attribution ? (
        <footer className="mt-2 text-sm not-italic text-neutral-600">
          — {payload.attribution}
        </footer>
      ) : null}
    </blockquote>
  );
}

const aspectRatioClass = {
  square: "aspect-square",
  "4:3": "aspect-[4/3]",
  "16:9": "aspect-video",
} as const;

function SignedImage({
  src,
  alt,
  placement,
}: {
  src: string;
  alt: string;
  placement: ComponentPlacement<"image">;
}) {
  const objectClass =
    placement.fit === "cover" ? "object-cover" : "object-contain";

  if (placement.aspectRatio === "auto") {
    return (
      <Image
        unoptimized
        src={src}
        alt={alt}
        width={1600}
        height={900}
        sizes="(max-width: 768px) 100vw, 960px"
        className={`h-auto w-full rounded-2xl bg-neutral-100 ${objectClass}`}
      />
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-neutral-100 ${aspectRatioClass[placement.aspectRatio]}`}
    >
      <Image
        unoptimized
        fill
        src={src}
        alt={alt}
        sizes="(max-width: 768px) 100vw, 960px"
        className={objectClass}
      />
    </div>
  );
}

function ImageRenderer({ component, assets, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.image.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.image.placementSchema.parse(
    component.placement,
  );
  const asset = resolveAsset(assets, payload.storedFileId);

  return (
    <figure
      className={`${widthClass(placement.width, mode)} ${blockAlignClass(placement.align)}`}
    >
      {asset ? (
        <SignedImage
          src={asset.signedUrl}
          alt={payload.alt}
          placement={placement}
        />
      ) : (
        <UnavailableAsset kind="image" />
      )}
      {payload.caption ? (
        <figcaption className="mt-2 text-center text-sm text-neutral-600">
          {payload.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function UnavailableRemoteMedia({ kind }: { kind: "video" | "audio" }) {
  return (
    <div
      className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-8 text-center text-sm text-neutral-600"
      role="status"
    >
      {kind === "video"
        ? "Видео недоступно: нужна защищённая ссылка HTTPS."
        : "Аудио недоступно: нужна защищённая ссылка HTTPS."}
    </div>
  );
}

function VideoRenderer({ component, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.video.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.video.placementSchema.parse(
    component.placement,
  );
  const sourceUrl = safeHttpsUrl(payload.url);
  const captionsUrl = safeHttpsUrl(payload.captionsUrl);
  const objectClass =
    placement.fit === "cover" ? "object-cover" : "object-contain";
  const ratioClass =
    placement.aspectRatio === "auto"
      ? "max-h-[70vh]"
      : aspectRatioClass[placement.aspectRatio];

  return (
    <figure
      className={`${widthClass(placement.width, mode)} ${blockAlignClass(placement.align)}`}
    >
      {payload.title ? (
        <p className="mb-2 font-bold text-neutral-950">{payload.title}</p>
      ) : null}
      {sourceUrl ? (
        <video
          controls
          playsInline
          preload="metadata"
          className={`w-full rounded-2xl bg-black ${ratioClass} ${objectClass}`}
        >
          <source src={sourceUrl} />
          {captionsUrl ? (
            <track
              default
              kind="captions"
              src={captionsUrl}
              srcLang="ru"
              label="Субтитры"
            />
          ) : null}
          Ваш браузер не поддерживает воспроизведение видео.
        </video>
      ) : (
        <UnavailableRemoteMedia kind="video" />
      )}
      {payload.caption ? (
        <figcaption className="mt-2 text-center text-sm text-neutral-600">
          {payload.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function AudioRenderer({ component, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.audio.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.audio.placementSchema.parse(
    component.placement,
  );
  const sourceUrl = safeHttpsUrl(payload.url);
  const [showTranscript, setShowTranscript] = useState(
    payload.showTranscriptByDefault,
  );

  return (
    <section
      className={`${widthClass(placement.width, mode)} rounded-2xl border border-neutral-200 bg-white ${placement.compact ? "p-4" : "p-5"}`}
      aria-label={`Аудио: ${payload.title}`}
    >
      <h3 className="font-bold text-neutral-950">{payload.title}</h3>
      <div className="mt-3">
        {sourceUrl ? (
          <audio controls preload="metadata" className="w-full">
            <source src={sourceUrl} />
            Ваш браузер не поддерживает воспроизведение аудио.
          </audio>
        ) : (
          <UnavailableRemoteMedia kind="audio" />
        )}
      </div>
      {payload.transcript ? (
        <div className="mt-3">
          <button
            type="button"
            aria-expanded={showTranscript}
            onClick={() => setShowTranscript((current) => !current)}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700"
          >
            {showTranscript ? "Скрыть расшифровку" : "Показать расшифровку"}
          </button>
          {showTranscript ? (
            <div className="mt-3 rounded-xl bg-neutral-50 px-4 py-3 text-sm leading-6 whitespace-pre-wrap text-neutral-700">
              {payload.transcript}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function SlideshowRenderer({
  component,
  assets,
  mode,
}: RegisteredRendererProps) {
  const payload = componentRegistry.slideshow.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.slideshow.placementSchema.parse(
    component.placement,
  );
  const [requestedIndex, setRequestedIndex] = useState(0);
  const currentIndex = Math.min(
    requestedIndex,
    Math.max(payload.slides.length - 1, 0),
  );
  const currentSlide = payload.slides[currentIndex];
  const asset = currentSlide
    ? resolveAsset(assets, currentSlide.storedFileId)
    : null;

  if (!currentSlide) {
    return (
      <div className={widthClass(placement.width, mode)}>
        <UnavailableAsset kind="image" />
      </div>
    );
  }

  return (
    <section
      className={`${widthClass(placement.width, mode)} ${blockAlignClass(placement.align)} space-y-3`}
      aria-label="Слайдшоу"
    >
      <figure>
        {asset ? (
          <SignedImage
            src={asset.signedUrl}
            alt={currentSlide.alt}
            placement={placement}
          />
        ) : (
          <UnavailableAsset kind="image" />
        )}
        {currentSlide.caption ? (
          <figcaption className="mt-2 text-center text-sm text-neutral-600">
            {currentSlide.caption}
          </figcaption>
        ) : null}
      </figure>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={currentIndex === 0}
          onClick={() => setRequestedIndex((index) => Math.max(0, index - 1))}
        >
          Назад
        </button>
        <span className="text-sm text-neutral-600">
          Слайд {currentIndex + 1} из {payload.slides.length}
        </span>
        <button
          type="button"
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={currentIndex >= payload.slides.length - 1}
          onClick={() =>
            setRequestedIndex((index) =>
              Math.min(payload.slides.length - 1, index + 1),
            )
          }
        >
          Далее
        </button>
      </div>
      <div className="flex justify-center gap-2" aria-label="Слайды">
        {payload.slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            className={`h-2.5 w-2.5 rounded-full ${index === currentIndex ? "bg-sky-600" : "bg-neutral-300"}`}
            aria-label={`Открыть слайд ${index + 1}`}
            aria-current={index === currentIndex ? "true" : undefined}
            onClick={() => setRequestedIndex(index)}
          />
        ))}
      </div>
    </section>
  );
}

function SingleChoicePollRenderer({
  component,
  mode,
}: RegisteredRendererProps) {
  const payload = componentRegistry.single_choice_poll.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.single_choice_poll.placementSchema.parse(
    component.placement,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const selectedOption = payload.options.find(
    (option) => option.id === selectedId,
  );

  function reset() {
    setSelectedId(null);
    setSubmitted(false);
  }

  return (
    <section
      className={`${widthClass(placement.width, mode)} rounded-3xl border border-sky-200 bg-sky-50/60 ${placement.compact ? "p-4" : "p-5 md:p-6"}`}
      aria-label="Опрос с одним вариантом ответа"
    >
      <fieldset>
        <legend className="text-lg font-bold text-neutral-950">
          {payload.question}
        </legend>
        <div className="mt-4 grid gap-2">
          {payload.options.map((option) => {
            const selected = selectedId === option.id;
            return (
              <label
                key={option.id}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${selected ? "border-sky-500 bg-white shadow-sm" : "border-sky-100 bg-white/75 hover:border-sky-300"}`}
              >
                <input
                  type="radio"
                  name={`poll-${component.id}`}
                  value={option.id}
                  checked={selected}
                  onChange={() => {
                    setSelectedId(option.id);
                    setSubmitted(false);
                  }}
                  className="h-4 w-4 accent-sky-600"
                />
                <span className="text-sm font-medium text-neutral-800">
                  {option.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!selectedId}
          onClick={() => setSubmitted(true)}
          className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ответить
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700"
        >
          Сбросить
        </button>
      </div>

      <div className="mt-3 min-h-6 text-sm text-sky-900" role="status">
        {submitted && selectedOption
          ? `${mode === "teacher" ? "Предпросмотр: " : ""}${
              payload.showResults
                ? `вы выбрали «${selectedOption.label}».`
                : "ответ выбран."
            }`
          : "Выберите один вариант."}
      </div>
    </section>
  );
}

function MatchingGameRenderer({ component, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.matching_game.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.matching_game.placementSchema.parse(
    component.placement,
  );
  const rightItems = useMemo(
    () => (payload.shuffle ? [...payload.pairs].reverse() : payload.pairs),
    [payload.pairs, payload.shuffle],
  );
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("Выберите элемент слева.");
  const validPairIds = new Set(payload.pairs.map((pair) => pair.id));
  const matchedIds = new Set(
    matchedPairIds.filter((pairId) => validPairIds.has(pairId)),
  );
  const completed = matchedIds.size === payload.pairs.length;

  function chooseRight(pairId: string) {
    if (!selectedLeftId) {
      setFeedback("Сначала выберите элемент слева.");
      return;
    }

    if (selectedLeftId === pairId) {
      setMatchedPairIds((current) =>
        current.includes(pairId) ? current : [...current, pairId],
      );
      setSelectedLeftId(null);
      setFeedback(
        matchedIds.size + 1 === payload.pairs.length
          ? "Все пары найдены!"
          : "Верно. Найдите следующую пару.",
      );
      return;
    }

    setFeedback("Пока не совпало. Попробуйте ещё раз.");
  }

  function reset() {
    setSelectedLeftId(null);
    setMatchedPairIds([]);
    setFeedback("Выберите элемент слева.");
  }

  return (
    <section
      className={`${widthClass(placement.width, mode)} rounded-3xl border border-violet-200 bg-violet-50/60 ${placement.compact ? "p-4" : "p-5 md:p-6"}`}
      aria-label="Игра Найди пару"
    >
      <h3 className="text-lg font-bold text-neutral-950">
        {payload.instruction}
      </h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="grid content-start gap-2" aria-label="Левая колонка">
          {payload.pairs.map((pair) => {
            const matched = matchedIds.has(pair.id);
            const selected = selectedLeftId === pair.id;
            return (
              <button
                key={pair.id}
                type="button"
                disabled={matched}
                aria-pressed={selected}
                onClick={() => {
                  setSelectedLeftId(pair.id);
                  setFeedback("Теперь выберите пару справа.");
                }}
                className={`min-h-12 rounded-2xl border px-3 py-2 text-sm font-semibold transition ${matched ? "border-emerald-300 bg-emerald-100 text-emerald-900" : selected ? "border-violet-500 bg-white text-violet-950 shadow-sm" : "border-violet-200 bg-white/80 text-neutral-800 hover:border-violet-400"}`}
              >
                {pair.left}
              </button>
            );
          })}
        </div>
        <div className="grid content-start gap-2" aria-label="Правая колонка">
          {rightItems.map((pair) => {
            const matched = matchedIds.has(pair.id);
            return (
              <button
                key={pair.id}
                type="button"
                disabled={matched}
                onClick={() => chooseRight(pair.id)}
                className={`min-h-12 rounded-2xl border px-3 py-2 text-sm font-semibold transition ${matched ? "border-emerald-300 bg-emerald-100 text-emerald-900" : "border-violet-200 bg-white/80 text-neutral-800 hover:border-violet-400"}`}
              >
                {pair.right}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p
          className={`text-sm ${completed ? "font-semibold text-emerald-800" : "text-violet-900"}`}
          role="status"
        >
          {mode === "teacher" ? "Предпросмотр: " : ""}
          {feedback}
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700"
        >
          Начать заново
        </button>
      </div>
    </section>
  );
}

function ExerciseFrame({
  width,
  compact,
  mode,
  label,
  children,
}: {
  width: "content" | "wide" | "full";
  compact: boolean;
  mode: CourseComponentRenderMode;
  label: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`${widthClass(width, mode)} rounded-3xl border border-indigo-200 bg-indigo-50/50 ${compact ? "p-4" : "p-5 md:p-6"}`}
      aria-label={label}
    >
      {children}
    </section>
  );
}

function teacherPreviewPrefix(mode: CourseComponentRenderMode) {
  return mode === "teacher" ? "Предпросмотр: " : "";
}

function ChoiceQuizRenderer({ component, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.choice_quiz.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.choice_quiz.placementSchema.parse(
    component.placement,
  );
  const orderedOptions = useMemo(
    () => deterministicOrder(payload.options, payload.shuffle),
    [payload.options, payload.shuffle],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const currentOptionIds = new Set(payload.options.map((option) => option.id));
  const normalizedSelectedIds = selectedIds.filter((id) =>
    currentOptionIds.has(id),
  );
  const correctIds = payload.options
    .filter((option) => option.isCorrect)
    .map((option) => option.id);
  const isCorrect =
    normalizedSelectedIds.length === correctIds.length &&
    correctIds.every((id) => normalizedSelectedIds.includes(id));

  function toggleOption(optionId: string) {
    setSubmitted(false);
    if (!payload.allowMultiple) {
      setSelectedIds([optionId]);
      return;
    }
    setSelectedIds((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId],
    );
  }

  function reset() {
    setSelectedIds([]);
    setSubmitted(false);
  }

  return (
    <ExerciseFrame
      width={placement.width}
      compact={placement.compact}
      mode={mode}
      label="Тест с выбором ответа"
    >
      <fieldset>
        <legend className="text-lg font-bold text-neutral-950">
          {payload.question}
        </legend>
        <p className="mt-1 text-sm text-neutral-600">
          {payload.allowMultiple
            ? "Можно выбрать несколько вариантов."
            : "Выберите один вариант."}
        </p>
        <div className="mt-4 grid gap-2">
          {orderedOptions.map((option) => {
            const selected = normalizedSelectedIds.includes(option.id);
            return (
              <label
                key={option.id}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${selected ? "border-indigo-500 bg-white shadow-sm" : "border-indigo-100 bg-white/80 hover:border-indigo-300"}`}
              >
                <input
                  type={payload.allowMultiple ? "checkbox" : "radio"}
                  name={`quiz-${component.id}`}
                  checked={selected}
                  onChange={() => toggleOption(option.id)}
                  className="mt-0.5 h-4 w-4 accent-indigo-600"
                />
                <span className="text-sm font-medium text-neutral-800">
                  {option.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={normalizedSelectedIds.length === 0}
          onClick={() => setSubmitted(true)}
          className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Проверить
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700"
        >
          Сбросить
        </button>
      </div>

      <div className="mt-3 min-h-6 text-sm" role="status" aria-live="polite">
        {submitted ? (
          <div className={isCorrect ? "text-emerald-800" : "text-rose-800"}>
            <p className="font-semibold">
              {teacherPreviewPrefix(mode)}
              {isCorrect ? "Верно!" : "Ответ пока неверный."}
            </p>
            {payload.explanation ? (
              <p className="mt-1 text-neutral-700">{payload.explanation}</p>
            ) : null}
          </div>
        ) : (
          <span className="text-indigo-900">
            Выберите ответ и проверьте себя.
          </span>
        )}
      </div>
    </ExerciseFrame>
  );
}

function templateParts(template: string) {
  return template.split(/(\[\[\d+\]\])/g);
}

function templateMarkerIndex(part: string) {
  const match = /^\[\[(\d+)\]\]$/.exec(part);
  return match ? Number(match[1]) - 1 : null;
}

function FillBlanksRenderer({ component, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.fill_blanks.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.fill_blanks.placementSchema.parse(
    component.placement,
  );
  const [values, setValues] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const correctness = payload.answers.map((answer, index) => {
    const value = normalizeAnswer(values[index] ?? "");
    return answer.accepted.some(
      (alternative) => normalizeAnswer(alternative) === value,
    );
  });
  const allCorrect = correctness.every(Boolean);

  function reset() {
    setValues({});
    setSubmitted(false);
  }

  return (
    <ExerciseFrame
      width={placement.width}
      compact={placement.compact}
      mode={mode}
      label="Упражнение Заполни пропуски"
    >
      <h3 className="text-lg font-bold text-neutral-950">
        {payload.instruction}
      </h3>
      <div className="mt-4 rounded-2xl border border-indigo-100 bg-white px-4 py-4 leading-10 text-neutral-800">
        {templateParts(payload.template).map((part, partIndex) => {
          const answerIndex = templateMarkerIndex(part);
          if (answerIndex === null) {
            return <Fragment key={`text-${partIndex}`}>{part}</Fragment>;
          }
          const answer = payload.answers[answerIndex];
          return (
            <label
              key={`blank-${partIndex}`}
              className="mx-1 inline-flex flex-col align-middle"
            >
              <span className="sr-only">Пропуск {answerIndex + 1}</span>
              <input
                type="text"
                value={values[answerIndex] ?? ""}
                aria-invalid={submitted ? !correctness[answerIndex] : undefined}
                onChange={(event) => {
                  const value = event.target.value;
                  setValues((current) => ({
                    ...current,
                    [answerIndex]: value,
                  }));
                  setSubmitted(false);
                }}
                className={`min-w-28 rounded-lg border px-2 py-1 leading-6 outline-none transition ${submitted ? (correctness[answerIndex] ? "border-emerald-500 bg-emerald-50" : "border-rose-500 bg-rose-50") : "border-neutral-300 bg-white focus:border-indigo-500"}`}
              />
              {answer?.hint ? (
                <span className="mt-0.5 text-xs leading-4 text-neutral-500">
                  {answer.hint}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubmitted(true)}
          className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Проверить
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700"
        >
          Очистить
        </button>
      </div>
      <p
        className={`mt-3 min-h-6 text-sm ${submitted ? (allCorrect ? "font-semibold text-emerald-800" : "text-rose-800") : "text-indigo-900"}`}
        role="status"
        aria-live="polite"
      >
        {submitted
          ? `${teacherPreviewPrefix(mode)}${allCorrect ? "Все пропуски заполнены верно!" : "Проверьте отмеченные пропуски."}`
          : "Заполните пропуски и проверьте себя."}
      </p>
    </ExerciseFrame>
  );
}

function splitAcceptedAlternatives(value: string) {
  return value.split("|").map((alternative) => alternative.trim());
}

function WordBankRenderer({ component, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.word_bank.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.word_bank.placementSchema.parse(
    component.placement,
  );
  const [values, setValues] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const options = useMemo(() => {
    const unique = new Map<string, string>();
    for (const value of [
      ...payload.answers.flatMap(splitAcceptedAlternatives),
      ...payload.distractors,
    ]) {
      const key = normalizeAnswer(value);
      if (!unique.has(key)) unique.set(key, value);
    }
    return deterministicOrder(Array.from(unique.values()), payload.shuffle);
  }, [payload.answers, payload.distractors, payload.shuffle]);
  const correctness = payload.answers.map((answer, index) => {
    const value = normalizeAnswer(values[index] ?? "");
    return splitAcceptedAlternatives(answer).some(
      (alternative) => normalizeAnswer(alternative) === value,
    );
  });
  const allCorrect = correctness.every(Boolean);

  function reset() {
    setValues({});
    setSubmitted(false);
  }

  return (
    <ExerciseFrame
      width={placement.width}
      compact={placement.compact}
      mode={mode}
      label="Упражнение Банк слов"
    >
      <h3 className="text-lg font-bold text-neutral-950">
        {payload.instruction}
      </h3>
      <div className="mt-4 rounded-2xl border border-indigo-100 bg-white px-4 py-4 leading-10 text-neutral-800">
        {templateParts(payload.template).map((part, partIndex) => {
          const answerIndex = templateMarkerIndex(part);
          if (answerIndex === null) {
            return <Fragment key={`text-${partIndex}`}>{part}</Fragment>;
          }
          return (
            <label key={`bank-${partIndex}`} className="mx-1 inline-flex">
              <span className="sr-only">Пропуск {answerIndex + 1}</span>
              <select
                value={values[answerIndex] ?? ""}
                aria-invalid={submitted ? !correctness[answerIndex] : undefined}
                onChange={(event) => {
                  const value = event.target.value;
                  setValues((current) => ({
                    ...current,
                    [answerIndex]: value,
                  }));
                  setSubmitted(false);
                }}
                className={`max-w-full rounded-lg border px-2 py-1 leading-6 outline-none transition ${submitted ? (correctness[answerIndex] ? "border-emerald-500 bg-emerald-50" : "border-rose-500 bg-rose-50") : "border-neutral-300 bg-white focus:border-indigo-500"}`}
              >
                <option value="">Выберите слово</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubmitted(true)}
          className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Проверить
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700"
        >
          Очистить
        </button>
      </div>
      <p
        className={`mt-3 min-h-6 text-sm ${submitted ? (allCorrect ? "font-semibold text-emerald-800" : "text-rose-800") : "text-indigo-900"}`}
        role="status"
        aria-live="polite"
      >
        {submitted
          ? `${teacherPreviewPrefix(mode)}${allCorrect ? "Все слова выбраны верно!" : "Некоторые слова пока не подходят."}`
          : "Выберите слова для каждого пропуска."}
      </p>
    </ExerciseFrame>
  );
}

function SequenceRenderer({ component, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.sequence.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.sequence.placementSchema.parse(
    component.placement,
  );
  const expectedIds = payload.items.map((item) => item.id);
  const [orderedIds, setOrderedIds] = useState(() =>
    deterministicOrder(expectedIds, payload.shuffle),
  );
  const [submitted, setSubmitted] = useState(false);
  const validIds = new Set(expectedIds);
  const normalizedOrderedIds = [
    ...orderedIds.filter((id, index) => {
      return validIds.has(id) && orderedIds.indexOf(id) === index;
    }),
    ...expectedIds.filter((id) => !orderedIds.includes(id)),
  ];
  const itemsById = new Map(payload.items.map((item) => [item.id, item]));
  const isCorrect = expectedIds.every(
    (id, index) => normalizedOrderedIds[index] === id,
  );

  function move(itemId: string, offset: -1 | 1) {
    const currentIndex = normalizedOrderedIds.indexOf(itemId);
    const nextIndex = currentIndex + offset;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= expectedIds.length) {
      return;
    }
    const next = [...normalizedOrderedIds];
    [next[currentIndex], next[nextIndex]] = [
      next[nextIndex],
      next[currentIndex],
    ];
    setOrderedIds(next);
    setSubmitted(false);
  }

  function reset() {
    setOrderedIds(deterministicOrder(expectedIds, payload.shuffle));
    setSubmitted(false);
  }

  return (
    <ExerciseFrame
      width={placement.width}
      compact={placement.compact}
      mode={mode}
      label="Упражнение Расставь по порядку"
    >
      <h3 className="text-lg font-bold text-neutral-950">
        {payload.instruction}
      </h3>
      <ol className="mt-4 grid gap-2">
        {normalizedOrderedIds.map((itemId, index) => {
          const item = itemsById.get(itemId);
          if (!item) return null;
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-white px-3 py-3"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-800"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium text-neutral-800">
                {item.text}
              </span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  aria-label={`Переместить «${item.text}» выше`}
                  onClick={() => move(item.id, -1)}
                  className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-sm font-bold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === normalizedOrderedIds.length - 1}
                  aria-label={`Переместить «${item.text}» ниже`}
                  onClick={() => move(item.id, 1)}
                  className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-sm font-bold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubmitted(true)}
          className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Проверить порядок
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700"
        >
          Начать заново
        </button>
      </div>
      <p
        className={`mt-3 min-h-6 text-sm ${submitted ? (isCorrect ? "font-semibold text-emerald-800" : "text-rose-800") : "text-indigo-900"}`}
        role="status"
        aria-live="polite"
      >
        {submitted
          ? `${teacherPreviewPrefix(mode)}${isCorrect ? "Порядок верный!" : "Порядок пока неверный."}`
          : `Перемещайте ${payload.mode === "words" ? "слова" : "фразы"} кнопками со стрелками.`}
      </p>
    </ExerciseFrame>
  );
}

function CategorizeRenderer({ component, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.categorize.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.categorize.placementSchema.parse(
    component.placement,
  );
  const orderedItems = useMemo(
    () => deterministicOrder(payload.items, payload.shuffle),
    [payload.items, payload.shuffle],
  );
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const correctness = payload.items.map(
    (item) => selections[item.id] === item.categoryId,
  );
  const allCorrect = correctness.every(Boolean);

  function reset() {
    setSelections({});
    setSubmitted(false);
  }

  return (
    <ExerciseFrame
      width={placement.width}
      compact={placement.compact}
      mode={mode}
      label="Упражнение Распредели по категориям"
    >
      <h3 className="text-lg font-bold text-neutral-950">
        {payload.instruction}
      </h3>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {orderedItems.map((item) => {
          const itemIndex = payload.items.findIndex(
            (candidate) => candidate.id === item.id,
          );
          const itemIsCorrect = correctness[itemIndex];
          return (
            <label
              key={item.id}
              className={`rounded-2xl border bg-white px-4 py-3 ${submitted ? (itemIsCorrect ? "border-emerald-400" : "border-rose-400") : "border-indigo-100"}`}
            >
              <span className="block text-sm font-semibold text-neutral-900">
                {item.text}
              </span>
              <select
                value={selections[item.id] ?? ""}
                aria-invalid={submitted ? !itemIsCorrect : undefined}
                onChange={(event) => {
                  const categoryId = event.target.value;
                  setSelections((current) => ({
                    ...current,
                    [item.id]: categoryId,
                  }));
                  setSubmitted(false);
                }}
                className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-indigo-500"
              >
                <option value="">Выберите категорию</option>
                {payload.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubmitted(true)}
          className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Проверить
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700"
        >
          Очистить
        </button>
      </div>
      <p
        className={`mt-3 min-h-6 text-sm ${submitted ? (allCorrect ? "font-semibold text-emerald-800" : "text-rose-800") : "text-indigo-900"}`}
        role="status"
        aria-live="polite"
      >
        {submitted
          ? `${teacherPreviewPrefix(mode)}${allCorrect ? "Все элементы распределены верно!" : "Проверьте отмеченные элементы."}`
          : "Выберите категорию для каждого элемента."}
      </p>
    </ExerciseFrame>
  );
}

function FreeResponseRenderer({ component, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.free_response.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.free_response.placementSchema.parse(
    component.placement,
  );
  const [response, setResponse] = useState("");
  const [checked, setChecked] = useState(false);
  const lengthIsValid =
    response.length >= payload.minChars && response.length <= payload.maxChars;
  const fieldClass =
    "mt-3 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-indigo-500";

  function updateResponse(value: string) {
    setResponse(value);
    setChecked(false);
  }

  return (
    <ExerciseFrame
      width={placement.width}
      compact={placement.compact}
      mode={mode}
      label="Свободный ответ"
    >
      <label className="block">
        <span className="text-lg font-bold text-neutral-950">
          {payload.prompt}
        </span>
        {payload.responseType === "long" ? (
          <textarea
            rows={6}
            value={response}
            maxLength={payload.maxChars}
            placeholder={payload.placeholder}
            onChange={(event) => updateResponse(event.target.value)}
            className={fieldClass}
          />
        ) : (
          <input
            type="text"
            value={response}
            maxLength={payload.maxChars}
            placeholder={payload.placeholder}
            onChange={(event) => updateResponse(event.target.value)}
            className={fieldClass}
          />
        )}
      </label>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
        <span>
          Минимум: {payload.minChars}; максимум: {payload.maxChars} символов.
        </span>
        <span aria-live="polite">
          {response.length} / {payload.maxChars}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setChecked(true)}
        className="mt-4 rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white"
      >
        Проверить готовность
      </button>
      <div className="mt-3 text-sm" role="status" aria-live="polite">
        {checked ? (
          <p className={lengthIsValid ? "text-emerald-800" : "text-rose-800"}>
            {teacherPreviewPrefix(mode)}
            {lengthIsValid
              ? "Ответ подходит по длине."
              : `Нужно ввести не меньше ${payload.minChars} символов.`}
          </p>
        ) : null}
        <p className="mt-1 text-neutral-600">
          Ответ существует только в этом предпросмотре и не сохраняется. В
          учебном процессе его проверяет преподаватель вручную.
        </p>
      </div>
    </ExerciseFrame>
  );
}

function ExternalLinkRenderer({ component, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.external_link.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.external_link.placementSchema.parse(
    component.placement,
  );
  const href = safeHttpsUrl(payload.url);

  if (!href) {
    return (
      <div className={widthClass(placement.width, mode)}>
        <div
          className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-5 text-sm text-neutral-600"
          role="status"
        >
          Ссылка недоступна: нужен адрес HTTPS.
        </div>
      </div>
    );
  }

  const targetProps = payload.openInNewTab
    ? ({ target: "_blank", rel: "noreferrer noopener" } as const)
    : {};
  const styleClass = {
    card: "flex w-full items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white px-5 py-4 shadow-sm transition hover:border-sky-300",
    button:
      "inline-flex items-center rounded-xl bg-sky-700 px-4 py-2.5 font-semibold text-white transition hover:bg-sky-800",
    text: "inline-flex font-semibold text-sky-700 underline underline-offset-4 hover:text-sky-900",
  }[placement.style];

  return (
    <div
      className={`${widthClass(placement.width, mode)} ${blockAlignClass(placement.align)}`}
    >
      <a href={href} {...targetProps} className={styleClass}>
        <span>
          <span className="block">{payload.label}</span>
          {payload.description ? (
            <span
              className={`mt-1 block text-sm ${placement.style === "button" ? "text-sky-100" : "font-normal text-neutral-600"}`}
            >
              {payload.description}
            </span>
          ) : null}
        </span>
        {placement.style === "card" ? (
          <span className="shrink-0 text-sm font-semibold text-sky-700">
            Открыть
          </span>
        ) : null}
      </a>
    </div>
  );
}

function WordBuilderRenderer({ component, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.word_builder.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.word_builder.placementSchema.parse(
    component.placement,
  );
  const letters = Array.from(payload.targetWord);
  const availableOrder = deterministicOrder(
    letters.map((letter, index) => ({ letter, index })),
    payload.shuffle,
  );
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const normalizedSelectedIndexes = selectedIndexes.filter(
    (index, position) =>
      index >= 0 &&
      index < letters.length &&
      selectedIndexes.indexOf(index) === position,
  );
  const builtWord = normalizedSelectedIndexes
    .map((index) => letters[index])
    .join("");
  const isCorrect =
    normalizeAnswer(builtWord) === normalizeAnswer(payload.targetWord);

  function chooseLetter(index: number) {
    setSelectedIndexes((current) =>
      current.includes(index) ? current : [...current, index],
    );
    setSubmitted(false);
  }

  function reset() {
    setSelectedIndexes([]);
    setSubmitted(false);
  }

  return (
    <ExerciseFrame
      width={placement.width}
      compact={placement.compact}
      mode={mode}
      label="Упражнение Собери слово"
    >
      <h3 className="text-lg font-bold text-neutral-950">
        {payload.instruction}
      </h3>
      {payload.hint ? (
        <p className="mt-1 text-sm text-neutral-600">
          Подсказка: {payload.hint}
        </p>
      ) : null}
      <div
        className="mt-4 min-h-14 rounded-2xl border border-indigo-200 bg-white px-4 py-3 text-center text-2xl font-black tracking-[0.2em] text-neutral-950"
        aria-label={`Собранное слово: ${builtWord || "пока пусто"}`}
        aria-live="polite"
      >
        {builtWord || "…"}
      </div>
      <div
        className="mt-3 flex flex-wrap justify-center gap-2"
        aria-label="Буквы"
      >
        {availableOrder.map(({ letter, index }) => {
          const selected = normalizedSelectedIndexes.includes(index);
          const label = letter.trim() ? letter : "Пробел";
          return (
            <button
              key={index}
              type="button"
              disabled={selected}
              aria-label={`Добавить: ${label}`}
              onClick={() => chooseLetter(index)}
              className="flex h-11 min-w-11 items-center justify-center rounded-xl border border-indigo-300 bg-white px-3 text-lg font-bold text-indigo-950 shadow-sm disabled:cursor-not-allowed disabled:opacity-25"
            >
              {letter.trim() ? letter : "␠"}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={normalizedSelectedIndexes.length === 0}
          onClick={() => {
            setSelectedIndexes((current) => current.slice(0, -1));
            setSubmitted(false);
          }}
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Убрать последнюю
        </button>
        <button
          type="button"
          disabled={normalizedSelectedIndexes.length !== letters.length}
          onClick={() => setSubmitted(true)}
          className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Проверить
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700"
        >
          Сначала
        </button>
      </div>
      <p
        className={`mt-3 min-h-6 text-sm ${submitted ? (isCorrect ? "font-semibold text-emerald-800" : "text-rose-800") : "text-indigo-900"}`}
        role="status"
        aria-live="polite"
      >
        {submitted
          ? `${teacherPreviewPrefix(mode)}${isCorrect ? "Слово собрано верно!" : "Слово пока неверное."}`
          : "Нажимайте на буквы в нужном порядке."}
      </p>
    </ExerciseFrame>
  );
}

function VocabularyListRenderer({ component, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.vocabulary_list.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.vocabulary_list.placementSchema.parse(
    component.placement,
  );
  const [revealedIds, setRevealedIds] = useState<string[]>([]);

  return (
    <section
      className={`${widthClass(placement.width, mode)} rounded-3xl border border-teal-200 bg-teal-50/50 ${placement.compact ? "p-4" : "p-5 md:p-6"}`}
      aria-label="Словарь"
    >
      {payload.title ? (
        <h3 className="text-lg font-bold text-neutral-950">{payload.title}</h3>
      ) : null}
      {payload.display === "list" ? (
        <dl
          className={`${payload.title ? "mt-4" : ""} divide-y divide-teal-100 rounded-2xl border border-teal-100 bg-white`}
        >
          {payload.items.map((item) => (
            <div
              key={item.id}
              className="grid gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4"
            >
              <dt className="font-bold text-teal-950">{item.term}</dt>
              <dd className="text-sm leading-6 text-neutral-700 sm:col-span-2">
                {item.definition}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div
          className={`${payload.title ? "mt-4" : ""} grid gap-3 sm:grid-cols-2`}
        >
          {payload.items.map((item) => {
            const revealed = revealedIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                aria-expanded={revealed}
                onClick={() =>
                  setRevealedIds((current) =>
                    current.includes(item.id)
                      ? current.filter((id) => id !== item.id)
                      : [...current, item.id],
                  )
                }
                className="min-h-32 rounded-2xl border border-teal-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-teal-400"
              >
                <span className="block font-bold text-teal-950">
                  {item.term}
                </span>
                <span className="mt-2 block text-sm leading-6 text-neutral-700">
                  {revealed
                    ? item.definition
                    : "Нажмите, чтобы увидеть определение"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function FileRenderer({ component, assets, mode }: RegisteredRendererProps) {
  const payload = componentRegistry.file.payloadSchema.parse(component.payload);
  const placement = componentRegistry.file.placementSchema.parse(
    component.placement,
  );
  const asset = resolveAsset(assets, payload.storedFileId);

  if (!asset) {
    return (
      <div className={widthClass(placement.width, mode)}>
        <UnavailableAsset kind="file" />
      </div>
    );
  }

  const linkProps =
    payload.openMode === "preview"
      ? ({ target: "_blank", rel: "noreferrer noopener" } as const)
      : ({ download: asset.originalFilename } as const);

  return (
    <a
      href={asset.signedUrl}
      {...linkProps}
      className={`${widthClass(placement.width, mode)} ${
        placement.display === "link"
          ? "inline-flex text-sky-700 underline underline-offset-4"
          : "flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white px-5 py-4 shadow-sm transition hover:border-sky-300"
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate font-semibold text-neutral-950">
          {payload.label}
        </span>
        {payload.description ? (
          <span className="mt-1 block text-sm text-neutral-600">
            {payload.description}
          </span>
        ) : null}
      </span>
      {placement.display === "card" ? (
        <span className="shrink-0 text-sm font-semibold text-sky-700">
          {payload.openMode === "preview" ? "Открыть" : "Скачать"}
        </span>
      ) : null}
    </a>
  );
}

export const courseComponentRenderers = {
  heading: HeadingRenderer,
  rich_text: RichTextRenderer,
  callout: CalloutRenderer,
  quote: QuoteRenderer,
  image: ImageRenderer,
  video: VideoRenderer,
  audio: AudioRenderer,
  slideshow: SlideshowRenderer,
  single_choice_poll: SingleChoicePollRenderer,
  matching_game: MatchingGameRenderer,
  choice_quiz: ChoiceQuizRenderer,
  fill_blanks: FillBlanksRenderer,
  word_bank: WordBankRenderer,
  sequence: SequenceRenderer,
  categorize: CategorizeRenderer,
  free_response: FreeResponseRenderer,
  external_link: ExternalLinkRenderer,
  word_builder: WordBuilderRenderer,
  vocabulary_list: VocabularyListRenderer,
  file: FileRenderer,
} as const satisfies Record<
  ComponentTypeKey,
  ComponentType<RegisteredRendererProps>
>;

export const courseComponentRendererKeys = componentTypeKeys.filter((key) =>
  Boolean(courseComponentRenderers[key]),
);

function InvalidComponent() {
  return (
    <div
      className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-4 text-sm text-neutral-600"
      role="status"
    >
      Компонент временно недоступен.
    </div>
  );
}

export function CourseComponentRenderer({
  component,
  assets,
  mode,
}: CourseComponentRendererProps) {
  const definition = findComponentDefinition(component.typeKey);
  if (!definition) return <InvalidComponent />;

  const payload = definition.payloadSchema.safeParse(component.payload);
  const placement = definition.placementSchema.safeParse(component.placement);
  if (!payload.success || !placement.success) return <InvalidComponent />;

  const Renderer = courseComponentRenderers[
    definition.key
  ] as ComponentType<RegisteredRendererProps>;
  const normalizedComponent: CourseComponentRendererComponent = {
    ...component,
    typeKey: definition.key,
    payload: payload.data as Record<string, unknown>,
    placement: placement.data as Record<string, unknown>,
  };

  return (
    <div
      data-course-component-type={definition.key}
      data-course-component-mode={mode}
    >
      <Renderer component={normalizedComponent} assets={assets} mode={mode} />
    </div>
  );
}
