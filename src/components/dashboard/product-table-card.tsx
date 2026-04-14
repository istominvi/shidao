import type { ReactNode } from "react";
import { SurfaceCard } from "@/components/ui/surface-card";

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
    <SurfaceCard
      title={title ? <span className="text-xl font-black">{title}</span> : undefined}
      actions={headerAction}
    >
      {controls ? <div>{controls}</div> : null}
      <div className={hasTitle || headerAction || controls ? "mt-4" : undefined}>
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white/95">
          {children}
        </div>
      </div>
    </SurfaceCard>
  );
}
