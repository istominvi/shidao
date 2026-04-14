import { type ReactNode } from "react";
import { TopNav } from "@/components/top-nav";
import { Chip } from "@/components/ui/chip";

type DashboardShellProps = {
  title: string;
  subtitle: string;
  roleLabel: string;
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
  return (
    <main className="pb-10">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-6 md:py-8">
        <section className="dashboard-hero product-hero-card relative z-0">
          <Chip
            tone={roleToneClass[roleTone]}
            className="w-fit text-xs uppercase tracking-[0.16em]"
          >
            {roleLabel}
          </Chip>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.03em] md:text-6xl">
            {title}
          </h1>
          <p className="mt-3 max-w-[62ch] text-sm text-neutral-700 md:text-base">
            {subtitle}
          </p>
          <div className="mt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
