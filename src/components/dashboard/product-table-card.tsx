import type { ReactNode } from "react";
import { AppCard } from "@/components/app/app-card";

type ProductTableCardProps = {
  title?: string;
  controls?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
};

export function ProductTableCard({
  title,
  controls,
  headerAction,
  children,
}: ProductTableCardProps) {
  const hasTitle = Boolean(title);

  return (
    <AppCard className="p-4 md:p-5">
      {title || headerAction ? (
        <div className={`flex items-center gap-3 ${hasTitle ? "justify-between" : "justify-start"}`}>
          {title ? <h2 className="text-xl font-black text-neutral-950">{title}</h2> : null}
          {headerAction}
        </div>
      ) : null}
      {controls ? <div className={title || headerAction ? "mt-4" : undefined}>{controls}</div> : null}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white/95">
        {children}
      </div>
    </AppCard>
  );
}
