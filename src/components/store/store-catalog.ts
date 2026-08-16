export type StoreCategory =
  "all" | "books" | "workbooks" | "cards" | "stationery" | "toys";

export type StoreProductCategory = Exclude<StoreCategory, "all">;

export type StoreAudience = "learner" | "teacher";

export type StoreSort = "popular" | "price-asc" | "price-desc" | "title";

export type StoreProductImage = {
  src: string;
  alt: string;
};

export type StoreProduct = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: StoreProductCategory;
  audience: StoreAudience;
  tags: readonly string[];
  priceKopeks: number;
  popularity: number;
  images: readonly [
    StoreProductImage,
    StoreProductImage,
    ...StoreProductImage[],
  ];
};

export type StoreFilters = {
  category: StoreCategory;
  query: string;
  sort: StoreSort;
};

export type StoreCartState = Record<string, number>;

export type StoreCartAction =
  | { type: "add"; slug: string }
  | { type: "increment"; slug: string }
  | { type: "decrement"; slug: string }
  | { type: "remove"; slug: string }
  | { type: "clear" };

export type StoreCartLine = {
  product: StoreProduct;
  quantity: number;
  lineTotalKopeks: number;
};

export type DerivedStoreCart = {
  lines: StoreCartLine[];
  count: number;
  subtotalKopeks: number;
};

export const STORE_CATEGORIES = [
  { value: "all", label: "Все" },
  { value: "books", label: "Книги" },
  { value: "workbooks", label: "Прописи и тетради" },
  { value: "cards", label: "Карточки" },
  { value: "stationery", label: "Канцелярия" },
  { value: "toys", label: "Игры и игрушки" },
] as const satisfies readonly { value: StoreCategory; label: string }[];

export const DEFAULT_STORE_FILTERS: StoreFilters = {
  category: "all",
  query: "",
  sort: "popular",
};

