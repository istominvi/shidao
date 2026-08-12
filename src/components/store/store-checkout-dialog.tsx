"use client";

import {
  ArrowLeft,
  CircleDollarSign,
  Mail,
  MapPin,
  Minus,
  PackageCheck,
  Phone,
  Plus,
  ShoppingCart,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState, type Dispatch } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import {
  formatStorePrice,
  formatStoreProductCount,
  type DerivedStoreCart,
  type StoreCartAction,
} from "@/components/store/store-catalog";

export type StoreCheckoutStep = "cart" | "delivery" | "payment" | "success";

type CheckoutDraft = {
  recipientName: string;
  phone: string;
  email: string;
  address: string;
};

type StoreCheckoutDialogProps = {
  cart: DerivedStoreCart;
  step: StoreCheckoutStep;
  onStepChange: (step: StoreCheckoutStep) => void;
  dispatchCart: Dispatch<StoreCartAction>;
  onClose: () => void;
  initialName: string;
  initialEmail: string;
};

const STEP_COPY: Record<
  StoreCheckoutStep,
  { title: string; description: string }
> = {
  cart: {
    title: "Корзина",
    description:
      "Проверьте товары и количество. Корзина сохранится только до перезагрузки страницы.",
  },
  delivery: {
    title: "Куда доставить",
    description:
      "Укажите контактные данные для демонстрации оформления. Они никуда не отправляются.",
  },
  payment: {
    title: "Проверка заказа",
    description:
      "Последний демонстрационный шаг. Реальной оплаты и создания заказа не будет.",
  },
  success: {
    title: "Демо завершено",
    description:
      "Так будет выглядеть финал оформления после подключения магазина.",
  },
};

