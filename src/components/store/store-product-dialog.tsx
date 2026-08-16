"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import type { StoreProduct } from "@/components/store/store-catalog";
import {
  STORE_CATEGORIES,
  formatStorePrice,
} from "@/components/store/store-catalog";
import { StoreProductCarousel } from "@/components/store/store-product-carousel";

function productCategoryLabel(product: StoreProduct) {
  return (
    STORE_CATEGORIES.find((category) => category.value === product.category)
      ?.label ?? "Учебные материалы"
  );
}

export function StoreProductDialog({
  product,
  imageIndex,
  quantity,
  transitionTarget,
  onImageIndexChange,
  onAdd,
  onBuyNow,
  onClose,
}: {
  product: StoreProduct;
  imageIndex: number;
  quantity: number;
  transitionTarget: boolean;
  onImageIndexChange: (index: number) => void;
  onAdd: (product: StoreProduct) => void;
  onBuyNow: (product: StoreProduct) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <DialogShell
      title={product.title}
      onClose={onClose}
      closeLabel="Закрыть товар"
      className="store-product-dialog"
      panelClassName={`store-product-dialog-panel ${transitionTarget ? "store-product-dialog-transition-target" : ""}`}
      bodyClassName="store-product-dialog-body"
    >
      <div className="store-product-dialog-layout">
        <StoreProductCarousel
          product={product}
          imageIndex={imageIndex}
          onImageIndexChange={onImageIndexChange}
          detail
          priority
        />

        <div className="store-product-dialog-copy">
          <div className="store-product-card-meta store-product-dialog-meta">
            <span>{productCategoryLabel(product)}</span>
            <span>
              {product.audience === "teacher"
                ? "Для преподавателя"
                : "Для ученика"}
            </span>
          </div>

          <p className="store-product-dialog-description">
            {product.description}
          </p>

          <div className="store-product-dialog-details">
            <h3>Для занятий</h3>
            <p>{product.tags.join(" · ")}</p>
          </div>

          <p className="store-product-dialog-demo-note">
            Это демонстрационная витрина: оплата и настоящий заказ пока не
            создаются.
          </p>

          <div className="store-product-dialog-purchase">
            <strong>{formatStorePrice(product.priceKopeks)}</strong>
            <div className="store-product-dialog-actions">
              <Button variant="secondary" onClick={() => onAdd(product)}>
                {quantity > 0 ? `Добавить ещё · ${quantity}` : "В корзину"}
              </Button>
              <Button onClick={() => onBuyNow(product)}>Оформить сразу</Button>
            </div>
          </div>
        </div>
      </div>
    </DialogShell>
  );
}
