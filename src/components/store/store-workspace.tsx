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
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
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
import { StoreProductDialog } from "@/components/store/store-product-dialog";
import {
  StoreCheckoutDialog,
  type StoreCheckoutStep,
} from "@/components/store/store-checkout-dialog";

type StoreView = "comfortable" | "compact";

type BrowserViewTransition = {
  finished: Promise<void>;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => BrowserViewTransition;
};

type OpenStoreProduct = {
  product: StoreProduct;
  imageIndex: number;
};

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
  priority,
  imageIndex,
  transitionSource,
  onAdd,
  onImageIndexChange,
  onOpen,
}: {
  product: StoreProduct;
  quantity: number;
  highlighted: boolean;
  compact: boolean;
  priority: boolean;
  imageIndex: number;
  transitionSource: boolean;
  onAdd: (product: StoreProduct) => void;
  onImageIndexChange: (product: StoreProduct, imageIndex: number) => void;
  onOpen: (product: StoreProduct, imageIndex: number) => void;
}) {
  return (
    <article
      id={`store-product-${product.id}`}
      tabIndex={-1}
      className={`store-product-card ${highlighted ? "store-product-highlighted" : ""}`}
      onClick={(event) => {
        const target = event.target;
        if (target instanceof Element && target.closest("button, a, input")) {
          return;
        }
        event.currentTarget.focus({ preventScroll: true });
        onOpen(product, imageIndex);
      }}
    >
      <SurfaceCard
        className={`store-product-card-surface ${transitionSource ? "store-product-card-transition-source" : ""}`}
        bodyClassName="store-product-card-inner"
      >
        <StoreProductCarousel
          product={product}
          compact={compact}
          imageIndex={imageIndex}
          onImageIndexChange={(index) => onImageIndexChange(product, index)}
          onOpen={() => onOpen(product, imageIndex)}
          priority={priority}
        />
        <div className="store-product-card-body">
          <div className="store-product-card-meta">
            <span>{CATEGORY_LABELS[product.category]}</span>
            <span>
              {product.audience === "teacher"
                ? "Для преподавателя"
                : "Для ученика"}
            </span>
          </div>
          <h2>
            <button
              type="button"
              className="store-product-title-button"
              onClick={() => onOpen(product, imageIndex)}
            >
              {product.title}
            </button>
          </h2>
          <p>{product.description}</p>
          <div className="store-product-card-footer">
            <strong>{formatStorePrice(product.priceKopeks)}</strong>
            <Button
              className="store-product-add"
              aria-label={`Добавить в корзину: ${product.title}`}
              onClick={() => onAdd(product)}
            >
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
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
  const [productImageIndexes, setProductImageIndexes] = useState<
    Record<string, number>
  >({});
  const [cartState, dispatchCart] = useReducer(storeCartReducer, {});
  const [checkoutStep, setCheckoutStep] = useState<StoreCheckoutStep | null>(
    null,
  );
  const [openProduct, setOpenProduct] = useState<OpenStoreProduct | null>(null);
  const [transitionProductSlug, setTransitionProductSlug] = useState<
    string | null
  >(null);
  const productTransitionTokenRef = useRef(0);
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

  const runProductTransition = useCallback(
    (productSlug: string, update: () => void) => {
      const transitionDocument = document as ViewTransitionDocument;
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (!transitionDocument.startViewTransition || reducedMotion) {
        update();
        return Promise.resolve();
      }

      const token = ++productTransitionTokenRef.current;
      flushSync(() => setTransitionProductSlug(productSlug));

      try {
        const transition = transitionDocument.startViewTransition(() => {
          if (productTransitionTokenRef.current !== token) return;
          flushSync(update);
        });
        return transition.finished
          .catch(() => undefined)
          .then(() => {
            if (productTransitionTokenRef.current === token) {
              setTransitionProductSlug(null);
            }
          });
      } catch {
        setTransitionProductSlug(null);
        update();
        return Promise.resolve();
      }
    },
    [],
  );

  const closeProduct = useCallback(() => {
    if (!openProduct) return;
    void runProductTransition(openProduct.product.slug, () => {
      setOpenProduct(null);
    });
  }, [openProduct, runProductTransition]);

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

  function showProduct(product: StoreProduct, imageIndex: number) {
    void runProductTransition(product.slug, () => {
      setOpenProduct({ product, imageIndex });
    });
  }

  function updateProductImage(product: StoreProduct, imageIndex: number) {
    setProductImageIndexes((current) =>
      current[product.slug] === imageIndex
        ? current
        : { ...current, [product.slug]: imageIndex },
    );
    setOpenProduct((current) =>
      current?.product.slug === product.slug &&
      current.imageIndex !== imageIndex
        ? { ...current, imageIndex }
        : current,
    );
  }

  function buyProductNow(product: StoreProduct) {
    if ((cartState[product.slug] ?? 0) === 0) {
      dispatchCart({ type: "add", slug: product.slug });
    }
    setAnnouncement(`${product.title} выбран для оформления.`);
    void runProductTransition(product.slug, () => {
      setOpenProduct(null);
    }).then(() => setCheckoutStep("delivery"));
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
              {visibleProducts.map((product, index) => (
                <StoreProductCard
                  key={product.id}
                  product={product}
                  quantity={cartState[product.slug] ?? 0}
                  highlighted={targetProduct?.slug === product.slug}
                  compact={view === "compact"}
                  priority={index === 0}
                  imageIndex={productImageIndexes[product.slug] ?? 0}
                  transitionSource={
                    transitionProductSlug === product.slug &&
                    openProduct?.product.slug !== product.slug
                  }
                  onAdd={addProduct}
                  onImageIndexChange={updateProductImage}
                  onOpen={showProduct}
                />
              ))}
            </div>
          )}
        </div>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      </section>

      {openProduct ? (
        <StoreProductDialog
          key={openProduct.product.slug}
          product={openProduct.product}
          imageIndex={openProduct.imageIndex}
          quantity={cartState[openProduct.product.slug] ?? 0}
          transitionTarget={transitionProductSlug === openProduct.product.slug}
          onImageIndexChange={(imageIndex) =>
            updateProductImage(openProduct.product, imageIndex)
          }
          onAdd={addProduct}
          onBuyNow={buyProductNow}
          onClose={closeProduct}
        />
      ) : null}

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
