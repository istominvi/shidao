import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const page = source("src/app/(app)/store/page.tsx");
const workspace = source("src/components/store/store-workspace.tsx");
const filters = source("src/components/store/store-filter-menu.tsx");
const checkout = source("src/components/store/store-checkout-dialog.tsx");
const catalog = source("src/components/store/store-catalog.ts");
const styles = source("src/app/styles/store.css");
const globalStyles = source("src/app/globals.css");

test("Store is an Account page built from the shared product shell", () => {
  assert.match(page, /className="course-demo-shell store-shell pb-12"/);
  assert.match(page, /<TopNav demoStyle \/>/);
  assert.match(page, /className="container app-page-container space-y-6"/);
  assert.match(page, /<StoreWorkspace initialProductSlug=/);

  assert.match(workspace, /<AppPageHeader/);
  assert.match(workspace, /title="Магазин"/);
  assert.match(workspace, /Демо · без оплаты/);
  assert.match(workspace, /Открыть корзину/);
  assert.match(workspace, /<WorkspaceTabs/);
  assert.match(workspace, /ariaLabel="Категории магазина"/);
  assert.match(workspace, /type="search"/);
  assert.match(workspace, /<StoreFilterMenu/);
  assert.match(workspace, /aria-label="Сортировка товаров"/);
  assert.match(workspace, /<SegmentedControl/);
  assert.match(workspace, /ariaLabel="Вид товаров"/);
  assert.match(workspace, /<StoreProductTable/);
  assert.match(workspace, /<StoreProductCard/);
  assert.match(workspace, /surface: "other"/);
  assert.match(workspace, /label: "Магазин"/);

  assert.match(filters, /aria-label="Фильтры товаров"/);
  assert.match(filters, /Button, productButtonClassName/);
  assert.match(
    filters,
    /className=\{productButtonClassName\(\s*"secondary",\s*"course-filter-trigger",?\s*\)\}/,
  );
  assert.match(
    filters,
    /className="product-dropdown-surface course-filter-popover"/,
  );
  assert.match(filters, /event\.key !== "Escape"/);
  assert.match(filters, /Для преподавателя/);
  assert.match(filters, /Только в наличии/);

  assert.match(catalog, /value: "books", label: "Книги"/);
  assert.match(catalog, /value: "workbooks", label: "Прописи и тетради"/);
  assert.match(catalog, /value: "cards", label: "Карточки"/);
  assert.match(catalog, /value: "stationery", label: "Канцелярия"/);
  assert.match(catalog, /value: "toys", label: "Игры и игрушки"/);
});

test("Store filters and cards adopt canonical raised surfaces", () => {
  assert.match(
    globalStyles,
    /:root\s*\{[^}]*--product-dropdown-inset: 0\.375rem;[^}]*--product-dropdown-shadow: 0 18px 46px rgba\(20, 20, 20, 0\.18\);/,
  );
  assert.match(
    globalStyles,
    /\.product-dropdown-surface\s*\{[^}]*border: 0;[^}]*padding: var\(--product-dropdown-inset, 0\.375rem\);[^}]*backdrop-filter: none;/,
  );
  assert.match(
    globalStyles,
    /:root\s*\{[^}]*--product-surface-border: 1px solid oklch\(0 0 0 \/ 0\.1\);[^}]*--product-raised-surface-shadow: var\(--product-raised-control-shadow\);/,
  );
  assert.match(
    globalStyles,
    /\.course-filter-trigger\s*\{[^}]*list-style: none;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.store-product-card-surface\s*\{[^}]*background: #fff;[^}]*box-shadow: var\(--product-raised-surface-shadow\);/,
  );
  assert.match(
    globalStyles,
    /\.course-demo-shell \.store-product-card-surface\s*\{[^}]*border: var\(--product-surface-border\);[^}]*background-clip: padding-box;/,
  );
  assert.match(
    styles,
    /\.store-product-card:focus-visible \.store-product-card-surface,\s*\.store-product-highlighted \.store-product-card-surface\s*\{[^}]*outline: 3px solid rgba\(20, 20, 20, 0\.34\);[^}]*outline-offset: 2px;[^}]*box-shadow: var\(--product-raised-surface-shadow\);/,
  );
});

test("Store demo checkout is explicit, keyboard-closeable, and has no payment fields", () => {
  assert.match(
    checkout,
    /"cart"\s*\|\s*"delivery"\s*\|\s*"payment"\s*\|\s*"success"/,
  );
  assert.match(checkout, /event\.key !== "Escape"/);
  assert.match(checkout, /autoComplete="name"/);
  assert.match(checkout, /type="tel"/);
  assert.match(checkout, /type="email"/);
  assert.match(checkout, /autoComplete="street-address"/);
  assert.match(checkout, /Платёжная система пока не подключена/);
  assert.match(checkout, /Деньги не списываются, заказ/);
  assert.match(checkout, /Банковские реквизиты на этом этапе не запрашиваются/);
  assert.match(checkout, /Заказ не создан — это была демонстрация/);
  assert.match(checkout, /dispatchCart\(\{ type: "clear" \}\)/);

  const localOnlySource = [workspace, filters, checkout, catalog].join("\n");
  assert.doesNotMatch(localOnlySource, /\bfetch\s*\(/);
  assert.doesNotMatch(localOnlySource, /localStorage|sessionStorage/);
  assert.doesNotMatch(checkout, /cc-number|card-number|cvv|cvc/i);
});

test("Store layout has contained tablet and mobile fallbacks", () => {
  assert.match(
    styles,
    /@media \(max-width: 1050px\)[\s\S]*?\.store-product-grid\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    styles,
    /@media \(max-width: 720px\)[\s\S]*?\.store-product-grid\s*\{[^}]*minmax\(0, 1fr\)/,
  );
  assert.match(
    styles,
    /\.store-checkout-dialog-panel\s*\{[^}]*calc\(100dvw - 2rem\)[^}]*calc\(100dvh - 2rem\)/,
  );
  assert.match(
    styles,
    /@media \(max-width: 580px\)[\s\S]*?\.store-checkout-actions\s*\{[^}]*flex-direction: column-reverse/,
  );
});
