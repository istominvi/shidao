"use client";

import {
  BookOpenText,
  GalleryHorizontalEnd,
  Grid3X3,
  LayoutGrid,
  NotebookPen,
  PackageOpen,
  PencilRuler,
  Puzzle,
  RotateCcw,
  Search,
  ShoppingBag,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { AppPageHeader } from "@/components/app/page-header";
import { useSystemAssistantPageContext } from "@/components/assistant/system-assistant-provider";
import { useSessionView } from "@/components/use-session-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductSelect } from "@/components/ui/product-select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  WorkspaceTabs,
  workspaceTabId,
  workspaceTabPanelId,
} from "@/components/ui/workspace-tabs";
import { isInternalAuthEmail } from "@/lib/auth";
import {
  DEFAULT_STORE_FILTERS,
  STORE_CATEGORIES,
  STORE_PRODUCTS,
  deriveStoreCart,
  filterAndSortStoreProducts,
  formatStorePrice,
  storeCartReducer,
  storeCategoryCounts,
  type StoreCategory,
  type StoreFilters,
  type StoreProduct,
} from "@/components/store/store-catalog";
import { StoreProductCarousel } from "@/components/store/store-product-carousel";
import {
  StoreCheckoutDialog,
  type StoreCheckoutStep,
} from "@/components/store/store-checkout-dialog";

type StoreView = "comfortable" | "compact";

const STORE_TABS_ID = "store-categories";

const STORE_SORT_OPTIONS = [
  { value: "popular", label: "Сначала популярные" },
  { value: "price-asc", label: "Сначала дешевле" },
  { value: "price-desc", label: "Сначала дороже" },
  { value: "title", label: "По названию" },
] as const;

const STORE_CATEGORY_ICONS: Record<StoreCategory, LucideIcon> = {
  all: PackageOpen,
  books: BookOpenText,
  workbooks: NotebookPen,
  cards: GalleryHorizontalEnd,
  stationery: PencilRuler,
  toys: Puzzle,
};

const CATEGORY_LABELS = Object.fromEntries(
  STORE_CATEGORIES.map((category) => [category.value, category.label]),
) as Record<StoreCategory, string>;

