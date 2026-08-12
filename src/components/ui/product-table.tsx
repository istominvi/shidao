import { ArrowDown, ArrowUp } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { ProductTableSortDirection } from "@/components/ui/product-table-sort";
import { classNames } from "@/lib/ui/classnames";

export {
  nextProductTableSort,
  type ProductTableSortDirection,
  type ProductTableSortState,
} from "@/components/ui/product-table-sort";

export function ProductTable({
  className,
  ...props
}: ComponentPropsWithoutRef<"table">) {
  return (
    <table
      className={classNames(
        "product-table min-w-full table-fixed text-left text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function ProductTableHead({
  className,
  ...props
}: ComponentPropsWithoutRef<"thead">) {
  return (
    <thead
      className={classNames(
        "bg-white text-xs uppercase tracking-wide text-neutral-500",
        className,
      )}
      {...props}
    />
  );
}

export function ProductTableHeaderRow({
  className,
  ...props
}: ComponentPropsWithoutRef<"tr">) {
  return <tr className={classNames("h-10", className)} {...props} />;
}

export function ProductTableBody({
  className,
  ...props
}: ComponentPropsWithoutRef<"tbody">) {
  return <tbody className={classNames(className)} {...props} />;
}

export function ProductTableRow({
  className,
  ...props
}: ComponentPropsWithoutRef<"tr">) {
  return (
    <tr
      className={classNames(
        "h-10 border-t border-neutral-200 transition hover:bg-sky-50/45",
        className,
      )}
      {...props}
    />
  );
}

export function ProductTableHeaderCell({
  className,
  ...props
}: ComponentPropsWithoutRef<"th">) {
  return (
    <th
      className={classNames("px-4 py-0 align-middle", className)}
      {...props}
    />
  );
}

type ProductTableSortableHeaderCellProps = Omit<
  ComponentPropsWithoutRef<"th">,
  "aria-sort"
> & {
  direction: ProductTableSortDirection | null;
  onSort: () => void;
  buttonClassName?: string;
};

export function ProductTableSortableHeaderCell({
  children,
  className,
  buttonClassName,
  direction,
  onSort,
  ...props
}: ProductTableSortableHeaderCellProps) {
  const ariaSort =
    direction === "asc"
      ? "ascending"
      : direction === "desc"
        ? "descending"
        : "none";
  const SortIcon =
    direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : null;

  return (
    <ProductTableHeaderCell
      {...props}
      className={classNames("product-table-sortable-header-cell", className)}
      aria-sort={ariaSort}
    >
      <button
        type="button"
        className={classNames(
          "product-table-sort-button inline-flex h-full w-full items-center gap-1.5 bg-transparent text-left text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900/60",
          buttonClassName,
        )}
        onClick={onSort}
      >
        <span className="min-w-0 truncate">{children}</span>
        {SortIcon ? (
          <SortIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : null}
      </button>
    </ProductTableHeaderCell>
  );
}

export function ProductTableCell({
  className,
  ...props
}: ComponentPropsWithoutRef<"td">) {
  return (
    <td
      className={classNames(
        "px-4 py-0 align-middle text-sm font-normal text-neutral-700",
        className,
      )}
      {...props}
    />
  );
}

export function ProductTablePrimaryCell({
  className,
  ...props
}: ComponentPropsWithoutRef<"td">) {
  return (
    <ProductTableCell
      className={classNames("text-neutral-950", className)}
      {...props}
    />
  );
}

export function ProductTableActionCell({
  className,
  ...props
}: ComponentPropsWithoutRef<"td">) {
  return (
    <ProductTableCell
      className={classNames(
        "product-table-action-cell whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

export function productTableActionLinkClassName(className?: string) {
  return classNames(
    "inline-flex items-center text-sm font-medium text-sky-700 underline underline-offset-2 transition-colors hover:text-sky-800",
    className,
  );
}

export function ProductTableTruncate({
  className,
  ...props
}: ComponentPropsWithoutRef<"span">) {
  return (
    <span className={classNames("block truncate", className)} {...props} />
  );
}

export function ProductTableEmptyState({
  text,
  className,
}: {
  text: ReactNode;
  className?: string;
}) {
  return (
    <p className={classNames("px-4 py-4 text-sm text-neutral-500", className)}>
      {text}
    </p>
  );
}