export function StoreCheckoutDialog({
  cart,
  step,
  onStepChange,
  dispatchCart,
  onClose,
  initialName,
  initialEmail,
}: StoreCheckoutDialogProps) {
  const stepContentRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<CheckoutDraft>({
    recipientName: initialName,
    phone: "",
    email: initialEmail,
    address: "",
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      stepContentRef.current
        ?.querySelector<HTMLElement>("[data-dialog-initial-focus]")
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);

  const copy = STEP_COPY[step];

  function finishDemo() {
    dispatchCart({ type: "clear" });
    setDraft({ recipientName: "", phone: "", email: "", address: "" });
    onStepChange("success");
  }

  return (
    <DialogShell
      title={copy.title}
      description={copy.description}
      onClose={onClose}
      panelClassName="store-checkout-dialog-panel"
      bodyClassName="store-checkout-dialog-body"
    >
      <div ref={stepContentRef} className="store-checkout-step">
        {step === "cart" ? (
          cart.lines.length === 0 ? (
            <div className="store-cart-empty">
              <span className="store-dialog-hero-icon" aria-hidden="true">
                <ShoppingCart />
              </span>
              <h3>Корзина пока пустая</h3>
              <p>Добавьте нужные для занятий товары из каталога.</p>
              <Button data-dialog-initial-focus onClick={onClose}>
                Выбрать товары
              </Button>
            </div>
          ) : (
            <div className="store-cart-layout">
              <ul className="store-cart-lines" aria-label="Товары в корзине">
                {cart.lines.map(({ product, quantity, lineTotalKopeks }) => (
                  <li key={product.slug} className="store-cart-line">
                    <div className="store-cart-line-copy">
                      <strong>{product.title}</strong>
                      <span>{formatStorePrice(lineTotalKopeks)}</span>
                    </div>
                    <div
                      className="store-cart-quantity"
                      role="group"
                      aria-label={`Количество: ${product.title}`}
                    >
                      <button
                        type="button"
                        aria-label={`Уменьшить количество: ${product.title}`}
                        onClick={() =>
                          dispatchCart({
                            type: "decrement",
                            slug: product.slug,
                          })
                        }
                      >
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <span aria-label={`${quantity} шт.`}>{quantity}</span>
                      <button
                        type="button"
                        aria-label={`Увеличить количество: ${product.title}`}
                        disabled={quantity >= 99}
                        onClick={() =>
                          dispatchCart({
                            type: "increment",
                            slug: product.slug,
                          })
                        }
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="store-cart-remove"
                      aria-label={`Удалить из корзины: ${product.title}`}
                      onClick={() =>
                        dispatchCart({ type: "remove", slug: product.slug })
                      }
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>

              <aside className="store-cart-summary" aria-label="Итого">
                <div>
                  <span>{formatStoreProductCount(cart.count)}</span>
                  <strong>{formatStorePrice(cart.subtotalKopeks)}</strong>
                </div>
                <p>Стоимость доставки в демо не рассчитывается.</p>
                <Button
                  data-dialog-initial-focus
                  onClick={() => onStepChange("delivery")}
                >
                  Оформить заказ
                </Button>
                <Button variant="ghost" onClick={onClose}>
                  Продолжить покупки
                </Button>
              </aside>
            </div>
          )
        ) : null}

        {step === "delivery" ? (
          <form
            className="store-checkout-form"
            onSubmit={(event) => {
              event.preventDefault();
              onStepChange("payment");
            }}
          >
            <label className="store-checkout-field">
              <span>
                <UserRound className="h-4 w-4" aria-hidden="true" />
                Получатель
              </span>
              <input
                data-dialog-initial-focus
                className="field-input"
                required
                minLength={2}
                maxLength={160}
                autoComplete="name"
                value={draft.recipientName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    recipientName: event.target.value,
                  }))
                }
                placeholder="Имя и фамилия"
              />
            </label>

            <label className="store-checkout-field">
              <span>
                <Phone className="h-4 w-4" aria-hidden="true" />
                Телефон
              </span>
              <input
                className="field-input"
                required
                type="tel"
                minLength={7}
                maxLength={24}
                pattern="[+0-9() -]{7,24}"
                autoComplete="tel"
                inputMode="tel"
                value={draft.phone}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="+7 900 000-00-00"
              />
            </label>

            <label className="store-checkout-field">
              <span>
                <Mail className="h-4 w-4" aria-hidden="true" />
                Email
              </span>
              <input
                className="field-input"
                required
                type="email"
                maxLength={254}
                autoComplete="email"
                value={draft.email}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="name@example.com"
              />
            </label>

            <label className="store-checkout-field store-checkout-address">
              <span>
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Адрес доставки
              </span>
              <textarea
                className="field-input"
                required
                minLength={8}
                maxLength={500}
                rows={3}
                autoComplete="street-address"
                value={draft.address}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                placeholder="Город, улица, дом, квартира"
              />
            </label>

            <Alert
              tone="info"
              title="Данные остаются на этой странице"
              className="store-checkout-address"
            >
              Форма нужна только для просмотра сценария. После закрытия или
              перезагрузки данные исчезнут.
            </Alert>

            <div className="dialog-shell-actions store-checkout-actions store-checkout-address">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onStepChange("cart")}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Назад
              </Button>
              <Button type="submit">Продолжить</Button>
            </div>
          </form>
        ) : null}

        {step === "payment" ? (
          <div className="store-payment-demo">
            <span className="store-dialog-hero-icon" aria-hidden="true">
              <CircleDollarSign />
            </span>
            <Alert tone="warning" title="Демо-режим">
              Платёжная система пока не подключена. Деньги не списываются, заказ
              не создаётся, а контактные данные никуда не отправляются.
            </Alert>
            <dl className="store-checkout-review">
              <div>
                <dt>Получатель</dt>
                <dd>{draft.recipientName}</dd>
              </div>
              <div>
                <dt>Контакты</dt>
                <dd>
                  {draft.phone} · {draft.email}
                </dd>
              </div>
              <div>
                <dt>Адрес</dt>
                <dd>{draft.address}</dd>
              </div>
              <div>
                <dt>Товары</dt>
                <dd>{formatStoreProductCount(cart.count)}</dd>
              </div>
              <div>
                <dt>Итого в демо</dt>
                <dd>{formatStorePrice(cart.subtotalKopeks)}</dd>
              </div>
            </dl>
            <p className="store-payment-no-card">
              Банковские реквизиты на этом этапе не запрашиваются.
            </p>
            <div className="dialog-shell-actions store-checkout-actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onStepChange("delivery")}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Назад
              </Button>
              <Button data-dialog-initial-focus onClick={finishDemo}>
                Завершить демо-заказ
              </Button>
            </div>
          </div>
        ) : null}

        {step === "success" ? (
          <div className="store-checkout-success">
            <span className="store-dialog-hero-icon" aria-hidden="true">
              <PackageCheck />
            </span>
            <h3>Заказ не создан — это была демонстрация</h3>
            <p>
              Корзина очищена. После подключения каталога, доставки и оплаты
              здесь появится настоящий номер заказа.
            </p>
            <Button data-dialog-initial-focus onClick={onClose}>
              Вернуться в магазин
            </Button>
          </div>
        ) : null}
      </div>
    </DialogShell>
  );
}
