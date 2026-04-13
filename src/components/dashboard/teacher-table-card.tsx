import type { ReactNode } from "react";
import { AppCard } from "@/components/app/app-card";
import { ProductTableEmptyState } from "@/components/ui/product-table";

type TeacherTableCardProps = {
  title?: string;
  controls?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
};

type TeacherTableEmptyStateProps = {
  text: string;
};

export function TeacherTableCard({
  title,
  controls,
  headerAction,
  children,
}: TeacherTableCardProps) {
  return (
    <AppCard className="p-4 md:p-5">
      {title || headerAction ? (
        <div className="flex items-center justify-between gap-3">
          {title ? <h2 className="text-xl font-black text-neutral-950">{title}</h2> : <span />}
          {headerAction}
        </div>
      ) : null}
      {controls ? <div className="mt-4">{controls}</div> : null}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white/95">
        {children}
      </div>
    </AppCard>
  );
}

export function TeacherTableEmptyState({ text }: TeacherTableEmptyStateProps) {
  return <ProductTableEmptyState text={text} />;
}
