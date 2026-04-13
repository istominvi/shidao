import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { classNames } from "@/lib/ui/classnames";

export function ProductTable({ className, ...props }: ComponentPropsWithoutRef<"table">) {
  return (
    <table
      className={classNames("min-w-full table-fixed text-left text-sm", className)}
      {...props}
    />
  );
}

export function ProductTableHead({ className, ...props }: ComponentPropsWithoutRef<"thead">) {
  return (
    <thead
      className={classNames(
        "bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500",
        className,
      )}
      {...props}
    />
  );
}

export function ProductTableHeaderRow({ className, ...props }: ComponentPropsWithoutRef<"tr">) {
  return <tr className={classNames("h-10", className)} {...props} />;
}

export function ProductTableBody({ className, ...props }: ComponentPropsWithoutRef<"tbody">) {
  return <tbody className={classNames(className)} {...props} />;
}

export function ProductTableRow({ className, ...props }: ComponentPropsWithoutRef<"tr">) {
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

export function ProductTableHeaderCell({ className, ...props }: ComponentPropsWithoutRef<"th">) {
  return <th className={classNames("px-4 py-0 align-middle", className)} {...props} />;
}

export function ProductTableCell({ className, ...props }: ComponentPropsWithoutRef<"td">) {
  return <td className={classNames("px-4 py-0 align-middle text-neutral-700", className)} {...props} />;
}

export function ProductTableTruncate({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return <span className={classNames("block truncate", className)} {...props} />;
}

export function ProductTableEmptyState({ text, className }: { text: ReactNode; className?: string }) {
  return <p className={classNames("px-4 py-4 text-sm text-neutral-500", className)}>{text}</p>;
}
