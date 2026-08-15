import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const page = source("src/app/(app)/store/page.tsx");
const workspace = source("src/components/store/store-workspace.tsx");
const productSelect = source("src/components/ui/product-select.tsx");
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
  assert.match(workspace, /<ProductSelect/);
  assert.match(workspace, /label="Сортировка товаров"/);
  assert.match(workspace, /options=\{STORE_SORT_OPTIONS\}/);
  assert.match(
    workspace,
    /const hasSearchQuery = filters\.query\.trim\(\)\.length > 0;/,
  );
  assert.match(
    workspace,
    /\{hasSearchQuery \? \([\s\S]*?aria-label="Очистить поиск"[\s\S]*?onClick=\{\(\) => updateFilter\("query", ""\)\}/,
  );
  assert.doesNotMatch(workspace, /Сбросить параметры каталога/);
  assert.doesNotMatch(
    workspace,
    /const hasFilters =[\s\S]*?filters\.category !== "all"[\s\S]*?filters\.sort !== "popular"/,
  );
  assert.doesNotMatch(workspace, /StoreFilterMenu|<Select\b|<select\b/);
  assert.doesNotMatch(
    workspace,
    /audienceFilter|priceFilter|availabilityFilter|filterAudience|filterPrice|filterAvailability/,
  );
  assert.match(workspace, /<SegmentedControl/);
  assert.match(workspace, /ariaLabel="Вид товаров"/);
  assert.match(workspace, /<StoreProductTable/);
  assert.match(workspace, /<StoreProductCard/);
  assert.match(workspace, /surface: "other"/);
  assert.match(workspace, /label: "Магазин"/);

  assert.match(productSelect, /role="combobox"/);
  assert.match(productSelect, /aria-haspopup="listbox"/);
  assert.match(productSelect, /role="listbox"/);
  assert.match(productSelect, /role="option"/);
  assert.match(
    productSelect,
    /className="product-dropdown-surface product-select-panel"/,
  );

  assert.match(catalog, /value: "books", label: "Книги"/);
  assert.match(catalog, /value: "workbooks", label: "Прописи и тетради"/);
  assert.match(catalog, /value: "cards", label: "Карточки"/);
  assert.match(catalog, /value: "stationery", label: "Канцелярия"/);
  assert.match(catalog, /value: "toys", label: "Игры и игрушки"/);
});

test("Store sort menu and cards adopt canonical raised surfaces", () => {
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
    /\.product-select-trigger:focus-visible\s*\{[^}]*outline: 2px solid var\(--product-control-focus-halo\);[^}]*outline-offset: -2px;/,
  );
  assert.doesNotMatch(
    globalStyles,
    /\.course-filter-(?:trigger|popover|actions)/,
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

  const localOnlySource = [workspace, productSelect, checkout, catalog].join(
    "\n",
  );
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
