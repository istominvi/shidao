import { ChevronLeft, ChevronRight, Maximize } from "lucide-react";
import { useRef, useState } from "react";
import type { ReusableAsset } from "@/lib/lesson-content";

export function mapAssetUrls(asset: ReusableAsset) {
  const metadata = asset.metadata ?? {};
  const localUrl =
    typeof asset.fileRef === "string" && asset.fileRef.startsWith("/methodologies/")
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
  return {
    localUrl,
    fallbackUrl,
    previewImageRefs,
    slideImageRefs,
    cardImageRefs,
    pptxFileRef,
  };
}

export function downloadLabel(asset: ReusableAsset) {
  if (
    asset.kind === "song_audio" ||
    asset.kind === "song" ||
    asset.kind === "pronunciation_audio"
  ) {
    return "Скачать аудио";
  }
  if (
    asset.kind === "song_video" ||
    asset.kind === "video" ||
    asset.kind === "lesson_video"
  ) {
    return "Скачать MP4";
  }
  if (
    asset.kind === "presentation" ||
    asset.kind === "flashcards_pdf" ||
    asset.kind === "worksheet" ||
    asset.kind === "worksheet_pdf"
  ) {
    return "Скачать PDF";
  }
  return "Скачать файл";
}

export function openLabel(asset: ReusableAsset) {
  if (
    asset.kind === "song_audio" ||
    asset.kind === "song" ||
    asset.kind === "pronunciation_audio"
  ) {
    return "Открыть аудио";
  }
  if (
    asset.kind === "song_video" ||
    asset.kind === "video" ||
    asset.kind === "lesson_video"
  ) {
    return "Открыть видео";
  }
  if (
    asset.kind === "presentation" ||
    asset.kind === "flashcards_pdf" ||
    asset.kind === "worksheet" ||
    asset.kind === "worksheet_pdf"
  ) {
    return "Открыть PDF";
  }
  return "Открыть файл";
}

function externalOpenLabel(asset: ReusableAsset) {
  if (
    asset.kind === "presentation" ||
    asset.kind === "flashcards_pdf" ||
    asset.kind === "worksheet" ||
    asset.kind === "worksheet_pdf"
  ) {
    return "Открыть внешний PDF";
  }
  return "Открыть внешний ресурс";
}

export function LessonPlanResourcePreview({
  asset,
  mode = "default",
}: {
  asset: ReusableAsset;
  mode?: "default" | "single-slide";
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeCard, setActiveCard] = useState(0);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const { localUrl, fallbackUrl, previewImageRefs, slideImageRefs, cardImageRefs, pptxFileRef } =
    mapAssetUrls(asset);
  const primaryUrl = localUrl ?? fallbackUrl;
  if (
    !primaryUrl &&
    !previewImageRefs.length &&
    !slideImageRefs.length &&
    !cardImageRefs.length
  ) {
    return null;
  }

  const actionButtonClassName =
    "inline-flex rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800";

  if (asset.kind === "video" || asset.kind === "lesson_video" || asset.kind === "song_video") {
    return (
      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        {primaryUrl ? (
          <video
            controls
            playsInline
            preload="metadata"
            src={primaryUrl}
            className="w-full rounded-lg border border-neutral-200 bg-black"
          />
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {localUrl ? (
            <a href={localUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
              {openLabel(asset)}
            </a>
          ) : null}
          {localUrl ? (
            <a href={localUrl} download className={actionButtonClassName}>
              {downloadLabel(asset)}
            </a>
          ) : null}
          {!localUrl && fallbackUrl ? (
            <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
              {externalOpenLabel(asset)}
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (asset.kind === "song_audio" || asset.kind === "song" || asset.kind === "pronunciation_audio") {
    return (
      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        {primaryUrl ? <audio controls preload="metadata" src={primaryUrl} className="w-full" /> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {localUrl ? (
            <a href={localUrl} download className={actionButtonClassName}>
              Скачать аудио
            </a>
          ) : null}
          {!localUrl && fallbackUrl ? (
            <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
              {externalOpenLabel(asset)}
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (asset.kind === "presentation") {
    const previewSlides = slideImageRefs.length ? slideImageRefs : localUrl ? [localUrl] : [];
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
            <button type="button" onClick={() => frameRef.current?.requestFullscreen?.()} className={actionButtonClassName}>
              <Maximize className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              На весь экран
            </button>
          ) : null}
          {localUrl ? (
            <>
              <a href={localUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
                Открыть PDF
              </a>
              <a href={localUrl} download className={actionButtonClassName}>
                Скачать PDF
              </a>
            </>
          ) : null}
          {pptxFileRef ? (
            <a href={pptxFileRef} target="_blank" rel="noreferrer" className={actionButtonClassName}>
              Скачать PPTX
            </a>
          ) : null}
          {!localUrl && fallbackUrl ? (
            <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
              Открыть внешний ресурс
            </a>
          ) : null}
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
          {localUrl ? (
            <>
              <a href={localUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
                Открыть PDF
              </a>
              <a href={localUrl} download className={actionButtonClassName}>
                Скачать PDF
              </a>
            </>
          ) : null}
          {!localUrl && fallbackUrl ? (
            <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
              Открыть внешний PDF
            </a>
          ) : null}
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
          {localUrl ? (
            <>
              <a href={localUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
                Открыть PDF
              </a>
              <a href={localUrl} download className={actionButtonClassName}>
                Скачать PDF
              </a>
            </>
          ) : null}
          {!localUrl && fallbackUrl ? (
            <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
              Открыть внешний PDF
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="mt-2 flex flex-wrap gap-2">
        {localUrl ? (
          <a href={localUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
            {openLabel(asset)}
          </a>
        ) : null}
        {localUrl ? (
          <a href={localUrl} download className={actionButtonClassName}>
            {downloadLabel(asset)}
          </a>
        ) : null}
        {!localUrl && fallbackUrl ? (
          <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
            Открыть внешний ресурс
          </a>
        ) : null}
      </div>
    </div>
  );
}
