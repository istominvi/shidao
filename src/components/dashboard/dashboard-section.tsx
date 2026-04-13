import { type ReactNode } from "react";

type DashboardSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function DashboardSection({
  title,
  description,
  children,
}: DashboardSectionProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-5">
      <header>
        <h3 className="text-lg font-bold text-neutral-900">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm text-neutral-600">{description}</p>
        ) : null}
      </header>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function DashboardEmptyState({ children }: { children: ReactNode }) {
  return <p className="text-sm text-neutral-600">{children}</p>;
}