export const STORE_PRODUCTS: readonly StoreProduct[] = [
  {
    id: "store-product-001",
    slug: "propisi-pervye-kitaiskie-ieroglify",
    title: "Прописи «Первые китайские иероглифы»",
    description:
      "Пошаговая тетрадь с базовыми чертами, сеткой мицзыгэ и 80 иероглифами для первого года обучения.",
    category: "workbooks",
    audience: "learner",
    tags: ["китайский язык", "иероглифы", "каллиграфия", "для ребёнка"],
    priceKopeks: 59000,
    popularity: 100,
    images: [
      {
        src: "/store/products/propisi-pervye-kitaiskie-ieroglify/cover.webp",
        alt: "Голубая обложка прописей с крупным иероглифом 永 на светлом фоне",
      },
      {
        src: "/store/products/propisi-pervye-kitaiskie-ieroglify/detail-01.webp",
        alt: "Разворот прописей с упражнениями для иероглифов 水 и 人 и схемами порядка черт",
      },
      {
        src: "/store/products/propisi-pervye-kitaiskie-ieroglify/detail-02.webp",
        alt: "Открытые прописи с упражнениями для 永, 一, 二, 三 и 十 рядом с голубой обложкой",
      },
    ],
  },
  {
    id: "store-product-002",
    slug: "tetrad-mitszyge-48-listov",
    title: "Тетрадь мицзыгэ для каллиграфии",
    description:
      "48 плотных листов с крупной разметкой для аккуратной тренировки китайских черт и ключей.",
    category: "workbooks",
    audience: "learner",
    tags: ["китайский язык", "письмо", "мицзыгэ", "тетрадь"],
    priceKopeks: 39000,
    popularity: 82,
    images: [
      {
        src: "/store/products/tetrad-mitszyge-48-listov/cover.webp",
        alt: "Бежевая обложка тетради мицзыгэ с сеткой и крупным иероглифом 永",
      },
      {
        src: "/store/products/tetrad-mitszyge-48-listov/detail-01.webp",
        alt: "Разворот тетради с базовыми штрихами, сетками и упражнениями для 永, 木, 水, 火 и 山",
      },
    ],
  },
  {
    id: "store-product-003",
    slug: "uchebnik-kitaiskii-dlya-detei-start",
    title: "Китайский для детей. Первый учебник",
    description:
      "Иллюстрированный вводный курс с короткими диалогами, понятными заданиями и темами из повседневной жизни.",
    category: "books",
    audience: "learner",
    tags: ["китайский язык", "учебник", "начальный уровень", "детям"],
    priceKopeks: 89000,
    popularity: 94,
    images: [
      {
        src: "/store/products/uchebnik-kitaiskii-dlya-detei-start/cover.webp",
        alt: "Зелёная обложка первого учебника китайского для детей с надписью 你好",
      },
      {
        src: "/store/products/uchebnik-kitaiskii-dlya-detei-start/detail-01.webp",
        alt: "Разворот урока знакомства с пандой, драконом, диалогами и письменными упражнениями",
      },
    ],
  },
  {
    id: "store-product-004",
    slug: "metodika-igrovykh-urokov-kitaiskogo",
    title: "Методика игровых уроков китайского",
    description:
      "Практическая книга для преподавателя: 36 игр, готовые сценарии и подсказки по работе с детскими группами.",
    category: "books",
    audience: "teacher",
    tags: ["методика", "преподавателю", "сценарии уроков", "игры"],
    priceKopeks: 129000,
    popularity: 88,
    images: [
      {
        src: "/store/products/metodika-igrovykh-urokov-kitaiskogo/cover.webp",
        alt: "Бежевая обложка методики игровых уроков с кубиком, карточками и репликой 你好",
      },
      {
        src: "/store/products/metodika-igrovykh-urokov-kitaiskogo/detail-01.webp",
        alt: "Разворот урока «Моя семья» со структурой занятия, лексикой, игрой и рефлексией",
      },
    ],
  },
  {
    id: "store-product-005",
    slug: "kartochki-100-kitaiskikh-slov",
    title: "Карточки «100 первых китайских слов»",
    description:
      "Двусторонние карточки с иероглифом, пиньинем и яркой иллюстрацией для игр и повторения.",
    category: "cards",
    audience: "learner",
    tags: ["слова", "пиньинь", "лексика", "карточки"],
    priceKopeks: 49000,
    popularity: 97,
    images: [
      {
        src: "/store/products/kartochki-100-kitaiskikh-slov/cover.webp",
        alt: "Закрытая розовая коробка карточек «100 первых китайских слов» с иероглифом 水",
      },
      {
        src: "/store/products/kartochki-100-kitaiskikh-slov/detail-01.webp",
        alt: "Розовая коробка и набор карточек со словами «вода», «рот» и «человек»",
      },
    ],
  },
  {
    id: "store-product-006",
    slug: "kartochki-kliuchi-kitaiskikh-ieroglifov",
    title: "Карточки «Ключи китайских иероглифов»",
    description:
      "Набор из 60 крупных карточек для объяснения радикалов у доски и самостоятельной сортировки по темам.",
    category: "cards",
    audience: "teacher",
    tags: ["ключи", "радикалы", "наглядные материалы", "урок"],
    priceKopeks: 69000,
    popularity: 76,
    images: [
      {
        src: "/store/products/kartochki-kliuchi-kitaiskikh-ieroglifov/cover.webp",
        alt: "Закрытая сиреневая коробка карточек «Ключи китайских иероглифов» с ключом 氵",
      },
      {
        src: "/store/products/kartochki-kliuchi-kitaiskikh-ieroglifov/detail-01.webp",
        alt: "Открытая коробка и разложенные карточки с ключами 氵, 亻, 女, 木 и 口",
      },
    ],
  },
  {
    id: "store-product-007",
    slug: "kantselyarskii-nabor-yunyi-kalligraf",
    title: "Канцелярский набор «Юный каллиграф»",
    description:
      "Кисти, тушь, маркеры, прописи, линейка и карточки — всё необходимое для первых занятий каллиграфией.",
    category: "stationery",
    audience: "learner",
    tags: ["канцелярия", "каллиграфия", "кисти", "прописи"],
    priceKopeks: 75000,
    popularity: 71,
    images: [
      {
        src: "/store/products/kantselyarskii-nabor-yunyi-kalligraf/cover.webp",
        alt: "Набор для каллиграфии с коробкой, тушью, кистями, маркерами, прописями, линейкой и карточками",
      },
      {
        src: "/store/products/kantselyarskii-nabor-yunyi-kalligraf/detail-01.webp",
        alt: "Открытые прописи, коробка набора, тушь, кисти, маркеры и листы с упражнениями",
      },
    ],
  },
  {
    id: "store-product-008",
    slug: "markery-kistochki-dlya-kalligrafii",
    title: "Маркеры-кисточки для каллиграфии",
    description:
      "Шесть маркеров с упругим наконечником для тренировки нажима, красивых черт и творческих работ.",
    category: "stationery",
    audience: "learner",
    tags: ["маркеры", "кисти", "каллиграфия", "рисование"],
    priceKopeks: 109000,
    popularity: 65,
    images: [
      {
        src: "/store/products/markery-kistochki-dlya-kalligrafii/cover.webp",
        alt: "Шесть маркеров-кисточек с цветными наконечниками в прозрачной упаковке",
      },
      {
        src: "/store/products/markery-kistochki-dlya-kalligrafii/detail-01.webp",
        alt: "Маркеры рядом с упаковкой и рука, пишущая иероглиф 永 на листе для практики",
      },
    ],
  },
  {
    id: "store-product-009",
    slug: "igra-soberi-ieroglif",
    title: "Обучающая игра «Собери иероглиф»",
    description:
      "Настольная игра с деревянными элементами: дети собирают знаки из ключей и объясняют их значение.",
    category: "toys",
    audience: "learner",
    tags: ["настольная игра", "деревянные детали", "иероглифы", "семья"],
    priceKopeks: 149000,
    popularity: 91,
    images: [
      {
        src: "/store/products/igra-soberi-ieroglif/cover.webp",
        alt: "Зелёная коробка игры и плитки с иероглифами, включая собранный из четырёх частей 好",
      },
      {
        src: "/store/products/igra-soberi-ieroglif/detail-01.webp",
        alt: "Разложенные светлые плитки с китайскими знаками и собранный из четырёх частей иероглиф 好 в центре",
      },
    ],
  },
];

