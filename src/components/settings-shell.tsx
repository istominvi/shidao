import { type ReactNode } from "react";
import { TopNav } from "@/components/top-nav";
import { SettingsNavigation } from "@/components/settings-navigation";

type SettingsShellProps = {
  badgeClassName: string;
  badgeLabel: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function SettingsShell({
  badgeClassName,
  badgeLabel,
  title,
  description,
  children,
}: SettingsShellProps) {
  return (
    <main>
      <TopNav />
      <section className="container mt-8 grid gap-4 pb-12 md:grid-cols-[280px_minmax(0,1fr)]">
        <SettingsNavigation />

        <div className="glass rounded-3xl p-6 md:p-8">
          <p className={`chip ${badgeClassName}`}>{badgeLabel}</p>
          <h1 className="mt-4 text-3xl font-black">{title}</h1>
          <p className="mt-2 text-sm text-neutral-600">{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
