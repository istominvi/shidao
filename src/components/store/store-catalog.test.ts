import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_STORE_FILTERS,
  STORE_CATEGORIES,
  STORE_PRODUCTS,
  deriveStoreCart,
  filterAndSortStoreProducts,
  formatStorePrice,
  formatStoreProductCount,
  storeCartReducer,
  storeCategoryCounts,
} from "./store-catalog";
import type {
  StoreCartAction,
  StoreCartState,
  StoreFilters,
  StoreProduct,
} from "./store-catalog";

const PRODUCT_BY_SLUG = new Map(
  STORE_PRODUCTS.map((product) => [product.slug, product]),
);

function filtered(overrides: Partial<StoreFilters> = {}) {
  return filterAndSortStoreProducts(STORE_PRODUCTS, {
    ...DEFAULT_STORE_FILTERS,
    ...overrides,
  });
}

function reduceCart(
  actions: readonly StoreCartAction[],
  initialState: StoreCartState = {},
) {
  return actions.reduce(storeCartReducer, initialState);
}

test("store demo catalog has nine stable, complete, realistic products", () => {
  assert.equal(STORE_PRODUCTS.length, 9);
  assert.equal(new Set(STORE_PRODUCTS.map((product) => product.id)).size, 9);
  assert.equal(new Set(STORE_PRODUCTS.map((product) => product.slug)).size, 9);
  assert.equal(
    new Set(STORE_PRODUCTS.map((product) => product.visualKey)).size,
    9,
  );

  for (const product of STORE_PRODUCTS) {
    assert.match(product.id, /^store-product-\d{3}$/);
    assert.match(product.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(product.title.length > 10);
    assert.ok(product.description.length > 40);
    assert.ok(product.tags.length >= 3);
    assert.ok(Number.isInteger(product.priceKopeks));
    assert.ok(product.priceKopeks > 0);
    assert.ok(Number.isInteger(product.popularity));
    assert.ok(product.popularity >= 0);
    assert.ok(Number.isInteger(product.stock));
    assert.ok(product.stock >= 0);
  }

  assert.deepEqual(
    new Set(STORE_PRODUCTS.map((product) => product.category)),
    new Set(["books", "workbooks", "cards", "stationery", "toys"]),
  );
  assert.deepEqual(
    new Set(STORE_PRODUCTS.map((product) => product.audience)),
    new Set(["learner", "teacher"]),
  );
  assert.ok(
    STORE_PRODUCTS.some((product) => product.title.includes("иероглиф")),
  );
  assert.ok(
    STORE_PRODUCTS.some((product) => product.title.includes("Методика")),
  );
  assert.ok(
    STORE_PRODUCTS.some((product) => product.category === "stationery"),
  );
  assert.ok(STORE_PRODUCTS.some((product) => product.category === "toys"));
});

test("store category metadata and counts include all and every concrete category", () => {
  assert.deepEqual(
    STORE_CATEGORIES.map((category) => category.value),
    ["all", "books", "workbooks", "cards", "stationery", "toys"],
  );
  assert.deepEqual(storeCategoryCounts(), {
    all: 9,
    books: 2,
    workbooks: 2,
    cards: 2,
    stationery: 2,
    toys: 1,
  });
  assert.deepEqual(storeCategoryCounts(STORE_PRODUCTS.slice(0, 3)), {
    all: 3,
    books: 1,
    workbooks: 2,
    cards: 0,
    stationery: 0,
    toys: 0,
  });
});

test("store search normalizes Cyrillic case, yo, punctuation, and whitespace", () => {
  assert.deepEqual(
    filtered({ query: "  КИТАЙСКИЕ   ИЕРОГЛИФЫ  " }).map(
      (product) => product.slug,
    ),
    ["propisi-pervye-kitaiskie-ieroglify"],
  );
  assert.deepEqual(
    filtered({ query: "РЕБЁНКА" }).map((product) => product.slug),
    ["propisi-pervye-kitaiskie-ieroglify"],
  );
  assert.deepEqual(
    filtered({ query: "пиньинем, яркой" }).map((product) => product.slug),
    ["kartochki-100-kitaiskikh-slov"],
  );
  assert.deepEqual(filtered({ query: "несуществующий товар" }), []);
});

test("store filters by category", () => {
  assert.deepEqual(
    filtered({ category: "cards" }).map((product) => product.slug),
    [
      "kartochki-100-kitaiskikh-slov",
      "kartochki-kliuchi-kitaiskikh-ieroglifov",
    ],
  );
});

test("store combines category and query with AND semantics", () => {
  assert.deepEqual(
    filtered({
      category: "books",
      query: "сценарии детскими",
    }).map((product) => product.slug),
    ["metodika-igrovykh-urokov-kitaiskogo"],
  );
  assert.deepEqual(
    filtered({
      category: "stationery",
      query: "маркеры",
    }).map((product) => product.slug),
    ["markery-kistochki-dlya-kalligrafii"],
  );
});

test("store sort modes are deterministic and never mutate the input", () => {
  const products: StoreProduct[] = [
    {
      ...STORE_PRODUCTS[0],
      id: "store-product-sort-b",
      slug: "sort-b",
      title: "Товар 10",
      priceKopeks: 50000,
      popularity: 10,
    },
    {
      ...STORE_PRODUCTS[1],
      id: "store-product-sort-a",
      slug: "sort-a",
      title: "Товар 2",
      priceKopeks: 50000,
      popularity: 10,
    },
    {
      ...STORE_PRODUCTS[2],
      id: "store-product-sort-c",
      slug: "sort-c",
      title: "Альбом",
      priceKopeks: 90000,
      popularity: 30,
    },
  ];
  const originalOrder = products.map((product) => product.id);
  const applySort = (sort: StoreFilters["sort"]) =>
    filterAndSortStoreProducts(products, {
      ...DEFAULT_STORE_FILTERS,
      sort,
    }).map((product) => product.id);

  assert.deepEqual(applySort("popular"), [
    "store-product-sort-c",
    "store-product-sort-a",
    "store-product-sort-b",
  ]);
  assert.deepEqual(applySort("price-asc"), [
    "store-product-sort-a",
    "store-product-sort-b",
    "store-product-sort-c",
  ]);
  assert.deepEqual(applySort("price-desc"), [
    "store-product-sort-c",
    "store-product-sort-a",
    "store-product-sort-b",
  ]);
  assert.deepEqual(applySort("title"), [
    "store-product-sort-c",
    "store-product-sort-a",
    "store-product-sort-b",
  ]);
  assert.deepEqual(
    products.map((product) => product.id),
    originalOrder,
  );
});

test("cart reducer adds, increments, decrements, removes, and clears items", () => {
  const firstSlug = STORE_PRODUCTS[0].slug;
  const secondSlug = STORE_PRODUCTS[1].slug;
  const state = reduceCart([
    { type: "add", slug: firstSlug },
    { type: "increment", slug: firstSlug },
    { type: "add", slug: secondSlug },
    { type: "decrement", slug: firstSlug },
  ]);

  assert.deepEqual(state, { [firstSlug]: 1, [secondSlug]: 1 });
  assert.deepEqual(
    storeCartReducer(state, { type: "decrement", slug: firstSlug }),
    {
      [secondSlug]: 1,
    },
  );
  assert.deepEqual(
    storeCartReducer(state, { type: "remove", slug: secondSlug }),
    {
      [firstSlug]: 1,
    },
  );
  assert.deepEqual(storeCartReducer(state, { type: "clear" }), {});
});

test("cart reducer caps quantity at 99 and ignores unknown or absent slugs", () => {
  const slug = STORE_PRODUCTS[0].slug;
  const fullState = { [slug]: 99 };
  const unknownAction = { type: "add", slug: "unknown-product" } as const;

  assert.equal(
    storeCartReducer(fullState, { type: "increment", slug }),
    fullState,
  );
  assert.equal(storeCartReducer(fullState, unknownAction), fullState);
  assert.equal(
    storeCartReducer(fullState, {
      type: "decrement",
      slug: STORE_PRODUCTS[2].slug,
    }),
    fullState,
  );
  assert.equal(
    storeCartReducer(fullState, {
      type: "remove",
      slug: STORE_PRODUCTS[2].slug,
    }),
    fullState,
  );
  assert.deepEqual(
    reduceCart(
      Array.from({ length: 120 }, () => ({ type: "add", slug }) as const),
    ),
    { [slug]: 99 },
  );
});

test("derived cart returns ordered lines, total item count, and kopek totals", () => {
  const first = STORE_PRODUCTS[0];
  const second = STORE_PRODUCTS[4];
  const cart = deriveStoreCart({
    [first.slug]: 2,
    [second.slug]: 3,
    "unknown-product": 50,
  });

  assert.deepEqual(
    cart.lines.map((line) => ({
      slug: line.product.slug,
      quantity: line.quantity,
      lineTotalKopeks: line.lineTotalKopeks,
    })),
    [
      {
        slug: first.slug,
        quantity: 2,
        lineTotalKopeks: first.priceKopeks * 2,
      },
      {
        slug: second.slug,
        quantity: 3,
        lineTotalKopeks: second.priceKopeks * 3,
      },
    ],
  );
  assert.equal(cart.count, 5);
  assert.equal(
    cart.subtotalKopeks,
    first.priceKopeks * 2 + second.priceKopeks * 3,
  );
  assert.equal(PRODUCT_BY_SLUG.get(first.slug), cart.lines[0]?.product);
});

test("derived cart defensively normalizes invalid quantities", () => {
  const [first, second, third, fourth] = STORE_PRODUCTS;
  const cart = deriveStoreCart({
    [first.slug]: 150,
    [second.slug]: 2.8,
    [third.slug]: -4,
    [fourth.slug]: Number.NaN,
  });

  assert.deepEqual(
    cart.lines.map((line) => line.quantity),
    [99, 2],
  );
  assert.equal(cart.count, 101);
  assert.equal(
    cart.subtotalKopeks,
    first.priceKopeks * 99 + second.priceKopeks * 2,
  );
});

test("store price and product-count formatters use Russian presentation", () => {
  assert.equal(formatStorePrice(39000), "390\u00a0₽");
  assert.equal(formatStorePrice(129000), "1 290\u00a0₽");
  assert.equal(formatStorePrice(129050), "1 290,5\u00a0₽");

  assert.equal(formatStoreProductCount(0), "0 товаров");
  assert.equal(formatStoreProductCount(1), "1 товар");
  assert.equal(formatStoreProductCount(2), "2 товара");
  assert.equal(formatStoreProductCount(5), "5 товаров");
  assert.equal(formatStoreProductCount(11), "11 товаров");
  assert.equal(formatStoreProductCount(21), "21 товар");
  assert.equal(formatStoreProductCount(22), "22 товара");
  assert.equal(formatStoreProductCount(25), "25 товаров");
});
