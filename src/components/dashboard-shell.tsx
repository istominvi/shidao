import { type ReactNode } from "react";
import { TopNav } from "@/components/top-nav";
import { Chip } from "@/components/ui/chip";

type DashboardShellProps = {
  title?: string;
  subtitle?: string;
  roleLabel?: string;
  roleTone?: "parent" | "teacher" | "student";
  children: ReactNode;
};

const roleToneClass: Record<
  NonNullable<DashboardShellProps["roleTone"]>,
  "amber" | "sky" | "violet"
> = {
  parent: "amber",
  teacher: "sky",
  student: "violet",
};

export function DashboardShell({
  title,
  subtitle,
  roleLabel,
  roleTone = "parent",
  children,
}: DashboardShellProps) {
  const normalizedRoleLabel = roleLabel?.trim() ?? "";
  const normalizedTitle = title?.trim() ?? "";
  const normalizedSubtitle = subtitle?.trim() ?? "";
  const hasHeroHeader = Boolean(normalizedRoleLabel || normalizedTitle || normalizedSubtitle);

  return (
    <main className="pb-10">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-6 md:py-8">
        <section className="dashboard-hero product-hero-card relative z-0">
          {normalizedRoleLabel ? (
            <Chip
              tone={roleToneClass[roleTone]}
              className="w-fit text-xs uppercase tracking-[0.16em]"
            >
              {normalizedRoleLabel}
            </Chip>
          ) : null}
          {normalizedTitle ? (
            <h1 className="mt-4 text-4xl font-black tracking-[-0.03em] md:text-6xl">
              {normalizedTitle}
            </h1>
          ) : null}
          {normalizedSubtitle ? (
            <p className="mt-3 max-w-[62ch] text-sm text-neutral-700 md:text-base">
              {normalizedSubtitle}
            </p>
          ) : null}
          <div className={hasHeroHeader ? "mt-6" : undefined}>{children}</div>
        </section>
      </div>
    </main>
  );
}
