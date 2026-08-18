import { type ReactNode } from "react";
import { TopNav } from "@/components/top-nav";
import { Chip } from "@/components/ui/chip";

type ProductShellProps = {
  children: ReactNode;
  contentClassName?: string;
};

export function ProductShell({
  children,
  contentClassName,
}: ProductShellProps) {
  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <section className={`container mt-6 ${contentClassName ?? ""}`.trim()}>
        {children}
      </section>
    </main>
  );
}

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageHero({ eyebrow, title, description }: PageHeroProps) {
  return (
    <header className="product-hero-card">
      <Chip
        tone="neutral"
        className="w-fit bg-white/85 text-xs uppercase tracking-[0.14em] text-neutral-700"
      >
        {eyebrow}
      </Chip>
      <h1 className="mt-4 text-4xl font-black leading-[0.95] tracking-[-0.03em] text-neutral-950 md:text-6xl">
        {title}
      </h1>
      <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-neutral-700 md:text-base">
        {description}
      </p>
    </header>
  );
}

export function StatusMessage({
  kind,
  children,
}: {
  kind: "error" | "success" | "info";
  children: ReactNode;
}) {
  const tone =
    kind === "error"
      ? "border-rose-200/80 bg-rose-100/85 text-rose-900"
      : kind === "success"
        ? "border-lime-200/80 bg-lime-100/85 text-lime-900"
        : "border-sky-200/80 bg-sky-100/85 text-sky-900";

  return (
    <p className={`rounded-2xl border px-4 py-3 text-sm ${tone}`}>{children}</p>
  );
}
