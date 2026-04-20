import type { ReactNode } from "react";
import { SurfaceCard } from "@/components/ui/surface-card";

type ProductTableCardProps = {
  title?: string;
  controls?: ReactNode;
  headerAction?: ReactNode;
  contentShellClassName?: string;
  children: ReactNode;
};

export function ProductTableCard({
  title,
  controls,
  headerAction,
  contentShellClassName,
  children,
}: ProductTableCardProps) {
  const hasTitle = Boolean(title);
  const tableTopSpacing = controls ? "mt-5" : hasTitle || headerAction ? "mt-4" : undefined;

  return (
    <SurfaceCard
      title={title}
      actions={headerAction}
    >
      {controls ? <div>{controls}</div> : null}
      <div className={tableTopSpacing}>
        <div className={contentShellClassName ?? "overflow-x-auto rounded-2xl border border-neutral-200 bg-white/95"}>
          {children}
        </div>
      </div>
    </SurfaceCard>
  );
}