function StoreProductCard({
  product,
  quantity,
  highlighted,
  compact,
  onAdd,
}: {
  product: StoreProduct;
  quantity: number;
  highlighted: boolean;
  compact: boolean;
  onAdd: (product: StoreProduct) => void;
}) {
  return (
    <article
      id={`store-product-${product.id}`}
      tabIndex={-1}
      className={`store-product-card ${highlighted ? "store-product-highlighted" : ""}`}
    >
      <SurfaceCard
        className="store-product-card-surface"
        bodyClassName="store-product-card-inner"
      >
        <StoreProductCarousel product={product} compact={compact} />
        <div className="store-product-card-body">
          <div className="store-product-card-meta">
            <span>{CATEGORY_LABELS[product.category]}</span>
            <span>
              {product.audience === "teacher"
                ? "Для преподавателя"
                : "Для ученика"}
            </span>
          </div>
          <h2>{product.title}</h2>
          <p>{product.description}</p>
          <div className="store-product-tags" aria-label="Метки товара">
            {product.tags.slice(0, 2).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <div className="store-product-card-footer">
            <strong>{formatStorePrice(product.priceKopeks)}</strong>
            <Button
              className="store-product-add"
              aria-label={`Добавить в корзину: ${product.title}`}
              onClick={() => onAdd(product)}
            >
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              <span className="store-product-add-label">
                {quantity > 0 ? `Ещё · ${quantity}` : "В корзину"}
              </span>
            </Button>
          </div>
        </div>
      </SurfaceCard>
    </article>
  );
}

export function StoreWorkspace({
  initialProductSlug,
}: {
  initialProductSlug: string | null;
}) {
  const targetProduct = STORE_PRODUCTS.find(
    (product) => product.slug === initialProductSlug,
  );
  const [filters, setFilters] = useState<StoreFilters>(() => ({
    ...DEFAULT_STORE_FILTERS,
    category: targetProduct?.category ?? "all",
  }));
  const [view, setView] = useState<StoreView>("comfortable");
  const [cartState, dispatchCart] = useReducer(storeCartReducer, {});
  const [checkoutStep, setCheckoutStep] = useState<StoreCheckoutStep | null>(
    null,
  );
  const [announcement, setAnnouncement] = useState("");
  const { state: session } = useSessionView();

  useSystemAssistantPageContext({
    surface: "other",
    courseId: null,
    lessonId: null,
    label: "Магазин",
  });

  const categoryCounts = useMemo(() => storeCategoryCounts(), []);
  const tabs = useMemo(
    () =>
      STORE_CATEGORIES.map((category) => ({
        value: category.value,
        label: category.label,
        icon: STORE_CATEGORY_ICONS[category.value],
        count: categoryCounts[category.value],
      })),
    [categoryCounts],
  );
  const visibleProducts = useMemo(
    () => filterAndSortStoreProducts(STORE_PRODUCTS, filters),
    [filters],
  );
  const cart = useMemo(() => deriveStoreCart(cartState), [cartState]);
  const hasSearchQuery = filters.query.trim().length > 0;
  const initialName =
    session.kind === "account" ? (session.fullName ?? "") : "";
  const initialEmail =
    session.kind === "account" && !isInternalAuthEmail(session.email)
      ? (session.email ?? "")
      : "";

  useEffect(() => {
    if (!targetProduct) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(
        `store-product-${targetProduct.id}`,
      );
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [targetProduct]);

  const closeCheckout = useCallback(() => setCheckoutStep(null), []);

  function updateFilter<TKey extends keyof StoreFilters>(
    key: TKey,
    value: StoreFilters[TKey],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters(DEFAULT_STORE_FILTERS);
  }

  function addProduct(product: StoreProduct) {
    dispatchCart({ type: "add", slug: product.slug });
    setAnnouncement(`${product.title} добавлен в корзину.`);
  }

  return (
    <>
      <AppPageHeader
        title="Магазин"
        metric={`Товаров: ${visibleProducts.length} · в корзине: ${cart.count}`}
        actions={
          <Button
            className="store-cart-trigger"
            aria-label={
              cart.count > 0
                ? `Открыть корзину, товаров: ${cart.count}`
                : "Открыть корзину"
            }
            onClick={() => setCheckoutStep("cart")}
          >
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            Корзина
            {cart.count > 0 ? (
              <span className="store-cart-badge" aria-hidden="true">
                {cart.count}
              </span>
            ) : null}
          </Button>
        }
      />

      <section className="store-workspace" aria-label="Каталог магазина">
        <WorkspaceTabs
          idBase={STORE_TABS_ID}
          ariaLabel="Категории магазина"
          value={filters.category}
          items={tabs}
          onChange={(category) => updateFilter("category", category)}
        />

        <div
          id={workspaceTabPanelId(STORE_TABS_ID, filters.category)}
          role="tabpanel"
          aria-labelledby={workspaceTabId(STORE_TABS_ID, filters.category)}
          tabIndex={0}
        >
          <div
            className="compact-page-toolbar store-toolbar"
            aria-label="Управление товарами"
          >
            <label className="compact-toolbar-search product-search-wrap">
              <span className="sr-only">Поиск товаров</span>
              <Search
                className="product-search-icon h-4 w-4"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={filters.query}
                onChange={(event) => updateFilter("query", event.target.value)}
                className="product-control-search"
                placeholder="Найти учебник, прописи, карточки…"
                autoComplete="off"
              />
            </label>

            <div className="compact-toolbar-rail store-toolbar-rail">
              <ProductSelect
                className="compact-toolbar-sort"
                label="Сортировка товаров"
                value={filters.sort}
                options={STORE_SORT_OPTIONS}
                onChange={(sort) => updateFilter("sort", sort)}
              />

              {hasSearchQuery ? (
                <Button
                  variant="ghost"
                  className="compact-toolbar-reset"
                  aria-label="Очистить поиск"
                  title="Очистить поиск"
                  onClick={() => updateFilter("query", "")}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}

              <SegmentedControl
                ariaLabel="Вид товаров"
                value={view}
                onChange={setView}
                iconOnly
                items={[
                  {
                    value: "compact",
                    label: "Компактные карточки",
                    ariaLabel: "Показать компактные карточки товаров",
                    icon: Grid3X3,
                  },
                  {
                    value: "comfortable",
                    label: "Крупные карточки",
                    ariaLabel: "Показать крупные карточки товаров",
                    icon: LayoutGrid,
                  },
                ]}
              />
            </div>
          </div>

          {visibleProducts.length === 0 ? (
            <SurfaceCard
              className="store-empty-state"
              bodyClassName="store-empty-state-body"
            >
              <PackageOpen className="h-7 w-7" aria-hidden="true" />
              <h2>Ничего не найдено</h2>
              <p>Попробуйте другой запрос или верните все товары в каталог.</p>
              <Button onClick={resetFilters}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Показать все товары
              </Button>
            </SurfaceCard>
          ) : (
            <div
              className={`store-product-grid store-product-grid-${view}`}
              aria-label={
                view === "compact"
                  ? "Товары компактными карточками"
                  : "Товары крупными карточками"
              }
              data-density={view}
            >
              {visibleProducts.map((product) => (
                <StoreProductCard
                  key={product.id}
                  product={product}
                  quantity={cartState[product.slug] ?? 0}
                  highlighted={targetProduct?.slug === product.slug}
                  compact={view === "compact"}
                  onAdd={addProduct}
                />
              ))}
            </div>
          )}
        </div>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      </section>

      {checkoutStep ? (
        <StoreCheckoutDialog
          cart={cart}
          step={checkoutStep}
          onStepChange={setCheckoutStep}
          dispatchCart={dispatchCart}
          onClose={closeCheckout}
          initialName={initialName}
          initialEmail={initialEmail}
        />
      ) : null}
    </>
  );
}
