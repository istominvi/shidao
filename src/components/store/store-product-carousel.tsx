"use client";

import Image from "next/image";
import {
  useId,
  useRef,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { FadeChevronButton } from "@/components/ui/fade-chevron-button";
import type { StoreProduct } from "@/components/store/store-catalog";

const SWIPE_THRESHOLD_PX = 36;
const SYNTHETIC_TAP_GUARD_MS = 350;

function wrappedImageIndex(index: number, imageCount: number) {
  return (index + imageCount) % imageCount;
}

export function StoreProductCarousel({
  product,
  compact = false,
  imageIndex,
  onImageIndexChange,
  onOpen,
  detail = false,
  priority = false,
}: {
  product: StoreProduct;
  compact?: boolean;
  imageIndex: number;
  onImageIndexChange: (index: number) => void;
  onOpen?: () => void;
  detail?: boolean;
  priority?: boolean;
}) {
  const statusId = useId();
  const gestureStart = useRef<{ x: number; y: number } | null>(null);
  const suppressTapUntil = useRef(0);
  const image = product.images[imageIndex] ?? product.images[0];

  function moveImage(offset: -1 | 1) {
    onImageIndexChange(
      wrappedImageIndex(imageIndex + offset, product.images.length),
    );
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>,
  ) {
    if (event.pointerType === "mouse") return;
    gestureStart.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(
    event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>,
  ) {
    const start = gestureStart.current;
    gestureStart.current = null;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (
      Math.abs(deltaX) < SWIPE_THRESHOLD_PX ||
      Math.abs(deltaX) <= Math.abs(deltaY)
    ) {
      return;
    }

    suppressTapUntil.current = performance.now() + SYNTHETIC_TAP_GUARD_MS;
    moveImage(deltaX < 0 ? 1 : -1);
  }

  function handleOpen() {
    if (performance.now() < suppressTapUntil.current) return;
    onOpen?.();
  }

  function handleGalleryKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!detail || event.target !== event.currentTarget) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      moveImage(event.key === "ArrowLeft" ? -1 : 1);
    }
  }

  return (
    <div
      className={`store-product-gallery ${detail ? "store-product-gallery-detail" : "store-product-gallery-card"}`}
    >
      <div
        className="store-product-carousel"
        role="group"
        aria-label={`Фотографии товара: ${product.title}`}
        aria-describedby={statusId}
        data-image-index={imageIndex}
        tabIndex={detail ? 0 : undefined}
        onKeyDown={handleGalleryKeyDown}
        onPointerDown={detail ? handlePointerDown : undefined}
        onPointerUp={detail ? handlePointerUp : undefined}
        onPointerCancel={
          detail
            ? () => {
                gestureStart.current = null;
              }
            : undefined
        }
      >
        <Image
          className="store-product-image"
          src={image.src}
          alt={image.alt}
          fill
          draggable={false}
          priority={priority}
          quality={detail ? 85 : 75}
          sizes={
            detail
              ? "(max-width: 720px) 90vw, 440px"
              : compact
                ? "(max-width: 720px) 50vw, (max-width: 1050px) 25vw, 17vw"
                : "(max-width: 720px) 100vw, (max-width: 1050px) 50vw, 34vw"
          }
        />

        {onOpen ? (
          <button
            type="button"
            className="store-product-carousel-open"
            aria-label={`Открыть товар: ${product.title}`}
            aria-describedby={statusId}
            onClick={handleOpen}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => {
              gestureStart.current = null;
            }}
          />
        ) : null}

        <FadeChevronButton
          direction="left"
          className="store-product-carousel-arrow store-product-carousel-previous"
          aria-label={`Предыдущее фото товара: ${product.title}`}
          aria-describedby={statusId}
          onClick={() => moveImage(-1)}
        />
        <FadeChevronButton
          direction="right"
          className="store-product-carousel-arrow store-product-carousel-next"
          aria-label={`Следующее фото товара: ${product.title}`}
          aria-describedby={statusId}
          onClick={() => moveImage(1)}
        />

        <div className="store-product-carousel-dots" aria-hidden="true">
          {product.images.map((productImage, index) => (
            <span
              key={productImage.src}
              className={index === imageIndex ? "is-active" : undefined}
            />
          ))}
        </div>
        <span id={statusId} className="sr-only" aria-live="polite" aria-atomic>
          Фото {imageIndex + 1} из {product.images.length}
        </span>
      </div>

      {detail ? (
        <div
          className="store-product-gallery-thumbnails"
          role="group"
          aria-label="Выбор фотографии товара"
        >
          {product.images.map((productImage, index) => (
            <button
              key={productImage.src}
              type="button"
              className="store-product-gallery-thumbnail"
              aria-label={`Показать фото ${index + 1}: ${productImage.alt}`}
              aria-current={index === imageIndex ? "true" : undefined}
              onClick={() => onImageIndexChange(index)}
            >
              <Image
                src={productImage.src}
                alt=""
                fill
                quality={75}
                sizes="72px"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