const storeTitleCollator = new Intl.Collator("ru-RU", {
  numeric: true,
  sensitivity: "base",
});

const knownStoreProductSlugs = new Set(
  STORE_PRODUCTS.map((product) => product.slug),
);

function normalizeStoreSearchValue(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function filterAndSortStoreProducts(
  products: readonly StoreProduct[],
  filters: StoreFilters,
): StoreProduct[] {
  const queryTokens = normalizeStoreSearchValue(filters.query).split(" ");
  const hasQuery = queryTokens[0]?.length > 0;

  const filtered = products.filter((product) => {
    const searchValue = normalizeStoreSearchValue(
      [product.title, product.description, ...product.tags].join(" "),
    );
    const matchesQuery =
      !hasQuery || queryTokens.every((token) => searchValue.includes(token));

    return (
      matchesQuery &&
      (filters.category === "all" || product.category === filters.category)
    );
  });

  return filtered.sort((left, right) => {
    if (filters.sort === "price-asc") {
      return (
        left.priceKopeks - right.priceKopeks ||
        storeTitleCollator.compare(left.title, right.title) ||
        left.id.localeCompare(right.id)
      );
    }

    if (filters.sort === "price-desc") {
      return (
        right.priceKopeks - left.priceKopeks ||
        storeTitleCollator.compare(left.title, right.title) ||
        left.id.localeCompare(right.id)
      );
    }

    if (filters.sort === "title") {
      return (
        storeTitleCollator.compare(left.title, right.title) ||
        left.id.localeCompare(right.id)
      );
    }

    return (
      right.popularity - left.popularity ||
      storeTitleCollator.compare(left.title, right.title) ||
      left.id.localeCompare(right.id)
    );
  });
}

export function storeCategoryCounts(
  products: readonly StoreProduct[] = STORE_PRODUCTS,
): Record<StoreCategory, number> {
  const counts: Record<StoreCategory, number> = {
    all: products.length,
    books: 0,
    workbooks: 0,
    cards: 0,
    stationery: 0,
    toys: 0,
  };

  for (const product of products) {
    counts[product.category] += 1;
  }

  return counts;
}

function hasCartEntry(state: StoreCartState, slug: string) {
  return Object.prototype.hasOwnProperty.call(state, slug);
}

export function storeCartReducer(
  state: StoreCartState,
  action: StoreCartAction,
): StoreCartState {
  if (action.type === "clear") {
    return Object.keys(state).length === 0 ? state : {};
  }

  if (!knownStoreProductSlugs.has(action.slug)) return state;

  const currentQuantity = state[action.slug] ?? 0;

  if (action.type === "add" || action.type === "increment") {
    if (currentQuantity >= 99) return state;
    return { ...state, [action.slug]: Math.min(currentQuantity + 1, 99) };
  }

  if (action.type === "remove") {
    if (!hasCartEntry(state, action.slug)) return state;
    const nextState = { ...state };
    delete nextState[action.slug];
    return nextState;
  }

  if (currentQuantity <= 0) return state;

  if (currentQuantity === 1) {
    const nextState = { ...state };
    delete nextState[action.slug];
    return nextState;
  }

  return { ...state, [action.slug]: currentQuantity - 1 };
}

function normalizedCartQuantity(quantity: number) {
  if (!Number.isFinite(quantity)) return 0;
  return Math.max(0, Math.min(99, Math.floor(quantity)));
}

export function deriveStoreCart(
  state: StoreCartState,
  products: readonly StoreProduct[] = STORE_PRODUCTS,
): DerivedStoreCart {
  const lines: StoreCartLine[] = [];
  let count = 0;
  let subtotalKopeks = 0;

  for (const product of products) {
    const quantity = normalizedCartQuantity(state[product.slug] ?? 0);
    if (quantity === 0) continue;

    const lineTotalKopeks = product.priceKopeks * quantity;
    lines.push({ product, quantity, lineTotalKopeks });
    count += quantity;
    subtotalKopeks += lineTotalKopeks;
  }

  return { lines, count, subtotalKopeks };
}

const rubleNumberFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatStorePrice(kopeks: number) {
  return `${rubleNumberFormatter.format(kopeks / 100)}\u00a0₽`;
}

export function formatStoreProductCount(count: number) {
  const absoluteCount = Math.abs(count);
  const mod10 = absoluteCount % 10;
  const mod100 = absoluteCount % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} товар`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} товара`;
  }
  return `${count} товаров`;
}
