export type ProductTableSortDirection = "asc" | "desc";

export type ProductTableSortState<TKey extends string> = {
  key: TKey;
  direction: ProductTableSortDirection;
};

export function nextProductTableSort<TKey extends string>(
  current: ProductTableSortState<TKey> | null | undefined,
  key: TKey,
): ProductTableSortState<TKey> {
  if (!current || current.key !== key) {
    return { key, direction: "asc" };
  }

  return {
    key,
    direction: current.direction === "asc" ? "desc" : "asc",
  };
}
