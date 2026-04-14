import { type ReactNode } from "react";
import { AppPageHeader } from "@/components/app/page-header";
import { TopNav } from "@/components/top-nav";
import { SettingsNavigation } from "@/components/settings-navigation";

type SettingsShellProps = {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function SettingsShell({
  eyebrow,
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
          <AppPageHeader
            eyebrow={eyebrow}
            title={title}
            description={description}
          />
          {children}
        </div>
      </section>
    </main>
  );
}
