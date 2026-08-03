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

function widthClass(width: "content" | "wide" | "full") {
  if (width === "content") return "mx-auto w-full max-w-3xl";
  if (width === "wide") return "mx-auto w-full max-w-5xl";
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

function HeadingRenderer({ component }: RegisteredRendererProps) {
  const payload = componentRegistry.heading.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.heading.placementSchema.parse(
    component.placement,
  );
  const Tag = payload.level;

  return (
    <Tag
      className={`${widthClass(placement.width)} ${textAlignClass(placement.textAlign)} text-2xl font-black tracking-tight text-neutral-950 md:text-3xl`}
    >
      {payload.text}
    </Tag>
  );
}

function RichTextRenderer({ component }: RegisteredRendererProps) {
  const payload = componentRegistry.rich_text.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.rich_text.placementSchema.parse(
    component.placement,
  );

  return (
    <div
      className={`${widthClass(placement.width)} ${textAlignClass(placement.textAlign)}`}
    >
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

function CalloutRenderer({ component }: RegisteredRendererProps) {
  const payload = componentRegistry.callout.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.callout.placementSchema.parse(
    component.placement,
  );

  return (
    <aside
      className={`${widthClass(placement.width)} ${calloutToneClass[payload.tone]} rounded-2xl border px-5 py-4 ${placement.emphasis === "strong" ? "shadow-sm" : ""}`}
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

function QuoteRenderer({ component }: RegisteredRendererProps) {
  const payload = componentRegistry.quote.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.quote.placementSchema.parse(
    component.placement,
  );

  return (
    <blockquote
      className={`${widthClass(placement.width)} ${textAlignClass(placement.textAlign)} border-l-4 border-violet-300 bg-violet-50/60 px-5 py-4 text-lg italic leading-7 text-neutral-800`}
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

const dividerStyleClass = {
  solid: "border-solid",
  dashed: "border-dashed",
  dotted: "border-dotted",
} as const;

function DividerRenderer({ component }: RegisteredRendererProps) {
  const placement = componentRegistry.divider.placementSchema.parse(
    component.placement,
  );

  return (
    <hr
      className={`${widthClass(placement.width)} ${dividerStyleClass[placement.style]} border-0 border-t border-neutral-300`}
    />
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

function ImageRenderer({ component, assets }: RegisteredRendererProps) {
  const payload = componentRegistry.image.payloadSchema.parse(
    component.payload,
  );
  const placement = componentRegistry.image.placementSchema.parse(
    component.placement,
  );
  const asset = resolveAsset(assets, payload.storedFileId);

  return (
    <figure
      className={`${widthClass(placement.width)} ${blockAlignClass(placement.align)}`}
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

function SlideshowRenderer({ component, assets }: RegisteredRendererProps) {
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
      <div className={widthClass(placement.width)}>
        <UnavailableAsset kind="image" />
      </div>
    );
  }

  return (
    <section
      className={`${widthClass(placement.width)} ${blockAlignClass(placement.align)} space-y-3`}
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
      className={`${widthClass(placement.width)} rounded-3xl border border-sky-200 bg-sky-50/60 ${placement.compact ? "p-4" : "p-5 md:p-6"}`}
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
      className={`${widthClass(placement.width)} rounded-3xl border border-violet-200 bg-violet-50/60 ${placement.compact ? "p-4" : "p-5 md:p-6"}`}
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

function FileRenderer({ component, assets }: RegisteredRendererProps) {
  const payload = componentRegistry.file.payloadSchema.parse(component.payload);
  const placement = componentRegistry.file.placementSchema.parse(
    component.placement,
  );
  const asset = resolveAsset(assets, payload.storedFileId);

  if (!asset) {
    return (
      <div className={widthClass(placement.width)}>
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
      className={`${widthClass(placement.width)} ${
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
  divider: DividerRenderer,
  image: ImageRenderer,
  slideshow: SlideshowRenderer,
  single_choice_poll: SingleChoicePollRenderer,
  matching_game: MatchingGameRenderer,
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
