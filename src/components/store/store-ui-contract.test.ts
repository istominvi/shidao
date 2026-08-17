import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const page = source("src/app/(app)/store/page.tsx");
const workspace = source("src/components/store/store-workspace.tsx");
const carousel = source("src/components/store/store-product-carousel.tsx");
const productDialog = source("src/components/store/store-product-dialog.tsx");
const fadeControl = source("src/components/ui/fade-chevron-button.tsx");
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
  assert.doesNotMatch(workspace, /Демо · без оплаты|store-demo-label/);
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
  assert.match(workspace, /value: "compact"/);
  assert.match(workspace, /label: "Компактные карточки"/);
  assert.match(workspace, /value: "comfortable"/);
  assert.match(workspace, /label: "Крупные карточки"/);
  assert.match(workspace, /<StoreProductCard/);
  assert.match(workspace, /<StoreProductCarousel/);
  assert.doesNotMatch(workspace, /StoreProductTable|ProductTable|Таблиц/);
  assert.doesNotMatch(workspace, /product\.stock|В наличии|Нет в наличии/);
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
  assert.match(catalog, /images: \[/);
  assert.match(catalog, /\/store\/products\/[^/]+\/cover\.webp/);
  assert.doesNotMatch(catalog, /visualKey|\bstock:/);
});

test("Store cards use optimized square galleries with open, swipe, and shared fade controls", () => {
  assert.match(carousel, /import Image from "next\/image"/);
  assert.match(carousel, /className="store-product-carousel"/);
  assert.match(carousel, /className="store-product-image"/);
  assert.match(carousel, /alt=\{image\.alt\}/);
  assert.doesNotMatch(carousel, /unoptimized/);
  assert.match(carousel, /quality=\{detail \? 85 : 75\}/);
  assert.match(carousel, /Открыть товар/);
  assert.match(carousel, /Предыдущее фото товара/);
  assert.match(carousel, /Следующее фото товара/);
  assert.match(carousel, /onPointerDown=\{handlePointerDown\}/);
  assert.match(carousel, /onPointerUp=\{handlePointerUp\}/);
  assert.match(
    carousel,
    /Фото \{imageIndex \+ 1\} из \{product\.images\.length\}/,
  );
  assert.match(carousel, /aria-live="polite"/);
  assert.match(carousel, /<FadeChevronButton/);
  assert.match(fadeControl, /"fade-chevron-control"/);
  assert.match(workspace, /<StoreProductDialog/);

  assert.match(styles, /\.store-product-carousel\s*\{[^}]*aspect-ratio: 1;/);
  assert.match(styles, /\.store-product-image\s*\{[^}]*object-fit: cover;/);
  assert.match(
    styles,
    /\.store-product-grid-comfortable\s*\{[^}]*repeat\(3, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    styles,
    /\.store-product-grid-compact\s*\{[^}]*repeat\(6, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    styles,
    /\.store-product-card-footer\s*\{[^}]*align-items: center;[^}]*margin-top: auto;/,
  );
  assert.match(
    styles,
    /\.store-product-card-footer strong\s*\{[^}]*font-size: 1\.18rem;/,
  );

  const arrowStyles =
    /\.store-product-carousel-arrow\s*\{[^}]*\}/.exec(styles)?.[0] ?? "";
  const dotStyles =
    /\.store-product-carousel-dots\s*\{[^}]*\}/.exec(styles)?.[0] ?? "";
  const footerStyles =
    /\.store-product-card-footer\s*\{[^}]*\}/.exec(styles)?.[0] ?? "";
  assert.doesNotMatch(
    arrowStyles,
    /border:|border-radius:|background:|box-shadow:|backdrop-filter:/,
  );
  assert.match(dotStyles, /radial-gradient/);
  assert.doesNotMatch(dotStyles, /box-shadow:/);
  assert.doesNotMatch(footerStyles, /border-top:/);
  assert.doesNotMatch(workspace, /store-product-tags/);
  assert.match(workspace, /<ShoppingCart className="h-4 w-4"/);
  assert.match(workspace, /className="store-product-card-meta"/);
});

test("Store product details expand into a large accessible purchase dialog", () => {
  assert.match(productDialog, /<DialogShell/);
  assert.match(productDialog, /title=\{product\.title\}/);
  assert.match(productDialog, /closeLabel="Закрыть товар"/);
  assert.match(productDialog, /event\.key !== "Escape"/);
  assert.match(productDialog, /<StoreProductCarousel/);
  assert.match(productDialog, /detail/);
  assert.match(productDialog, /product\.description/);
  assert.match(productDialog, /formatStorePrice/);
  assert.match(productDialog, /В корзину/);
  assert.match(productDialog, /Оформить сразу/);
  assert.match(carousel, /store-product-gallery-thumbnails/);
  assert.match(carousel, /aria-current=\{index === imageIndex/);
  assert.match(workspace, /startViewTransition/);
  assert.match(workspace, /flushSync/);
  assert.match(
    styles,
    /\.store-product-dialog-panel\s*\{[^}]*min\(56rem,[^}]*min\(42rem,/,
  );
  assert.match(styles, /view-transition-name: store-product-detail;/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?view-transition-group\(store-product-detail\)/,
  );
});

test("Store sort menu and cards adopt canonical raised surfaces", () => {
  assert.match(
    globalStyles,
    /:root\s*\{[^}]*--product-dropdown-background: var\(--product-surface-background\);[^}]*--product-dropdown-inset: 0\.375rem;[^}]*--product-dropdown-shadow: 0 24px 32px -24px rgba\(20, 20, 20, 0\.24\);/,
  );
  assert.match(
    globalStyles,
    /\.product-dropdown-surface\s*\{[^}]*border: 0;[^}]*padding: var\(--product-dropdown-inset, 0\.375rem\);[^}]*backdrop-filter: none;/,
  );
  assert.match(
    globalStyles,
    /:root\s*\{[^}]*--product-surface-background: #fff;[^}]*--product-surface-border-color: oklch\(0 0 0 \/ 0\.1\);[^}]*--product-surface-border: 1px solid var\(--product-surface-border-color\);[^}]*--product-raised-surface-shadow: var\(--product-raised-control-shadow\);/,
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
    /@media \(max-width: 1050px\)[\s\S]*?\.store-product-grid-comfortable\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)[\s\S]*?\.store-product-grid-compact\s*\{[^}]*repeat\(4, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    styles,
    /@media \(max-width: 720px\)[\s\S]*?\.store-product-grid-comfortable\s*\{[^}]*minmax\(0, 1fr\)[\s\S]*?\.store-product-grid-compact\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/,
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
