"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import {
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { StoreProduct } from "@/components/store/store-catalog";

const SWIPE_THRESHOLD_PX = 36;
const SYNTHETIC_TAP_GUARD_MS = 350;

function wrappedImageIndex(index: number, imageCount: number) {
  return (index + imageCount) % imageCount;
}

export function StoreProductCarousel({
  product,
  compact,
}: {
  product: StoreProduct;
  compact: boolean;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const statusId = useId();
  const gestureStart = useRef<{ x: number; y: number } | null>(null);
  const suppressTapUntil = useRef(0);
  const image = product.images[imageIndex] ?? product.images[0];

  function moveImage(offset: -1 | 1) {
    setImageIndex((current) =>
      wrappedImageIndex(current + offset, product.images.length),
    );
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse") return;
    gestureStart.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
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

  function handleTap() {
    if (performance.now() < suppressTapUntil.current) return;
    moveImage(1);
  }

  return (
    <div
      className="store-product-carousel"
      role="group"
      aria-label={`Фотографии товара: ${product.title}`}
      data-image-index={imageIndex}
    >
      <Image
        className="store-product-image"
        src={image.src}
        alt={image.alt}
        fill
        unoptimized
        draggable={false}
        sizes={
          compact
            ? "(max-width: 720px) 50vw, (max-width: 1050px) 25vw, 17vw"
            : "(max-width: 720px) 100vw, (max-width: 1050px) 50vw, 34vw"
        }
      />

      <button
        type="button"
        className="store-product-carousel-tap"
        aria-label={`Показать следующее фото товара: ${product.title}`}
        aria-describedby={statusId}
        onClick={handleTap}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          gestureStart.current = null;
        }}
      />

      <button
        type="button"
        className="store-product-carousel-arrow store-product-carousel-previous"
        aria-label={`Предыдущее фото товара: ${product.title}`}
        aria-describedby={statusId}
        onClick={() => moveImage(-1)}
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      <button
        type="button"
        className="store-product-carousel-arrow store-product-carousel-next"
        aria-label={`Следующее фото товара: ${product.title}`}
        aria-describedby={statusId}
        onClick={() => moveImage(1)}
      >
        <ChevronRight aria-hidden="true" />
      </button>

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
  );
}
